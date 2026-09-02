# =============================================================================
# outputs.tf — Output Values for UrbanSync v2
# =============================================================================
# Αρχείο: outputs.tf
# Σκοπός: Εκτύπωση χρήσιμων πληροφοριών μετά το tofu apply,
#         όπως η Public IP του VM για σύνδεση μέσω SSH.
# =============================================================================

# -----------------------------------------------------------------------------
# Public IP Address του VM
# Εμφανίζεται μετά το apply — χρησιμοποιείται για SSH σύνδεση.
# -----------------------------------------------------------------------------
output "vm_public_ip" {
  description = "Η δημόσια IP διεύθυνση του Linux VM. Χρησιμοποίησέ την για SSH: ssh <admin_username>@<ip>"
  value       = azurerm_public_ip.main.ip_address
}

# -----------------------------------------------------------------------------
# Έτοιμη εντολή SSH για γρήγορη σύνδεση
# -----------------------------------------------------------------------------
output "ssh_connection_command" {
  description = "Έτοιμη εντολή για σύνδεση στο VM μέσω SSH."
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.ip_address}"
}

# -----------------------------------------------------------------------------
# Key Vault name
# Αντέγραψέ το στο k8s/overlays/prod/secret-provider-class.yaml (keyvaultName)
# και στο infrastructure/ansible/vars/secrets.enc.yml (azure_keyvault_name).
# -----------------------------------------------------------------------------
output "keyvault_name" {
  description = "Το όνομα του Key Vault που δημιουργήθηκε."
  value       = azurerm_key_vault.main.name
}

# -----------------------------------------------------------------------------
# Azure Tenant ID
# Αντέγραψέ το στο k8s/overlays/prod/secret-provider-class.yaml (tenantId).
# -----------------------------------------------------------------------------
output "tenant_id" {
  description = "Το Azure Tenant ID του subscription."
  value       = data.azurerm_client_config.current.tenant_id
}

# -----------------------------------------------------------------------------
# Managed Identity του VM
# Χρήσιμο για debugging του Key Vault access:
#   az role assignment list --assignee <αυτή η τιμή> -o table
# -----------------------------------------------------------------------------
output "vm_identity_principal_id" {
  description = "Το principal ID του system-assigned Managed Identity του VM."
  value       = azurerm_linux_virtual_machine.main.identity[0].principal_id
}
