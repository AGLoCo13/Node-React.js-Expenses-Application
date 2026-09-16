/**
 * ============================================================
 * ThingsBoard proxy — building/apartment telemetry
 * ============================================================
 * Backs GET /api/buildings/:id/telemetry/fuel and
 * GET /api/apartments/:id/telemetry/temperature. Talks to ThingsBoard's
 * REST API using the same tenant-admin account the IoT provisioning job
 * uses (iot-credentials Secret) — read-only calls, no new account needed.
 *
 * Resilience:
 *   PATTERN: CIRCUIT BREAKER (thingsboardBreaker). ThingsBoard down ->
 *   fast-fail with a typed error, route answers 503.
 *
 * Caching: 5s in-memory per (deviceName, key) — matches the frontend
 * polling interval (5-10s), avoids hammering the TB REST API and JWT
 * login on every request.
 *
 * Config:
 *   THINGSBOARD_URL   default http://thingsboard:9090 (in-cluster service)
 *   TB_USERNAME / TB_PASSWORD  from Secret iot-credentials (same as
 *   the provisioning job — tb-username/tb-password keys)
 * ============================================================
 */
const { createBreaker } = require('../resilience/circuitBreaker');

const TB_URL = process.env.THINGSBOARD_URL || 'http://thingsboard:9090';
const TB_USERNAME = process.env.TB_USERNAME;
const TB_PASSWORD = process.env.TB_PASSWORD;
const CACHE_MS = 5000;

let jwt = null;
let jwtExpiresAt = 0;
const cache = new Map(); // `${deviceName}:${key}` -> { value, cachedAt }

async function login() {
    const res = await fetch(`${TB_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TB_USERNAME, password: TB_PASSWORD }),
    });
    if (!res.ok) {
        const err = new Error(`ThingsBoard login failed: ${res.status}`);
        err.status = res.status;
        throw err;
    }
    const body = await res.json();
    jwt = body.token;
    // TB access tokens are ~2.5h by default; refresh a bit early.
    jwtExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
    return jwt;
}

async function authedFetch(path) {
    if (!jwt || Date.now() > jwtExpiresAt) {
        await login();
    }
    let res = await fetch(`${TB_URL}${path}`, { headers: { 'X-Authorization': `Bearer ${jwt}` } });
    if (res.status === 401) {
        // Token expired server-side before our local clock thought so — one retry after fresh login.
        await login();
        res = await fetch(`${TB_URL}${path}`, { headers: { 'X-Authorization': `Bearer ${jwt}` } });
    }
    if (!res.ok) {
        const err = new Error(`ThingsBoard API ${path} -> ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function resolveDeviceId(deviceName) {
    const found = await authedFetch(`/api/tenant/devices?deviceName=${encodeURIComponent(deviceName)}`);
    if (!found || !found.id) {
        const err = new Error(`ThingsBoard device not found: ${deviceName}`);
        err.status = 404;
        throw err;
    }
    return found.id.id;
}

async function fetchLatestTelemetry(deviceName, key) {
    const deviceId = await resolveDeviceId(deviceName);
    const data = await authedFetch(`/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${encodeURIComponent(key)}`);
    const points = data && data[key];
    if (!points || !points.length) return null;
    return { value: Number(points[0].value), ts: points[0].ts };
}

const thingsboardBreaker = createBreaker(
    fetchLatestTelemetry,
    'ThingsBoard-Telemetry',
    {
        timeout: 5000,
        resetTimeout: 20000,
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
        errorFilter: (err) => Boolean(err && err.status && err.status < 500 && err.status !== 401),
    }
);

async function getLatestTelemetry(deviceName, key) {
    const cacheKey = `${deviceName}:${key}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_MS) return cached.value;
    try {
        const value = await thingsboardBreaker.fire(deviceName, key);
        cache.set(cacheKey, { value, cachedAt: Date.now() });
        return value;
    } catch (err) {
        if (err && err.code === 'EOPENBREAKER') {
            const e = new Error('ThingsBoard circuit OPEN — telemetry unreachable');
            e.circuitOpen = true;
            throw e;
        }
        throw err;
    }
}

module.exports = { getLatestTelemetry, thingsboardBreaker, TB_URL };
