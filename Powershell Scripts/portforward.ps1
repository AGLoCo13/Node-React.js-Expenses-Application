# =============================================================================
#  portforward.ps1  -  manage every port-forward this stack needs, in one place
#
#  Port-forwards are ONLY for reaching things from Windows. Nothing inside the
#  cluster needs them: backend talks to mongodb:27017, rabbitmq:5672 and
#  minio:9000 over cluster DNS, and the frontend's nginx proxies /api/ to
#  backend:5000 internally. The app needs exactly one forward - the ingress.
#
#  Jenkins (8080) and the registry (5000) run in Docker Compose, not in
#  Kubernetes, so they are already on localhost and never appear here.
#
#  Usage:
#      .\Powershell Scripts\portforward.ps1                 # app only - what you need to use the app
#      .\Powershell Scripts\portforward.ps1 -All            # app + every admin UI
#      .\Powershell Scripts\portforward.ps1 -Only argocd,minio
#      .\Powershell Scripts\portforward.ps1 -Status         # what is running
#      .\Powershell Scripts\portforward.ps1 -Stop           # stop everything
#
#  Forwards run as background jobs and die when you close the terminal.
# =============================================================================

[CmdletBinding(DefaultParameterSetName = 'Start')]
param(
    [Parameter(ParameterSetName='Start')]
    [ValidateSet('app','argocd','rabbitmq','minio','thingsboard','nodered','mongodb')]
    [string[]]$Only,

    [Parameter(ParameterSetName='Start')]
    [switch]$All,

    [Parameter(ParameterSetName='Stop')]
    [switch]$Stop,

    [Parameter(ParameterSetName='Status')]
    [switch]$Status
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }

# Local port : cluster target. Local ports match what README.md and SETUP.md
# document, so existing notes and bookmarks keep working.
$FORWARDS = [ordered]@{
    app         = @{ Ns='ingress-nginx'; Svc='svc/ingress-nginx-controller'; Map='80:80';
                     Url='http://localhost';        Note='the application itself' }
    argocd      = @{ Ns='argocd';        Svc='svc/argocd-server';            Map='8081:443';
                     Url='https://localhost:8081';  Note='GitOps UI (self-signed cert warning is expected)' }
    rabbitmq    = @{ Ns='urbansync';     Svc='svc/rabbitmq';                 Map='15672:15672';
                     Url='http://localhost:15672';  Note='admin / admin123' }
    minio       = @{ Ns='urbansync';     Svc='svc/minio';                    Map='9001:9001';
                     Url='http://localhost:9001';   Note='admin / password123' }
    thingsboard = @{ Ns='urbansync';     Svc='svc/thingsboard';              Map='9090:9090';
                     Url='http://localhost:9090';   Note='tenant@thingsboard.org / tenant' }
    nodered     = @{ Ns='urbansync';     Svc='svc/nodered';                  Map='1880:1880';
                     Url='http://localhost:1880';   Note='device simulator flows' }
    mongodb     = @{ Ns='urbansync';     Svc='svc/mongodb';                  Map='27017:27017';
                     Url='mongodb://localhost:27017'; Note='for Compass / mongoimport from Windows' }
}

$TAG = 'urbansync-pf'

function Get-Forwards { Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "$TAG-*" } }

# --- status ------------------------------------------------------------------
if ($Status) {
    $jobs = Get-Forwards
    if (-not $jobs) { Write-Host "`nNo port-forwards running." -ForegroundColor Yellow; return }
    Write-Host ''
    $jobs | ForEach-Object {
        $key = $_.Name -replace "^$TAG-", ''
        $colour = if ($_.State -eq 'Running') { 'Green' } else { 'Red' }
        Write-Host ("  {0,-12} {1,-10} {2}" -f $key, $_.State, $FORWARDS[$key].Url) -ForegroundColor $colour
    }
    Write-Host ''
    return
}

# --- stop --------------------------------------------------------------------
if ($Stop) {
    $jobs = Get-Forwards
    if (-not $jobs) { Write-Host "`nNothing to stop." -ForegroundColor Yellow; return }
    $jobs | Stop-Job -PassThru | Remove-Job -Force
    Write-Host "`nStopped $($jobs.Count) port-forward(s)." -ForegroundColor Green
    return
}

# --- start -------------------------------------------------------------------
$wanted = if ($All) { $FORWARDS.Keys } elseif ($Only) { $Only } else { @('app') }

kubectl get nodes *>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'Cluster not reachable.' -ForegroundColor Red; exit 1 }

Write-Host ''
foreach ($key in $wanted) {
    $f    = $FORWARDS[$key]
    $name = "$TAG-$key"

    # Already up? Leave it alone rather than fighting over the local port.
    if (Get-Job -Name $name -ErrorAction SilentlyContinue) {
        Write-Host ("  {0,-12} already running  {1}" -f $key, $f.Url) -ForegroundColor DarkGray
        continue
    }

    # Confirm the Service exists first - otherwise the job starts, fails
    # silently in the background, and you only find out when the page won't load.
    kubectl get $f.Svc -n $f.Ns *>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("  {0,-12} SKIPPED - {1} not found in namespace {2}" -f $key, $f.Svc, $f.Ns) -ForegroundColor Yellow
        continue
    }

    $local = ($f.Map -split ':')[0]
    $inUse = Get-NetTCPConnection -LocalPort $local -State Listen -ErrorAction SilentlyContinue
    if ($inUse) {
        Write-Host ("  {0,-12} SKIPPED - local port {1} already in use" -f $key, $local) -ForegroundColor Yellow
        continue
    }

    Start-Job -Name $name -ScriptBlock {
        param($ns, $svc, $map)
        kubectl port-forward -n $ns $svc $map
    } -ArgumentList $f.Ns, $f.Svc, $f.Map | Out-Null

    Write-Host ("  {0,-12} -> {1,-28} {2}" -f $key, $f.Url, $f.Note) -ForegroundColor Green
}

Start-Sleep -Seconds 2
$dead = Get-Forwards | Where-Object { $_.State -ne 'Running' }
if ($dead) {
    Write-Host "`nThese failed to start:" -ForegroundColor Red
    $dead | ForEach-Object { Write-Host "  $($_.Name): $(Receive-Job $_ 2>&1 | Select-Object -First 2)" }
}

Write-Host @"

  .\portforward.ps1 -Status    what is running
  .\portforward.ps1 -Stop      stop all
  .\portforward.ps1 -All       add every admin UI

  Not port-forwards - already on localhost via Docker Compose:
    Jenkins    http://localhost:8080
    Registry   http://localhost:5000/v2/_catalog
"@ -ForegroundColor Cyan
