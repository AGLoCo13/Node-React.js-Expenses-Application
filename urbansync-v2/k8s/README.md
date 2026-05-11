# Kubernetes — UrbanSync v2

Deploys the full UrbanSync stack on Docker Desktop Kubernetes. Once set up,
every push to `feature/stefanos-branch` triggers Jenkins which applies the
manifests and restarts the frontend and backend deployments automatically.

## Folder structure

```
k8s/
├── namespace.yaml          All resources live in the "urbansync" namespace
├── secrets.yaml            Passwords and connection strings (gitignored)
├── configmap.yaml          Non-sensitive env vars
├── ingress.yaml            Routes / → frontend, /api → backend
├── frontend/               Deployment + Service
├── backend/                Deployment + Service
├── mongodb/                StatefulSet + Service + PVC
├── rabbitmq/               StatefulSet + Service + PVC
├── minio/                  StatefulSet + Service + PVC
├── thingsboard/            StatefulSet + Service + PVCs
└── nodered/                Deployment + Service + PVC
```

---

## Windows port-forward (required every session)

Docker Desktop on Windows does not map LoadBalancer services to `localhost`
automatically (Mac does; Windows does not). The nginx ingress controller gets
an internal cluster IP that is unreachable from the host.

**Run this once each time you start working:**

```powershell
# From the repo root:
.\urbansync-v2\k8s\start-portforward.ps1
```

Or manually as a background job:

```powershell
Start-Job { kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80 }
```

The app is then available at **http://localhost**.

To stop the background job:
```powershell
Get-Job | Stop-Job
Get-Job | Remove-Job
```

> This is not a flaw in the K8s setup — it is a Docker Desktop for Windows
> networking limitation. On Azure (AKS) the LoadBalancer gets a real public IP
> automatically and this workaround is not needed.

---

## One-time setup (do this before the first Jenkins build)

### 1 — Enable Kubernetes in Docker Desktop

Docker Desktop → Settings → Kubernetes → check **Enable Kubernetes** → Apply & Restart.

Verify:
```powershell
kubectl get nodes
# NAME                 STATUS   ROLES           AGE
# docker-desktop       Ready    control-plane   ...
```

### 2 — Allow HTTP pulls from the local registry

Docker Desktop → Settings → Docker Engine → add `"insecure-registries"` to the
JSON config:

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

Click **Apply & Restart**. This lets the K8s node pull images from the local
registry over plain HTTP.

### 3 — Install the nginx ingress controller

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

This enables the `Ingress` resource in `ingress.yaml` to route traffic.

### 4 — Start the local registry

The registry must be running before applying manifests so Jenkins can push
images and K8s can pull them.

```powershell
cd urbansync-v2/infrastructure/registry
docker compose up -d
```

### 5 — Apply the manifests

```powershell
# From the repo root:
kubectl apply -f urbansync-v2/k8s/namespace.yaml
kubectl apply -f urbansync-v2/k8s/secrets.yaml
kubectl apply -f urbansync-v2/k8s/ --recursive
```

> `secrets.yaml` is applied before the recursive apply because other resources
> depend on it and it is gitignored (will not be in the repo clone on CI).

### 6 — Wait for pods to start

```powershell
kubectl get pods -n urbansync --watch
```

Most pods reach `Running` within 30–60 seconds. Thingsboard takes 2–3 minutes
on first start (initialises its PostgreSQL database).

### 7 — Open the app

Navigate to **http://localhost** — the login page should load.

---

## Verifying the stack

```powershell
# All pods running
kubectl get pods -n urbansync

# Ingress has an address
kubectl get ingress -n urbansync

# Persistent volumes bound
kubectl get pvc -n urbansync
```

---

## Updating the app (normal flow after setup)

Push a commit to `feature/stefanos-branch`. Jenkins will:
1. Build new Docker images and push them to `localhost:5000`
2. Run `kubectl apply -f k8s/ --recursive`
3. Run `kubectl rollout restart` on the frontend and backend deployments

The rollout restart forces pods to pull the new `:latest` image even though the
tag name has not changed.

---

## Secrets

`secrets.yaml` is gitignored and must exist on the machine before applying
manifests. The file contains base64-encoded values for:

- MongoDB credentials (`admin` / `admin123`)
- RabbitMQ credentials (`admin` / `admin123`)
- MinIO credentials (`admin` / `password123`)
- JWT secret (`your-secret-key`)

If the file is lost, recreate it from `k8s/secrets.yaml` in the repo history
or re-encode the values:

```powershell
# Example: encode a value
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("admin"))
# Output: YWRtaW4=
```

---

## Migrating to Azure (when ready)

1. Change `REGISTRY` in `urbansync-v2/Jenkinsfile` from `localhost:5000` to your ACR hostname.
2. Update `image:` in `frontend/deployment.yaml` and `backend/deployment.yaml` to match.
3. Add `az acr login` before the Push stage in the Jenkinsfile.
4. Replace `secrets.yaml` entries with values appropriate for the Azure environment.

---

## Lifecycle

```powershell
# Delete all urbansync resources (keeps PVCs — data is preserved)
kubectl delete -f urbansync-v2/k8s/ --recursive

# Delete everything including persistent data — DESTRUCTIVE
kubectl delete namespace urbansync

# Tail logs for a specific pod
kubectl logs -f deployment/urbansync-backend -n urbansync

# Restart a specific deployment
kubectl rollout restart deployment/urbansync-frontend -n urbansync
```
