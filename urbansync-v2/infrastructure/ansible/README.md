# Ansible — UrbanSync v2

Automates the full deployment of UrbanSync to an Azure Linux VM:
sets up Kubernetes, starts the local registry, applies all K8s manifests,
and starts Jenkins (fully configured via JCasC — no wizard required).

---

## Before you run anything — get the secrets decryption key

All secrets (GitHub PAT, Jenkins password, DB/MinIO/RabbitMQ credentials, Gemini API
key, Azure Key Vault settings) live in one SOPS-encrypted file,
`vars/secrets.enc.yml`, committed to Git. You need the **age private key** to decrypt
it — see [SECRETS.md](SECRETS.md) for the full one-time setup (install age/sops,
get the key from a teammate, install Ansible collections).

Ansible decrypts `secrets.enc.yml` automatically as the first task in `deploy.yml` —
there's no separate manual decrypt step before running the playbook.

---

## Playbooks

| File | Purpose | Run order |
|------|---------|-----------|
| `setup-microk8s.yml` | Installs Docker, kubeadm, kubectl; initialises K8s cluster with Calico | 1st (once per VM) |
| `deploy.yml` | Copies app, starts registry, applies K8s manifests, starts Jenkins | 2nd (every deploy) |

---

## Inventory

`inventory.ini` points to the Azure VM:

```ini
[azure_vm]
<vm-public-ip> ansible_user=azureuser ansible_ssh_private_key_file=~/.ssh/id_rsa
```

Update the IP if the VM is recreated.

---

## Running

```bash
# 1. One-time: set up Kubernetes on the VM
ansible-playbook -i inventory.ini setup-microk8s.yml

# 2. Deploy (and re-deploy) the app + Jenkins + ArgoCD — targets prod by default
ansible-playbook -i inventory.ini deploy.yml
```

**Testing locally against Docker Desktop instead of the Azure VM** (run from WSL2 —
see [SECRETS.md](SECRETS.md) for why):
```bash
ansible-playbook -i inventory-local.ini deploy.yml -e "deploy_user=$USER" -e "deploy_env=local"
```

---

## What `deploy.yml` does (in order)

0. Decrypts `vars/secrets.enc.yml` (SOPS + age) — every later step pulls vars from here
1. Creates `/opt/urbansync/` on the target
2. Rsyncs the `urbansync-v2/` folder over (incremental)
3. Starts the local Docker registry (`infrastructure/registry/`)
4. Applies `k8s/base/namespace.yaml`, then the `urbansync-secrets` K8s Secret
   (generated inline from the decrypted vars), then — prod only — Knative Serving +
   Kourier, then — prod only — the Secrets Store CSI driver + Azure Key Vault
   provider (Helm) and populates Key Vault, then
   `kubectl apply -k k8s/overlays/<local|prod>/`
5. Writes Jenkins' `.env` (GitHub PAT + admin password, from the decrypted vars);
   builds + starts Jenkins
6. Installs ArgoCD (server-side apply), writes + applies the repo credential
   Secret, applies `application-local.yaml` or `application-prod.yaml`

After step 6, Jenkins is available at `http://<vm-ip>:8080` and ArgoCD is syncing
the cluster automatically on every future push.
Log in to Jenkins with `admin` / `password123` (or your `jenkins_admin_password`
from `secrets.enc.yml`) — no wizard, pipeline job already created.

---

## What JCasC configures automatically

| What | Value |
|------|-------|
| Admin username | `admin` |
| Admin password | `password123` (or `jenkins_admin_password` from `secrets.enc.yml`) |
| GitHub credential | `github-creds` — PAT from the decrypted `secrets.enc.yml` |
| Pipeline job | `urbansync-v2` → `urbansync-v2/Jenkinsfile` on `dev-combined` |

Config file: [infrastructure/jenkins/jenkins.yaml](../jenkins/jenkins.yaml)
