# rebuild-ai-images.ps1
# Rebuilds the two images that contain the Gemini code (backend + receipt-annotator),
# pushes them to the local registry under BOTH tags the manifests may reference
# (":latest" for overlays/local and the Jenkins SHA tag pinned in base/), then
# restarts the workloads so they pull the new image (imagePullPolicy: Always).
#
# Usage (from the repo root or from Powershell Scripts\):
#   .\rebuild-ai-images.ps1                 # build + push + restart + show startup logs
#   .\rebuild-ai-images.ps1 -SkipBuild      # only restart + logs
#   .\rebuild-ai-images.ps1 -Tag efdb6f1b   # override the SHA tag if Jenkins bumped it
#   .\rebuild-ai-images.ps1 -IncludeFrontend  # frontend changed too (e.g. ExpensesCharge.js)
#
# PowerShell 5.1 compatible. No secrets are read or printed.

param(
    [string]$Registry  = 'localhost:5000',
    [string]$Tag       = '',              # empty = read from k8s/base/backend/deployment.yaml
    [string]$Namespace = 'urbansync',
    [switch]$SkipBuild,
    [switch]$NoCache,
    [switch]$IncludeFrontend       # also rebuild/restart urbansync-frontend
)

$ErrorActionPreference = 'Stop'

# --- locate repo root (this file lives in <root>\Powershell Scripts\) -------------
$root = Split-Path -Parent $PSScriptRoot
$v2   = Join-Path $root 'urbansync-v2'
if (-not (Test-Path (Join-Path $v2 'backend\Dockerfile'))) {
    Write-Host "Cannot find urbansync-v2\backend\Dockerfile under $root" -ForegroundColor Red; exit 1
}

# --- resolve the SHA tag pinned by Jenkins in base/ --------------------------------
if (-not $Tag) {
    $line = Select-String -Path (Join-Path $v2 'k8s\base\backend\deployment.yaml') -Pattern 'image:\s*\S+:(\w+)' | Select-Object -First 1
    if ($line) { $Tag = $line.Matches[0].Groups[1].Value }
}
if (-not $Tag) { Write-Host "Could not determine SHA tag; pass -Tag" -ForegroundColor Red; exit 1 }
Write-Host ("Registry: {0}   tags: latest, {1}" -f $Registry, $Tag) -ForegroundColor Cyan

$images = @(
    @{ name = 'urbansync-backend';           ctx = (Join-Path $v2 'backend') },
    @{ name = 'urbansync-receipt-annotator'; ctx = (Join-Path $v2 'knative\receipt-annotator') }
)
if ($IncludeFrontend) { $images += @{ name = 'urbansync-frontend'; ctx = (Join-Path $v2 'frontend') } }

if (-not $SkipBuild) {
    foreach ($img in $images) {
        $full = "$Registry/$($img.name)"
        Write-Host ("`n=== build {0} ===" -f $img.name) -ForegroundColor Yellow
        $args = @('build', '-t', "${full}:latest", '-t', "${full}:$Tag", $img.ctx)
        if ($NoCache) { $args = @('build', '--no-cache') + $args[1..($args.Length-1)] }
        & docker @args
        if ($LASTEXITCODE -ne 0) { Write-Host "docker build failed for $($img.name)" -ForegroundColor Red; exit 1 }
        & docker push "${full}:latest"
        & docker push "${full}:$Tag"
        if ($LASTEXITCODE -ne 0) { Write-Host "docker push failed for $($img.name)" -ForegroundColor Red; exit 1 }
    }
    # sanity: the hedging code must be in the image
    Write-Host "`n=== verify image content ===" -ForegroundColor Yellow
    & docker run --rm --entrypoint sh "$Registry/urbansync-backend:latest" -c "grep -c generateHedged /app/services/aiService.js"
    & docker run --rm --entrypoint sh "$Registry/urbansync-receipt-annotator:latest" -c "grep -c generateHedged /app/index.js"
}

# --- restart workloads --------------------------------------------------------------
Write-Host "`n=== restart backend ===" -ForegroundColor Yellow
kubectl rollout restart deployment/urbansync-backend -n $Namespace
kubectl rollout status  deployment/urbansync-backend -n $Namespace --timeout=180s
if ($IncludeFrontend) {
    Write-Host "`n=== restart frontend ===" -ForegroundColor Yellow
    kubectl rollout restart deployment/urbansync-frontend -n $Namespace
    kubectl rollout status  deployment/urbansync-frontend -n $Namespace --timeout=180s
}

Write-Host "`n=== restart knative function (delete pod, scale-to-zero will recreate on demand) ===" -ForegroundColor Yellow
$kpods = kubectl get pods -n $Namespace -l serving.knative.dev/service=receipt-annotator -o name 2>$null
if ($kpods) { $kpods | ForEach-Object { kubectl delete -n $Namespace $_ --wait=false } } else { Write-Host "(no function pod running - fine, it is scaled to zero)" }

# --- show that the new config is live ------------------------------------------------
Write-Host "`n=== backend env (Gemini settings) ===" -ForegroundColor Yellow
$bp = (kubectl get pods -n $Namespace -l app=urbansync-backend -o json | ConvertFrom-Json).items |
      Where-Object { $_.status.phase -eq 'Running' -and -not $_.metadata.deletionTimestamp } | Select-Object -First 1
if ($bp) {
    kubectl exec -n $Namespace $bp.metadata.name -- sh -c 'printenv | grep -E "^GEMINI_|^RECEIPT_ANNOTATOR" | sort'
    Write-Host "`nBackend pod: $($bp.metadata.name)" -ForegroundColor Green
    Write-Host "Follow logs with:  kubectl logs -n $Namespace $($bp.metadata.name) -f | Select-String gemini,hedge,Knative,extract" -ForegroundColor DarkGray
} else {
    Write-Host "No running backend pod found yet" -ForegroundColor Red
}

Write-Host "`nNow upload 3-4 receipts in the UI and watch for lines like:" -ForegroundColor Cyan
Write-Host "  [gemini] hedge #1 sent at +3001ms" -ForegroundColor DarkGray
Write-Host "  [gemini] attempt #1 won in 3980ms (2 in flight, 1 aborted)" -ForegroundColor DarkGray
Write-Host "Function logs:  kubectl logs -n $Namespace -l serving.knative.dev/service=receipt-annotator -c user-container -f" -ForegroundColor DarkGray
