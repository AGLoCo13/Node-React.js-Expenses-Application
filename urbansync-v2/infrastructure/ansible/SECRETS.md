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

```powershell
ansible-galaxy collection install -r requirements.yml
```

## 4. Run the playbook

```powershell
ansible-playbook -i inventory.ini deploy.yml
```

Ansible decrypts the secrets automatically — no extra steps needed.

---

**To inspect the secrets manually:**
```powershell
sops --decrypt vars/secrets.enc.yml
```
