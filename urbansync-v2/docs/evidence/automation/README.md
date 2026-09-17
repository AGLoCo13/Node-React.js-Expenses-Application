# Automation evidence (S3): OpenTofu and Ansible health check

Run on 17 Sep 2026 from WSL (Ubuntu 24.04) against the live Azure environment. Both checks are
read-only: nothing was applied or changed.

| Check | Result | File |
|---|---|---|
| `tofu fmt -check` | Pass, after fixing one whitespace alignment in `main.tf` found by the first run | `2026-09-17-opentofu-check.txt` |
| `tofu validate` | Pass | same |
| `tofu plan -detailed-exitcode` | **No changes** (exit 0): real Azure resources match the code, including the 14 Sep resize to `Standard_B4as_v2` | same |
| `ansible-playbook -i inventory.ini deploy.yml --check` | **Pass**: `ok=13 changed=3 unreachable=0 failed=0 skipped=34`, 1 min 18 s | `2026-09-17-ansible-deploy-check.txt` |

## Reading the Ansible result

- **Check mode** reports what each module would change. `command`/`shell` tasks (kubectl, helm,
  `az keyvault secret set`) are skipped, so the Key Vault loop in 4d.6 shows one skip per secret
  and writes nothing.
- **The 3 "would change" tasks are expected:**
  - **2** rsync: the VM's copy of the repo is behind the latest commits.
  - **5b** Jenkins compose: the stack would be re-applied.
  - **6c** ArgoCD `repo-secret.yaml`: the file would be rewritten.
- Secrets stay hidden: the SOPS decrypt and the secret-handling tasks run with `no_log`.

## Stale configuration found and fixed

- `infrastructure/ansible/ansible.cfg` defaulted to `hosts.yml`, a leftover from the v1 MERN setup
  that targets a host `devopsvm1`, which no longer exists. It now defaults to `inventory.ini`, the
  Azure VM. Note: Ansible ignores `ansible.cfg` in world-writable directories such as a WSL
  `/mnt/<drive>` mount, so pass `-i inventory.ini` explicitly there, as above.
- `infrastructure/opentofu/main.tf`: `tofu fmt` alignment.

## Redaction

- **Redacted from the OpenTofu log:** the subscription ID, and the encoded client-config ID
  (client, object, subscription and tenant IDs).
- **Checked:** both files were compared against every decrypted SOPS secret value; none appear.
- **Left in:** the Key Vault name, already public in `k8s/overlays/prod/secret-provider-class.yaml`.

## Reproduce

```bash
cd urbansync-v2/infrastructure/opentofu && tofu fmt -check && tofu validate && tofu plan -detailed-exitcode
cd ../ansible && ansible-playbook -i inventory.ini deploy.yml --check
```

Requirements: `az login` in WSL (for tofu); the age key and `~/.ssh/id_rsa` in WSL (for Ansible).
