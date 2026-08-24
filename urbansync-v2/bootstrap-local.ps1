# =============================================================================
#  UrbanSync v2 - bootstrap-local.ps1
#
#  Brings the full local stack up on Docker Desktop for Windows:
#    registry -> ingress -> Knative -> images -> K8s -> ArgoCD -> Jenkins -> seed
#
#  Run from the repo root:
#      .\urbansync-v2\bootstrap-local.ps1
#
#  Re-runnable: every step is idempotent, so you can rerun after a failure.
#
#  Flags:
#      -SkipCluster   Skip registry/ingress/Knative install (already done)
#      -SkipBuild     Skip docker build/push of the three app images
#      -SkipArgo      Skip the ArgoCD install + Application
#      -SkipJenkins   Skip the Jenkins container
#      -SkipSeed      Skip the MongoDB seed
# =============================================================================

[CmdletBinding()]
param(
    [switch]$SkipCluster,
    [switch]$SkipBuild,
    [switch]$SkipArgo,
    [switch]$SkipJenkins,
    [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'

# PowerShell 7.4+ turns a non-zero native exit code into a terminating error and
# honours $ErrorActionPreference for it. That would abort the script before our
# own `if ($LASTEXITCODE -ne 0)` checks and Warn-and-continue paths ever run,
# and would leave Push-Location unbalanced. Opt out; we check exit codes by hand.
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }

$KNATIVE = 'knative-v1.14.0'
$INGRESS = 'controller-v1.10.1'

# Resolve repo root from this script's location (script lives in urbansync-v2/)
$V2   = $PSScriptRoot
$ROOT = Split-Path $V2 -Parent

function Step { param($n, $t) Write-Host "`n=== [$n] $t ===" -ForegroundColor Cyan }
function Ok   { param($t) Write-Host "    ok  $t" -ForegroundColor Green }
function Warn { param($t) Write-Host "    !!  $t" -ForegroundColor Yellow }
function Die  { param($t) Write-Host "`nFAILED: $t" -ForegroundColor Red; exit 1 }

function Need {
    param($cmd, $hint)
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "$cmd not on PATH. $hint" }
    Ok "$cmd found"
}

# -----------------------------------------------------------------------------
Step 0 'Preflight'
# -----------------------------------------------------------------------------
Need docker  'Install Docker Desktop.'
Need kubectl 'Bundled with Docker Desktop - enable Kubernetes in Settings.'

docker info *>$null
if ($LASTEXITCODE -ne 0) { Die 'Docker daemon not reachable. Start Docker Desktop.' }
Ok 'docker daemon up'

$ctx = (kubectl config current-context 2>$null)
if ($LASTEXITCODE -ne 0) { Die 'No kubectl context. Enable Kubernetes in Docker Desktop -> Settings -> Kubernetes.' }
if ($ctx -ne 'docker-desktop') { Warn "kubectl context is '$ctx', not 'docker-desktop'. Continuing anyway." }
else { Ok "context: $ctx" }

kubectl get nodes *>$null
if ($LASTEXITCODE -ne 0) { Die 'Cluster not responding. Wait for Docker Desktop Kubernetes to go green.' }
Ok 'cluster reachable'

# Required config files (all gitignored - see SETUP-LOCAL-K8S.md)
$secretsFile = Join-Path $V2 'k8s\overlays\local\plain-secrets.yaml'
$jenkinsEnv  = Join-Path $V2 'infrastructure\jenkins\.env'
$repoSecret  = Join-Path $V2 'infrastructure\argocd\repo-secret.yaml'

if (-not (Test-Path $secretsFile)) { Die "Missing $secretsFile - see SETUP-LOCAL-K8S.md" }
if (Select-String -Path $secretsFile -Pattern 'REPLACE_WITH_REAL_KEY' -Quiet) {
    Warn 'plain-secrets.yaml still has REPLACE_WITH_REAL_KEY for gemini-api-key.'
    Warn 'Everything else works; only AI receipt parsing will fail.'
}
Ok 'plain-secrets.yaml present'

if (-not $SkipArgo -and -not (Test-Path $repoSecret)) { Die "Missing $repoSecret - see SETUP-LOCAL-K8S.md" }
if (-not $SkipJenkins -and -not (Test-Path $jenkinsEnv)) { Die "Missing $jenkinsEnv - see SETUP-LOCAL-K8S.md" }

# -----------------------------------------------------------------------------
if (-not $SkipCluster) {
Step 1 'Local container registry (localhost:5000)'
    Push-Location (Join-Path $V2 'infrastructure\registry')
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die 'registry failed to start' }
    Pop-Location

    $tries = 0
    do {
        Start-Sleep -Seconds 2; $tries++
        try { $r = Invoke-WebRequest 'http://localhost:5000/v2/' -UseBasicParsing -TimeoutSec 3; $up = $r.StatusCode -eq 200 }
        catch { $up = $false }
    } while (-not $up -and $tries -lt 15)
    if (-not $up) { Die 'registry not answering on localhost:5000' }
    Ok 'registry up'

Step 2 'nginx ingress controller'
    kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/$INGRESS/deploy/static/provider/cloud/deploy.yaml"
    if ($LASTEXITCODE -ne 0) { Die 'ingress-nginx apply failed' }
    kubectl wait --namespace ingress-nginx --for=condition=ready pod `
        --selector=app.kubernetes.io/component=controller --timeout=180s
    if ($LASTEXITCODE -ne 0) { Warn 'ingress controller not ready yet - check: kubectl get pods -n ingress-nginx' }
    else { Ok 'ingress-nginx ready' }

Step 3 "Knative Serving $KNATIVE"
    kubectl apply -f "https://github.com/knative/serving/releases/download/$KNATIVE/serving-crds.yaml"
    if ($LASTEXITCODE -ne 0) { Die 'knative serving-crds apply failed' }
    kubectl apply -f "https://github.com/knative/serving/releases/download/$KNATIVE/serving-core.yaml"
    if ($LASTEXITCODE -ne 0) { Die 'knative serving-core apply failed' }
    kubectl rollout status deployment/controller -n knative-serving --timeout=300s
    if ($LASTEXITCODE -ne 0) { Die 'knative controller never became ready' }
    kubectl rollout status deployment/webhook    -n knative-serving --timeout=300s
    if ($LASTEXITCODE -ne 0) { Die 'knative webhook never became ready' }
    kubectl apply -f "https://github.com/knative/net-kourier/releases/download/$KNATIVE/kourier.yaml"
    if ($LASTEXITCODE -ne 0) { Die 'kourier apply failed' }
    # Do NOT pass the JSON patch as an inline --patch argument. Windows
    # PowerShell mangles embedded double quotes when handing a string to a
    # native .exe, so kubectl receives {data:{...}} and rejects it with
    # "invalid character 'd' looking for beginning of object key string".
    # Writing the JSON to a file and using --patch-file sidesteps the whole
    # argument-quoting layer and behaves identically on PS 5.1 and PS 7.
    $patchFile = Join-Path ([System.IO.Path]::GetTempPath()) 'knative-config-network.json'
    '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}' |
        Set-Content -Path $patchFile -Encoding ascii
    kubectl patch configmap config-network -n knative-serving --type merge --patch-file $patchFile
    $rc = $LASTEXITCODE
    Remove-Item $patchFile -ErrorAction SilentlyContinue
    if ($rc -ne 0) { Die 'config-network patch failed' }
    Ok 'Knative installed'
} else { Warn 'skipping cluster prerequisites (-SkipCluster)' }

# -----------------------------------------------------------------------------
if (-not $SkipBuild) {
Step 4 'Build + push app images at the tags the manifests pin'
# The committed manifests pin exact SHA tags (e.g. urbansync-backend:50515cd1).
# Those images exist only in whichever registry built them, so on a fresh
# machine the pods would sit in ImagePullBackOff. We read the pinned tag out of
# each manifest and build that exact tag locally, so the manifests resolve
# without editing them.

    function Get-PinnedTag {
        param($file, $image)
        # -List: stop at the first matching line, so $m is always a single
        # MatchInfo and .Matches[0] cannot silently resolve against an array.
        $m = Select-String -Path $file -Pattern "localhost:5000/$image`:(\S+)" -List
        if (-not $m) { Die "could not find image tag for $image in $file" }
        return $m.Matches[0].Groups[1].Value
    }

    $targets = @(
        @{ Name='urbansync-backend';           Ctx=(Join-Path $V2 'backend');
           File=(Join-Path $V2 'k8s\base\backend\deployment.yaml') }
        @{ Name='urbansync-frontend';          Ctx=(Join-Path $V2 'frontend');
           File=(Join-Path $V2 'k8s\base\frontend\deployment.yaml') }
        @{ Name='urbansync-receipt-annotator'; Ctx=(Join-Path $V2 'knative\receipt-annotator');
           File=(Join-Path $V2 'k8s\base\knative\kservice.yaml') }
    )

    foreach ($t in $targets) {
        $tag = Get-PinnedTag $t.File $t.Name
        $ref = "localhost:5000/$($t.Name):$tag"
        Write-Host "    building $ref"
        # --provenance=false --sbom=false: Docker Desktop's buildx adds
        # provenance attestations by default, which turn the result into a
        # manifest list containing an unknown/unknown platform entry. The
        # kubelet's containerd can fail to resolve a platform in that index
        # ("no match for platform in manifest"), giving ImagePullBackOff for an
        # image that pushed fine. Local dev needs neither attestation.
        docker build --provenance=false --sbom=false `
            -t $ref -t "localhost:5000/$($t.Name):latest" $t.Ctx
        if ($LASTEXITCODE -ne 0) { Die "docker build failed for $($t.Name)" }
        # Check each push separately: a single check after both would only see
        # the :latest result, and it is the pinned SHA tag the manifests need.
        # Push output is left visible on purpose - a silenced push makes a
        # later ImagePullBackOff much harder to diagnose.
        docker push $ref
        if ($LASTEXITCODE -ne 0) { Die "docker push failed for $ref" }
        docker push "localhost:5000/$($t.Name):latest"
        if ($LASTEXITCODE -ne 0) { Die "docker push failed for $($t.Name):latest" }

        # Confirm the tag really landed in the registry rather than trusting
        # the exit code alone.
        try {
            $tags = Invoke-RestMethod "http://localhost:5000/v2/$($t.Name)/tags/list" -TimeoutSec 5
            if ($tags.tags -contains $tag) { Ok "$ref pushed and present in registry" }
            else { Warn "$ref pushed but registry lists only: $($tags.tags -join ', ')" }
        } catch { Warn "could not query registry catalog for $($t.Name): $_" }
    }
    Warn 'The frontend build is the slow one (CRA webpack) - 5-10 min is normal.'
} else { Warn 'skipping image build (-SkipBuild)' }

# -----------------------------------------------------------------------------
Step 5 'Apply the app manifests (namespace -> secret -> kustomize overlay)'
kubectl apply -f (Join-Path $V2 'k8s\base\namespace.yaml')
if ($LASTEXITCODE -ne 0) { Die 'namespace apply failed' }

# The Secret is applied out-of-band on purpose: it is not in the kustomization,
# and the ArgoCD Application ignores its /data, so ArgoCD will not touch it.
kubectl apply -f $secretsFile
if ($LASTEXITCODE -ne 0) { Die 'secret apply failed' }
Ok 'namespace + urbansync-secrets applied'

kubectl apply -k (Join-Path $V2 'k8s\overlays\local')
if ($LASTEXITCODE -ne 0) { Die 'kustomize overlay apply failed' }
Ok 'overlay applied'

Write-Host "`n    waiting for workloads (Thingsboard takes ~3 min on first start)..."
kubectl rollout status deployment/urbansync-backend  -n urbansync --timeout=300s
if ($LASTEXITCODE -ne 0) { Warn 'backend did not become ready - kubectl describe pod -n urbansync -l app=urbansync-backend' }
kubectl rollout status deployment/urbansync-frontend -n urbansync --timeout=300s
if ($LASTEXITCODE -ne 0) { Warn 'frontend did not become ready - usually ImagePullBackOff, see step 4' }
kubectl get pods -n urbansync

# -----------------------------------------------------------------------------
Step 6 'MinIO receipts bucket + Knative webhook'
# Flow B: a PUT into the receipts bucket fires a webhook at the receipt-annotator
# KService, which pulls the file and sends it to Gemini. Bucket + notification
# config live in MinIO's own state, not in any manifest, so this is a one-time
# imperative step (idempotent - safe to re-run).
kubectl wait --for=condition=ready pod -l app=minio -n urbansync --timeout=180s
if ($LASTEXITCODE -ne 0) { Warn 'minio not ready - skipping webhook wiring' }
else {
    # Single-line, and deliberately free of double quotes and backslash
    # continuations: Windows PowerShell mangles embedded double quotes when
    # passing a string to a native .exe (the same bug that broke the Knative
    # patch above). None of these mc values contain spaces, so no quoting is
    # needed in the first place.
    $mcAlias = 'mc alias set myminio http://localhost:9000 admin password123'
    # NOTE: no `mc admin service restart` here. That subcommand renders a
    # progress UI and needs a controlling terminal; under `kubectl exec` without
    # -t it dies with "could not open a new TTY: open /dev/tty: no such device".
    # Restarting the pod with kubectl achieves the same thing and always works.
    $mcSetup = "$mcAlias && mc mb --ignore-existing myminio/receipts && " +
               'mc admin config set myminio notify_webhook:receipts_knative ' +
               'endpoint=http://receipt-annotator.urbansync.svc.cluster.local ' +
               'queue_limit=100 enable=on'
    $mcEvent = "$mcAlias && " +
               'mc event add myminio/receipts arn:minio:sqs::receipts_knative:webhook ' +
               '--event s3:ObjectCreated:Put --ignore-existing && ' +
               'mc event list myminio/receipts'

    kubectl exec -n urbansync statefulset/minio -- sh -c $mcSetup
    if ($LASTEXITCODE -ne 0) { Warn 'webhook config failed - see README section 14' }
    else {
        # The notify_webhook config only takes effect after a MinIO restart.
        Write-Host '    restarting minio to load the webhook config...'
        kubectl delete pod minio-0 -n urbansync --wait=false | Out-Null
        Start-Sleep -Seconds 5
        kubectl wait --for=condition=ready pod -l app=minio -n urbansync --timeout=180s
        if ($LASTEXITCODE -ne 0) { Warn 'minio did not come back up - check kubectl get pods -n urbansync' }
        else {
            kubectl exec -n urbansync statefulset/minio -- sh -c $mcEvent
            if ($LASTEXITCODE -ne 0) { Warn 'event subscription failed - re-run step 6 from SETUP-LOCAL-K8S.md' }
            else { Ok 'MinIO -> Knative webhook configured' }
        }
    }
}

# -----------------------------------------------------------------------------
if (-not $SkipArgo) {
Step 7 'ArgoCD'
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) { Die 'argocd namespace create failed' }
    # Server-side apply: the install manifest's CRDs blow past the client-side
    # last-applied-configuration annotation size limit.
    kubectl apply -n argocd --server-side -f `
        'https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml'
    if ($LASTEXITCODE -ne 0) { Die 'argocd install failed' }
    kubectl rollout status deployment/argocd-server -n argocd --timeout=300s

    kubectl apply -f $repoSecret
    if ($LASTEXITCODE -ne 0) { Die 'argocd repo secret apply failed' }

    kubectl apply -f (Join-Path $V2 'infrastructure\argocd\application-local.yaml')
    if ($LASTEXITCODE -ne 0) { Die 'argocd Application apply failed' }
    Ok 'ArgoCD installed and Application created'
    Warn 'ArgoCD syncs from GitHub dev-combined - local uncommitted changes are NOT deployed.'
} else { Warn 'skipping ArgoCD (-SkipArgo)' }

# -----------------------------------------------------------------------------
if (-not $SkipJenkins) {
Step 8 'Jenkins'
    $override = Join-Path $V2 'infrastructure\jenkins\docker-compose.local.yml'
    Push-Location (Join-Path $V2 'infrastructure\jenkins')
    if (Test-Path $override) {
        # The committed compose file mounts /home/azureuser/.kube (an Azure VM
        # path). docker-compose.local.yml drops that mount for Windows.
        docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
    } else {
        Warn 'docker-compose.local.yml missing - the azureuser kubeconfig mount may break this.'
        docker compose up -d --build
    }
    $rc = $LASTEXITCODE
    Pop-Location
    if ($rc -ne 0) { Die 'jenkins failed to start' }
    Ok 'Jenkins starting at http://localhost:8080 (admin / see jenkins\.env)'
} else { Warn 'skipping Jenkins (-SkipJenkins)' }

# -----------------------------------------------------------------------------
if (-not $SkipSeed) {
Step 9 'Seed MongoDB'
    if (-not (Get-Command mongoimport -ErrorAction SilentlyContinue)) {
        Warn 'mongoimport not on PATH - skipping seed.'
        Warn 'Install MongoDB Database Tools, then run: .\import-db-k8s.ps1'
    } else {
        kubectl wait --for=condition=ready pod -l app=mongodb -n urbansync --timeout=180s
        if ($LASTEXITCODE -ne 0) { Die 'mongodb pod never became ready - cannot seed' }
        Push-Location $ROOT
        try { .\import-db-k8s.ps1; Ok 'database seeded' }
        catch { Warn "seed failed: $_"; Warn 'retry later with: .\import-db-k8s.ps1' }
        finally { Pop-Location }
    }
} else { Warn 'skipping seed (-SkipSeed)' }

# -----------------------------------------------------------------------------
Step 10 'Port-forward'
# Docker Desktop on Windows does not bind LoadBalancer IPs to localhost.
& (Join-Path $V2 'k8s\start-portforward.ps1')

Write-Host @"

=============================================================
 Done.

   App        http://localhost
   Jenkins    http://localhost:8080
   ArgoCD     kubectl port-forward svc/argocd-server -n argocd 8081:443
              then https://localhost:8081

 Logins after seeding:
   admin@example.com   / Admin!123        (site admin)
   tonyGeo@gmail.com   / 1234567890123    (building admin)
   thkam@example.com   / 1234567          (tenant)

 Every new session, re-run just the port-forward:
   .\urbansync-v2\k8s\start-portforward.ps1
=============================================================
"@ -ForegroundColor Green
