# =============================================================================
#  seed-db-in-pod.ps1
#
#  Seeds MongoDB WITHOUT installing MongoDB Database Tools on Windows.
#  The official mongo image already ships mongoimport, so we copy the JSON
#  files into the pod and run the import in there.
#
#  Use this instead of import-db-k8s.ps1 when `mongoimport` is not on PATH.
#
#  Run from anywhere (path-independent):
#      .\Powershell Scripts\seed-db-in-pod.ps1
# =============================================================================

[CmdletBinding()]
param(
    [string]$Namespace  = 'urbansync',
    [string]$Pod        = 'mongodb-0',
    [string]$Database   = 'commons-db',
    [string]$User       = 'admin',
    [string]$Password   = 'admin123'
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }

$COLLECTIONS = @('users','profiles','buildings','apartments','expenses','consumptions','payments')

function Ok   { param($t) Write-Host "    ok  $t"  -ForegroundColor Green }
function Warn { param($t) Write-Host "    !!  $t"  -ForegroundColor Yellow }
function Die  { param($t) Write-Host "`nFAILED: $t" -ForegroundColor Red; exit 1 }

$jsonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'JSON DB Collections'
if (-not (Test-Path $jsonDir)) { Die "cannot find '$jsonDir'" }

Write-Host "`n=== Seeding $Database in $Namespace/$Pod ===" -ForegroundColor Cyan

# --- pod reachable? ----------------------------------------------------------
kubectl get pod $Pod -n $Namespace *>$null
if ($LASTEXITCODE -ne 0) { Die "pod $Pod not found in namespace $Namespace" }

kubectl wait --for=condition=ready pod/$Pod -n $Namespace --timeout=120s *>$null
if ($LASTEXITCODE -ne 0) { Die "pod $Pod is not ready" }
Ok 'mongodb pod ready'

# --- mongoimport present in the image? ---------------------------------------
kubectl exec -n $Namespace $Pod -- sh -c 'command -v mongoimport' *>$null
if ($LASTEXITCODE -ne 0) {
    Die @'
mongoimport is not inside the mongo container either.
Install MongoDB Database Tools on Windows instead:
    winget install MongoDB.DatabaseTools
then open a NEW terminal and run .\Powershell Scripts\import-db-k8s.ps1
'@
}
Ok 'mongoimport available inside the pod'

# --- stage the files somewhere kubectl cp can cope with ----------------------
# kubectl cp splits its arguments on ':' to separate pod from path, so a Windows
# path like C:\Users\... is parsed as pod "C". The folder name also contains
# spaces. Staging to a short temp dir and copying with relative names avoids
# both problems.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) 'urbansync-seed'
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging -Force | Out-Null

foreach ($c in $COLLECTIONS) {
    $src = Join-Path $jsonDir "$c.json"
    if (-not (Test-Path $src)) { Die "missing $src" }
    Copy-Item $src $staging          # binary copy - Greek text stays intact
}
Ok "staged $($COLLECTIONS.Count) files"

kubectl exec -n $Namespace $Pod -- mkdir -p /tmp/seed
if ($LASTEXITCODE -ne 0) { Die 'could not create /tmp/seed in the pod' }

Push-Location $staging
try {
    foreach ($c in $COLLECTIONS) {
        # Relative filename on purpose - no drive letter, no colon.
        kubectl cp "$c.json" "$Namespace/${Pod}:/tmp/seed/$c.json"
        if ($LASTEXITCODE -ne 0) { Die "kubectl cp failed for $c.json" }
    }
} finally { Pop-Location }
Ok 'files copied into the pod'

# --- import ------------------------------------------------------------------
# --drop makes this re-runnable: each collection is replaced, not appended to.
$failed = @()
foreach ($c in $COLLECTIONS) {
    Write-Host "    importing $c..."
    kubectl exec -n $Namespace $Pod -- mongoimport `
        --db $Database `
        --authenticationDatabase admin `
        -u $User -p $Password `
        --collection $c `
        --file "/tmp/seed/$c.json" `
        --drop
    if ($LASTEXITCODE -ne 0) { $failed += $c; Warn "$c FAILED" }
}

kubectl exec -n $Namespace $Pod -- rm -rf /tmp/seed | Out-Null
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue

if ($failed.Count -gt 0) { Die "these collections failed: $($failed -join ', ')" }

# --- verify ------------------------------------------------------------------
Write-Host "`n--- document counts ---"
# $($_) rather than $_ : inside a double-quoted string, "$_.countDocuments"
# parses as a property access on $_ and silently evaluates to nothing, and
# "$_:" risks being read as a scope qualifier. The subexpression form ends the
# variable explicitly so the rest stays literal JS.
$js = ($COLLECTIONS | ForEach-Object {
    "print('$($_)' + ': ' + db.$($_).countDocuments({}))"
}) -join '; '

kubectl exec -n $Namespace $Pod -- mongosh `
    "mongodb://${User}:${Password}@localhost:27017/${Database}?authSource=admin" `
    --quiet --eval $js
if ($LASTEXITCODE -ne 0) { Warn 'could not read back counts (mongosh missing?) - the import itself succeeded' }

Write-Host @"

Seeded. Log in with:
   admin@example.com   / Admin!123        (site admin)
   tonyGeo@gmail.com   / 1234567890123    (building admin)
   thkam@example.com   / 1234567          (tenant)
"@ -ForegroundColor Green
