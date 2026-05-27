# UrbanSync v2 — Cloud-Native Building Management Platform

> **Production-grade reference documentation.** This file is the single source of truth for
> architecture, deployment, and operations. For the legacy v1 local-only setup see
> [`../README.md`](../README.md).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Repository Layout](#4-repository-layout)
5. [Secrets & Configuration](#5-secrets--configuration)
6. [Bootstrap: Fresh Cluster Deployment](#6-bootstrap-fresh-cluster-deployment)
7. [Knative Serverless — Install & Deploy](#7-knative-serverless--install--deploy)
8. [Knative Flow Explained](#8-knative-flow-explained)
9. [CI/CD Pipeline (Jenkins + ArgoCD)](#9-cicd-pipeline-jenkins--argocd)
10. [Design Patterns](#10-design-patterns)
11. [IaC — OpenTofu + Ansible](#11-iac--opentofu--ansible)
12. [Service Access & Endpoints](#12-service-access--endpoints)
13. [Test Credentials](#13-test-credentials)
14. [Troubleshooting](#14-troubleshooting)
15. [Roadmap](#15-roadmap)

---

## 1. Project Overview

UrbanSync is a **smart building management system** for property managers and tenants. It tracks
shared expenses, monitors IoT sensor telemetry, stores receipts, and auto-annotates them with
AI-powered OCR.

### Technology Stack

| Component | Technology | Role |
|---|---|---|
| **Frontend** | React 18 + Nginx (multi-stage Docker) | SPA served over port 80 |
| **Backend** | Node.js 20 + Express | REST API, file upload proxy, alarm consumer |
| **Database** | MongoDB 7 (StatefulSet) | Application data, notifications |
| **Message Broker** | RabbitMQ 3 (StatefulSet) | Building alarms, MinIO event fan-out |
| **Object Storage** | MinIO (StatefulSet) | Receipt PDF/image storage (S3-compatible) |
| **IoT Platform** | ThingsBoard CE (StatefulSet) | Sensor telemetry, dashboards, rule engine |
| **Flow Orchestration** | Node-RED (Deployment) | IoT device simulator, alarm rule chains |
| **Serverless Function** | Knative Serving — `receipt-annotator` | AI receipt annotation via Google Gemini |

**Kubernetes namespace:** `urbansync`  
**Local container registry:** `localhost:5000`  
**CI/CD:** Jenkins (build → push) + ArgoCD (GitOps sync)

---

## 2. Architecture

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     urbansync  (Kubernetes namespace)                   │
│                                                                         │
│  ┌──────────┐   HTTP    ┌──────────┐   mongoose  ┌──────────────────┐  │
│  │ Frontend │ ────────► │ Backend  │ ───────────► │    MongoDB       │  │
│  │ (React)  │           │ (Node.js)│              │  (StatefulSet)   │  │
│  └──────────┘           └────┬─────┘              └──────────────────┘  │
│       ▲                      │                                          │
│       │  Nginx Ingress        │  amqplib                                │
│  ┌────┴───────────────┐      ▼                                          │
│  │  ingress-nginx     │  ┌──────────┐   fanout    ┌──────────────────┐  │
│  │  (cluster-wide)    │  │ RabbitMQ │ ──────────► │   Node-RED       │  │
│  └────────────────────┘  │(StatefulS)│  exchange  │ (Device Sim.)    │  │
│                           └──────────┘             └──────────────────┘  │
│                                ▲                                        │
│  ┌──────────────────┐          │ alarm queue                            │
│  │    ThingsBoard   │ ─────────┘                                        │
│  │   (StatefulSet)  │  RabbitMQ Rule Engine                             │
│  └──────────────────┘                                                   │
│                                                                         │
│  ┌──────────────────┐  webhook   ┌──────────────────────────────────┐  │
│  │      MinIO       │ ─────────► │  receipt-annotator               │  │
│  │   (StatefulSet)  │            │  (Knative Service)               │  │
│  │  bucket:receipts │            │  • scale-to-zero (60s idle)      │  │
│  └──────────────────┘            │  • max 3 replicas under load     │  │
│           ▲                      │  • Gemini 1.5 Pro AI extraction  │  │
│           │  multer-s3           └──────────────────────────────────┘  │
│           │                                                             │
│      Backend /api/expenses (file upload)                                │
└─────────────────────────────────────────────────────────────────────────┘

Outside cluster:
  ┌─────────────────────────────────────────────────┐
  │  localhost:8080  Jenkins  (Docker Compose)       │
  │    ↓ build → push → update manifest tag         │
  │  localhost:5000  Registry (Docker Compose)       │
  │    ↓                                            │
  │  ArgoCD  watches dev-combined branch → sync K8s │
  └─────────────────────────────────────────────────┘
```

### IoT Telemetry Flow (Flow A)

```
Node-RED (MQTT every 10 s)
    │  topic: v1/devices/me/telemetry
    ▼
ThingsBoard  (stores, displays, evaluates Rule Engine)
    │  if fuel_usage < 200 → trigger alarm
    ▼
RabbitMQ  queue: building-alarms
    │  amqplib consumer in backend
    ▼
MongoDB   collection: notifications
    │
    ▼
Admin Dashboard  (polling /api/notifications)
```

### Receipt Upload & AI Annotation Flow (Flow B)

```
Admin uploads PDF/image via React UI
    │  POST /api/expenses  (multipart)
    ▼
Backend  →  multer-s3  →  MinIO bucket: receipts
                                │
                        PUT event notification
                                │  webhook POST
                                ▼
                    receipt-annotator  (Knative)
                    ┌──────────────────────────┐
                    │  Cold start if scaled-to-0│
                    │  Download file from MinIO │
                    │  Call Gemini 1.5 Pro API  │
                    │  Return JSON:             │
                    │   amount, month, year,    │
                    │   type (Heating/Elevator/ │
                    │         General)          │
                    └──────────────────────────┘
                                │
                    Backend also calls Knative synchronously
                    via POST /api/expenses/knative-extract
                    for interactive receipt annotation
```

---

## 3. Prerequisites

Install these tools **once** on the host machine before any deployment step.

| Tool | Min. Version | Install / Notes |
|---|---|---|
| Docker Desktop | Latest | [docker.com](https://docker.com/products/docker-desktop) — enable **WSL2 backend** |
| kubectl | ≥ 1.28 (bundled with Docker Desktop) | No separate install needed |
| Knative CLI (`kn`) | ≥ 1.13 | [knative.dev/docs/client](https://knative.dev/docs/client/install-kn/) |
| MinIO Client (`mc`) | Latest | [min.io/docs/minio/linux/reference/minio-mc.html](https://min.io/docs/minio/linux/reference/minio-mc.html) |
| Git | ≥ 2.40 | [git-scm.com](https://git-scm.com) |
| MongoDB Database Tools | Latest | [mongodb.com/try/download/database-tools](https://mongodb.com/try/download/database-tools) — adds `mongoimport` to PATH |
| OpenTofu | ≥ 1.6 | [opentofu.org](https://opentofu.org/docs/intro/install/) — only needed for Azure IaC |
| Ansible | ≥ 2.15 | [docs.ansible.com](https://docs.ansible.com/ansible/latest/installation_guide/) — only needed for VM config |

> **RAM:** Minimum 8 GB free for the full stack. ThingsBoard alone requires ~2 GB.  
> **Ports used locally (port-forward):** 80, 5000, 5672, 8080, 9000, 9001, 9090, 15672, 1880.

---

## 4. Repository Layout

```
urbansync-v2/
├── frontend/               React SPA + Nginx (multi-stage Dockerfile)
├── backend/                Node.js REST API
│   ├── controllers/        Request handlers (expenses, users, buildings…)
│   ├── models/             Mongoose schemas
│   ├── middleware/         JWT authentication
│   ├── services/
│   │   ├── cloudService.js     MinIO + RabbitMQ clients & consumers
│   │   └── rabbitmq-consumer.js
│   ├── workers/            Background processors (receipt-processor)
│   ├── config/             minio.config.js, rabbitmq.config.js
│   └── resilience/
│       ├── circuitBreaker.js   Opossum circuit breaker (RabbitMQ, MinIO)
│       └── retryHelper.js      Exponential-backoff retry wrapper
├── knative/
│   └── receipt-annotator/  Serverless function source
│       ├── index.js            Express HTTP handler (Path A + Path B)
│       ├── Dockerfile          Multi-stage, non-root, Node 20 Alpine
│       └── package.json
├── k8s/                    Kubernetes manifests (source of truth for ArgoCD)
│   ├── namespace.yaml
│   ├── secrets.yaml            ⚠️  See Section 5 before applying
│   ├── configmap.yaml
│   ├── ingress.yaml
│   ├── frontend/           Deployment + Service
│   ├── backend/            Deployment + Service
│   ├── mongodb/            StatefulSet + Service + PVC
│   ├── rabbitmq/           StatefulSet + Service + PVC
│   ├── minio/              StatefulSet + Service + PVC
│   ├── thingsboard/        StatefulSet + Service + PVCs
│   ├── nodered/            Deployment + Service + PVC
│   └── knative/
│       ├── kservice.yaml       Knative Service for receipt-annotator
│       └── minio-webhook.sh    One-time MinIO → Knative event wiring
├── infrastructure/
│   ├── jenkins/            Dockerfile + JCasC config (zero-click setup)
│   ├── argocd/             ArgoCD Application manifest
│   ├── registry/           Local Docker registry (registry:2)
│   ├── opentofu/           IaC — Azure VM provisioning (main.tf, tfvars)
│   └── ansible/            Configuration management playbooks
├── Jenkinsfile             CI pipeline: build → push → update tags
├── SETUP.md                Detailed step-by-step Docker Desktop bootstrap
└── README.md               ← YOU ARE HERE
```

---

## 5. Secrets & Configuration

### ⚠️ Security Warning

`k8s/secrets.yaml` contains base64-encoded values that are **trivially decoded**:

```powershell
# Anyone can decode them with:
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("YWRtaW4="))
# Output: admin
```

**For production / submission:** rotate all default credentials and generate your own
base64 values using the commands below. **Never commit real API keys to Git** — use
Kubernetes Sealed Secrets or external secret management instead.

### Generating Your Own Secret Values

```powershell
# PowerShell (Windows)
function b64 { param($s) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }

b64 "your-mongo-password"   # mongo-pass
b64 "your-jwt-secret-32chars-minimum"  # jwt-secret
b64 "YOUR_ACTUAL_GEMINI_API_KEY"       # gemini-api-key  ← most important
```

```bash
# Linux / WSL / macOS
echo -n "your-mongo-password" | base64          # mongo-pass
echo -n "your-jwt-secret-32chars" | base64      # jwt-secret
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | base64   # gemini-api-key
```

Get a free Gemini API key at: **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**

### Creating the ConfigMap (Required — Missing from Auto-Apply)

The `receipt-annotator` Knative Service reads non-sensitive config from a ConfigMap named
`urbansync-config`. Create it before applying the KService:

```powershell
kubectl create configmap urbansync-config \
  --from-literal=MINIO_ENDPOINT=minio \
  --from-literal=MINIO_PORT=9000 \
  --from-literal=MINIO_USE_SSL=false \
  --namespace=urbansync
```

### Secrets Reference Table

| Secret Key | Description | Default (dev only) |
|---|---|---|
| `mongo-user` | MongoDB admin username | `admin` |
| `mongo-pass` | MongoDB admin password | `admin123` |
| `mongo-uri` | Full MongoDB connection string | `mongodb://admin:admin123@mongodb:27017/commons-db?authSource=admin` |
| `rabbitmq-user` | RabbitMQ username | `admin` |
| `rabbitmq-pass` | RabbitMQ password | `admin123` |
| `rabbitmq-url` | Full AMQP URL | `amqp://admin:admin123@rabbitmq:5672` |
| `minio-access-key` | MinIO root user | `admin` |
| `minio-secret-key` | MinIO root password | `password123` |
| `jwt-secret` | JWT signing secret | `your-secret-key` |
| `gemini-api-key` | Google Gemini AI API key | **Replace with your real key** |

---

## 6. Bootstrap: Fresh Cluster Deployment

Complete sequence for a brand-new Docker Desktop Kubernetes cluster. Run all commands from
the **repository root**.

### Step 1 — Enable Kubernetes in Docker Desktop

Docker Desktop → Settings → Kubernetes → ☑ Enable Kubernetes → **Apply & Restart**

```powershell
# Verify the node is Ready
kubectl get nodes
# NAME             STATUS   ROLES           AGE
# docker-desktop   Ready    control-plane   ...
```

### Step 2 — Configure Insecure Local Registry

Docker Desktop → Settings → Docker Engine → add to JSON:

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

Click **Apply & Restart**.

### Step 3 — Start the Local Container Registry

```powershell
cd urbansync-v2/infrastructure/registry
docker compose up -d
cd ../../..

# Verify
curl http://localhost:5000/v2/
# Expected: {}
```

### Step 4 — Install Nginx Ingress Controller

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

kubectl wait --namespace ingress-nginx `
  --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=120s

# Verify
kubectl get pods -n ingress-nginx
```

### Step 5 — Install Knative Serving

```powershell
# 5a. Install Knative Serving CRDs
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-crds.yaml

# 5b. Install Knative Serving core
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.14.0/serving-core.yaml

# 5c. Install Kourier as the Knative networking layer
kubectl apply -f https://github.com/knative/net-kourier/releases/download/knative-v1.14.0/kourier.yaml

# 5d. Configure Knative to use Kourier
kubectl patch configmap/config-network \
  --namespace knative-serving \
  --type merge \
  --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

# 5e. Verify all Knative pods are Running
kubectl get pods -n knative-serving
# Expected: activator, autoscaler, controller, webhook — all Running
```

### Step 6 — Create Namespace

```powershell
kubectl apply -f urbansync-v2/k8s/namespace.yaml

# Verify
kubectl get namespace urbansync
```

### Step 7 — Apply Secrets and ConfigMap

> **Before this step:** update `urbansync-v2/k8s/secrets.yaml` with your real Gemini API key
> (see [Section 5](#5-secrets--configuration)).

```powershell
# Apply secrets first — all other resources depend on them
kubectl apply -f urbansync-v2/k8s/secrets.yaml

# Create the ConfigMap required by the Knative Service
kubectl create configmap urbansync-config \
  --from-literal=MINIO_ENDPOINT=minio \
  --from-literal=MINIO_PORT=9000 \
  --from-literal=MINIO_USE_SSL=false \
  --namespace=urbansync

# Verify
kubectl get secret urbansync-secrets -n urbansync
kubectl get configmap urbansync-config -n urbansync
```

### Step 8 — Apply All Kubernetes Manifests

```powershell
# Apply all manifests recursively (namespace + secrets already applied above)
kubectl apply -f urbansync-v2/k8s/ --recursive

# Watch pods come up (ThingsBoard takes ~3 minutes)
kubectl get pods -n urbansync --watch

# All PVCs should be Bound
kubectl get pvc -n urbansync
```

Expected final state:

```
NAME                        READY   STATUS    RESTARTS
backend-XXXXXXX             1/1     Running   0
frontend-XXXXXXX            1/1     Running   0
mongodb-0                   1/1     Running   0
rabbitmq-0                  1/1     Running   0
minio-0                     1/1     Running   0
thingsboard-0               1/1     Running   0
nodered-XXXXXXX             1/1     Running   0
```

### Step 9 — Deploy the Knative Service

```powershell
kubectl apply -f urbansync-v2/k8s/knative/kservice.yaml

# Verify the KService is Ready (URL column will show the internal URL)
kubectl get ksvc -n urbansync
# NAME                URL                                              READY
# receipt-annotator   http://receipt-annotator.urbansync.svc...        True
```

### Step 10 — Configure MinIO → Knative Webhook

```powershell
# Exec into the MinIO pod to run mc commands
kubectl exec -it -n urbansync statefulset/minio -- sh

# Inside the pod — set up mc alias (minio is the K8s service name)
mc alias set myminio http://localhost:9000 admin password123

# Run the webhook configuration script
# Exit the pod first, then run from the host:
exit
```

```powershell
# Copy and execute the webhook script inside the MinIO pod
kubectl exec -n urbansync statefulset/minio -- sh -c "
  mc alias set myminio http://localhost:9000 admin password123 && \
  mc admin config set myminio notify_webhook:receipts_knative \
    endpoint='http://receipt-annotator.urbansync.svc.cluster.local' \
    queue_limit='100' enable='on' && \
  mc admin service restart myminio
"

# Wait 5 seconds for MinIO to restart, then add the event subscription
Start-Sleep -Seconds 5

kubectl exec -n urbansync statefulset/minio -- sh -c "
  mc alias set myminio http://localhost:9000 admin password123 && \
  mc mb --ignore-existing myminio/receipts && \
  mc event add myminio/receipts \
    arn:minio:sqs::receipts_knative:webhook \
    --event 's3:ObjectCreated:Put'
"

# Verify
kubectl exec -n urbansync statefulset/minio -- sh -c "
  mc alias set myminio http://localhost:9000 admin password123 && \
  mc event list myminio/receipts
"
```

### Step 11 — Seed the Database

```powershell
# From repo root — port-forwards MongoDB, imports all 7 collections, closes port-forward
.\import-db-k8s.ps1
```

### Step 12 — Start Jenkins (CI/CD)

```powershell
# Provide your GitHub PAT
"GITHUB_PAT=ghp_yourtoken" | Out-File -Encoding ascii urbansync-v2/infrastructure/jenkins/.env

cd urbansync-v2/infrastructure/jenkins
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
cd ../../..

# Jenkins ready at http://localhost:8080  (admin / password123)
# Trigger the first build manually: Jenkins → urbansync-v2 → Build Now
```

### Step 13 — Port-Forward for Local Access (Windows only)

```powershell
# Run once per working session
.\urbansync-v2\k8s\start-portforward.ps1

# Application available at http://localhost
# Stop port-forward:
Get-Job | Stop-Job; Get-Job | Remove-Job
```

---

## 7. Knative Serverless — Install & Deploy

### What Is Knative Serving?

Knative Serving extends Kubernetes with a higher-level abstraction for **HTTP workloads** that:

- **Scale to zero** when idle (no traffic for 60 seconds → pod terminates → zero cost)
- **Scale out automatically** when traffic arrives (Activator buffers requests during cold start)
- Provide **traffic-split** between revisions (canary deployments)
- Expose a stable **cluster-internal URL** regardless of replica count

### The `receipt-annotator` KService

| Parameter | Value |
|---|---|
| Image | `localhost:5000/urbansync-receipt-annotator:latest` |
| Port | 8080 |
| Scale-to-zero grace period | 60 seconds |
| Autoscale target (concurrent requests per pod) | 1 (conservative for AI workloads) |
| Max replicas | 3 |
| Cold-start timeout | 60 seconds |
| Health check | `GET /health` → `{"status":"UP"}` |

### Deploying / Updating the KService

```powershell
# First deploy
kubectl apply -f urbansync-v2/k8s/knative/kservice.yaml

# Check status
kubectl get ksvc receipt-annotator -n urbansync
kubectl describe ksvc receipt-annotator -n urbansync

# Watch the pod scale from 0 → 1 on first request
kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator --watch

# View logs
kubectl logs -n urbansync \
  -l serving.knative.dev/service=receipt-annotator \
  --tail=50 -f
```

### Building and Pushing the Knative Image

```powershell
cd urbansync-v2/knative/receipt-annotator

docker build -t localhost:5000/urbansync-receipt-annotator:latest .
docker push localhost:5000/urbansync-receipt-annotator:latest

# Force Knative to pull the new image by updating the revision
kubectl rollout restart deployment -n knative-serving activator
# Or simply re-apply the KService (Knative creates a new revision automatically)
kubectl apply -f ../../k8s/knative/kservice.yaml

cd ../../..
```

### Test the Knative Function Manually

```powershell
# Start a port-forward to the Kourier gateway
kubectl port-forward -n kourier-system svc/kourier 8081:80 &

# Send a test request with a receipt image
curl -X POST http://localhost:8081/ `
  -H "Host: receipt-annotator.urbansync.svc.cluster.local" `
  -F "receipt=@path\to\test-receipt.jpg"

# Expected response:
# {"amount":125.50,"month":"January","year":"2025","type":"Heating"}
```

---

## 8. Knative Flow Explained

The `receipt-annotator` function handles **two distinct call paths** over the same `POST /` endpoint.

### Path A — Synchronous Call from Backend (Interactive)

```
User clicks "Extract from Receipt" in the React UI
        │
        ▼
Backend  POST /api/expenses/knative-extract
        │  proxies the multipart file upload to:
        ▼
receipt-annotator  POST /  (multipart/form-data)
        │
        ├─ IF scaled to zero → Knative Activator buffers the request
        │                       → cold-start the pod (~5-10 s)
        │                       → route request to pod
        │
        ├─ Download file from MinIO (if bucket+key provided in body)
        │  OR use the raw file buffer (if file forwarded directly)
        │
        ├─ Call Google Gemini 1.5 Pro API with base64-encoded image
        │
        └─ Return JSON: { amount, month, year, type }
                │
                ▼
        Backend inserts expense record into MongoDB
        React UI pre-fills the expense form
```

### Path B — Async MinIO Webhook (Event-Driven)

```
Admin uploads a receipt → Backend → MinIO bucket: receipts
                                           │
                                   PUT event notification
                                           │  HTTP POST to:
                                           ▼
                           receipt-annotator  POST /  (JSON body)
                           {
                             "EventName": "s3:ObjectCreated:Put",
                             "Records": [{
                               "s3": {
                                 "bucket": { "name": "receipts" },
                                 "object": { "key": "1234-receipt.pdf", "size": 98765 }
                               }
                             }]
                           }
                                           │
                           ┌──────────────────────────────────┐
                           │  Knative Serving behaviour:       │
                           │  • Scale pod from 0 → 1          │
                           │  • Activator buffers event until  │
                           │    pod is Ready (cold start)      │
                           └──────────────────────────────────┘
                                           │
                           Respond 202 Accepted immediately
                           (MinIO does not wait for processing)
                                           │
                           Async background:
                           ├─ Download file from MinIO
                           ├─ Run Gemini AI extraction
                           └─ Log result (future: PATCH /api/expenses/:id)
```

### Scale-to-Zero Demonstration

```powershell
# After 60 seconds of no traffic, the pod terminates:
kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator
# No resources found in urbansync namespace.   ← scaled to zero ✅

# Trigger a cold start by uploading a receipt via the UI.
# Observe the pod appearing within ~5-10 seconds:
kubectl get pods -n urbansync -l serving.knative.dev/service=receipt-annotator --watch
# NAME                                            READY   STATUS
# receipt-annotator-00001-deployment-XXXX         0/2     Pending     ← cold start
# receipt-annotator-00001-deployment-XXXX         2/2     Running     ← ready
```

---

## 9. CI/CD Pipeline (Jenkins + ArgoCD)

### Pipeline Overview

```
Developer git push → dev-combined branch
        │
        ▼  (poll every 2 minutes)
Jenkins  (localhost:8080)
        │
        ├─ Stage: Checkout
        │    git rev-parse --short HEAD → GIT_SHA
        │
        ├─ Stage: Build images  (parallel)
        │    docker build backend  → localhost:5000/urbansync-backend:GIT_SHA
        │    docker build frontend → localhost:5000/urbansync-frontend:GIT_SHA
        │
        ├─ Stage: Push to registry
        │    docker push both images (:GIT_SHA + :latest)
        │
        └─ Stage: Update manifests
             sed -i image tag in k8s/backend/deployment.yaml
             sed -i image tag in k8s/frontend/deployment.yaml
             git commit "[skip ci] ci: update image tags to GIT_SHA"
             git push → dev-combined
                    │
                    ▼
            ArgoCD  (watches dev-combined / k8s/)
                    │
                    ▼
            kubectl apply  →  rolling update in urbansync namespace
```

### Jenkins Setup

Jenkins is configured via **Jenkins Configuration as Code (JCasC)** — zero UI wizard clicks.

```powershell
# Write your GitHub PAT
"GITHUB_PAT=ghp_yourRealToken" | Out-File -Encoding ascii `
    urbansync-v2/infrastructure/jenkins/.env

# Start Jenkins
cd urbansync-v2/infrastructure/jenkins
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- URL: **http://localhost:8080**
- Credentials: `admin` / `password123`
- Trigger first build manually: **urbansync-v2 → Build Now**

### ArgoCD Setup (One-Time)

```powershell
# Install ArgoCD into the cluster
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=120s

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | `
  ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }

# Port-forward the ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8443:443 &
# Access: https://localhost:8443  (admin / password from above)

# Apply the Application manifest to register the UrbanSync app with ArgoCD
kubectl apply -f urbansync-v2/infrastructure/argocd/application.yaml
```

---

## 10. Design Patterns

### Circuit Breaker (`backend/resilience/circuitBreaker.js`)

Implemented with the **`opossum`** library. Protects external service calls so that a failed
dependency does not cascade and hang the entire Node.js event loop.

| Breaker | Protects | Timeout | Open threshold | Reset after |
|---|---|---|---|---|
| `RabbitMQ-Connect` | `amqplib.connect()` | 8 s | Any failure (3+ calls) | 20 s |
| `MinIO-Operations` | All MinIO API calls | 6 s | 50% failure rate | 15 s |

**States:**

```
[CLOSED] ──── threshold exceeded ───► [OPEN] ──── resetTimeout ───► [HALF-OPEN]
   ▲                                                                      │
   └──────────────── probe success ──────────────────────────────────────┘
                                             probe failure → back to OPEN
```

When the circuit is **OPEN**, the fallback throws a typed error that the route handler catches
and returns an HTTP **503 Service Unavailable** — preserving API responsiveness even when
RabbitMQ or MinIO is down.

### Retry with Exponential Backoff (`backend/resilience/retryHelper.js`)

Wraps transient operations (e.g. initial connection attempts) with configurable retry logic:

- **Max retries:** configurable per call site
- **Strategy:** exponential backoff with jitter to avoid thundering-herd
- **Used for:** initial RabbitMQ connection on backend startup; MinIO bucket existence check

### Idempotency

Receipt upload requests include a client-generated `idempotency-key` header. The backend checks
MongoDB before processing to ensure that duplicate uploads (e.g. from a browser retry) do not
create duplicate expense records.

---

## 11. IaC — OpenTofu + Ansible

The `infrastructure/` directory contains full Infrastructure-as-Code for provisioning and
configuring an **Azure VM** to host the stack (alternative to Docker Desktop local cluster).

### OpenTofu (Azure VM Provisioning)

```bash
cd urbansync-v2/infrastructure/opentofu

# Review the variables
cat terraform.tfvars
# location            = "swedencentral"
# resource_group_name = "gas-receipts-rg"
# admin_username      = "azureuser"

# Login to Azure
az login

# Plan the infrastructure changes
tofu plan

# Apply (creates the VM, VNet, NSG, public IP)
tofu apply

# Get the VM's public IP after apply:
tofu output public_ip_address
```

### Ansible (VM Configuration)

After the VM is provisioned by OpenTofu:

```bash
cd urbansync-v2/infrastructure/ansible

# Copy and fill in secrets (gitignored)
cp vars/secrets.yml.example vars/secrets.yml
# Edit secrets.yml: add your GitHub PAT, credentials, etc.

# Update the inventory with the VM's public IP from OpenTofu output
# ansible-test/hosts.yml  →  update ansible_host

# Run the full configuration playbook
ansible-playbook -i ../../../ansible-test/hosts.yml playbooks/deploy.yml

# The playbook automates:
#   1. Install Docker + Docker Compose
#   2. Write daemon.json (insecure registry)
#   3. Start local registry + Jenkins via docker compose
#   4. Install kubectl + Knative CLI
#   5. Apply K8s namespace, secrets, manifests
#   6. Seed the database
```

---

## 12. Service Access & Endpoints

### Kubernetes Service Endpoints (via port-forward)

| Service | Port-Forward Command | Access URL | Notes |
|---|---|---|---|
| **Application** | `.\start-portforward.ps1` | http://localhost | Full app via Nginx Ingress |
| **RabbitMQ Management** | `kubectl port-forward -n urbansync svc/rabbitmq 15672:15672` | http://localhost:15672 | Queue/exchange management |
| **MinIO Console** | `kubectl port-forward -n urbansync svc/minio 9001:9001` | http://localhost:9001 | Bucket browser |
| **MinIO API** | `kubectl port-forward -n urbansync svc/minio 9000:9000` | http://localhost:9000 | S3-compatible API |
| **ThingsBoard** | `kubectl port-forward -n urbansync svc/thingsboard 9090:9090` | http://localhost:9090 | IoT dashboard ⏰ ~3 min startup |
| **Node-RED** | `kubectl port-forward -n urbansync svc/nodered 1880:1880` | http://localhost:1880 | Flow editor |
| **MongoDB** | `kubectl port-forward -n urbansync svc/mongodb 27017:27017` | `mongodb://admin:admin123@localhost:27017` | Direct DB access |
| **Jenkins** | (Docker Compose) | http://localhost:8080 | CI/CD |

### Backend API Endpoints (Key Routes)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | No | Authenticate user, returns JWT |
| `GET` | `/api/expenses` | JWT | List expenses for user's building |
| `POST` | `/api/expenses` | JWT | Create expense + upload receipt to MinIO |
| `POST` | `/api/expenses/knative-extract` | JWT | Proxy receipt to Knative for AI annotation |
| `POST` | `/api/upload-receipt` | JWT | Direct MinIO upload, returns URL |
| `GET` | `/api/notifications` | JWT | Get building alarm notifications |

---

## 13. Test Credentials

| Service | Username | Password | Notes |
|---|---|---|---|
| **App — Site Admin** | `admin@example.com` | `Admin!123` | Full platform access |
| **App — Building Admin** | `tonyGeo@gmail.com` | `1234567890123` | Manages one building |
| **App — Tenant** | `thkam@example.com` | `1234567` | View-only access |
| **Jenkins** | `admin` | `password123` | CI/CD dashboard |
| **RabbitMQ** | `admin` | `admin123` | Message broker management |
| **MinIO** | `admin` | `password123` | Object storage console |
| **MongoDB** | `admin` | `admin123` | Database (via mongosh) |
| **ThingsBoard** | `tenant@thingsboard.org` | `tenant` | IoT platform |
| **Node-RED** | — | — | No authentication by default |

> **After `.\import-db-k8s.ps1`:** application users are populated. Other service credentials
> are set via `k8s/secrets.yaml`.

---

## 14. Troubleshooting

### Pods not starting — `ImagePullBackOff`

```powershell
# Check the registry is running
curl http://localhost:5000/v2/

# Check what images are available
curl http://localhost:5000/v2/_catalog

# If images are missing, trigger a Jenkins build first
# Then re-apply the manifests:
kubectl rollout restart deployment backend -n urbansync
kubectl rollout restart deployment frontend -n urbansync
```

### Pod stuck in `CrashLoopBackOff`

```powershell
# Get the pod name
kubectl get pods -n urbansync

# Read the last 50 log lines
kubectl logs <pod-name> -n urbansync --tail=50

# Describe for events (OOM, probe failures, missing secrets)
kubectl describe pod <pod-name> -n urbansync
```

### Knative Service not becoming Ready

```powershell
# Check KService conditions
kubectl describe ksvc receipt-annotator -n urbansync

# Check Knative system pods
kubectl get pods -n knative-serving

# Common cause: urbansync-config ConfigMap missing
kubectl get configmap urbansync-config -n urbansync
# If not found, re-run the configmap creation command from Section 6, Step 7

# Common cause: gemini-api-key secret value is wrong
kubectl get secret urbansync-secrets -n urbansync -o jsonpath='{.data.gemini-api-key}' | `
  ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }
```

### MinIO Webhook Not Firing

```powershell
# Verify event subscriptions are configured
kubectl exec -n urbansync statefulset/minio -- sh -c "
  mc alias set myminio http://localhost:9000 admin password123 &&
  mc event list myminio/receipts
"

# Check Knative function logs for incoming events
kubectl logs -n urbansync \
  -l serving.knative.dev/service=receipt-annotator \
  --tail=30

# Test with a manual upload
kubectl exec -n urbansync statefulset/minio -- sh -c "
  mc alias set myminio http://localhost:9000 admin password123 &&
  echo 'test' > /tmp/test.jpg &&
  mc cp /tmp/test.jpg myminio/receipts/
"
```

### ThingsBoard Not Accessible

```powershell
kubectl logs -n urbansync statefulset/thingsboard --tail=50 -f
# Wait until you see: "Started ThingsboardServerApplication"
# This can take up to 3 minutes on first boot.
```

### RabbitMQ Circuit Breaker OPEN (backend logs)

```
🔴 [CB:RabbitMQ-Connect] Circuit OPEN — fast-failing all calls
```

This means RabbitMQ is down or unreachable. Check:

```powershell
kubectl get pods -n urbansync -l app=rabbitmq
kubectl logs -n urbansync statefulset/rabbitmq --tail=30
```

The backend will continue to serve non-RabbitMQ routes. The circuit auto-closes after 20 s once
RabbitMQ recovers.

### PVC Stuck in `Pending`

```powershell
kubectl get pvc -n urbansync
kubectl describe pvc <pvc-name> -n urbansync
# Common cause: Docker Desktop storage class not available
# Ensure "docker.io/hostpath" StorageClass exists:
kubectl get storageclass
```

---

## 15. Roadmap

| Phase | Component | Status |
|---|---|---|
| 1 | Project restructuring — v2 monorepo layout | ✅ Done |
| 2 | GitOps — Jenkins CI/CD + ArgoCD | ✅ Done |
| 3 | Kubernetes manifests — full stack on Docker Desktop K8s | ✅ Done |
| 4 | IaC — OpenTofu + Ansible (Azure VM) | ✅ Done |
| 5 | Serverless — Knative Serving (`receipt-annotator` + MinIO webhook) | ✅ Done |
| 6 | Design Patterns — Circuit Breaker (`opossum`), Idempotency, Retry | ✅ Done |
| 7 | Monitoring — Prometheus + Grafana + HPA | 🔜 Planned |
| 8 | Sealed Secrets / External Secrets Operator | 🔜 Planned |
| 9 | Horizontal Pod Autoscaler for backend | 🔜 Planned |

---

## Quick Reference — Most-Used Commands

```powershell
# === CLUSTER STATUS ===
kubectl get pods -n urbansync                        # All app pods
kubectl get ksvc -n urbansync                        # Knative services
kubectl get pvc -n urbansync                         # Persistent volumes

# === LOGS ===
kubectl logs -n urbansync deploy/backend --tail=50 -f
kubectl logs -n urbansync -l serving.knative.dev/service=receipt-annotator --tail=50

# === RESTART ===
kubectl rollout restart deploy/backend -n urbansync
kubectl rollout restart deploy/frontend -n urbansync

# === RE-APPLY EVERYTHING ===
kubectl apply -f urbansync-v2/k8s/secrets.yaml
kubectl apply -f urbansync-v2/k8s/ --recursive
kubectl apply -f urbansync-v2/k8s/knative/kservice.yaml

# === CLEAN SLATE (destroys all data) ===
kubectl delete namespace urbansync
kubectl apply -f urbansync-v2/k8s/namespace.yaml
# Then repeat Steps 7–13 from Section 6
```

---

*Last reviewed: May 2026 | Branch: `dev-combined` | Namespace: `urbansync`*
