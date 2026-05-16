# UrbanSync v2 — Full Setup Guide

Complete sequence for bringing the stack up from scratch on a new Windows 11
machine with Docker Desktop. Steps are ordered by dependency. Each step notes
whether it can be automated with Ansible later.

---

## Prerequisites (install once, manually)

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | Latest | docker.com/products/docker-desktop — enable WSL2 backend |
| MongoDB Database Tools | Latest | mongodb.com/try/download/database-tools — adds `mongoimport` to PATH |
| Git | Latest | git-scm.com |
| kubectl | Bundled with Docker Desktop | No separate install needed |

> **Ansible note:** Tool installation can be automated with `win_chocolatey`
> (Docker Desktop, Git) and `win_package` or direct download tasks
> (MongoDB Tools). MongoDB Tools PATH must be set after install.

---

## Step 1 — Configure Docker Desktop

These settings live in Docker Desktop's UI and the daemon JSON config.

### 1a — Enable Kubernetes

Docker Desktop → Settings → Kubernetes → check **Enable Kubernetes** → Apply & Restart.

Verify:
```powershell
kubectl get nodes
# NAME             STATUS   ROLES           AGE
# docker-desktop   Ready    control-plane   ...
```

### 1b — Add local registry to insecure registries

Docker Desktop → Settings → Docker Engine → edit the JSON to add:

```json
"insecure-registries": ["localhost:5000"]
```

Full example:
```json
{
  "builder": { "gc": { "defaultKeepStorage": "20GB", "enabled": true } },
  "experimental": false,
  "insecure-registries": ["localhost:5000"]
}
```

Click **Apply & Restart** again.

> **Ansible note:** On Windows, Docker Desktop's daemon.json is at
> `%USERPROFILE%\.docker\daemon.json`. An Ansible `win_copy` or `win_template`
> task can write this file. Docker Desktop must be restarted after the change —
> use `win_service` or `win_shell: Stop-Process -Name 'Docker Desktop' -Force`
> followed by a start task. Enabling Kubernetes programmatically is not
> officially supported; it may require replicating the settings file at
> `%APPDATA%\Docker\settings.json` with `"kubernetesEnabled": true`.

---

## Step 2 — Start the local container registry

The registry must be up before Jenkins builds (push) and before K8s pods start
(pull). Start it first, every time.

```powershell
cd urbansync-v2/infrastructure/registry
docker compose up -d
```

Verify:
```powershell
curl http://localhost:5000/v2/
# Response: {}
```

> **Ansible note:** `community.docker.docker_compose_v2` module can manage
> this. The compose file is at `urbansync-v2/infrastructure/registry/docker-compose.yml`.

---

## Step 3 — Install the nginx ingress controller (one-time)

Required for the K8s `Ingress` resource to route HTTP traffic to pods.

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

kubectl wait --namespace ingress-nginx `
  --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=120s
```

Verify:
```powershell
kubectl get pods -n ingress-nginx
# ingress-nginx-controller-...   1/1   Running
```

> **Ansible note:** Use `kubernetes.core.k8s` module with the manifest URL, or
> download and apply from a local copy. The `kubectl wait` can be replaced with
> a `kubernetes.core.k8s_info` polling loop checking pod `Ready` condition.

---

## Step 4 — Apply K8s manifests (one-time, then Jenkins handles it)

Apply in this exact order — namespace and secrets must exist before other
resources reference them.

```powershell
# From repo root:
kubectl apply -f urbansync-v2/k8s/namespace.yaml
kubectl apply -f urbansync-v2/k8s/secrets.yaml
kubectl apply -f urbansync-v2/k8s/ --recursive
```

Verify:
```powershell
kubectl get pods -n urbansync
# All pods should reach Running within 60s (Thingsboard takes ~3min)

kubectl get pvc -n urbansync
# All PVCs should be Bound
```

> **Ansible note:** `kubernetes.core.k8s` with `state: present` and
> `src: path/to/manifest.yaml` for each file. Apply namespace first as a
> separate task with `when` dependency. `secrets.yaml` should be templated
> from Ansible Vault variables rather than committed to the repo.
> The `--recursive` flag maps to looping over all files in the `k8s/` directory.

---

## Step 5 — Start Jenkins

```powershell
cd urbansync-v2/infrastructure/jenkins
docker compose up -d --build
```

The `--build` flag is required on first run and after any Dockerfile change
(e.g. adding kubectl, upgrading base image).

Get the initial admin password:
```powershell
docker exec urbansync-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open **http://localhost:8080** and complete the setup wizard:
1. Paste the password
2. Click **Install suggested plugins** (wait ~3 min)
3. Create your admin user

> **Ansible note:** `community.docker.docker_compose_v2` starts the container.
> Jenkins initial configuration can be automated with:
> - **Jenkins Configuration as Code (JCasC)** plugin — mount a `jenkins.yaml`
>   config file into the container at startup (no wizard needed)
> - **jenkins-job-builder** — creates pipeline jobs from YAML definitions
> This is the recommended path for full Ansible automation of Step 5 + Step 6.

---

## Step 6 — Configure Jenkins (UI steps)

### 6a — Add GitHub credential (only if repo is private)

**Manage Jenkins → Credentials → System → Global → Add Credentials**

| Field | Value |
|-------|-------|
| Kind | Username with password |
| Username | Your GitHub username |
| Password | GitHub PAT with `Contents: Read` scope |
| ID | `github-creds` |

### 6b — Create the pipeline job

1. **New Item** → name `urbansync-v2` → **Pipeline** → OK
2. **General** → check GitHub project → URL: `https://github.com/AGLoCo13/Node-React.js-Expenses-Application`
3. **Pipeline** → Pipeline script from SCM → Git
   - Repository URL: `https://github.com/AGLoCo13/Node-React.js-Expenses-Application.git`
   - Credentials: `github-creds` (or none if public)
   - Branch: `*/feature/stefanos-branch`
   - Script Path: `urbansync-v2/Jenkinsfile`
4. **Save**

### 6c — Trigger first build

Click **Build Now** on the `urbansync-v2` job page.

Watch Stage View: `Checkout → Build images → Push to registry → Deploy`

After first success, all future pushes to `feature/stefanos-branch` trigger
automatically within ~2 minutes.

> **Ansible note:** Steps 6a–6c can be fully automated with the Jenkins REST
> API via Ansible `uri` module tasks, or with **jenkins-job-builder** +
> **JCasC**. Credentials can be seeded via the Jenkins credentials API.

---

## Step 7 — Seed the database (one-time per fresh cluster)

Required before testing — the K8s MongoDB pod starts empty.

```powershell
# From repo root:
.\import-db-k8s.ps1
```

This port-forwards MongoDB, imports all 7 collections, then closes the
port-forward.

Requires `mongoimport` on PATH (see Prerequisites).

Default test credentials after import:

| Role | Email | Password |
|------|-------|----------|
| Site admin | `admin@example.com` | `Admin!123` |
| Building admin | `tonyGeo@gmail.com` | `1234567890123` |
| Tenant | `thkam@example.com` | `1234567` |

> **Ansible note:** Use `kubernetes.core.k8s_exec` or a port-forward + local
> `command` module task to run `mongoimport` against the pod. Alternatively,
> use a Kubernetes `Job` manifest that runs a one-shot init container to seed
> the database on first start.

---

## Step 8 — Start port-forward (every session, Windows only)

Docker Desktop on Windows does not map LoadBalancer IPs to localhost
automatically. Run this once each time you start working:

```powershell
.\urbansync-v2\k8s\start-portforward.ps1
```

App is then available at **http://localhost**.

To stop:
```powershell
Get-Job | Stop-Job; Get-Job | Remove-Job
```

> **Ansible note:** Not needed on AKS or any cloud Kubernetes — the
> LoadBalancer gets a real public IP automatically. This step disappears
> entirely when moving to Azure.

---

## Summary — what runs where

| Component | Managed by | Restart needed? |
|-----------|-----------|-----------------|
| Local registry (`localhost:5000`) | Docker Compose | Only if `docker compose down` was run |
| Jenkins (`localhost:8080`) | Docker Compose | Only if container stopped |
| App pods (frontend, backend, etc.) | Kubernetes | Auto-restarted by K8s if they crash |
| Port-forward to localhost:80 | Manual PowerShell job | Every session (Windows only) |

---

## Ansible automation roadmap

When writing the Ansible playbook, tackle steps in this order:

1. **Tool install** — chocolatey for Docker Desktop + Git, direct download for MongoDB Tools
2. **Docker Desktop config** — write `daemon.json` + `settings.json`, restart service
3. **Infrastructure services** — `docker_compose_v2` for registry + Jenkins
4. **Jenkins config** — JCasC plugin + jenkins-job-builder for zero-UI setup
5. **K8s baseline** — namespace, secrets (from Vault), ingress controller, manifests
6. **DB seed** — one-shot K8s Job or `k8s_exec` task

Steps 3–6 are straightforward with the `kubernetes.core` and
`community.docker` Ansible collections. Step 2 (Docker Desktop config on
Windows) is the most fragile — test it carefully.
