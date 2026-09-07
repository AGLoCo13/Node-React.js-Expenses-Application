/**
 * ============================================================
 * A6 - Alarm Ingestion: RabbitMQ 'building-alarms' -> Notification
 * ============================================================
 * The ThingsBoard rule chain publishes an alarm to the building-alarms queue.
 * This service turns that message into notifications for the people who care:
 * the building administrator always, plus the tenant of the affected apartment
 * for anything measured inside their flat.
 *
 * Two message shapes are accepted on purpose:
 *
 *   1. ENRICHED (what the rule chain sends after the "Enrich Alarm" node):
 *      { alarmId, type: "High Temperature", status: "ACTIVE"|"CLEARED",
 *        severity: "CRITICAL", deviceName: "Ap2 Thermostat", value, startTs }
 *      Here one message = one alarm transition, so the alarm id + status is a
 *      natural dedupe key.
 *
 *   2. RAW TELEMETRY (what the older chain sent straight off the filter nodes):
 *      { temperature: 29.4 }  or  { fuel: 15 }
 *      There is no device identity and a message arrives on every tick while
 *      the condition holds, so the type is inferred from the field present and
 *      the dedupe key falls back to a time window (ALARM_DEDUPE_WINDOW_MS).
 *
 * Keeping both means a rule-chain rollback cannot silence notifications; it
 * only makes them coarser.
 *
 * Errors are typed so the consumer knows what to do with the message:
 *   AlarmValidationError (permanent) -> dead-letter it, never retry
 *   err.retryable === true           -> requeue once (e.g. MongoDB still down)
 * ============================================================
 */
const mongoose = require('mongoose');

const Notification = require('../models/notification');
const Building     = require('../models/building');
const Apartment    = require('../models/apartment');
const Profile      = require('../models/profile');

const { alarmsProcessed } = require('../middleware/metrics');

// Raw-telemetry fallback: collapse everything inside this window into one
// notification. 10 minutes at a 5s telemetry rate turns 120 messages into 1.
const DEDUPE_WINDOW_MS = parseInt(process.env.ALARM_DEDUPE_WINDOW_MS, 10) || 10 * 60 * 1000;

// Optional explicit pairing, e.g.
//   IOT_DEVICE_MAP={"Ap2 Thermostat":{"apartment":"B1"},"Building A Fuel Tank":{"buildingAddress":"Χαροκόπου 3"}}
// Without it the resolver falls back to the floor number in the device name.
function deviceMap() {
    if (!process.env.IOT_DEVICE_MAP) return {};
    try {
        return JSON.parse(process.env.IOT_DEVICE_MAP);
    } catch (e) {
        console.warn('[alarms] IOT_DEVICE_MAP is not valid JSON, ignoring:', e.message);
        return {};
    }
}

class AlarmValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AlarmValidationError';
        this.permanent = true;
    }
}

/** ThingsBoard alarm type -> the enum on the Notification model. */
function classify(rawType) {
    const t = String(rawType || '').toLowerCase();
    if (t.includes('temp')) return 'high_temperature';
    if (t.includes('fuel') || t.includes('oil')) return 'low_fuel';
    if (t.includes('batter')) return 'battery_low';
    if (t.includes('offline') || t.includes('inactiv')) return 'sensor_offline';
    return null;
}

function severityOf(raw, status) {
    if (String(status).toUpperCase() === 'CLEARED') return 'info';
    const s = String(raw || '').toUpperCase();
    if (s.includes('CRITICAL')) return 'critical';
    if (s.includes('MAJOR') || s.includes('MINOR') || s.includes('WARNING')) return 'warning';
    return 'critical';   // an alarm that reached the queue is not an FYI
}

function numeric(...candidates) {
    for (const c of candidates) {
        const n = Number(c);
        if (c !== null && c !== undefined && c !== '' && Number.isFinite(n)) return n;
    }
    return null;
}

/**
 * Bring either message shape to one internal form. Throws AlarmValidationError
 * for anything we cannot act on — that message is poison, not unlucky.
 */
function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new AlarmValidationError('payload is not a JSON object');
    }

    const deviceName = raw.deviceName || raw.device || raw.originatorName || null;
    const details    = (raw.details && typeof raw.details === 'object') ? raw.details : {};

    // ── Shape 1: enriched alarm event ─────────────────────────────────────
    if (typeof raw.type === 'string' && raw.type.trim()) {
        const type = classify(raw.type);
        if (!type) throw new AlarmValidationError(`unrecognised alarm type "${raw.type}"`);

        const status  = String(raw.status || (raw.cleared ? 'CLEARED' : 'ACTIVE')).toUpperCase();
        const alarmId = raw.alarmId || (raw.id && (raw.id.id || raw.id)) || null;
        const ts      = numeric(raw.startTs, raw.ts, Date.now());
        const value   = numeric(raw.value, raw.temperature, raw.fuel, details.temperature, details.fuel);

        return {
            type, status, deviceName, alarmId, value, ts,
            severity: severityOf(raw.severity, status),
            // Alarm id + status is stable across redeliveries and unique per
            // transition, which is exactly the deduplication we want.
            dedupeKey: alarmId
                ? `${alarmId}:${status}`
                : `${type}:${deviceName || 'unknown'}:${status}:${ts}`,
            raw,
        };
    }

    // ── Shape 2: raw telemetry off the filter nodes ───────────────────────
    const temperature = numeric(raw.temperature);
    const fuel        = numeric(raw.fuel);
    if (temperature === null && fuel === null) {
        throw new AlarmValidationError('no alarm type and no temperature/fuel field');
    }

    const type  = temperature !== null ? 'high_temperature' : 'low_fuel';
    const value = temperature !== null ? temperature : fuel;
    const ts    = numeric(raw.ts, Date.now());

    return {
        type, value, ts, deviceName,
        status: 'ACTIVE',
        alarmId: null,
        severity: 'critical',
        // No transition to key off, so collapse by time window instead.
        dedupeKey: `${type}:${deviceName || 'unknown'}:${Math.floor(ts / DEDUPE_WINDOW_MS)}`,
        raw,
    };
}

/** Device -> apartment/building. Explicit map wins, floor number is the fallback. */
async function resolveScope(alarm) {
    const entry = alarm.deviceName ? deviceMap()[alarm.deviceName] : null;
    let apartment = null;

    if (entry && entry.apartment) {
        apartment = await Apartment.findOne({ name: entry.apartment });
    }
    // "Ap2 Thermostat" -> the apartment on floor 2. Fuel tanks are building-wide
    // and deliberately never resolve to an apartment.
    if (!apartment && alarm.type !== 'low_fuel' && alarm.deviceName) {
        const m = /(\d+)/.exec(alarm.deviceName);
        if (m) apartment = await Apartment.findOne({ floor: Number(m[1]) });
    }

    let building = null;
    if (apartment) building = await Building.findById(apartment.building);
    if (!building && entry && entry.buildingAddress) {
        building = await Building.findOne({ address: entry.buildingAddress });
    }
    if (!building) building = await Building.findOne().sort({ _id: 1 });   // single-building demo

    return { apartment, building };
}

/** Who gets told: the administrator, plus the tenant when it happened indoors. */
async function recipients({ apartment, building }, type) {
    const users = new Map();   // userId -> role, so one person is never told twice

    if (building && building.profile) {
        const admin = await Profile.findById(building.profile);
        if (admin && admin.user) users.set(String(admin.user), 'administrator');
    }
    if (apartment && apartment.tenant && type !== 'low_fuel') {
        const tenant = await Profile.findById(apartment.tenant);
        if (tenant && tenant.user) users.set(String(tenant.user), 'tenant');
    }
    return [...users.entries()].map(([user, role]) => ({ user, role }));
}

function describe(alarm, apartment) {
    const where  = apartment ? `apartment ${apartment.name}` : 'the building';
    const cleared = alarm.status === 'CLEARED';

    if (alarm.type === 'high_temperature') {
        const v = alarm.value !== null ? ` (${alarm.value}°C)` : '';
        return cleared
            ? `Temperature back to normal in ${where}${v}.`
            : `High temperature in ${where}${v} — above the 28°C threshold.`;
    }
    if (alarm.type === 'low_fuel') {
        const v = alarm.value !== null ? ` (${alarm.value}%)` : '';
        return cleared
            ? `Heating oil level recovered${v}.`
            : `Low heating oil${v} — below the 20% threshold. Time to reorder.`;
    }
    return `${alarm.type.replace(/_/g, ' ')} reported by ${alarm.deviceName || 'a sensor'}.`;
}

/**
 * Handle one message. Returns a small summary; throws on permanent (validation)
 * or retryable (dependency) failures so the consumer can route the message.
 */
async function handle(raw) {
    let alarm;
    try {
        alarm = normalize(raw);
    } catch (err) {
        alarmsProcessed.inc({ type: 'unknown', outcome: 'invalid' });
        throw err;
    }

    // Nothing can be persisted without Mongo, and that is worth one retry
    // rather than a dead-letter.
    if (mongoose.connection.readyState !== 1) {
        alarmsProcessed.inc({ type: alarm.type, outcome: 'deferred' });
        const err = new Error('MongoDB not connected — alarm deferred');
        err.retryable = true;
        throw err;
    }

    const scope   = await resolveScope(alarm);
    const targets = await recipients(scope, alarm.type);

    if (!targets.length) {
        alarmsProcessed.inc({ type: alarm.type, outcome: 'unmapped' });
        console.warn(`[alarms] ${alarm.type} from ${alarm.deviceName || 'unknown device'}: no recipient could be resolved`);
        return { outcome: 'unmapped', created: 0, deduplicated: 0 };
    }

    const message = describe(alarm, scope.apartment);
    let created = 0, deduplicated = 0;

    for (const target of targets) {
        try {
            await Notification.create({
                user:      target.user,
                building:  scope.building ? scope.building._id : undefined,
                apartment: scope.apartment ? scope.apartment._id : undefined,
                type:      alarm.type,
                severity:  alarm.severity,
                message,
                thingsboardData: alarm.raw,
                dedupeKey: alarm.dedupeKey,
            });
            created++;
        } catch (err) {
            // 11000 = the unique (user, dedupeKey) index did its job.
            if (err && err.code === 11000) deduplicated++;
            else throw err;
        }
    }

    alarmsProcessed.inc({ type: alarm.type, outcome: created ? 'created' : 'deduplicated' });
    console.log(
        `[alarms] ${alarm.type} ${alarm.status}` +
        ` from ${alarm.deviceName || 'unknown device'}` +
        `${scope.apartment ? ` (${scope.apartment.name})` : ''}` +
        ` -> ${created} notification(s), ${deduplicated} deduplicated` +
        ` [key ${alarm.dedupeKey}]`
    );

    return { outcome: created ? 'created' : 'deduplicated', created, deduplicated, message };
}

module.exports = { handle, normalize, describe, AlarmValidationError };
