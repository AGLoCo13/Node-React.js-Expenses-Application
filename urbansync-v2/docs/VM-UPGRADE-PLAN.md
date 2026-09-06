# VM Upgrade Plan — `Standard_B2ms` → `Standard_B4ms`

**Status:** proposed, not applied.
**Written:** 2026-09-04 · **Measurements from:** 2026-09-03 (VM deallocated since).
**Owner:** Στέφανος (DevOps · GitOps & Μετρήσεις)

---

## 1. Why this exists

The prod node is out of schedulable CPU. Not out of *compute* — out of **reservations**.
Every new workload the remaining roadmap needs (S4 monitoring, S5 HPA, S7 load tests)
has to be scheduled onto a node that already has 96% of its CPU requested.

This has already cost real time twice:

- **2026-09-02** — the Knative `receipt-annotator` could not schedule
  (`0/1 nodes are available: 1 Insufficient cpu`), leaving ArgoCD `Degraded` and
  `/api/expenses/knative-extract` returning 502.
- **2026-09-03** — a teammate worked around it in `e9e4e8bff` by cutting the
  function's own request `100m → 50m`. That bought ~50m. It is a patch, not headroom.

---

## 2. Current state (measured 2026-09-03)

```
CPU requests   1935m / 2000m   (96%)   <- the binding constraint
CPU actual      206m           (10%)   <- requests are ~9x real usage
Memory req     3084Mi / 7937Mi (39%)
Memory actual  4668Mi          (59%)
Disk             17G / 29G     (57%)
```

The gap between 96% requested and 10% used is the whole story: nothing is working
hard, the scheduler simply has no reservation budget left to hand out.

### Where the CPU requests go

| Request | Component |
|---:|---|
| 250m | kube-apiserver |
| 200m | kube-controller-manager |
| 150m | thingsboard |
| 100m | ×6 — kube-scheduler, etcd, coredns, calico-node, kourier-gateway, knative webhook/controller/autoscaler/activator |
| 70m | csi-secrets-store driver |
| 50m | ×4 — backend, mongodb, azure-csi-provider, net-kourier-controller, ingress-nginx |
| 30m | rabbitmq, minio |
| 25m | metrics-server |
| 20m | nodered |
| 10m | frontend |

Roughly **1100m of the 1935m is Kubernetes and Knative infrastructure**, not the app.

---

## 3. What still has to fit

| Task | Workload | New CPU requests |
|---|---|---|
| S4 | Prometheus 50m + Grafana 20m + kube-state-metrics 10m | **80m** |
| S5 | HPA on backend, min 1 → **max 4** (3 extra × 50m) | **150m** |
| — | receipt-annotator revision (50m + 25m queue-proxy sidecar) | **75m** |
| S7 | k6 load — no *requests*, but real CPU burn during runs | — |
| | | **≈ 305m needed vs ~65m free** |

**It does not fit.** S5 is the killer: the entire point of the HPA demo is watching
replicas go 1 → 3/4 under k6 load. On a full node those replicas stay `Pending` and
the demo shows nothing.

---

## 4. Cost analysis

Azure's retail price API has **no entries for `denmarkeast`** (newer region), so the
absolute rate is an estimate. The *ratio* is not — B4ms is exactly **2.00×** B2ms in
every comparable region:

| Region | B2ms /hr | B4ms /hr | ratio |
|---|---:|---:|---:|
| swedencentral | $0.0864 | $0.1730 | 2.00 |
| northeurope | $0.0910 | $0.1820 | 2.00 |
| francecentral | $0.0944 | $0.1890 | 2.00 |
| westeurope | $0.0960 | $0.1920 | 2.00 |
| norwayeast | $0.1060 | $0.2110 | 1.99 |

Denmark East is Nordic, so **~$0.09/hr → ~$0.18/hr** is the working estimate.

> The Consumption API (`az consumption usage list`) returns records for this
> subscription but every `pretaxCost` and `quantity` is empty — student/sponsored
> offers do not expose cost there. **Real spend can only be read in the portal:**
> Cost Management + Billing → Credits.

### Cost to the 2026-09-21 exam (17 days)

| Usage pattern | B2ms | B4ms | **Extra** |
|---|---:|---:|---:|
| ~4 h/day (deallocating between sessions) | ~$6 | ~$12 | **+$6** |
| ~8 h/day | ~$12 | ~$24 | **+$12** |
| Left running 24/7 | ~$37 | ~$73 | **+$37** |

Fixed regardless of VM state, because the disk and the static IP are always billed:
**~$3.40** over 17 days (~$6/month: $1.54 disk + $4.38 IP).

**Conclusion: while the deallocate habit holds, the upgrade costs about $6 for the
rest of the project.** The credit is $100. This is not the thing that will exhaust it —
leaving the VM running overnight is.

---

## 5. What changes

| | B2ms (now) | B4ms (after) |
|---|---|---|
| vCPU | 2 | **4** |
| Schedulable CPU | 2000m | **4000m** |
| Free CPU headroom | ~65m | **~2065m** |
| RAM | 8 GB | **16 GB** |
| BS-family quota used | 2 / 4 | **4 / 4 (at ceiling)** |
| Compute cost | 1× | **2×** |
| Disk, IP, Key Vault | unchanged | unchanged |

Nothing else moves. Same disk, same public IP `9.205.24.56`, same managed identity,
same Key Vault. The cluster comes back exactly as it was — kubeadm, Calico,
local-path PVCs, ArgoCD, Jenkins all survive a resize.

**The RAM is arguably the bigger win.** Memory was already at 59% actual before
Prometheus (256Mi request / 768Mi limit) and Grafana (96Mi / 256Mi) were added.

### Quota consequence worth noting

B4ms consumes the **entire** BS-family quota (4/4 vCPUs) in denmarkeast. No second
B-series VM in that region afterwards without a quota increase request. Irrelevant for
this project — single node by design — but it closes that door.

---

## 6. Alternative considered and rejected: trim CPU requests

Chosen on 2026-09-02, then reconsidered. Plan was ~300m from over-reserved infra:

| target | from | to |
|---|---:|---:|
| kube-apiserver | 250m | 150m |
| kube-controller-manager | 200m | 100m |
| knative webhook | 100m | 50m |
| knative autoscaler | 100m | 50m |

Rejected for three reasons:

1. **It doesn't buy enough.** ~300m against ~305m of upcoming demand — it lands
   exactly on the line, with nothing left for k6 or a second Knative revision during
   a rollout.
2. **The control-plane half is risky.** apiserver and controller-manager requests live
   in `/etc/kubernetes/manifests/*.yaml`. Editing those restarts the static pods —
   the API server blips ~30s, and a malformed edit takes the cluster down. Mid-sprint,
   days before a graded demo, for ~$6 of savings.
3. **It does not survive.** `setup-microk8s.yml` re-applies upstream Calico and the
   Knative install re-applies its own deployments, both resetting trims. They must be
   re-applied by `deploy.yml` on every run — that machinery already exists
   (tasks 4b.5f–i) and is itself a recurring source of confusion.

The script is still there if needed: `scratchpad/trim.sh` (backs manifests up to
`/root/manifest-backup/` first, waits for `/readyz` after the restart).

---

## 7. How to apply

```bash
# 1. deallocate (resize needs the VM stopped)
az vm deallocate -g urbansync-rg -n urbansync-rg-vm

# 2. one line in urbansync-v2/infrastructure/opentofu/main.tf
#      size = "Standard_B4ms"      # was Standard_B2ms

# 3. from WSL2 (Norton breaks tofu on Windows -- see CLAUDE.md)
cd urbansync-v2/infrastructure/opentofu
tofu plan      # expect: 1 to change, 0 to add, 0 to destroy
tofu apply

# 4. start and verify
az vm start -g urbansync-rg -n urbansync-rg-vm
ssh azureuser@9.205.24.56 "kubectl get nodes; kubectl describe node urbansync-rg-vm | grep -A5 'Allocated resources'"
```

Expect ~5 minutes. `tofu plan` must say **change**, not **replace** — if it says
replace, stop: something else in the resource drifted and applying would destroy the
disk. Azure resizes B-series in place.

### Rollback

Set `size` back to `Standard_B2ms` and re-apply. Same stop/resize/start cycle.
Only constraint: workloads scheduled into the extra headroom will go `Pending` again.

---

## 8. Decision triggers

Apply the upgrade when **any** of these is true:

- S5 (HPA) is starting — the demo needs 3–4 backend replicas schedulable
- S4 monitoring is deployed and something goes `Pending`
- `kubectl top nodes` shows memory above ~80%
- Any pod reports `Insufficient cpu` again

Do **not** apply if:

- Portal shows credit below ~$25 remaining — at that point protect the demo, keep
  B2ms, and cut S5's `maxReplicas` to 2
- The team decides the demo runs on local Docker Desktop instead of the Azure VM
  (still unresolved as of 2026-09-04 — the roadmap's freeze plan says local,
  the deployed environment is Azure)

---

## 9. Open questions

- **Remaining credit is unknown.** Not readable via CLI on this subscription. Someone
  should check the portal and record it here.
- **denmarkeast pricing unverified.** If it ever appears in the retail API, replace the
  estimates in §4 with real figures.
- **Demo location undecided.** If the demo is local, this entire document is moot and
  the VM should be deallocated permanently after evidence is captured.
