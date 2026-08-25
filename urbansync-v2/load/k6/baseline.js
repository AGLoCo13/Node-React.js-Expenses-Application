// load/k6/baseline.js
// Baseline load test: steady ramp against the core API through the ingress.
// Produces the p95/error-rate numbers that define the Gold/Silver SLA tiers.
//
// Run (from repo root, with the app port-forwarded on http://localhost):
//   k6 run load/k6/baseline.js
//   k6 run -e BASE_URL=http://localhost -e EMAIL=admin@example.com -e PASSWORD='Admin!123' load/k6/baseline.js
//
// Watch the HPA react in a second terminal:
//   kubectl get hpa -n urbansync -w

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE  = __ENV.BASE_URL  || 'http://localhost';
const EMAIL = __ENV.EMAIL     || 'admin@example.com';
const PASS  = __ENV.PASSWORD  || 'Admin!123';

// Custom trends let the summary separate SLA tiers per endpoint class.
const loginLatency = new Trend('latency_gold_login',  true);
const crudLatency  = new Trend('latency_silver_crud', true);

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // warm-up
    { duration: '3m', target: 30 },   // steady state — SLA measurement window
    { duration: '1m', target: 60 },   // push: should trigger HPA scale-out
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    // These ARE the SLA definitions — k6 fails the run if a tier is violated.
    'latency_gold_login':  ['p(95)<300'],   // Gold: p95 < 300ms
    'latency_silver_crud': ['p(95)<800'],   // Silver: p95 < 800ms
    'http_req_failed':     ['rate<0.001'],  // 99.9% success overall
  },
};

export function setup() {
  const res = http.post(`${BASE}/api/login`, JSON.stringify({ email: EMAIL, password: PASS }),
    { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'login for token OK': (r) => r.status === 200 });
  return { token: res.json('token') };
}

export default function ({ token }) {
  const auth = { headers: { Authorization: token } };

  // Gold tier: authentication
  const login = http.post(`${BASE}/api/login`, JSON.stringify({ email: EMAIL, password: PASS }),
    { headers: { 'Content-Type': 'application/json' } });
  loginLatency.add(login.timings.duration);
  check(login, { 'login 200': (r) => r.status === 200 });

  // Silver tier: read-heavy CRUD
  for (const path of ['/api/buildings', '/api/apartments', '/api/expenses']) {
    const res = http.get(`${BASE}${path}`, auth);
    crudLatency.add(res.timings.duration);
    check(res, { [`GET ${path} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
