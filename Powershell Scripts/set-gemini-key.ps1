# set-gemini-key.ps1
# Run this LOCALLY (never paste the key into any chat). It asks for the key
# on your own terminal, writes it into the two local secret files, applies
# the K8s Secret, and restarts the workloads that read it so the change
# takes effect immediately.
#
# Usage:  .\Powershell Scripts\set-gemini-key.ps1   (run from anywhere)

$ErrorActionPreference = "Stop"
$V2 = Join-Path (Split-Path $PSScriptRoot -Parent) 'urbansync-v2'

$secureKey = Read-Host -Prompt "Paste your real Gemini API key" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$key  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Error "Empty key, aborting."
    exit 1
}

$files = @(
    (Join-Path $V2 "k8s/overlays/local/plain-secrets.yaml"),
    (Join-Path $V2 "backend/.env")
)

foreach ($f in $files) {
    if (-not (Test-Path $f)) { Write-Warning "Missing $f, skipping"; continue }
    (Get-Content $f -Raw) -replace 'REPLACE_WITH_REAL_KEY', $key | Set-Content $f -NoNewline
    Write-Host "Updated $f"
}

# Apply the updated Secret to the live cluster (ArgoCD ignores this Secret's
# /data via ignoreDifferences, so this is the correct out-of-band path).
kubectl apply -f (Join-Path $V2 "k8s/overlays/local/plain-secrets.yaml")

# Restart workloads that read GEMINI_API_KEY so they pick up the new value.
kubectl rollout restart deployment/urbansync-backend -n urbansync
kubectl delete pod -n urbansync -l serving.knative.dev/service=receipt-annotator --ignore-not-found

Write-Host "`nDone. The key was written to disk and applied  -  it was never sent anywhere else."
