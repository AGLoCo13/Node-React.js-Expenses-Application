# ArgoCD GitOps — UrbanSync v2

ArgoCD is the deployment half of the CI/CD pipeline. Jenkins builds and pushes
images; ArgoCD watches the Git repo for manifest changes and syncs the cluster
automatically — no manual `kubectl apply` required.

---

## How it works

```
git push (code change)
    └─► Jenkins: build images → push to registry → update image tag in k8s/ → git push [skip ci]
            └─► ArgoCD detects new commit on dev-combined
                    └─► Diffs k8s/ manifests against live cluster state
                            └─► Applies changed manifests
                                    └─► New pods roll out automatically
```

ArgoCD runs inside the Kubernetes cluster and talks to the API server directly
(`kubernetes.default.svc`) — no kubeconfig mount or external access needed.

**Key behaviours:**
- `selfHeal: true` — if anyone does a manual `kubectl apply`, ArgoCD reverts it within seconds
- `prune: true` — deleting a manifest from Git removes the resource from the cluster
- `[skip ci]` — the manifest-update commit carries this tag so Jenkins does not re-trigger on it

---

## Files in this directory

| File | Purpose |
|------|---------|
| `application.yaml` | ArgoCD Application CR — declares what to watch and where to deploy |
| `repo-secret.yaml.example` | Template for the private repo credential secret |
| `repo-secret.yaml` | Real credential secret — **gitignored**, created from example or by Ansible |
| `.gitignore` | Gitignores `repo-secret.yaml` |

---

## Prerequisites

- ArgoCD installed in the cluster (`argocd` namespace)
- Repo credential secret applied (`repo-secret.yaml`)
- `application.yaml` applied

---

## Installing ArgoCD

```bash
# Create namespace first (required before the install manifest)
kubectl create namespace argocd

# Install ArgoCD — server-side apply required (CRD annotations exceed client-side limit)
kubectl apply -n argocd --server-side \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s
```

On the **Azure VM**, Ansible handles this automatically via `deploy.yml` Block 6.

---

## Applying the repo secret and Application CR

```bash
# Create the real repo-secret.yaml from the example
cd urbansync-v2/infrastructure/argocd
cp repo-secret.yaml.example repo-secret.yaml
# Edit repo-secret.yaml — fill in your GitHub username and PAT
# The PAT needs Contents: Read and Write scope

kubectl apply -f repo-secret.yaml
kubectl apply -f application.yaml
```

The repo secret must be applied **before** the Application CR — ArgoCD connects to
the repo immediately on creation and will fail with an auth error if the secret
arrives later.

On the **Azure VM**, Ansible writes `repo-secret.yaml` automatically from
`ansible/vars/secrets.yml` (gitignored) and applies both files.

---

## What `application.yaml` configures

| Setting | Value |
|---------|-------|
| Watches repo | `AGLoCo13/Node-React.js-Expenses-Application` |
| Branch | `dev-combined` |
| Manifest path | `urbansync-v2/k8s/` |
| Destination cluster | in-cluster (`kubernetes.default.svc`) |
| Destination namespace | `urbansync` |
| Auto-sync | enabled (`selfHeal` + `prune`) |
| `urbansync-secrets` | ignored — applied by Ansible directly, gitignored |

---

## Accessing the ArgoCD UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

Open **https://localhost:8081**

**Username:** `admin`

**Password:**
```bash
# Linux / Git Bash
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath='{.data.password}' | base64 -d

# PowerShell
$enc = kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($enc))
```

---

## Verify it worked

```bash
# Application is synced and healthy
kubectl get application urbansync -n argocd

# Watch sync status in real time
kubectl get application urbansync -n argocd -w

# All app pods running
kubectl get pods -n urbansync
```

After a successful end-to-end test:
1. Push a code change to `dev-combined`
2. Jenkins builds, pushes images, commits updated SHA tags → `[skip ci]`
3. ArgoCD detects the manifest commit within ~3 minutes
4. New pods roll out — `kubectl get pods -n urbansync` shows the rollout
5. ArgoCD UI shows `Synced` / `Healthy`

---

## Migrating to AKS

1. Change `REGISTRY` in `urbansync-v2/Jenkinsfile` to your ACR address
2. Add `az acr login` before the Push stage
3. Update `image:` in `k8s/frontend/deployment.yaml` and `k8s/backend/deployment.yaml`
4. Update `url:` in `repo-secret.yaml` if the repo moves
5. No changes needed to `application.yaml` — it watches Git, not the registry
