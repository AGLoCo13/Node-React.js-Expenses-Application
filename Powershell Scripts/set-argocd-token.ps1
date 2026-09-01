# set-argocd-token.ps1
# Sets the real GitHub PAT that ArgoCD uses to read the repo, then applies it
# and asks ArgoCD to sync. Run this LOCALLY - the token is never pasted into
# any chat.
#
# Usage:  .\Powershell Scripts\set-argocd-token.ps1   (run from anywhere)

$ErrorActionPreference = "Stop"
$V2 = Join-Path (Split-Path $PSScriptRoot -Parent) 'urbansync-v2'

Write-Host "GitHub Settings -> Developer settings -> Personal access tokens (classic)"
Write-Host "  -> Generate new token (classic), scope: 'repo' (read access is enough for a private repo)."
Write-Host ""

$secureToken = Read-Host -Prompt "Paste the GitHub PAT for ArgoCD" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error "Empty token, aborting."
    exit 1
}
if ($token.Length -lt 36) {
    Write-Warning "That's shorter than a normal GitHub classic PAT (usually 40 chars incl. 'ghp_') - double check you copied the whole thing."
}

$repoSecretFile = Join-Path $V2 "infrastructure\argocd\repo-secret.yaml"
if (-not (Test-Path $repoSecretFile)) { Write-Error "Missing $repoSecretFile"; exit 1 }

(Get-Content $repoSecretFile -Raw) -replace 'password:\s*ghp_REPLACE_WITH_YOUR_CLASSIC_PAT', "password: $token" | Set-Content $repoSecretFile -NoNewline
Write-Host "Updated $repoSecretFile"

kubectl apply -f $repoSecretFile
if ($LASTEXITCODE -ne 0) { Write-Error "kubectl apply failed - is the cluster reachable?"; exit 1 }

# Nudge ArgoCD to re-read the repo and Application right away instead of
# waiting for its normal 3-minute poll.
kubectl -n argocd annotate application urbansync-local argocd.argoproj.io/refresh=hard --overwrite
if ($LASTEXITCODE -ne 0) { Write-Warning "Could not annotate the Application for refresh - check it exists: kubectl get application -n argocd" }

Write-Host "`nDone. Open the ArgoCD UI and check Sync Status - should move off 'Unknown' within ~10-20s."
