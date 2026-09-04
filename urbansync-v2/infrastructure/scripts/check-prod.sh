#!/usr/bin/env bash
# check-prod.sh — health check of the UrbanSync stack on the Azure VM (kubeadm single node).
#
# Run ON THE VM (ssh in first):
#   bash /opt/urbansync/infrastructure/scripts/check-prod.sh
#   bash /opt/urbansync/infrastructure/scripts/check-prod.sh --fix-knative   # also apply the tag-resolving patch
#
# Walks the receipt-upload path layer by layer and prints a verdict per layer:
#   ArgoCD app -> pods -> images in the local registry -> Knative revision -> Gemini secret
#   -> backend logs -> the real HTTP answer of /api/expenses/knative-extract (with its body).
# Nothing secret is printed (only lengths / prefixes).

set -u
NS=${NS:-urbansync}
FIX=0; [ "${1:-}" = "--fix-knative" ] && FIX=1

ok()   { printf '  \033[32m[OK]\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31m[FAIL]\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m[WARN]\033[0m %s\n' "$*"; }
hdr()  { printf '\n\033[36m== %s ==\033[0m\n' "$*"; }

hdr "1. ArgoCD application"
if kubectl get application -n argocd urbansync-prod >/dev/null 2>&1; then
  kubectl get application -n argocd urbansync-prod -o custom-columns='NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,REV:.status.sync.revision,BRANCH:.spec.source.targetRevision' 2>/dev/null
  sync=$(kubectl get application -n argocd urbansync-prod -o jsonpath='{.status.sync.status}')
  health=$(kubectl get application -n argocd urbansync-prod -o jsonpath='{.status.health.status}')
  [ "$sync" = "Synced" ] && ok "Synced" || bad "sync status: $sync (something in git is not applied)"
  [ "$health" = "Healthy" ] && ok "Healthy" || bad "health: $health"
else
  warn "no Application 'urbansync-prod' in namespace argocd (name differs? kubectl get application -A)"
fi

hdr "2. Pods in $NS"
kubectl get pods -n $NS -o wide 2>/dev/null
notready=$(kubectl get pods -n $NS --no-headers 2>/dev/null | awk '$3!="Running" && $3!="Completed"{print $1" ("$3")"}')
[ -z "$notready" ] && ok "all pods Running" || bad "not running: $notready"

hdr "3. Images the manifests want vs. what the local registry has"
for d in urbansync-backend urbansync-frontend; do
  img=$(kubectl get deploy -n $NS $d -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)
  echo "  $d -> $img"
done
kimg=$(kubectl get ksvc -n $NS receipt-annotator -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)
echo "  receipt-annotator (ksvc) -> ${kimg:-<no ksvc>}"
if curl -fs http://localhost:5000/v2/_catalog >/dev/null 2>&1; then
  ok "registry answers on localhost:5000"
  for img in $(kubectl get deploy -n $NS -o jsonpath='{range .items[*]}{.spec.template.spec.containers[0].image}{"\n"}{end}' 2>/dev/null; echo "$kimg"); do
    [ -z "$img" ] && continue
    case "$img" in localhost:5000/*) ;; *) continue;; esac
    repo=${img#localhost:5000/}; name=${repo%%:*}; tag=${repo##*:}
    if curl -fs "http://localhost:5000/v2/$name/manifests/$tag" -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' >/dev/null 2>&1 \
       || curl -fs "http://localhost:5000/v2/$name/manifests/$tag" -H 'Accept: application/vnd.oci.image.manifest.v1+json' >/dev/null 2>&1 \
       || curl -fs "http://localhost:5000/v2/$name/manifests/$tag" -H 'Accept: application/vnd.oci.image.index.v1+json' >/dev/null 2>&1; then
      ok "$name:$tag present in registry"
    else
      bad "$name:$tag NOT in registry -> Jenkins never built/pushed this tag (run the job with FORCE_BUILD)"
    fi
  done
else
  bad "registry not reachable on localhost:5000 (docker ps | grep registry)"
fi

hdr "4. Knative receipt-annotator"
if kubectl get ksvc -n $NS receipt-annotator >/dev/null 2>&1; then
  kubectl get ksvc -n $NS receipt-annotator 2>/dev/null
  ready=$(kubectl get ksvc -n $NS receipt-annotator -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
  reason=$(kubectl get ksvc -n $NS receipt-annotator -o jsonpath='{.status.conditions[?(@.type=="Ready")].reason}')
  msg=$(kubectl get ksvc -n $NS receipt-annotator -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}')
  if [ "$ready" = "True" ]; then ok "ksvc Ready"; else bad "ksvc not Ready: $reason — $msg"; fi
  skip=$(kubectl get cm config-deployment -n knative-serving -o jsonpath='{.data.registries-skipping-tag-resolving}' 2>/dev/null)
  case "$skip" in
    *localhost:5000*) ok "config-deployment skips tag resolution for localhost:5000";;
    *) bad "config-deployment does NOT skip localhost:5000 -> controller cannot resolve the image digest (dial tcp [::1]:5000 refused)"
       if [ $FIX = 1 ]; then
         kubectl patch configmap/config-deployment -n knative-serving --type merge \
           -p '{"data":{"registries-skipping-tag-resolving":"kind.local,ko.local,dev.local,localhost:5000"}}' \
           && ok "patched; deleting failed revisions so they get re-created" \
           && kubectl delete revision -n $NS -l serving.knative.dev/service=receipt-annotator --ignore-not-found
         echo "  re-run this script in ~30s"
       else
         echo "  -> re-run with --fix-knative (or run the Ansible playbook, task 4b.5e2)"
       fi;;
  esac
  echo "  revisions:"; kubectl get revision -n $NS -l serving.knative.dev/service=receipt-annotator 2>/dev/null | sed 's/^/    /'
else
  bad "no ksvc receipt-annotator in $NS (kubectl get crd services.serving.knative.dev ; is Knative installed?)"
fi
kubectl get pods -n knative-serving --no-headers 2>/dev/null | awk '$3!="Running"{print "  [WARN] knative-serving pod not running: "$1" "$3}'
kubectl get pods -n kourier-system --no-headers 2>/dev/null | awk '$3!="Running"{print "  [WARN] kourier pod not running: "$1" "$3}'

hdr "5. Secrets reaching the pods (lengths only)"
bp=$(kubectl get pods -n $NS -l app=urbansync-backend --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$bp" ]; then
  glen=$(kubectl exec -n $NS "$bp" -- sh -c 'printf %s "$GEMINI_API_KEY" | wc -c' 2>/dev/null | tr -d ' ')
  gpre=$(kubectl exec -n $NS "$bp" -- sh -c 'printf %.4s "$GEMINI_API_KEY"' 2>/dev/null)
  if [ "${glen:-0}" -gt 30 ]; then ok "GEMINI_API_KEY in backend: length $glen, prefix $gpre"
  else bad "GEMINI_API_KEY in backend has length ${glen:-0} (placeholder REPLACE_WITH_REAL_KEY? Key Vault / SOPS value missing)"; fi
  for v in RECEIPT_ANNOTATOR_URL GEMINI_MODEL GEMINI_THINKING_LEVEL GEMINI_HEDGE_AFTER_MS GEMINI_MAX_HEDGES MONGO_URI MINIO_ENDPOINT RABBITMQ_URL; do
    val=$(kubectl exec -n $NS "$bp" -- sh -c "printenv $v" 2>/dev/null)
    case "$v" in MONGO_URI|RABBITMQ_URL) [ -n "$val" ] && echo "  $v = <set, ${#val} chars>" || warn "$v not set";;
                 *) echo "  $v = ${val:-<not set>}";; esac
  done
else
  bad "no running backend pod"
fi
slen=$(kubectl get secret -n $NS urbansync-secrets -o jsonpath='{.data.gemini-api-key}' 2>/dev/null | base64 -d 2>/dev/null | wc -c | tr -d ' ')
[ "${slen:-0}" -gt 30 ] && ok "Secret urbansync-secrets/gemini-api-key length $slen" || warn "Secret urbansync-secrets/gemini-api-key length ${slen:-0} (prod may use the CSI-synced secret instead)"

hdr "6. Last backend errors"
[ -n "$bp" ] && kubectl logs -n $NS "$bp" --tail=300 2>/dev/null | grep -iE 'error|circuit|knative|extract|ECONN|ENOTFOUND|timeout' | tail -15 | sed 's/^/  /'

hdr "7. The real answer of the endpoint (needs a JWT)"
HOST=${HOST:-http://localhost}
if [ -n "${URBANSYNC_TOKEN:-}" ]; then
  tmpf=$(mktemp); printf 'x' > "$tmpf.jpg"
  code=$(curl -s -o "$tmpf" -w '%{http_code}' -X POST "$HOST/api/expenses/knative-extract" \
           -H "Authorization: $URBANSYNC_TOKEN" -F "receipt=@$tmpf.jpg;type=image/jpeg" -D "$tmpf.h")
  echo "  HTTP $code"; grep -iE 'x-extraction|retry-after' "$tmpf.h" | sed 's/^/  /'
  echo "  body: $(head -c 600 "$tmpf")"; rm -f "$tmpf" "$tmpf.jpg" "$tmpf.h"
  case "$code" in
    200) ok "extraction works end-to-end";;
    502) bad "502 from OUR backend = the call to receipt-annotator failed; the 'detail' field above says why";;
    503) bad "503 = circuit breaker OPEN (Knative was failing repeatedly); fix Knative, wait 30s, retry";;
    504) bad "504 = timeout (Gemini slow / cold start > 90s?)";;
    *)   warn "unexpected $code";;
  esac
else
  echo "  export URBANSYNC_TOKEN='<jwt from browser localStorage>' and re-run to test the endpoint itself."
  echo "  (Or: curl -s -X POST $HOST/api/login -H 'Content-Type: application/json' -d '{\"email\":\"...\",\"password\":\"...\"}')"
fi

hdr "8. Knative function logs (if a pod is up right now)"
kubectl logs -n $NS -l serving.knative.dev/service=receipt-annotator -c user-container --tail=30 2>/dev/null | sed 's/^/  /' || echo "  (scaled to zero)"
echo
