#!/usr/bin/env node
/**
 * ThingsBoard provisioning (runs as a Kubernetes Job, see thingsboard-provision-job.yaml).
 *
 * Makes the IoT side of UrbanSync declarative: everything a human used to click
 * together in the ThingsBoard UI is created (or updated) from files in git:
 *
 *   1. device profiles  thermostat / fuel-tank, each with its alarm rules
 *        High Temperature: temperature > 28  (cleared at <= 26)
 *        Low Fuel:         fuel < 20          (cleared at >= 30)
 *   2. devices          Ap1/Ap2/Ap3 Thermostat, Building A Fuel Tank
 *                       with FIXED access tokens (Secret iot-credentials) so the
 *                       Node-RED simulator can address them without any lookup
 *   3. root rule chain  root-rule-chain.json (Save telemetry -> filters -> RabbitMQ
 *                       queue building-alarms). RabbitMQ credentials are injected
 *                       from env at import time - the file in git only has ${...}.
 *   4. dashboards       dashboards/*.json; __DEVICE_ID:<name>__ placeholders are
 *                       replaced with the ids of the devices created in step 2.
 *
 * Idempotent: safe to run on every ArgoCD sync. Existing entities are found by
 * name and updated in place; nothing is ever deleted.
 *
 * Env: TB_URL (default http://thingsboard:9090), TB_USERNAME, TB_PASSWORD,
 *      TB_TOKEN_AP1..3, TB_TOKEN_FUEL, RABBITMQ_USER, RABBITMQ_PASS,
 *      ASSETS_DIR (default /provision), WAIT_TIMEOUT_SEC (default 1200).
 * No secret value is ever logged.
 */
const fs   = require('fs');
const path = require('path');

const TB_URL   = (process.env.TB_URL || 'http://thingsboard:9090').replace(/\/$/, '');
const ASSETS   = process.env.ASSETS_DIR || '/provision';
const WAIT_SEC = parseInt(process.env.WAIT_TIMEOUT_SEC, 10) || 1200;

const DEVICES = [
  { name: 'Ap1 Thermostat',      profile: 'thermostat', label: 'Apartment 1', tokenEnv: 'TB_TOKEN_AP1'  },
  { name: 'Ap2 Thermostat',      profile: 'thermostat', label: 'Apartment 2', tokenEnv: 'TB_TOKEN_AP2'  },
  { name: 'Ap3 Thermostat',      profile: 'thermostat', label: 'Apartment 3', tokenEnv: 'TB_TOKEN_AP3'  },
  { name: 'Building A Fuel Tank', profile: 'fuel-tank', label: 'Building A',  tokenEnv: 'TB_TOKEN_FUEL' },
];

// ---------------------------------------------------------------- helpers
const log = (...a) => console.log(new Date().toISOString(), '[tb-provision]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let jwt = null;

async function api(method, p, body, { okStatuses = [200, 201] } = {}) {
  const res = await fetch(TB_URL + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jwt ? { 'X-Authorization': `Bearer ${jwt}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!okStatuses.includes(res.status)) {
    const err = new Error(`${method} ${p} -> ${res.status} ${typeof data === 'object' && data && data.message ? data.message : String(text).slice(0, 200)}`);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function alarmRule(alarmType, key, createOp, createValue, clearOp, clearValue, severity = 'CRITICAL') {
  const cond = (op, value) => ({
    condition: [{
      key: { type: 'TIME_SERIES', key },
      valueType: 'NUMERIC',
      predicate: { type: 'NUMERIC', operation: op, value: { defaultValue: value, dynamicValue: null } },
    }],
    spec: { type: 'SIMPLE' },
  });
  return {
    id: `${key}-${alarmType.toLowerCase().replace(/\s+/g, '-')}`,
    alarmType,
    createRules: { [severity]: { condition: cond(createOp, createValue), schedule: null, alarmDetails: null, dashboardId: null } },
    clearRule: { condition: cond(clearOp, clearValue), schedule: null, alarmDetails: null, dashboardId: null },
    propagate: false, propagateToOwner: false, propagateToTenant: false, propagateRelationTypes: null,
  };
}

const PROFILES = {
  'thermostat': { description: 'Apartment thermostat (UrbanSync)', alarms: [alarmRule('High Temperature', 'temperature', 'GREATER', 28, 'LESS_OR_EQUAL', 26)] },
  'fuel-tank':  { description: 'Building heating-oil tank (UrbanSync)', alarms: [alarmRule('Low Fuel', 'fuel', 'LESS', 20, 'GREATER_OR_EQUAL', 30)] },
};

// ---------------------------------------------------------------- steps
async function waitForThingsBoard() {
  const deadline = Date.now() + WAIT_SEC * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const r = await fetch(`${TB_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: requireEnv('TB_USERNAME'), password: requireEnv('TB_PASSWORD') }) });
      if (r.status === 200) { jwt = (await r.json()).token; log(`logged in as ${process.env.TB_USERNAME} (attempt ${attempt})`); return; }
      if (r.status === 401) throw new Error('ThingsBoard rejected TB_USERNAME/TB_PASSWORD (401) - check Secret iot-credentials');
      log(`ThingsBoard answered ${r.status}, waiting...`);
    } catch (e) {
      if (/401/.test(e.message)) throw e;
      log(`ThingsBoard not ready yet (${e.cause ? e.cause.code || e.cause.message : e.message}), waiting...`);
    }
    await sleep(10000);
  }
  throw new Error(`ThingsBoard did not come up within ${WAIT_SEC}s`);
}

async function ensureProfiles() {
  const page = await api('GET', '/api/deviceProfileInfos?pageSize=200&page=0');
  const byName = new Map((page.data || []).map(p => [p.name, p.id]));
  const ids = {};
  for (const [name, spec] of Object.entries(PROFILES)) {
    let existing = byName.get(name) ? await api('GET', `/api/deviceProfile/${byName.get(name).id}`) : null;
    const body = existing || {
      name, type: 'DEFAULT', transportType: 'DEFAULT', provisionType: 'DISABLED', default: false,
      description: spec.description, profileData: { configuration: { type: 'DEFAULT' }, transportConfiguration: { type: 'DEFAULT' }, provisionConfiguration: { type: 'DISABLED' } },
    };
    body.profileData = body.profileData || {};
    body.profileData.alarms = spec.alarms;      // git is the source of truth for alarm rules
    body.description = spec.description;
    try {
      const saved = await api('POST', '/api/deviceProfile', body);
      ids[name] = saved.id; log(`device profile '${name}' ${existing ? 'updated' : 'created'} (alarm rules: ${spec.alarms.map(a => a.alarmType).join(', ')})`);
    } catch (e) {
      // alarm-rule schema differs across TB versions: keep/create the profile without rules, warn, continue
      log(`WARN could not save alarm rules on '${name}': ${e.message}`);
      if (existing) { ids[name] = existing.id; continue; }
      delete body.profileData.alarms;
      const saved = await api('POST', '/api/deviceProfile', body);
      ids[name] = saved.id; log(`device profile '${name}' created WITHOUT alarm rules`);
    }
  }
  return ids;
}

async function ensureDevices(profileIds) {
  const result = {};
  for (const d of DEVICES) {
    let dev = null;
    try { dev = await api('GET', `/api/tenant/devices?deviceName=${encodeURIComponent(d.name)}`); }
    catch (e) { if (e.status !== 404) throw e; }
    if (!dev) {
      dev = await api('POST', '/api/device', { name: d.name, label: d.label, type: d.profile, deviceProfileId: profileIds[d.profile] });
      log(`device '${d.name}' created`);
    } else {
      log(`device '${d.name}' exists`);
    }
    result[d.name] = dev.id.id;

    const token = requireEnv(d.tokenEnv);
    const creds = await api('GET', `/api/device/${dev.id.id}/credentials`);
    if (creds.credentialsType === 'ACCESS_TOKEN' && creds.credentialsId === token) {
      log(`  token for '${d.name}' already set (len ${token.length})`);
    } else {
      try {
        await api('POST', '/api/device/credentials', { ...creds, credentialsType: 'ACCESS_TOKEN', credentialsId: token, credentialsValue: null });
        log(`  token for '${d.name}' set from ${d.tokenEnv} (len ${token.length})`);
      } catch (e) {
        log(`  WARN could not set token for '${d.name}': ${e.message} (another device may already use it)`);
      }
    }
  }
  return result;
}

function substituteSecrets(text) {
  return text.replace(/\$\{(RABBITMQ_USER|RABBITMQ_PASS)\}/g, (_, k) => requireEnv(k));
}

async function ensureRootRuleChain() {
  const file = path.join(ASSETS, 'root-rule-chain.json');
  if (!fs.existsSync(file)) { log('no root-rule-chain.json, skipping'); return; }
  const spec = JSON.parse(substituteSecrets(fs.readFileSync(file, 'utf8')));
  const name = spec.ruleChain.name;
  const page = await api('GET', `/api/ruleChains?pageSize=200&page=0&textSearch=${encodeURIComponent(name)}`);
  let chain = (page.data || []).find(c => c.name === name);
  if (!chain) { chain = await api('POST', '/api/ruleChain', { name, type: 'CORE', debugMode: false }); log(`rule chain '${name}' created`); }
  else log(`rule chain '${name}' exists, re-applying nodes`);
  const metadata = { ...spec.metadata, ruleChainId: chain.id };
  delete metadata.version;               // optimistic-locking field from the export, not ours
  await api('POST', '/api/ruleChain/metadata', metadata);
  if (!chain.root) { await api('POST', `/api/ruleChain/${chain.id.id}/root`); log(`rule chain '${name}' set as ROOT`); }
  log(`rule chain '${name}': ${spec.metadata.nodes.length} nodes (Low Fuel / High Temp -> RabbitMQ building-alarms)`);
}

async function ensureDashboards(deviceIds) {
  const dir = path.join(ASSETS, 'dashboards');
  if (!fs.existsSync(dir)) { log('no dashboards dir, skipping'); return; }
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    let text = fs.readFileSync(path.join(dir, f), 'utf8');
    text = text.replace(/__DEVICE_ID:([^_]+)__/g, (m, devName) => {
      if (!deviceIds[devName]) { log(`WARN dashboard ${f}: unknown device '${devName}'`); return m; }
      return deviceIds[devName];
    });
    const dash = JSON.parse(text);
    const page = await api('GET', `/api/tenant/dashboards?pageSize=200&page=0&textSearch=${encodeURIComponent(dash.title)}`);
    const existing = (page.data || []).find(x => x.title === dash.title);
    if (existing) dash.id = existing.id;
    await api('POST', '/api/dashboard', dash);
    log(`dashboard '${dash.title}' ${existing ? 'updated' : 'created'}`);
  }
}

// ---------------------------------------------------------------- main
(async () => {
  log(`target ${TB_URL}, assets ${ASSETS}`);
  await waitForThingsBoard();
  const profileIds = await ensureProfiles();
  const deviceIds  = await ensureDevices(profileIds);
  await ensureRootRuleChain();
  await ensureDashboards(deviceIds);
  log('done - ThingsBoard matches git');
})().catch(e => { console.error(new Date().toISOString(), '[tb-provision] FAILED:', e.message); process.exit(1); });
