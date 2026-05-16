# Bridges host port 80 to the nginx ingress controller inside the K8s cluster.
# Required on Docker Desktop for Windows — LoadBalancer services don't bind to
# localhost automatically (they do on Mac; this is the Windows workaround).
#
# Usage:
#   .\start-portforward.ps1          # runs in background, returns immediately
#   .\start-portforward.ps1 -Wait    # blocks the terminal (useful for debugging)

param([switch]$Wait)

if ($Wait) {
    kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80
} else {
    $job = Start-Job { kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80 }
    Write-Host "Port-forward running as background job (ID: $($job.Id))"
    Write-Host "App available at: http://localhost"
    Write-Host "To stop: Stop-Job $($job.Id)"
}
