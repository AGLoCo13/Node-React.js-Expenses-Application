#!/bin/bash
# S7 baseline: 3 k6 runs from WSL against the Azure VM, waiting for HPA=1 before each.
# Run from WSL (k6 + ssh to the VM): bash load/k6/run-baseline.sh
cd "$(dirname "$0")/../.."   # urbansync-v2/
OUT=docs/evidence/sla
D=$(date -u +%F)
VM=azureuser@9.205.24.56
K6=~/.local/bin/k6

replicas() { ssh -o BatchMode=yes $VM "bash -lc 'kubectl -n urbansync get deploy urbansync-backend -o jsonpath={.status.replicas}'"; }

for run in 1 2 3; do
  echo "[$(date -u +%T)] run $run: waiting for backend replicas=1"
  until [ "$(replicas)" = "1" ]; do sleep 30; done
  echo "[$(date -u +%T)] run $run: start"
  HPA=$OUT/$D-baseline-run$run-hpa.txt
  echo "# baseline run $run, HPA every 15s (UTC time, cpu target, replicas, ready, node cpu)" > $HPA
  ssh -o BatchMode=yes $VM "bash -lc 'while true; do echo \"\$(date -u +%T) \$(kubectl get hpa urbansync-backend -n urbansync --no-headers | awk \"{print \\\$3, \\\$6}\") ready=\$(kubectl -n urbansync get deploy urbansync-backend -o jsonpath={.status.readyReplicas}) node=\$(kubectl top node --no-headers | awk \"{print \\\$3}\")\"; sleep 15; done'" >> $HPA &
  W=$!
  $K6 run -e BASE_URL=http://9.205.24.56 \
    --summary-trend-stats "avg,min,med,max,p(90),p(95),p(99)" \
    --summary-export $OUT/$D-baseline-run$run-summary.json \
    --out json=$OUT/$D-baseline-run$run.json.gz \
    load/k6/baseline.js > $OUT/$D-baseline-run$run-console.txt 2>&1
  echo "[$(date -u +%T)] run $run: k6 exit $?"
  sleep 20; kill $W
done
echo "[$(date -u +%T)] all baseline runs done"
