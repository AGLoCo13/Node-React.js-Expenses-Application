# UrbanSync v2 — Local K8s Bring-Up (corrected runbook)

Full local stack on Docker Desktop for Windows: Kubernetes + Knative + ArgoCD + Jenkins.

This file supersedes `SETUP.md`, which drifted out of sync with the manifests
(see [What changed](#what-changed-vs-setupmd)). The 15-section `README.md` is
still the reference for architecture, flows and troubleshooting.

**Shortcut:** `.\urbansync-v2\bootstrap-local.ps1` runs steps 1–10 unattended.
Read [Before you start](#before-you-start) first — three files need your tokens.

---

## Architecture in one screen

Everything the app needs runs inside one Kubernetes namespace, `urbansync`.
CI/CD lives outside the cluster in Docker Compose.

```
 In-cluster (namespace: urbansync)                    Outside the cluster
 ─────────────────────────────────                    ───────────────────
 ingress-nginx  :80                                   Jenkins   :8080
      │                                                  │ build + push
      ▼                                                  ▼
  frontend (React → nginx)                            Registry  :5000
      │  /api/ proxy                                      │
      ▼                                                  ▼
  backend (Node/Express) ──mongoose──► MongoDB      ArgoCD ──watches
      │        │                       (StatefulSet)   dev-combined branch
      │        └──amqplib──► RabbitMQ ──► Node-RED       │ syncs
      │                         ▲                        ▼
      │                         │ alarms            k8s/overlays/local
      │                    ThingsBoard
      │
      └──multer-s3──► MinIO ──webhook──► receipt-annotator
                      bucket:            (Knative, scale-to-zero,
                      receipts            Gemini extraction)
```

**The GitOps loop.** Jenkins polls `dev-combined` every 2 min → builds only the
component whose directory changed → pushes to `localhost:5000` → rewrites the
image tag in `k8s/base/*/deployment.yaml` → commits back with `[skip ci]`.
ArgoCD sees that commit and syncs the cluster. Nobody runs `kubectl apply` in
steady state.

**Two AI paths into the same Knative function.** Synchronous — backend calls
`POST /api/expenses/knative-extract` while the admin waits. Asynchronous — MinIO
fires a webhook on `s3:ObjectCreated:Put`. The function scales to zero after 60s
idle, so the first request after a lull pays a ~5–10s cold start.

---

## Before you start

### Install once

| Tool | Note |
|---|---|
| Docker Desktop | Enable **Kubernetes** in Settings, and WSL2 backend |
| MongoDB Database Tools | Puts `mongoimport` on PATH — needed to seed |
| Git | — |
| kubectl | Ships with Docker Desktop |

Allow HTTP pulls from the local registry — Docker Desktop → Settings → Docker
Engine, add `"insecure-registries": ["localhost:5000"]`, Apply & Restart.

Budget ~10 GB RAM for the whole stack. ThingsBoard alone is ~1.5 GB.

### Fill in three tokens

These files are already created and gitignored. Each has one `REPLACE_...`
line:

| File | What to put in |
|---|---|
| `k8s/overlays/local/plain-secrets.yaml` | `gemini-api-key` — your Gemini key |
| `infrastructure/jenkins/.env` | `GITHUB_PAT` — classic PAT, `repo` scope |
| `infrastructure/argocd/repo-secret.yaml` | `password` — the same PAT |

Also created: `backend/.env` (only used by the docker-compose path) and
`infrastructure/jenkins/docker-compose.local.yml` (Windows fix, see step 8).

---

## Steps

### 1 — Local registry

```powershell
cd urbansync-v2\infrastructure\registry
docker compose up -d
curl http://localhost:5000/v2/     # {}
```

Must be up before anything pushes or pulls.

### 2 — nginx ingress controller

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller --timeout=180s
```

### 3 — Knative Serving v1.14.0

Required: `k8s/base/knative/kservice.yaml` is part of the base kustomization, so
step 5 fails without the Knative CRDs.

```powershell
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-crds.yaml
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-core.yaml
kubectl rollout status deployment/controller -n knative-serving --timeout=300s
kubectl rollout status deployment/webhook    -n knative-serving --timeout=300s
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.14.0/kourier.yaml

# Do NOT use an inline --patch here. Windows PowerShell strips the embedded
# double quotes when handing the string to kubectl.exe, which then sees
# {data:{...}} and fails with:
#   error decoding patch: invalid character 'd' looking for beginning of object key string
# Write the JSON to a file and use --patch-file instead.
$patch = Join-Path $env:TEMP 'knative-config-network.json'
'{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}' | Set-Content $patch -Encoding ascii
kubectl patch configmap config-network -n knative-serving --type merge --patch-file $patch
```

This inline-quoting trap bites any `kubectl`/`docker` call in PowerShell that
takes JSON as an argument. `--patch-file`, `-f file.yaml`, or piping into
`kubectl apply -f -` all avoid it.

### 4 — Build the images the manifests pin

**This step is missing from both `SETUP.md` and `README.md`, and it is the most
common reason a fresh cluster sits in `ImagePullBackOff`.**

The committed manifests pin exact SHA tags — today
`urbansync-backend:50515cd1`, `urbansync-frontend:50aa0b89`,
`urbansync-receipt-annotator:75187658`. Those images only ever existed in the
registry of whichever machine built them. On a fresh machine nothing can pull
them.

`README.md` §14 says "trigger a Jenkins build first", but the Jenkinsfile guards
every build stage with `when { changeset ... }`, and on a first build there is no
previous build to diff against — so the first build produces no images at all.
Build them by hand once:

```powershell
cd urbansync-v2
docker build --provenance=false --sbom=false -t localhost:5000/urbansync-backend:50515cd1 .\backend
docker push  localhost:5000/urbansync-backend:50515cd1

docker build --provenance=false --sbom=false -t localhost:5000/urbansync-frontend:50aa0b89 .\frontend
docker push  localhost:5000/urbansync-frontend:50aa0b89

docker build --provenance=false --sbom=false -t localhost:5000/urbansync-receipt-annotator:75187658 .\knative\receipt-annotator
docker push  localhost:5000/urbansync-receipt-annotator:75187658
```

`--provenance=false --sbom=false` matters. Docker Desktop's buildx attaches
provenance attestations by default, which makes the result a manifest list with
an extra `unknown/unknown` platform entry. The kubelet's containerd can fail to
resolve a platform in that index and report `ImagePullBackOff` for an image that
pushed perfectly well. Local dev needs neither attestation.

Verify what actually reached the registry — a successful `docker push` exit code
is weaker evidence than the catalog:

```powershell
Invoke-RestMethod http://localhost:5000/v2/_catalog
Invoke-RestMethod http://localhost:5000/v2/urbansync-frontend/tags/list
```

**A build alone is never enough.** `docker build` writes to the docker daemon's
image store; Docker Desktop's Kubernetes reads from a separate containerd
namespace (`k8s.io`). The two do not share images, so `imagePullPolicy:
IfNotPresent` does not spare you — the kubelet always has to pull from
`localhost:5000`, which is why the registry and the `insecure-registries`
setting are both mandatory.

If the tags in the manifests have moved on since, read the current ones out
first — `bootstrap-local.ps1` does exactly this, so it never goes stale:

```powershell
Select-String -Path .\k8s\base\backend\deployment.yaml -Pattern 'urbansync-backend:(\S+)'
```

The frontend build is slow (CRA webpack, Node 16 builder stage) — 5–10 minutes
is normal.

### 5 — Apply the manifests

Order matters: namespace, then the Secret, then the overlay.

```powershell
kubectl apply -f urbansync-v2\k8s\base\namespace.yaml
kubectl apply -f urbansync-v2\k8s\overlays\local\plain-secrets.yaml
kubectl apply -k urbansync-v2\k8s\overlays\local
kubectl get pods -n urbansync
```

Why the Secret goes on separately: it is deliberately *not* in the
kustomization, and `application-local.yaml` sets `ignoreDifferences` on its
`/data`. ArgoCD therefore never manages, diffs, or prunes it — the plaintext
stays on your disk only.

ThingsBoard takes ~3 minutes on first boot. Everything else should be Running
inside a minute.

### 6 — MinIO bucket + Knative webhook

MinIO's bucket and notification config live in MinIO's own state, not in any
manifest, so this is a one-time imperative step.

Note the deliberate absence of quotes around the `mc` values — none of them
contain spaces, and quoting them would hit the same PowerShell native-argument
trap as step 3.

Also note there is no `mc admin service restart`. That subcommand renders a
progress UI and needs a controlling terminal, so under `kubectl exec` without
`-t` it fails with `could not open a new TTY: open /dev/tty: no such device or
address` — after having already written the config. Restart the pod with
kubectl instead; same effect, no TTY.

```powershell
$alias = 'mc alias set myminio http://localhost:9000 admin password123'

kubectl exec -n urbansync statefulset/minio -- sh -c "$alias && mc mb --ignore-existing myminio/receipts && mc admin config set myminio notify_webhook:receipts_knative endpoint=http://receipt-annotator.urbansync.svc.cluster.local queue_limit=100 enable=on"

# notify_webhook only takes effect after a restart
kubectl delete pod minio-0 -n urbansync
kubectl wait --for=condition=ready pod -l app=minio -n urbansync --timeout=180s

kubectl exec -n urbansync statefulset/minio -- sh -c "$alias && mc event add myminio/receipts arn:minio:sqs::receipts_knative:webhook --event s3:ObjectCreated:Put --ignore-existing && mc event list myminio/receipts"
```

### 7 — ArgoCD

```powershell
kubectl create namespace argocd
# --server-side is required: the install manifest's CRDs exceed the
# client-side last-applied-configuration annotation size limit.
kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s

kubectl apply -f urbansync-v2\infrastructure\argocd\repo-secret.yaml
kubectl apply -f urbansync-v2\infrastructure\argocd\application-local.yaml
```

ArgoCD now syncs `urbansync-v2/k8s/overlays/local` from **GitHub, branch
`dev-combined`** — not from your working tree. With `selfHeal: true` it will
revert any manual `kubectl edit` you make in the namespace. To change what runs,
commit and push.

UI password:

```powershell
kubectl port-forward svc/argocd-server -n argocd 8081:443
$enc = kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($enc))
```

### 8 — Jenkins

The committed `infrastructure/jenkins/docker-compose.yml` mounts
`/home/azureuser/.kube:/root/.kube:ro` — an Azure VM path that does not exist on
Windows. `docker-compose.local.yml` drops that mount. The Jenkinsfile never
calls `kubectl` (ArgoCD does the deploying), so nothing is lost.

```powershell
cd urbansync-v2\infrastructure\jenkins
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Ready at http://localhost:8080 — `admin` / whatever you set as
`JENKINS_ADMIN_PASSWORD`. JCasC creates the admin user, the `github-creds`
credential and the `urbansync-v2` pipeline job on boot; there is no setup wizard.

First build: **Build Now** on the `urbansync-v2` job. Expect it to build
nothing (the `changeset` guards, as in step 4) — that is fine, it establishes
the baseline. From the next push onward the loop works: change a file under
`urbansync-v2/backend/`, push, and within ~2 min Jenkins rebuilds that one image
and ArgoCD rolls the deployment.

### 9 — Seed MongoDB

```powershell
.\import-db-k8s.ps1     # from repo root
```

Port-forwards the MongoDB pod, imports all 7 collections into `commons-db` with
`--drop`, closes the port-forward. Needs `mongoimport` on PATH.

Note there are three seed scripts and only this one is right for K8s.
`seed-db.bat` targets the docker-compose container and database `commons`;
`import-db.bat` targets a bare local mongod with `--jsonArray`, which does not
match these files (they are newline-delimited, not JSON arrays).

| Role | Email | Password |
|---|---|---|
| Site admin | `admin@example.com` | `Admin!123` |
| Building admin | `tonyGeo@gmail.com` | `1234567890123` |
| Tenant | `thkam@example.com` | `1234567` |

### 10 — Port-forward (every session)

Docker Desktop on Windows does not bind LoadBalancer IPs to localhost.

```powershell
.\urbansync-v2\k8s\start-portforward.ps1     # app at http://localhost
Get-Job | Stop-Job; Get-Job | Remove-Job     # to stop
```

---

## What changed vs `SETUP.md`

| `SETUP.md` says | Reality |
|---|---|
| `kubectl apply -f k8s/namespace.yaml` | It moved to `k8s/base/namespace.yaml` |
| `kubectl apply -f k8s/secrets.yaml` | No such file. It is `k8s/overlays/local/plain-secrets.yaml` (copy of the `.example`) |
| Secret keys `mongodb-user`, `mongodb-password`, `jwt-secret` | Actual keys are `mongo-user`, `mongo-pass`, `mongo-uri`, `rabbitmq-url`, `minio-*`, `jwt-secret`, `gemini-api-key`. `mongo-uri` and `rabbitmq-url` are full connection strings, not just credentials |
| `kubectl apply -f k8s/ --recursive` | Use `kubectl apply -k k8s/overlays/local`. A recursive apply would also pick up the stale duplicate `k8s/backend/deployment.yaml` and `k8s/frontend/deployment.yaml` left outside `base/` |
| `argocd/application.yaml` | It is `application-local.yaml` (and `application-prod.yaml`) |
| Nothing about images | Step 4 above. Fresh clusters cannot pull the pinned SHA tags |
| Nothing about the MinIO webhook | Step 6 above. Flow B is dead without it |
| Nothing about the kubeconfig mount | Step 8 above. The Azure path breaks Jenkins on Windows |
| Gemini key not mentioned | `gemini-api-key` is a required Secret key; both the backend and the Knative function read it |

`plain-secrets.yaml.example` describes a `kubeseal` workflow for sealing the
secret into Git. You do not need it locally — the ArgoCD `ignoreDifferences`
block means a directly-applied Secret is left alone. Sealing only matters for
the `prod` overlay, which uses a CSI SecretProviderClass instead.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ImagePullBackOff`, `server gave HTTP response to HTTPS client` | `insecure-registries: ["localhost:5000"]` missing from Docker Engine settings |
| `ImagePullBackOff`, `no match for platform in manifest` | buildx attestations. Rebuild with `--provenance=false --sbom=false`, step 4 |
| `ImagePullBackOff`, image not in `Invoke-RestMethod http://localhost:5000/v2/_catalog` | The push never landed. A build alone does not reach the cluster — step 4 |
| An old pod still Running next to a failing new one | Normal: the Deployment keeps the working ReplicaSet until the new one goes ready. The app you see is the old build |
| `could not open a new TTY` from `mc` | `mc admin service restart` needs a terminal. Restart the pod with kubectl instead, step 6 |
| Pod `CrashLoopBackOff`, logs mention Mongo auth | `mongo-uri` in the Secret must match `mongo-user`/`mongo-pass`. All three come from the same file |
| KService never Ready | Usually the `urbansync-config` ConfigMap or a bad `gemini-api-key`. `kubectl get ksvc -n urbansync` |
| ArgoCD reverts your change | `selfHeal: true`, by design. Commit and push instead |
| Receipt upload works, no AI annotation | Step 6 webhook, or `gemini-api-key` still `REPLACE_WITH_REAL_KEY` |
| PVC `Pending` | Needs the `hostpath` StorageClass — Docker Desktop provides it; confirm Kubernetes is actually enabled |
| ThingsBoard unreachable | Give it 3 minutes. `kubectl logs -n urbansync statefulset/thingsboard` until "Started ThingsboardServerApplication" |
| `error decoding patch: invalid character 'd'` | PowerShell ate the quotes in an inline JSON argument. Use `--patch-file`, see step 3 |

Clean slate: `kubectl delete namespace urbansync` then repeat from step 5.
This destroys all PVC data, so re-seed.
