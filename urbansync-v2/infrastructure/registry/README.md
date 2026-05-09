# Local Container Registry (UrbanSync)

A self-hosted `registry:2` container that acts as the image store for the
UrbanSync CI pipeline. Jenkins pushes freshly built images here; anything that
needs to run those images pulls from here.

This mirrors how a cloud registry (Azure Container Registry, Docker Hub, ECR)
would work in production — the only difference when you migrate is the hostname
and a credential.

> **Start this before anything else.** Both Jenkins (to push images) and the
> v2 app stack (to pull and run images) depend on this registry being up.
> If the registry is down, Jenkins builds will fail at the Push stage and
> `docker compose up -d` will fail to pull the frontend and backend images.

## How to start

```powershell
cd urbansync-v2/infrastructure/registry
docker compose up -d
```

Images pushed here persist in the `registry_data` Docker volume and survive
container restarts.

## How to verify it's running

```powershell
curl http://localhost:5000/v2/
# expect: {}
```

An empty JSON object means the registry is up and speaking the OCI
Distribution API.

## Inspecting pushed images

After the Jenkins pipeline runs at least once:

```powershell
# List all repositories in the registry
curl http://localhost:5000/v2/_catalog
# expect: {"repositories":["urbansync-backend","urbansync-frontend"]}

# List tags for the backend image
curl http://localhost:5000/v2/urbansync-backend/tags/list
# expect: {"name":"urbansync-backend","tags":["latest","<8-char-sha>",...]}
```

## Why Docker Desktop trusts this without TLS

Docker Desktop automatically allows plain HTTP pushes/pulls to `localhost`
addresses. No `insecure-registries` configuration needed.

## Migrating to Azure (when ready)

The only change required in the pipeline is the registry hostname.

In `urbansync-v2/Jenkinsfile`, change:

```groovy
REGISTRY = 'localhost:5000'
```

to:

```groovy
REGISTRY = '<yourname>.azurecr.io'
```

Then add an `az acr login --name <yourname>` step (or a Jenkins credential
binding) before the push stage. Everything else — the `docker build`, tag
shape, and `docker push` commands — stays exactly the same.

## Lifecycle

```powershell
# Stop (images are preserved in the volume)
docker compose down

# Stop and delete all stored images (DESTRUCTIVE)
docker compose down -v

# Tail logs
docker compose logs -f registry
```
