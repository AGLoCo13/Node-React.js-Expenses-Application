#!/bin/bash
# S7 coldstart: 3 k6 runs on the VM through kourier-internal. Usage: coldstart-runs.sh <label>
# (label = minscale0 or minscale1). Logs receipt-annotator pod count every 5s as proof of cold starts.
# Runs ON the VM (kourier-internal is ClusterIP only). Copy this file and coldstart.js to /tmp, then:
#   nohup bash -l /tmp/run-coldstart.sh minscale1 > /tmp/s7-minscale1.log 2>&1 &
# IDLE_SECONDS=150 because Knative (defaults) removes the pod ~110s after the last request;
# the script's 90s default would measure a still-draining pod, not a cold start.
LABEL=$1
D=$(date -u +%F)
OUT=/tmp/s7
mkdir -p $OUT
GW=http://$(kubectl -n kourier-system get svc kourier-internal -o jsonpath='{.spec.clusterIP}')
for run in 1 2 3; do
  echo "[$(date -u +%T)] $LABEL run $run: waiting for backend replicas=1 and a quiet cluster"
  until [ "$(kubectl -n urbansync get deploy urbansync-backend -o jsonpath='{.status.replicas}')" = "1" ]; do sleep 20; done
  if [ "$LABEL" = "minscale0" ]; then
    echo "[$(date -u +%T)] waiting for receipt-annotator to be at 0 pods"
    until [ "$(kubectl -n urbansync get pods -l serving.knative.dev/service=receipt-annotator --no-headers 2>/dev/null | wc -l)" = "0" ]; do sleep 5; done
  fi
  P=$OUT/$D-coldstart-$LABEL-run$run-pods.txt
  echo "# receipt-annotator pods every 5s (UTC, total, ready)" > $P
  ( while true; do echo "$(date -u +%T) $(kubectl -n urbansync get pods -l serving.knative.dev/service=receipt-annotator --no-headers 2>/dev/null | awk '{n++; if ($2 ~ /^2\/2/) r++} END {print "pods="n+0, "ready="r+0}')"; sleep 5; done ) >> $P &
  W=$!
  echo "[$(date -u +%T)] $LABEL run $run: start"
  ~/.local/bin/k6 run -e GATEWAY=$GW -e IDLE_SECONDS=150 \
    --summary-trend-stats "avg,min,med,max,p(90),p(95),p(99)" \
    --summary-export $OUT/$D-coldstart-$LABEL-run$run-summary.json \
    --out json=$OUT/$D-coldstart-$LABEL-run$run.json.gz \
    /tmp/coldstart.js > $OUT/$D-coldstart-$LABEL-run$run-console.txt 2>&1
  echo "[$(date -u +%T)] $LABEL run $run: done"
  kill $W
done
echo "[$(date -u +%T)] $LABEL all runs done"
