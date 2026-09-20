# Grafana screenshots, 20 Sep 2026

Captured during a single k6 baseline run against the Azure VM (`9.205.24.56`), the same
`load/k6/baseline.js` profile used for the 15 Sep runs: 1 min at 10 VUs, 3 min at 30 VUs,
1 min at 60 VUs, 1 min ramp down. Filenames carry the local capture time (EEST, UTC+3);
the k6 run itself was 08:30:23 - 08:36:55 UTC.

The dashboards in these shots are the version committed on 20 Sep, where the latency
thresholds are the measured SLA tiers from chapter 9 rather than the pre-experiment
estimates.

| File | Time | What it shows |
|---|---|---|
| `2026-09-20-113200-grafana-app-scaleout-start.png` | 11:32:00 | The ramp beginning. HPA has just moved 1 -> 3 replicas, 15 req/s, every tier green. |
| `2026-09-20-113300-grafana-cluster.png` | 11:33:00 | Cluster Overview during the run: 13 pods, node CPU 12.6%, memory 46.2%, CPU requests 53.6%, and the replica step on the node view. |
| `2026-09-20-113546-grafana-app-peak.png` | 11:35:46 | **Figure 9.3 candidate.** Peak load: 72.4 req/s, 4 replicas, reads p99 680 ms, login p99 1.96 s, 0.00% errors. |
| `2026-09-20-113604-grafana-app-tail-breach.png` | 11:36:04 | 18 seconds later, the tail crosses the SLO: reads p99 1.017 s (amber), login p99 3.954 s (red). Shows the tier thresholds firing. |
| `2026-09-20-113825-grafana-app-full-run.png` | 11:38:25 | The whole run in one frame: traffic arc to ~80 req/s and back to zero, replicas held at 4, latency curve peaking near 2.5 s, no errors at any point. |

## Reading the two p99 stats

The dashboard splits p99 by SLA tier, because a p99 mixed across tiers cannot be compared
with any single SLO:

- **p99 reads (Gold)** covers `/api/buildings`, `/api/apartments`, `/api/expenses`.
  Amber at 1 s, red at the 1.5 s target.
- **p99 login (Silver)** covers `POST /api/login`, slower by design because bcrypt cost 10
  burns about 75 ms of CPU per call. Amber at 2 s, red at the 3 s target.

Note that these panels are a **server side p99 over a 1 minute window**, while the SLO in
chapter 9 is defined on the **client side k6 p99 over the whole run**. The 3.954 s in the
11:36:04 shot and the 3.15 s in the k6 summary are therefore two different measurements of
the same event, not a contradiction. The run level numbers are in
`../2026-09-20-verification-run-console.txt`.

## Scale-out timeline, from `kubectl get hpa` during the run

```
08:30:32 UTC  10%/65%   desired=1  ready=1
08:30:47      140%/65%  desired=1  ready=1
08:31:02      140%/65%  desired=3  ready=3
08:31:28      289%/65%  desired=4  ready=4
08:36:31      743%/65%  desired=4  ready=4
```

Utilization is relative to the 50 m CPU request, so 743% is about 370 m against the 400 m
limit: the capacity ceiling described in chapter 9, reached with all 4 replicas running.
