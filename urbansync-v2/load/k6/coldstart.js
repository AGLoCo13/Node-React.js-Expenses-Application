// load/k6/coldstart.js
// Measures the Knative receipt-annotator cold start vs warm latency.
//
// Method: the KService scales to zero after 60s idle. We send one request
// (cold — includes pod spin-up), then a burst of warm requests, then wait
// past the scale-to-zero window and repeat. The two custom trends give a
// clean cold-vs-warm distribution for docs/SLA.md (Bronze tier).
//
// Setup (separate terminal): port-forward the Kourier gateway —
//   kubectl port-forward -n kourier-system svc/kourier 8082:80
// Knative routes by Host header, so we pass it explicitly.
//
// Run:
//   k6 run load/k6/coldstart.js
//   k6 run -e GATEWAY=http://localhost:8082 -e HOST=receipt-annotator.urbansync.svc.cluster.local load/k6/coldstart.js
//
// Verify scale-to-zero between cycles (second terminal):
//   kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator -w

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const GATEWAY = __ENV.GATEWAY || 'http://localhost:8082';
const HOST    = __ENV.HOST    || 'receipt-annotator.urbansync.svc.cluster.local';
const IDLE    = Number(__ENV.IDLE_SECONDS || 90); // > 60s scale-to-zero grace

const coldLatency = new Trend('knative_cold_start_ms', true);
const warmLatency = new Trend('knative_warm_ms',       true);

export const options = {
  scenarios: {
    coldstart_cycles: {
      executor: 'per-vu-iterations',
      vus: 1,                 // strictly sequential — parallel VUs would keep it warm
      iterations: 5,          // 5 cold/warm cycles ≈ 12 minutes
      maxDuration: '30m',
    },
  },
  thresholds: {
    'knative_warm_ms':       ['p(95)<1000'],
    'knative_cold_start_ms': ['p(95)<30000'],   // Bronze tier: cold start < 30s
  },
};

const params = { headers: { Host: HOST }, timeout: '60s' };

export default function () {
  // 1. COLD: the service has been idle > grace period — this request pays
  //    for activator wake-up + pod schedule + container boot.
  const cold = http.get(`${GATEWAY}/health`, params);
  coldLatency.add(cold.timings.duration);
  check(cold, { 'cold request eventually 200': (r) => r.status === 200 });

  // 2. WARM: pod is up — these measure steady-state function latency.
  for (let i = 0; i < 10; i++) {
    const warm = http.get(`${GATEWAY}/health`, params);
    warmLatency.add(warm.timings.duration);
    check(warm, { 'warm 200': (r) => r.status === 200 });
    sleep(1);
  }

  // 3. Wait past the scale-to-zero window so the next iteration is cold again.
  console.log(`Cycle done — sleeping ${IDLE}s to let the KService scale to zero...`);
  sleep(IDLE);
}
