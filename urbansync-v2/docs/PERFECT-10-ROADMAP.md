# UrbanSync v2 — Audit & Perfect-10 Roadmap

*Audited 2026-08-25 against the final-project rubric. Deadline: September 21.*

---

## Part 1 — Uncompromising audit

### Verdict at a glance

| # | Criterion | Weight | Status today | Honest score |
|---|-----------|--------|--------------|--------------|
| 1 | Architecture & Services | 20% | Strong — all services real, probes real | 8.5/10 |
| 2 | Design Patterns | 20% | 3 real + 1 implemented-but-undocumented; 2 missing; 1 sabotaged by a hardcoded string | 6/10 |
| 3 | Serverless (Knative) | 10% | Strong — real event triggering, scale-to-zero | 8.5/10 |
| 4 | Automation & Secrets | 10% | Surprisingly strong — SOPS+age, Azure Key Vault CSI | 8.5/10 |
| 5 | GitOps | 20% | Working loop, witnessed live; a few traps | 8/10 |
| 6 | SLAs & Monitoring | 15% | **Effectively zero** | 1/10 |
| 7 | Documentation | 20% | Very strong; two reproducibility holes | 8/10 |

**Weighted estimate today: ≈ 6.9/10.** The single biggest lever is criterion 6 —
15% of the grade sitting at nearly zero. Second lever: the two missing patterns,
which are also the most impressive to demonstrate.

### 1. Architecture & Services — 20%

Real, not mocked. The full chain exists and was exercised end-to-end this week:
React (multi-stage Docker → nginx with `/api/` proxy) → Express backend →
MongoDB StatefulSet, RabbitMQ StatefulSet, MinIO StatefulSet, ThingsBoard,
Node-RED, and a Knative function — all in the `urbansync` namespace behind
ingress-nginx. The `/health` liveness and `/ready` readiness probes
(`backend/server.js:79,97`) do real per-dependency checks (mongoose readyState,
RabbitMQ `isConnected`, MinIO `bucketExists`) and return per-service breakdowns
— this is exactly what a grader hopes to see.

Gaps: stale duplicate manifests `k8s/backend/deployment.yaml` and
`k8s/frontend/deployment.yaml` sit outside `base/` and contradict it — delete
them. The Gemini call (`backend/services/aiService.js`) is real, not mock, but
fails at runtime until `gemini-api-key` stops being `REPLACE_WITH_REAL_KEY`.

### 2. Design Patterns — 20% (the second-biggest lever)

**Retry — real and good.** `backend/resilience/retryHelper.js`: `async-retry`,
exponential back-off, jitter, bail support. Used for Mongo connect
(`server.js:571`) and RabbitMQ reconnect (`rabbitmq-consumer.js:74`).

**Circuit Breaker — real and good.** `backend/resilience/circuitBreaker.js`:
`opossum`, named singleton breakers for RabbitMQ connect and MinIO ops, tuned
thresholds, fallbacks, full event hooks (which even say "ready for Prometheus
metrics" — a promise we will now keep).

**Claim Check — implemented but you never claimed the credit.** The receipt flow
IS the pattern: the fat payload (PDF/image) goes to MinIO
(`expensesController.js:20`), Mongo stores only the key + bucket + metadata
(`document`, `documentBucket`, `documentMetadata`), and downstream consumers
(the Knative annotator) fetch by reference from the event's `Records[].s3.object.key`.
Zero code needed — one README section and code comments naming the pattern.

**Async Request-Reply — half-implemented.** The alarm path
(ThingsBoard → RabbitMQ → consumer with ack/nack (`rabbitmq-consumer.js:104-112`)
→ Mongo notifications → dashboard) is real async messaging. What's missing for
the textbook pattern: a correlation ID on the message and a client-visible
"pending → done" lifecycle. Cheap to add on the receipt-annotation async path.

**Idempotency — MISSING.** Only accidental uniqueness on usernames. A retried
`POST /api/payments` or `POST /api/expenses` creates duplicates today. Fix in
Part 3, Task 2.

**Compensating Logic — MISSING, and there is a live bug proving the need.**
`createExpense` uploads to MinIO **then** saves to Mongo (`expensesController.js:20-47`).
If `expense.save()` throws, the MinIO object is orphaned forever. Wrapping this
in try/catch with `removeObject` on failure is a *real* compensating transaction
with a demonstrable failure scenario — graders love a pattern you can trigger
live. Fix in Part 3.

**Stateless — 95% true, sabotaged by one string.** No server-side sessions, no
local disk state in K8s (uploads go through memory buffers to MinIO), any
replica can serve any request — *except* JWTs are signed/verified with
hardcoded `'your-secret-key'` in **four** places (`loginController.js:34`,
`registerController.js:56` — a *different* literal, `'yourSecretKey'`, meaning
register-issued tokens already fail verification! — and `authMiddleware.js:7,25`).
Meanwhile the `jwt-secret` key sits **unused** in the K8s Secret. Wiring
`process.env.JWT_SECRET` fixes a real bug, completes the pattern, and closes a
security hole in one move.

**Count after the fixes: 6 patterns real and documented (Retry, Circuit Breaker,
Claim Check, Idempotency, Compensating, Stateless) + Async Reply hardened = well
past "at least 4, flawlessly".**

### 3. Serverless — 10%

Real Knative Service (`k8s/base/knative/kservice.yaml`) with scale-to-zero
(60s grace), max-scale 3, health probes, and **two genuine trigger paths**:
synchronous (`POST /api/expenses/knative-extract`) and event-driven (MinIO
bucket notification → webhook → function parses `Records[].s3`, fetches the
object, calls Gemini). The webhook wiring is imperative but documented and
scripted (`bootstrap-local.ps1` step 6). Missing only: **measured** cold-start
numbers — which criterion 6 will produce anyway.

### 4. Automation & Secrets — 10%

Stronger than most graduate submissions: OpenTofu provisions the Azure VM
(RG, VNet, NSG, NIC, VM — `infrastructure/opentofu/main.tf`); Ansible does the
full bring-up (registry, namespace, secrets, Knative install with resource
trims for a small node, Helm, **Secrets-Store CSI driver + Azure Key Vault
provider, populates the vault**, Jenkins with JCasC, ArgoCD + repo secret) —
~30 tasks, secrets decrypted via **SOPS + age** with `no_log: true`, and the
prod overlay consumes secrets via `SecretProviderClass` instead of plaintext.
Idempotency: nearly everything is `kubectl apply`/Helm/rsync (safe to re-run);
do one full re-run and confirm `changed=0` on the second pass to be able to
*say* "fully idempotent" with a screenshot.

### 5. GitOps — 20%

The loop works and we watched it work: Jenkins polls `dev-combined` every 2
min → changeset-guarded parallel builds → push to `localhost:5000` → `sed` the
image tag in the manifest → `[skip ci]` commit → ArgoCD (automated, selfHeal,
prune) syncs. The `ci: update image tags` commits in history are the proof.

Traps to close: (a) the first-build changeset trap — `when { changeset }`
builds nothing on a baseline build; add a `FORCE_BUILD_ALL` boolean parameter;
(b) branch discipline — ArgoCD watches `dev-combined` but local work landed on
`main`; the `--bind_ip_all` fix (commit `db6af353`) must reach `dev-combined`
or selfHeal will resurrect the loopback bug on the next sync; (c) add ArgoCD
sync-wave annotations so the namespace/secret sync before workloads; (d) add
`retry` to the Application syncPolicy.

### 6. SLAs & Monitoring — 15% — **the beast, currently unslain**

Nothing exists: no `prom-client`, no `/metrics`, no Prometheus, no Grafana, no
prometheus-adapter, no HPA (only Knative's own annotations; `metrics-server`
is installed — necessary but not sufficient), no k6, no SLA definitions, no
measurements. This is where the 10/10 is won or lost. Full plan in Part 2.

### 7. Documentation — 20%

The 1000-line `README.md` (architecture diagrams, both flows, 15 sections,
troubleshooting), `SETUP-LOCAL-K8S.md`, `SECRETS.md`, per-directory READMEs —
genuinely strong. Two reproducibility holes: **Node-RED flows and the
ThingsBoard rule chain exist only inside PVCs** — not in Git. A grader
rebuilding from the repo gets an empty Node-RED and no telemetry flow. Export
`flows.json` and the rule-chain JSON into `urbansync-v2/iot/` with import
instructions. Also: mark stale `SETUP.md` as superseded, and delete or update
the contradictory duplicate manifests.

---

## Part 2 — The Perfect-10 roadmap

### Phase 0 — hygiene (today, ~1 hour)
Merge/push `main` → `dev-combined` so ArgoCD serves the mongo fix; delete stale
`k8s/backend/` + `k8s/frontend/` duplicates; mark `SETUP.md` superseded; put
the real Gemini key in the local secret.

### Phase 1 — patterns + metrics foundation (this week, Aug 25–31)
1. **JWT env fix** (4 lines) — completes Stateless.
2. **`/metrics` endpoint** with `prom-client` (Task 1 below) — histogram
   `http_request_duration_seconds{route,method,code}`, counter
   `http_requests_total`, gauge `circuit_breaker_state{name}` fed by the
   existing opossum event hooks, gauge `rabbitmq_connection_up`.
3. **Idempotency middleware** on `POST /api/payments` and `POST /api/expenses`
   (Task 2 below).
4. **Compensating logic** in `createExpense` (snippet below).
5. Document Claim Check + Async Reply in README with file/line references.

### Phase 2 — observability stack via GitOps (Sep 1–7)
1. Add `kube-prometheus-stack` (Prometheus, Grafana, Alertmanager) as a
   **second ArgoCD Application** (Helm source, values in Git) — deploying the
   monitoring stack itself through GitOps is a rubric two-for-one.
2. `ServiceMonitor` for the backend Service (scrape `/metrics`).
3. `prometheus-adapter` exposing `http_requests_per_second` to the custom
   metrics API.
4. **HPA v2** on `urbansync-backend`: min 1 / max 5, target ~10 req/s per pod
   on the custom metric, plus a CPU fallback target. Second tracked metric:
   RabbitMQ queue depth via `rabbitmq_prometheus` plugin (built into the
   3-management image — just expose port 15692) or the app-level gauge.
5. Grafana dashboard JSON committed to Git; provisioned via sidecar ConfigMap.

### Phase 3 — load, SLAs, measurements (Sep 8–14)
1. **k6 scripts** (Task 3, already in `load/k6/`): `baseline.js` (steady
   ramp, thresholds), `coldstart.js` (hit Knative after >60s idle, measure
   first-request latency vs warm), `spike.js` (burst to force HPA scale-out —
   capture `kubectl get hpa -w` while it runs).
2. **Define tiers from measured data** (don't invent numbers first — measure,
   then set Gold at what you actually achieve):
   - **Gold** (auth, payments): 99.9% availability, p95 < 300 ms, error rate < 0.1%
   - **Silver** (CRUD APIs): 99.5%, p95 < 800 ms
   - **Bronze** (AI annotation, async): 99%, p95 < 15 s warm / < 30 s cold-start
3. Write `docs/SLA.md`: methodology, k6 output tables, Grafana screenshots,
   HPA scaling timeline, cold-start distribution (warm vs cold), and the tier
   table with pass/fail against measurements.

### Phase 4 — GitOps hardening + dress rehearsal (Sep 15–20)
`FORCE_BUILD_ALL` Jenkins parameter; sync-waves + syncPolicy retry; export
Node-RED flows + ThingsBoard rule chain to Git; then the killer move: **wipe
the cluster and rebuild everything from the repo following only your own
docs**, timing it. Fix every deviation you hit. That rehearsal *is* the
documentation grade.

---

## Part 3 — First three coding tasks (start now)

### Task 1 — `backend/middleware/metrics.js` (new file) + 3 lines in `server.js`

```js
// backend/middleware/metrics.js
// Pattern support: exposes Prometheus metrics for SLA tracking + HPA scaling.
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.025, 0.05, 0.1, 0.3, 0.8, 2, 5, 15],   // aligned to SLA tiers
  registers: [register],
});
const httpTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'code'],
  registers: [register],
});
const cbState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: '0=closed 1=half-open 2=open',
  labelNames: ['name'],
  registers: [register],
});

function instrument(app) {
  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route?.path || req.path;
      const labels = { method: req.method, route, code: res.statusCode };
      end(labels);
      httpTotal.inc(labels);
    });
    next();
  });
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

function watchBreaker(breaker) {   // call once per opossum breaker
  const name = breaker.name;
  breaker.on('close',    () => cbState.set({ name }, 0));
  breaker.on('halfOpen', () => cbState.set({ name }, 1));
  breaker.on('open',     () => cbState.set({ name }, 2));
}

module.exports = { instrument, watchBreaker, register };
```

Wire-up in `server.js` (right after `const app = express()`):
```js
const { instrument, watchBreaker } = require('./middleware/metrics');
instrument(app);
const { rabbitMQBreaker, minioBreaker } = require('./resilience/circuitBreaker');
watchBreaker(rabbitMQBreaker); watchBreaker(minioBreaker);
```
Plus `npm install prom-client` in `backend/`.

### Task 2 — Idempotency: `backend/models/idempotencyRecord.js` + `backend/middleware/idempotency.js`

```js
// backend/models/idempotencyRecord.js
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },  // client-sent Idempotency-Key
  response:  { statusCode: Number, body: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // TTL: 24h
});
module.exports = mongoose.model('IdempotencyRecord', schema);
```

```js
// backend/middleware/idempotency.js
// Pattern: IDEMPOTENCY — a retried POST with the same Idempotency-Key returns
// the stored first response instead of creating a duplicate resource.
const IdempotencyRecord = require('../models/idempotencyRecord');

module.exports = async function idempotency(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return next();                       // header optional; document as required for payments

  const existing = await IdempotencyRecord.findOne({ key });
  if (existing?.response?.statusCode) {          // replay: return cached result
    return res.status(existing.response.statusCode)
              .set('X-Idempotent-Replay', 'true')
              .json(existing.response.body);
  }
  try {                                           // reserve the key atomically
    await IdempotencyRecord.create({ key });
  } catch (e) {
    if (e.code === 11000)                         // concurrent duplicate in-flight
      return res.status(409).json({ message: 'Request with this Idempotency-Key is already processing' });
    throw e;
  }
  const json = res.json.bind(res);                // capture the outcome
  res.json = (body) => {
    IdempotencyRecord.updateOne({ key },
      { response: { statusCode: res.statusCode, body } }).catch(() => {});
    return json(body);
  };
  next();
};
```

Apply in `server.js`:
```js
const idempotency = require('./middleware/idempotency');
app.post('/api/payments', idempotency, paymentController.createPayment);
app.post('/api/expenses', idempotency, uploadMemory.single('document'), expensesController.createExpense);
```
Frontend: send `Idempotency-Key: crypto.randomUUID()` per logical submit (axios header).

### Task 3 — Compensating logic in `createExpense` (edit `backend/controllers/expensesController.js`)

```js
    // Save the expense to the database.
    // Pattern: COMPENSATING TRANSACTION — the MinIO upload above and this Mongo
    // save form a distributed write. If the save fails, we compensate by
    // deleting the just-uploaded object so no orphan is left in storage.
    let savedExpense;
    try {
      savedExpense = await expense.save();
    } catch (dbErr) {
      if (uploadResult && documentData) {
        try {
          await cloudService.minioClient.removeObject(bucketName, documentData);
          console.warn(`↩️  [Compensate] Mongo save failed — removed orphaned MinIO object ${documentData}`);
        } catch (compErr) {
          console.error(`💥 [Compensate] FAILED to remove ${documentData} — manual cleanup needed:`, compErr.message);
        }
      }
      throw dbErr;   // propagate to the route's error handler
    }
```

Demo for the grader: scale Mongo down (`kubectl scale statefulset mongodb --replicas=0 -n urbansync`),
POST an expense with a file, show the compensation log line and the empty
bucket, scale Mongo back up.

*(k6 starter scripts are committed under `load/k6/` — see `baseline.js` and `coldstart.js`.)*
