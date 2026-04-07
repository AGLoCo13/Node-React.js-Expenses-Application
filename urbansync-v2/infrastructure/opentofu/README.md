# OpenTofu — IaC for UrbanSync v2 Azure VM

This directory contains OpenTofu (open-source Terraform fork) configuration
for provisioning the target Azure VM.

## Planned Resources (Phase 6)
- `main.tf`         — Provider config (AzureRM)
- `vm.tf`           — Azure VM resource (size: Standard_B2s or equivalent)
- `network.tf`      — VNet, Subnet, NSG, Public IP
- `variables.tf`    — Input variables
- `outputs.tf`      — Output values (public IP, etc.)
- `terraform.tfvars`— Variable values (git-ignored)

## Usage
```bash
tofu init
tofu plan
tofu apply
```
