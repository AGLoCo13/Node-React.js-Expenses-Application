# Getting the project secrets

The secrets file (`vars/secrets.enc.yml`) is encrypted with [SOPS + age](https://github.com/getsops/sops).
You need the private key from Stefanos to decrypt it.

---

## 1. Install the tools

```powershell
winget install FiloSottile.age
winget install mozilla.sops
```

## 2. Get the private key

Ask Stefanos for the private key and save it here:

```powershell
New-Item -ItemType Directory -Force "$env:APPDATA\sops\age"
notepad "$env:APPDATA\sops\age\keys.txt"   # paste the key, save, close
```

## 3. Install Ansible collections

Ansible does not run natively on Windows — use **WSL2**. Install `ansible`, `age`,
and `sops` inside WSL2 too (the Windows installs from step 1 don't carry over), then
copy your age private key into WSL2:

```bash
sudo apt update && sudo apt install -y software-properties-common
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt install -y ansible age
sudo wget https://github.com/getsops/sops/releases/download/v3.9.4/sops-v3.9.4.linux.amd64 -O /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops

mkdir -p ~/.config/sops/age
cp /mnt/c/Users/<you>/AppData/Roaming/sops/age/keys.txt ~/.config/sops/age/keys.txt

ansible-galaxy collection install -r requirements.yml
```

## 4. Run the playbook

**Against the Azure VM (prod):**
```bash
ansible-playbook -i inventory.ini deploy.yml
```

**Against your own Docker Desktop cluster (local test):**
```bash
ansible-playbook -i inventory-local.ini deploy.yml -e "deploy_user=$USER" -e "deploy_env=local"
```
`deploy_env=local` skips the Azure-only steps (Helm CSI driver, Azure CLI, Key Vault
population) and applies `k8s/overlays/local/` instead of `k8s/overlays/prod/`.

Either way, Ansible decrypts the secrets automatically and configures the K8s Secret,
Jenkins' `.env`, and (prod only) Azure Key Vault — no extra steps needed.

---

**To inspect the secrets manually:**
```bash
sops --decrypt vars/secrets.enc.yml
```
