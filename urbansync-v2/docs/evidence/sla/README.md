# SLA evidence (S5, S7, S8)

Measured on the Azure VM `urbansync-rg-vm` (`Standard_B4as_v2`). Written up in
[`docs/SLA-chapter9-draft.md`](../../SLA-chapter9-draft.md).

| What | Files |
|---|---|
| HPA scale-out tests (curl, 30 and 100 parallel logins) | `2026-09-15-hpa-load-tests.md`, `2026-09-15-hpa-scaleout*.txt` |
| k6 baseline ×3 (login + CRUD, up to 60 VUs, from WSL) | `2026-09-15-baseline-run{1,2,3}*` |
| k6 cold start ×3, Knative `min-scale 0` (on the VM) | `2026-09-15-coldstart-minscale0-run{1,2,3}*` |
| k6 cold start ×3, Knative `min-scale 1` (on the VM) | `2026-09-16-coldstart-minscale1-run{1,2,3}*` |
| Percentile tables (per run + median of runs) | `2026-09-16-k6-percentiles.md` |
| CDF plots | `2026-09-16-cdf-*.png` |

Per run: `*-summary.json` (k6 end-of-test summary), `*.json.gz` (every request, k6 `--out json`),
`*-console.txt` (k6 output), `*-hpa.txt` (HPA every 15 s, baseline) or `*-pods.txt`
(receipt-annotator pod count every 5 s, cold start). File dates are UTC days.

The baseline and cold-start timestamps are UTC in `*-hpa.txt`/`*-pods.txt`; the k6 JSON
timestamps carry the local offset of the machine k6 ran on.

## Reproduce

```bash
# baseline, from WSL (k6 + ssh to the VM): waits for HPA = 1 before each run
bash load/k6/run-baseline.sh
# cold start, on the VM (see the header of the script); label = minscale0 or minscale1
bash -l /tmp/run-coldstart.sh minscale0
# tables + plots, from urbansync-v2/ (python 3, numpy, matplotlib)
python load/k6/cdf_plots.py docs/evidence/sla
```

`min-scale 1` was set by a temporary commit to `k8s/base/knative/kservice.yaml` and reverted
after the runs. The plot script drops baseline requests with `http_req_waiting == 0` (a WSL2
timing artifact, 0.6–0.7% of requests) and counts them per run.
