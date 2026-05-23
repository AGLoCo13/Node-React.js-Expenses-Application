# Jenkins CI/CD — UrbanSync v2

## How it works

Every push to `dev-combined` triggers a fully automated pipeline:

```
git push
    └─► Jenkins detects new commit (polls GitHub every ~2 min)
            └─► Checkout repo + capture git SHA
                    └─► Build backend image  ─┐  (parallel)
                        Build frontend image ─┘
                            └─► Push both images to local registry (localhost:5000)
                                    └─► kubectl apply -f k8s/ --recursive
                                            └─► kubectl rollout restart (frontend + backend)
                                                    └─► New version live
```

Jenkins runs in a Docker container with the host Docker daemon mounted via
socket — no Docker-in-Docker required. `kubectl` talks to the Kubernetes cluster
via the mounted kubeconfig. **Jenkins Configuration as Code (JCasC)** configures
the admin account, GitHub credential, and pipeline job automatically on first boot
— no setup wizard required.

---

## Prerequisites

- Docker (Desktop on Windows, or Docker Engine on Linux)
- Kubernetes cluster running and `~/.kube/config` in place
- nginx ingress controller installed — see [urbansync-v2/k8s/README.md](../../k8s/README.md)
- Local registry up — see [urbansync-v2/infrastructure/registry/README.md](../registry/README.md)
- K8s manifests applied at least once — see [urbansync-v2/k8s/README.md](../../k8s/README.md)

---

## Starting Jenkins

### On the Azure VM (via Ansible — recommended)

The `deploy.yml` playbook handles everything. Before running it, set your GitHub PAT:

```bash
cd urbansync-v2/infrastructure/ansible
cp vars/secrets.yml.example vars/secrets.yml
# edit vars/secrets.yml and paste your real GitHub PAT
ansible-playbook -i inventory.ini deploy.yml
```

Jenkins will be available at `http://<vm-ip>:8080` fully configured.

### On Linux manually

```bash
cd urbansync-v2/infrastructure/jenkins

# Write your GitHub PAT to the .env file (gitignored)
echo "GITHUB_PAT=ghp_yourtoken" > .env

docker compose up -d --build
```

### On Windows (local testing)

```powershell
cd urbansync-v2/infrastructure/jenkins

# Write your GitHub PAT to the .env file (gitignored)
"GITHUB_PAT=ghp_yourtoken" | Out-File -Encoding ascii .env

# Use the local override (swaps Linux paths for Windows paths)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

`docker-compose.local.yml` is gitignored — it only exists for local development.

---

## What JCasC configures automatically

On first boot Jenkins reads `jenkins.yaml` and sets up:

| What | Value |
|------|-------|
| Admin username | `admin` |
| Admin password | `password123` |
| GitHub credential ID | `github-creds` (PAT from `GITHUB_PAT` env var) |
| Pipeline job | `urbansync-v2` → `urbansync-v2/Jenkinsfile` on `dev-combined` |

No setup wizard, no UI clicks required.

---

## Trigger the first build

Polling cannot fire before Jenkins has a baseline commit reference. After the
container starts, trigger the first run manually:

1. Open **http://localhost:8080** (or `http://<vm-ip>:8080`)
2. Log in with `admin` / `password123`
3. Click **urbansync-v2** → **Build Now**

After the first build succeeds, every subsequent push to `dev-combined` triggers
a build automatically within ~2 minutes.

---

## Verify it worked

```bash
# Registry has the images
curl http://localhost:5000/v2/_catalog
# {"repositories":["urbansync-backend","urbansync-frontend"]}

# K8s pods are running
kubectl get pods -n urbansync
# All pods should show STATUS = Running
```

---

## Migrating to a cloud registry (AKS)

1. Change `REGISTRY` in `urbansync-v2/Jenkinsfile`:
   ```groovy
   REGISTRY = '<yourname>.azurecr.io'
   ```
2. Add `az acr login --name <yourname>` before the Push stage.
3. Update `image:` in `k8s/frontend/deployment.yaml` and `k8s/backend/deployment.yaml`.
4. Remove the two Docker Desktop workarounds from the Deploy stage:
   - The `sed` rewriting `127.0.0.1` → `host.docker.internal` in the kubeconfig
   - The `--insecure-skip-tls-verify` flags on both `kubectl` commands

   The Deploy stage simplifies to:
   ```groovy
   sh 'kubectl apply -f urbansync-v2/k8s/ --recursive'
   sh 'kubectl rollout restart deployment/urbansync-frontend deployment/urbansync-backend -n urbansync'
   ```

---

## Lifecycle commands

```bash
# Rebuild Jenkins image (required after Dockerfile or plugins.txt changes)
docker compose build --no-cache
docker compose up -d

# Stop Jenkins — jenkins_home volume is preserved, no data lost
docker compose down

# Stop and wipe all Jenkins state — DESTRUCTIVE, JCasC will reconfigure on next start
docker compose down -v

# Tail Jenkins logs
docker compose logs -f jenkins
```
