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
                                    └─► Update image tag in k8s/base/{frontend,backend}/deployment.yaml → git commit [skip ci] → git push
                                            └─► ArgoCD detects manifest commit → syncs cluster
                                                    └─► New pods roll out
```

Jenkins runs in a Docker container with the host Docker daemon mounted via
socket — no Docker-in-Docker required. **Jenkins Configuration as Code (JCasC)**
configures the admin account, GitHub credential, and pipeline job automatically
on first boot — no setup wizard required.

Deployment is handled entirely by **ArgoCD** — see
[infrastructure/argocd/README.md](../argocd/README.md).

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

The `deploy.yml` playbook handles everything, including writing Jenkins' `.env` file.
Secrets (including the GitHub PAT) come from the SOPS-encrypted
`vars/secrets.enc.yml` — see [infrastructure/ansible/SECRETS.md](../ansible/SECRETS.md)
to get the decryption key, then:

```bash
cd urbansync-v2/infrastructure/ansible
ansible-playbook -i inventory.ini deploy.yml
```

Jenkins will be available at `http://<vm-ip>:8080` fully configured.

**Testing locally first (Docker Desktop):** Ansible doesn't run natively on Windows —
use WSL2, and pass `deploy_env=local` plus an inventory targeting `localhost`:

```bash
ansible-playbook -i inventory-local.ini deploy.yml -e "deploy_user=$USER" -e "deploy_env=local"
```

This skips the Azure-only steps (Key Vault CSI driver, `az` CLI) and applies
`k8s/overlays/local/` instead of `k8s/overlays/prod/`.

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
| Admin password | `password123` (or `jenkins_admin_password` from `secrets.enc.yml`) |
| GitHub credential ID | `github-creds` (PAT from `GITHUB_PAT` env var, written by Ansible from `secrets.enc.yml`) |
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

# ArgoCD has synced the new manifests (urbansync-local or urbansync-prod depending on target)
kubectl get application -n argocd
# SYNC STATUS = Synced, HEALTH = Healthy

# K8s pods are running the new image
kubectl get pods -n urbansync
```

---

## Migrating to a cloud registry (AKS)

1. Change `REGISTRY` in `urbansync-v2/Jenkinsfile`:
   ```groovy
   REGISTRY = '<yourname>.azurecr.io'
   ```
2. Add `az acr login --name <yourname>` before the Push stage.
3. Update `image:` in `k8s/base/frontend/deployment.yaml` and `k8s/base/backend/deployment.yaml`.

No kubectl workarounds to remove — ArgoCD handles all cluster interaction directly.

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
