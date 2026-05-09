# Jenkins CI/CD — UrbanSync v2

## How it works

Every push to `feature/stefanos-branch` triggers a fully automated pipeline:

```
git push
    └─► Jenkins detects new commit (polls GitHub every ~2 min)
            └─► Checkout repo + capture git SHA
                    └─► Build backend image  ─┐  (parallel)
                        Build frontend image ─┘
                            └─► Push both images to local registry (localhost:5000)
                                    └─► docker compose pull + up -d
                                            └─► New version live at http://localhost
```

Jenkins runs in a Docker container with the host Docker daemon mounted via
socket, so all `docker build`, `docker push`, and `docker compose` commands
run against Docker Desktop on the host machine — no Docker-in-Docker required.

---

## Prerequisites

Before running anything, make sure these are in place:

- Docker Desktop installed and running (Windows 11, WSL2 backend)
- The local container registry is up — see
  [urbansync-v2/infrastructure/registry/README.md](../registry/README.md)
- The repo is pushed to GitHub on `feature/stefanos-branch`

---

## Step 1 — Start Jenkins

From this directory (`urbansync-v2/infrastructure/jenkins/`):

```powershell
docker compose up -d --build
```

This builds a custom Jenkins image that includes:
- Jenkins LTS on JDK 21
- Docker CLI + Docker Compose plugin (so pipelines can run `docker build` and `docker compose`)
- Pre-installed plugins (Pipeline, Git, GitHub, Docker Workflow, Blue Ocean, etc.)

Retrieve the initial admin password:

```powershell
docker exec urbansync-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open **http://localhost:8080**, paste the password, click **Install suggested
plugins**, then create your admin user.

---

## Step 2 — Add credentials

Jenkins needs two credentials. Add them at:
**Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

### Credential 1 — Backend environment file

The pipeline copies this into the workspace before running `docker compose` so
the backend has its database and service connection strings.

| Field | Value |
|---|---|
| Kind | Secret file |
| File | Upload `urbansync-v2/backend/.env` from your machine |
| ID | `backend-env-file` |
| Description | Backend environment variables |

### Credential 2 — GitHub (only if repo is private)

| Field | Value |
|---|---|
| Kind | Username with password |
| Username | Your GitHub username |
| Password | A GitHub personal access token (PAT) with `Contents: Read` permission — generate at github.com/settings/tokens |
| ID | `github-creds` |
| Description | GitHub access token |

---

## Step 3 — Create the Pipeline job

1. On the Jenkins home page click **New Item**.
2. Enter name: `urbansync-v2`, select **Pipeline**, click **OK**.
3. On the configuration page:

   **General**
   - Check **GitHub project**
   - Project URL: `https://github.com/AGLoCo13/Node-React.js-Expenses-Application`

   **Build Triggers**
   - Leave blank — the trigger is declared inside the Jenkinsfile itself
     (`pollSCM('H/2 * * * *')`), Jenkins picks it up after the first run.

   **Pipeline**
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `https://github.com/AGLoCo13/Node-React.js-Expenses-Application.git`
   - Credentials: `github-creds` (only if the repo is private; leave empty if public)
   - Branch Specifier: `*/feature/stefanos-branch`
   - Script Path: `urbansync-v2/Jenkinsfile`

4. Click **Save**.

---

## Step 4 — Trigger the first build

Polling cannot fire before Jenkins has a baseline. Kick off the first run
manually:

Click **Build Now** on the `urbansync-v2` job page.

Watch the **Stage View** — you should see four stages complete in order:
`Checkout → Build images → Push to local registry → Deploy`

After the first build succeeds, every subsequent push to
`feature/stefanos-branch` triggers a build automatically within ~2 minutes.

---

## Step 5 — Verify it worked

**Check the registry has the images:**

```powershell
curl http://localhost:5000/v2/_catalog
# {"repositories":["urbansync-backend","urbansync-frontend"]}

curl http://localhost:5000/v2/urbansync-frontend/tags/list
# {"name":"urbansync-frontend","tags":["latest","<sha>",...]}
```

**Check the app is running:**

Open **http://localhost** — the login page should load.

**Check running containers:**

```powershell
docker ps --filter name=urbansync
```

You should see `urbansync-v2-frontend`, `urbansync-v2-backend`, and the
supporting services (mongodb, rabbitmq, minio, etc.) all running.

---

## Migrating to a cloud registry (when ready)

When the project moves to Azure, the only change needed in the pipeline is
one line in `urbansync-v2/Jenkinsfile`:

```groovy
// Change this:
REGISTRY = 'localhost:5000'

// To this (Azure Container Registry example):
REGISTRY = '<yourname>.azurecr.io'
```

Then add an `az acr login` step (or a Jenkins credential binding for Docker
Hub) before the Push stage. Everything else stays the same.

---

## Lifecycle commands

```powershell
# Rebuild Jenkins image (e.g. after Dockerfile changes)
docker compose build --no-cache
docker compose up -d

# Stop Jenkins (jenkins_home volume is preserved — no data lost)
docker compose down

# Stop and wipe all Jenkins state — DESTRUCTIVE, requires full setup again
docker compose down -v

# Tail Jenkins logs
docker compose logs -f jenkins
```
