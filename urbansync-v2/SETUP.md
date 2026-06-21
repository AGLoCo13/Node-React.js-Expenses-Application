# UrbanSync v2 — Full Local Setup Guide

Complete sequence for bringing the full stack up from scratch on a Windows machine
with Docker Desktop. Follow steps in order — each one depends on the previous.

---

## Prerequisites (install once)

| Tool | Notes |
|------|-------|
| Docker Desktop (latest) | Enable WSL2 backend during install |
| MongoDB Database Tools | Adds `mongoimport` to PATH — needed for DB seed |
| Git | git-scm.com |
| kubectl | Bundled with Docker Desktop — no separate install needed |

---

## Step 1 — Configure Docker Desktop

### 1a — Enable Kubernetes

Docker Desktop → Settings → Kubernetes → check **Enable Kubernetes** → Apply & Restart.

```powershell
kubectl get nodes
# docker-desktop   Ready   control-plane
```

### 1b — Allow HTTP pulls from the local registry

Docker Desktop → Settings → Docker Engine → add to the JSON:

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

Click **Apply & Restart**.

---

## Step 2 — Start the local container registry

Must be running before Jenkins builds and before K8s pods start.

```powershell
cd urbansync-v2/infrastructure/registry
docker compose up -d
```

Verify:
```powershell
curl http://localhost:5000/v2/
# {}
```

---

## Step 3 — Install the nginx ingress controller

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

kubectl wait --namespace ingress-nginx `
  --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=120s
```

---

## Step 4 — Install Knative Serving v1.14.0

Required for the serverless receipt-annotator function (`k8s/knative/kservice.yaml`).
Without this, the recursive `kubectl apply` in step 5 will fail.

```powershell
# CRDs first
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-crds.yaml

# Core components
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-core.yaml

# Wait for controller and webhook to be ready
kubectl rollout status deployment/controller -n knative-serving --timeout=300s
kubectl rollout status deployment/webhook    -n knative-serving --timeout=300s

# Kourier networking layer
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.14.0/kourier.yaml

# Point Knative at Kourier
kubectl patch configmap/config-network `
  --namespace knative-serving `
  --type merge `
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
```

---

## Step 5 — Apply K8s manifests

`secrets.yaml` is gitignored — create it before this step (see Secrets section below).

```powershell
# From repo root — order matters: namespace → secrets → everything else
kubectl apply -f urbansync-v2/k8s/namespace.yaml
kubectl apply -f urbansync-v2/k8s/secrets.yaml
kubectl apply -f urbansync-v2/k8s/ --recursive
```

Verify:
```powershell
kubectl get pods -n urbansync
# All pods reach Running within ~60s. Thingsboard takes ~3 min on first start.
```

---

## Step 6 — Install ArgoCD

ArgoCD is the deployment engine — it watches the Git repo and syncs the cluster
whenever Jenkins pushes updated image tags.

```powershell
# Namespace must exist before the install manifest
kubectl create namespace argocd

# Server-side apply required — install manifest CRDs exceed client-side annotation limit
kubectl apply -n argocd --server-side `
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s
```

### Apply the repo credential secret

ArgoCD needs a GitHub credential to read the private repo.

```powershell
cd urbansync-v2/infrastructure/argocd
cp repo-secret.yaml.example repo-secret.yaml
# Edit repo-secret.yaml — fill in your GitHub username and a classic PAT with repo scope
kubectl apply -f repo-secret.yaml
```

### Apply the Application CR

```powershell
kubectl apply -f urbansync-v2/infrastructure/argocd/application.yaml
```

ArgoCD will immediately begin syncing `urbansync-v2/k8s/` from `dev-combined`.

---

## Step 7 — Start Jenkins

Jenkins is configured automatically via **JCasC** on first boot — no setup wizard, no UI clicks.

Create the `.env` file with your credentials:

```powershell
# From repo root:
@"
GITHUB_PAT=ghp_yourtoken
GITHUB_USERNAME=YourGitHubUsername
JENKINS_ADMIN_PASSWORD=password123
"@ | Out-File -Encoding ascii urbansync-v2/infrastructure/jenkins/.env
```

Start Jenkins:

```powershell
cd urbansync-v2/infrastructure/jenkins
docker compose up -d --build
```

Jenkins is ready at **http://localhost:8080** (`admin` / `password123`).

JCasC automatically creates:
- Admin account
- `github-creds` credential (PAT from `.env`)
- `urbansync-v2` pipeline job pointing at `urbansync-v2/Jenkinsfile` on `dev-combined`

---

## Step 8 — Trigger the first build

SCM polling can't fire until Jenkins has a baseline commit. Kick it off manually:

1. Open **http://localhost:8080**, log in with `admin` / `password123`
2. Click **urbansync-v2** → **Build Now**

Pipeline stages: `Checkout → Build images (parallel) → Push to registry → Update manifests`

The "Update manifests" stage commits the new SHA image tags back to Git with `[skip ci]`.
ArgoCD detects this commit within ~3 minutes and syncs the cluster automatically.

After the first build, every push to `dev-combined` triggers the full loop within ~2 minutes.

---

## Step 9 — Seed the database

The MongoDB pod starts empty. Run this once after the first build:

```powershell
# From repo root:
.\import-db-k8s.ps1
```

Default credentials after seeding:

| Role | Email | Password |
|------|-------|----------|
| Site admin | `admin@example.com` | `Admin!123` |
| Building admin | `tonyGeo@gmail.com` | `1234567890123` |
| Tenant | `thkam@example.com` | `1234567` |

Requires `mongoimport` on PATH (see Prerequisites).

---

## Step 10 — Port-forward (Windows only, every session)

Docker Desktop on Windows does not map LoadBalancer IPs to `localhost` automatically.
Run once each time you start working:

```powershell
# App at http://localhost
.\urbansync-v2\k8s\start-portforward.ps1

# ArgoCD UI at https://localhost:8081
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

ArgoCD password:
```powershell
$enc = kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($enc))
```

To stop the app port-forward:
```powershell
Get-Job | Stop-Job; Get-Job | Remove-Job
```

---

## Secrets — `k8s/secrets.yaml`

This file is gitignored and must be created before step 5. It contains
base64-encoded credentials for MongoDB, RabbitMQ, MinIO, and the JWT secret.

Encode a value:
```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("admin"))
# YWRtaW4=
```

Expected values:

| Key | Plain value |
|-----|-------------|
| `mongodb-user` | `admin` |
| `mongodb-password` | `admin123` |
| `rabbitmq-user` | `admin` |
| `rabbitmq-password` | `admin123` |
| `minio-access-key` | `admin` |
| `minio-secret-key` | `password123` |
| `jwt-secret` | `your-secret-key` |

---

## What runs where

| Component | Managed by | URL |
|-----------|-----------|-----|
| Local registry | Docker Compose | `localhost:5000` |
| Jenkins | Docker Compose | `http://localhost:8080` |
| App (via ingress) | Kubernetes + ArgoCD | `http://localhost` |
| ArgoCD UI | Kubernetes (port-forward) | `https://localhost:8081` |
| MongoDB | Kubernetes StatefulSet | internal only |
| RabbitMQ | Kubernetes StatefulSet | internal + `localhost:15672` (management) |
| MinIO | Kubernetes StatefulSet | internal + `localhost:9001` (console) |
