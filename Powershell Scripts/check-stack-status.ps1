# check-stack-status.ps1
# One-shot diagnostic dump of the whole local stack. Run it and paste the
# full output back  -  it answers "what works / what doesn't" in one go.
#
# Usage:  cd urbansync-v2 ; .\check-stack-status.ps1 | Tee-Object status.txt

Write-Host "`n===== NAMESPACE PODS =====" -ForegroundColor Cyan
kubectl get pods -n urbansync -o wide

Write-Host "`n===== KNATIVE SERVICES =====" -ForegroundColor Cyan
kubectl get ksvc -n urbansync -o wide

Write-Host "`n===== KNATIVE REVISIONS =====" -ForegroundColor Cyan
kubectl get revisions -n urbansync -o wide

Write-Host "`n===== KNATIVE ROUTES =====" -ForegroundColor Cyan
kubectl get routes -n urbansync -o wide

Write-Host "`n===== receipt-annotator PODS (if any currently scaled up) =====" -ForegroundColor Cyan
kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator -o wide

Write-Host "`n===== receipt-annotator LAST LOGS (current + previous) =====" -ForegroundColor Cyan
$revPod = kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator -o jsonpath='{.items[0].metadata.name}' 2>$null
if ($revPod) {
    kubectl logs $revPod -n urbansync --all-containers --tail=80
    kubectl logs $revPod -n urbansync --all-containers --tail=80 --previous 2>$null
} else {
    Write-Host "No receipt-annotator pod currently running (expected if scaled to zero)."
}

Write-Host "`n===== ARGOCD APP STATUS =====" -ForegroundColor Cyan
kubectl get application -n argocd -o wide 2>$null

Write-Host "`n===== JENKINS POD =====" -ForegroundColor Cyan
kubectl get pods -n jenkins -o wide 2>$null

Write-Host "`n===== HPA (should be empty until Phase implemented) =====" -ForegroundColor Cyan
kubectl get hpa -n urbansync 2>$null

Write-Host "`n===== IMAGES IN LOCAL REGISTRY =====" -ForegroundColor Cyan
try {
    Invoke-RestMethod http://localhost:5000/v2/_catalog
} catch { Write-Host "Registry not reachable on localhost:5000 right now." }

Write-Host "`n===== BACKEND POD RESTART COUNT (flags crash loops) =====" -ForegroundColor Cyan
kubectl get pods -n urbansync -l app=urbansync-backend

Write-Host "`n===== GEMINI_API_KEY SANITY CHECK (inside the live backend pod) =====" -ForegroundColor Cyan
$backendPod = kubectl get pods -n urbansync -l app=urbansync-backend -o jsonpath='{.items[0].metadata.name}' 2>$null
if ($backendPod) {
    Write-Host "pod: $backendPod"
    kubectl exec -n urbansync $backendPod -- sh -c 'echo "length: ${#GEMINI_API_KEY}"'
    kubectl exec -n urbansync $backendPod -- sh -c 'echo "prefix: $(echo $GEMINI_API_KEY | cut -c1-6)"'
} else {
    Write-Host "No backend pod found."
}

Write-Host "`n===== BACKEND LOGS - AI Extraction errors (real Gemini error hides here) =====" -ForegroundColor Cyan
if ($backendPod) {
    kubectl logs $backendPod -n urbansync --tail=200 | Select-String -Pattern "AI Extraction Error", "GoogleGenerativeAI", "gemini", "429", "401", "403", "API key" -Context 0,3
}

Write-Host "`nDone. Paste this whole block back."
