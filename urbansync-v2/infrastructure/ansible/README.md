# Ansible — UrbanSync v2

Automates the full deployment of UrbanSync to an Azure Linux VM:
sets up Kubernetes, starts the local registry, applies all K8s manifests,
and starts Jenkins (fully configured via JCasC — no wizard required).

---

## Before you run anything — create your secrets file

The playbook needs your GitHub PAT to configure Jenkins. This file is
**gitignored** and must be created manually on your machine:

```bash
cd urbansync-v2/infrastructure/ansible
cp vars/secrets.yml.example vars/secrets.yml
```

Then open `vars/secrets.yml` and replace the placeholder:

```yaml
github_pat: "ghp_yourrealtokenhere"
```

Generate a PAT at **github.com/settings/tokens** with `Contents: Read` scope.

> Never commit `vars/secrets.yml` — it is listed in `ansible/.gitignore`.

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

# 2. Deploy (and re-deploy) the app + Jenkins
ansible-playbook -i inventory.ini deploy.yml
```

---

## What `deploy.yml` does (in order)

1. Creates `/opt/urbansync/` on the VM
2. Copies the `urbansync-v2/` folder to the VM
3. Starts the local Docker registry (`infrastructure/registry/`)
4. Applies K8s manifests: `namespace.yaml` → `secrets.yaml` → everything else
5. Writes a `.env` file with `GITHUB_PAT` for the Jenkins docker-compose
6. Starts Jenkins (`infrastructure/jenkins/`) — JCasC configures it automatically

After step 6, Jenkins is available at `http://<vm-ip>:8080`.  
Log in with `admin` / `password123` — no wizard, pipeline job already created.

---

## What JCasC configures automatically

| What | Value |
|------|-------|
| Admin username | `admin` |
| Admin password | `password123` |
| GitHub credential | `github-creds` — PAT from `vars/secrets.yml` |
| Pipeline job | `urbansync-v2` → `urbansync-v2/Jenkinsfile` on `dev-combined` |

Config file: [infrastructure/jenkins/jenkins.yaml](../jenkins/jenkins.yaml)
