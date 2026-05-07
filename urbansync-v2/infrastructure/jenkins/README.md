# Jenkins (UrbanSync GitOps)

Local Jenkins controller for the UrbanSync CI pipeline. Builds the backend
and frontend Docker images and pushes them to Docker Hub on every commit.

## Prerequisites

- Docker Desktop running (Linux container mode, WSL2 backend on Windows)
- A Docker Hub account (we will create credentials inside Jenkins later)

## First-time setup

From this directory (`urbansync-v2/infrastructure/jenkins/`):

```powershell
docker compose up -d --build
```

The first build pulls the `jenkins/jenkins:lts-jdk17` base, installs the
Docker CLI, and preinstalls the plugins listed in `plugins.txt`. Expect
a few minutes on first run; later starts are instant.

### Get the initial admin password

```powershell
docker exec urbansync-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open <http://localhost:8080>, paste the password, then:

1. Choose **Install suggested plugins** (the ones we preinstalled are
   already there — Jenkins will skip those and add a few extras).
2. Create the admin user when prompted.
3. Accept the default Jenkins URL (`http://localhost:8080/`).

### Verify Docker access

After login, open **Manage Jenkins → System Information**, or run a quick
sanity job:

```
Manage Jenkins → Script Console
```

Paste:

```groovy
"docker version".execute().text
```

You should see both Client and Server sections — Server confirms the
mounted socket reaches Docker Desktop.

## Next steps

1. **Add Docker Hub credentials** — Manage Jenkins → Credentials → System →
   Global → Add Credentials. Kind: *Username with password*. ID:
   `docker-hub-creds`. Username = your Docker Hub username, Password =
   a Docker Hub **access token** (not your account password — generate one
   at <https://hub.docker.com/settings/security>).
2. **Add GitHub credentials** if the repo is private — same place, kind
   *Username with password* (use a personal access token), ID `github-creds`.
3. **Create the pipeline job** — see the next section.

## Creating the Pipeline job

The `Jenkinsfile` lives at [urbansync-v2/Jenkinsfile](../../Jenkinsfile) and
builds + pushes both app images on every commit to `main`. To wire it up:

1. **Commit and push** the Jenkinsfile and this `infrastructure/jenkins/`
   directory to GitHub on `main`. Jenkins polls the remote, so the pipeline
   files must be visible there.
2. In Jenkins: **New Item** → name it `urbansync-v2` → choose **Pipeline** →
   OK.
3. On the job config page:
   - **General** → check *GitHub project*, paste the repo URL.
   - **Build Triggers** → leave blank. The trigger is declared inside the
     `Jenkinsfile` (`pollSCM('H/2 * * * *')`), so Jenkins picks it up after
     the first run.
   - **Pipeline** section:
     - Definition: *Pipeline script from SCM*
     - SCM: *Git*
     - Repository URL: `https://github.com/<your-fork>/Node-React.js-Expenses-Application.git`
     - Credentials: `github-creds` (only if the repo is private; leave empty if public)
     - Branch Specifier: `*/feature/stefanos-branch` (current dev branch — switch to `*/main` once changes are merged)
     - Script Path: `urbansync-v2/Jenkinsfile`
   - Save.
4. **First run** — click **Build Now** once. The first run cannot be
   triggered by polling because Jenkins needs an initial baseline.
5. After the first build succeeds, every push to the tracked branch will
   trigger a new build within ~2 minutes.

## Verifying it worked

- The build log should end with `Pushed stefanosthedocker/urbansync-backend:<sha>`
  and the matching frontend line.
- On <https://hub.docker.com/u/stefanosthedocker> you should see two repos:
  `urbansync-backend` and `urbansync-frontend`, each with `latest` and a
  short-SHA tag for every successful build.

## Lifecycle

```powershell
# Stop (preserves jenkins_home volume)
docker compose down

# Stop and wipe state (DESTRUCTIVE — re-runs first-time setup)
docker compose down -v

# Tail logs
docker compose logs -f jenkins
```

## Notes

- The container runs as `root` so that the mounted `/var/run/docker.sock`
  is usable. This is acceptable for a local dev/class setup; in a hardened
  deployment you would either run Jenkins agents in DinD or add the
  `jenkins` user to a docker group with the matching host GID.
- `jenkins_home` is a named Docker volume — credentials, jobs, and plugin
  state survive container rebuilds. Treat it as the source of truth.
