# Jenkins (UrbanSync GitOps)

Jenkins controller running in Docker. On every push to `feature/stefanos-branch`
it builds the v2 backend and frontend Docker images and pushes them to the local
container registry at `localhost:5000`.

## How the pipeline works

The pipeline is defined in [urbansync-v2/Jenkinsfile](../../Jenkinsfile) and
runs four stages:

1. **Checkout** — clones the repo and captures the 8-char git SHA used as the
   image tag.
2. **Build images** *(parallel)* — runs `docker build` for the backend
   (`urbansync-v2/backend/`) and frontend (`urbansync-v2/frontend/`) at the same
   time. Each image is tagged `:latest` and `:<sha>`.
3. **Push to local registry** — pushes all four tags to `localhost:5000`. No
   credentials needed (local registry is unauthenticated).
4. **Post / cleanup** — wipes the Jenkins workspace. Images remain cached on
   Docker Desktop for fast layer reuse on the next build.

The trigger is SCM polling every ~2 minutes (`pollSCM('H/2 * * * *')`),
declared inside the Jenkinsfile.

## Prerequisites

- Docker Desktop running (WSL2 backend on Windows 11)
- Local registry running — start it first:
  ```powershell
  cd urbansync-v2/infrastructure/registry
  docker compose up -d
  ```
  See [urbansync-v2/infrastructure/registry/README.md](../registry/README.md)
  for verification steps.
- `github-creds` Jenkins credential — only needed if the repo is private
  (username + personal access token, ID `github-creds`).

## How to start Jenkins

From this directory (`urbansync-v2/infrastructure/jenkins/`):

```powershell
docker compose up -d --build
docker exec urbansync-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open <http://localhost:8080>, paste the password, install suggested plugins,
and create the admin user.

## Creating the Pipeline job

1. Commit and push the `Jenkinsfile` and this `infrastructure/` directory to
   `feature/stefanos-branch` on GitHub.
2. In Jenkins: **New Item** → name `urbansync-v2` → **Pipeline** → OK.
3. Configure:
   - **General** → check *GitHub project*, paste the repo URL.
   - **Build Triggers** → leave blank (trigger is in the Jenkinsfile).
   - **Pipeline** → Definition: *Pipeline script from SCM* → SCM: *Git*
     → Repository URL: your GitHub repo URL
     → Credentials: `github-creds` (only if private)
     → Branch Specifier: `*/feature/stefanos-branch`
     → Script Path: `urbansync-v2/Jenkinsfile`
   - Save.
4. Click **Build Now** for the first run (polling can't trigger before a
   baseline exists).

## Lifecycle

```powershell
# Stop Jenkins (jenkins_home volume is preserved)
docker compose down

# Stop and wipe all state (DESTRUCTIVE — requires full first-run setup again)
docker compose down -v

# Tail logs
docker compose logs -f jenkins
```
