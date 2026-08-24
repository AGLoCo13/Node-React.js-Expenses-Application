# OpenTofu — IaC for UrbanSync v2 Azure VM

Provisions the single Azure VM that runs the whole UrbanSync v2 stack
(Kubernetes, Jenkins, ArgoCD, the local registry, and all app services), plus the
Key Vault the prod overlay reads its secrets from.

## Resources created

| File | Resources |
|---|---|
| `main.tf` | Resource group, VNet, subnet, public IP, NSG (22/80/8080), NIC, Linux VM, Key Vault, role assignment |
| `variables.tf` | `location`, `resource_group_name`, `admin_username`, `ssh_public_key`, `keyvault_name` |
| `outputs.tf` | `vm_public_ip`, `ssh_connection_command`, `keyvault_name`, `tenant_id`, `vm_identity_principal_id` |
| `terraform.tfvars` | Your values — **git-ignored**, copy from `terraform.tfvars.example` |

The VM gets a **system-assigned Managed Identity** holding the *Key Vault Secrets
Officer* role on the vault. That single binding covers both directions:

- **write** — Ansible `deploy.yml` task 4d.6 pushes secrets with `az keyvault secret set`
  after authenticating via `az login --identity` (task 4d.5c)
- **read** — the Secrets Store CSI driver pulls them into the cluster
  (`useVMManagedIdentity: "true"` in `k8s/overlays/prod/secret-provider-class.yaml`)

## Prerequisites

```powershell
winget install OpenTofu.Tofu
winget install Microsoft.AzureCLI
az login
az account set --subscription <subscription-id>
```

Check your B-series vCPU quota before applying — `Standard_B2ms` needs 2 vCPUs and
some student subscriptions cap this at 0:

```powershell
az vm list-usage --location westeurope -o table | Select-String "Standard B"
```

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars
# Fill in ssh_public_key and pick a globally-unique keyvault_name

tofu init
tofu validate
tofu plan
tofu apply
```

## After apply — three values must be copied out

Key Vault names and tenant IDs are referenced in files OpenTofu does not manage.
Take them straight from the outputs:

```bash
tofu output
```

| Output | Goes into |
|---|---|
| `vm_public_ip` | `infrastructure/ansible/inventory.ini` |
| `keyvault_name` | `k8s/overlays/prod/secret-provider-class.yaml` (`keyvaultName`) and `vars/secrets.enc.yml` (`azure_keyvault_name`) |
| `tenant_id` | `k8s/overlays/prod/secret-provider-class.yaml` (`tenantId`) |

The Key Vault name must agree in all three places. It is **not** templated from
Ansible on purpose — ArgoCD applies `overlays/prod` directly from Git with
`selfHeal: true` and would revert any locally-generated manifest.

## Verifying the identity actually works

This is the exact operation `deploy.yml` block 4d performs. Run it on the VM before
running any playbook:

```bash
ssh azureuser@$(tofu output -raw vm_public_ip)
az login --identity
az keyvault secret set --vault-name <kv-name> --name smoke-test --value ok
az keyvault secret list --vault-name <kv-name> -o table
az keyvault secret delete --vault-name <kv-name> --name smoke-test
```

`az login --identity` failing means the identity is missing; the `secret set`
failing means the role assignment is missing or has not propagated yet (Azure RBAC
can lag a minute or two).

## Troubleshooting

### `AuthorizationFailed` on the role assignment

Creating a role assignment requires **Owner** or **User Access Administrator** on
the subscription. A university/school account is often only *Contributor*, in which
case apply creates the vault and the identity correctly and fails only on the
binding. Someone with the right role can add it by hand:

```bash
az role assignment create \
  --assignee $(tofu output -raw vm_identity_principal_id) \
  --role "Key Vault Secrets Officer" \
  --scope $(az keyvault show --name <kv-name> --query id -o tsv)
```

Everything else in the stack works once that exists — re-run `tofu apply`
afterwards and it will show no changes.

### Key Vault name already taken

Names are globally unique *and* soft-deleted vaults keep their name reserved. This
config sets `soft_delete_retention_days = 7` (the Azure minimum) so a destroyed
vault frees its name in a week rather than the 90-day default. If you hit a
collision, either pick a new name or purge the old vault:

```bash
az keyvault purge --name <kv-name> --location westeurope
```

### Disk filling up

The OS disk stays at the image default of 30 GB. The local Docker registry
accumulates an image per CI build and is the main growth driver. To grow the disk,
add `disk_size_gb = 64` to the `os_disk` block and re-apply — this needs a VM
stop/deallocate but not a rebuild. Disks can never be shrunk.

## Notes

- Authentication is via Azure CLI (`az login`). No credentials are ever committed here.
- `terraform.tfvars`, `.terraform/`, and all `*.tfstate` files are git-ignored.
- State is local. There is no remote backend, so the state file lives only on the
  machine that ran `apply` — back it up, or whoever holds it owns the infrastructure.
