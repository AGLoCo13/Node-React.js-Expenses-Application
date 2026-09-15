# Backend HPA load tests (S5), 15 Sep 2026

Two runs with the same script, one with 30 parallel logins and one with 100. The question
was whether the HPA scales the backend out and back in, and what happens when parallel
load grows beyond what 4 replicas can serve.

Raw logs (15-second samples, HPA events, status codes, latency):
[2026-09-15-hpa-scaleout-30.txt](2026-09-15-hpa-scaleout-30.txt) ·
[2026-09-15-hpa-scaleout-100.txt](2026-09-15-hpa-scaleout-100.txt).
An earlier 30-parallel run at 13:24 UTC, before latency was recorded, is in
[2026-09-15-hpa-scaleout.txt](2026-09-15-hpa-scaleout.txt).

## Setup

| | |
|---|---|
| Cluster | single-node kubeadm on Azure VM `urbansync-rg-vm`, `Standard_B4as_v2` (4 vCPU, 16 GB) |
| Deployed commit | `e734dfcf5` (HPA, probes, rolling updates) |
| HPA | `k8s/base/backend/hpa.yaml`: CPU 65% of request, min 1, max 4, default behavior |
| Backend pod | requests 50m CPU / 192Mi, limits 400m CPU / 512Mi |
| Endpoint | `POST /api/login` with valid admin credentials. bcrypt makes every login CPU-bound |
| Load generator | `curl` via `xargs -P <N>`, run **on the VM itself**, through ingress-nginx |
| Duration | 3 min of load, then ~7 min idle to observe scale-in |
| Sampling | every 15 s: `kubectl get hpa`, ready replicas, `kubectl top node` |

Command (N = 30 or 100):

```bash
timeout 180 bash -c "seq 10000000 | xargs -P N -I{} curl -s -o /dev/null -m 30 \
  -w '%{http_code} %{time_total}\n' -X POST localhost/api/login \
  -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"Admin!123\"}'"
```

## Results

| | 30 parallel | 100 parallel |
|---|---|---|
| Start (UTC) | 16:13:58 | 16:00:42 |
| First scale-out observed | +45 s (1 → 2, then 3) | +46 s (1 → 4) |
| Reached 4 replicas | +61 s | +46 s |
| Requests completed in 3 min | 3658 | 3812 |
| Throughput | **20.3 req/s** | **21.2 req/s** |
| Status codes | 3657 × 200, **1 × 502** | 3812 × 200 |
| Latency p50 | 0.763 s | 0.750 s |
| Latency p95 | 4.593 s | **15.499 s** |
| Latency p99 | 4.975 s | **16.184 s** |
| Latency max | 12.365 s | 20.656 s |
| Peak node CPU | 2114m (52%) | 2137m (53%) |
| CPU per pod at max | ~800% of request (the 400m limit) | ~800% of request (the 400m limit) |
| Back to 1 replica after load stop | 5 min 52 s | 5 min 52 s |
| ArgoCD during the run | Synced / Healthy | Synced / Healthy |

## What the numbers show

1. **The HPA works as configured.** In both runs it scaled out within ~45 s of load starting
   and returned to 1 replica about 6 min after load stopped. That is ~1 min for CPU to fall
   below target plus the default 5-minute scale-down stabilization window.
2. **Throughput is capped at ~21 logins/s, regardless of parallelism.** 4 replicas × 400m
   limit = 1.6 cores for the backend, and every pod sat at its limit in both runs. Node CPU
   peaked at the same ~52% in both, so the cap is the HPA maximum and the pod CPU limit,
   not the VM.
3. **Extra parallel requests only add waiting time.** At a fixed ~21 req/s, 100 concurrent
   clients means each request waits about 3× longer on average than with 30. The median
   barely moved (0.76 s → 0.75 s), but the tail grew from ~5 s to ~16 s at p95/p99. The tail
   most likely comes from the first ~45 s, when one pod (400m) served all the load before
   the new replicas were Ready. The timeline supports this, but per-request timestamps were
   not recorded, so it is not proven.
4. **One 502 in the 30-parallel run.** ingress-nginx log: `16:14:16 POST /api/login 502`,
   upstream `192.168.216.88:5000`, 0 bytes after 70 ms. This was 18 s into the load, while the
   single original pod was CPU-saturated and before any scale-out. The upstream closed the
   connection without a response. A likely cause is nginx reusing a keep-alive connection
   the Node server had just closed; this has not been confirmed. No 5xx occurred during
   scale-out, scale-in, or the 100-parallel run.

## Limitations

- **The load generator ran on the same VM** and competed with the cluster for CPU, so the
  latency numbers are pessimistic. The S7 k6 runs should come from outside the VM.
- **One endpoint only** (login, CPU-heavy by design). CRUD endpoints behave differently.
- **One repetition per scenario.** The roadmap asks for 3 repetitions and the median (S7).
- **`Standard_B4as_v2` is burstable:** it guarantees 40% of 4 vCPU (1.6 cores) sustained
  and runs above that on CPU credits. 3-minute bursts are unaffected; long k6 runs may not be.

## Is 4 replicas a hard limit?

No. `maxReplicas: 4` is our setting, taken from the roadmap's S5 definition. Kubernetes has
no such limit. On this VM:

| Constraint | Replicas it allows |
|---|---|
| Scheduling by CPU requests (50m each, ~2000m free) | ~40 |
| Memory (192Mi requested each, 21% of node requested) | 20+ |
| Real CPU (400m per busy pod, ~200m used by everything else, 4 vCPU) | ~8 before the node saturates |
| Sustained CPU on the burstable VM (1.6 cores guaranteed) | ~4 |

Raising `maxReplicas` to ~6 would lift the throughput cap for short bursts. Beyond that, the
backend competes with the load generator and the rest of the stack for the same 4 cores.
