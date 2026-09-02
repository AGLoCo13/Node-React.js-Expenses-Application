# =============================================================================
# main.tf — OpenTofu Infrastructure for UrbanSync v2
# =============================================================================
# Αρχείο: main.tf
# Σκοπός: Ορισμός του Azure provider (AzureRM) και όλων των πόρων:
#         δίκτυο, Virtual Machine, Managed Identity και Key Vault.
# =============================================================================

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Ελάχιστη έκδοση OpenTofu που απαιτείται
  required_version = ">= 1.6.0"
}

# -----------------------------------------------------------------------------
# Azure Provider Configuration
# Το authentication γίνεται μέσω Azure CLI (az login) ή Service Principal.
# Τα credentials ΔΕΝ μπαίνουν ποτέ hardcoded εδώ.
# -----------------------------------------------------------------------------
provider "azurerm" {
  features {}
}

# -----------------------------------------------------------------------------
# Το tenant των credentials που τρέχουν το tofu.
# Χρησιμοποιείται από το Key Vault και εμφανίζεται ως output — η ίδια τιμή
# πρέπει να μπει στο k8s/overlays/prod/secret-provider-class.yaml (tenantId).
# -----------------------------------------------------------------------------
data "azurerm_client_config" "current" {}

# -----------------------------------------------------------------------------
# Κοινά tags για όλους τους πόρους
# -----------------------------------------------------------------------------
locals {
  tags = {
    project     = "urbansync"
    environment = "dev"
    managed_by  = "opentofu"
  }
}

# =============================================================================
# RESOURCE GROUP
# =============================================================================
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = local.tags
}

# =============================================================================
# ΥΠΟΔΟΜΗ ΔΙΚΤΥΟΥ
# =============================================================================

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${var.resource_group_name}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.0.0.0/16"]

  tags = local.tags
}

# Subnet
resource "azurerm_subnet" "main" {
  name                 = "${var.resource_group_name}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}

# =============================================================================
# ΠΡΟΣΒΑΣΗ — PUBLIC IP
# =============================================================================
resource "azurerm_public_ip" "main" {
  name                = "${var.resource_group_name}-public-ip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = local.tags
}

# =============================================================================
# ΑΣΦΑΛΕΙΑ — NETWORK SECURITY GROUP (NSG)
# =============================================================================
resource "azurerm_network_security_group" "main" {
  name                = "${var.resource_group_name}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # Κανόνας 1: Επιτρέπει εισερχόμενη κίνηση SSH (port 22)
  security_rule {
    name                       = "Allow-SSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Κανόνας 2: Επιτρέπει HTTP (80) για το UrbanSync και 8080 για τον Jenkins
  security_rule {
    name                       = "Allow-HTTP-Jenkins"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "8080"] # Προσοχή: Εδώ είναι ranges στον πληθυντικό
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.tags
}

# =============================================================================
# NETWORK INTERFACE
# =============================================================================
resource "azurerm_network_interface" "main" {
  name                = "${var.resource_group_name}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.main.id
  }

  tags = local.tags
}

# Σύνδεση NSG με το Network Interface
resource "azurerm_network_interface_security_group_association" "main" {
  network_interface_id      = azurerm_network_interface.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

# =============================================================================
# LINUX VIRTUAL MACHINE
# =============================================================================
resource "azurerm_linux_virtual_machine" "main" {
  name                = "${var.resource_group_name}-vm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  size                = "Standard_B2ms"
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  # System-assigned Managed Identity.
  # Το Ansible (deploy.yml task 4d.5c) κάνει `az login --identity` με αυτήν,
  # και ο Key Vault CSI driver τη χρησιμοποιεί για να διαβάσει τα secrets
  # (useVMManagedIdentity: "true" στο secret-provider-class.yaml).
  identity {
    type = "SystemAssigned"
  }

  # Αυθεντικοποίηση μέσω SSH key (όχι κωδικός)
  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    # Χωρίς disk_size_gb — κρατάμε το default του image (30 GB).
    # Ο δίσκος μπορεί να μεγαλώσει αργότερα (disk_size_gb = 64 + tofu apply,
    # απαιτεί stop/deallocate αλλά όχι rebuild). Δεν μπορεί να μικρύνει.
  }

  # Ubuntu 22.04 LTS
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  tags = local.tags
}

# =============================================================================
# AZURE KEY VAULT
# =============================================================================
# Το prod overlay διαβάζει τα secrets από εδώ μέσω του Secrets Store CSI Driver.
# Το Ansible (deploy.yml task 4d.6) τα γράφει με `az keyvault secret set`.
# =============================================================================
resource "azurerm_key_vault" "main" {
  name                = var.keyvault_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  # RBAC αντί για access policies — η πρόσβαση δίνεται από το role assignment
  # παρακάτω. Χωρίς αυτό, το role assignment αγνοείται εντελώς.
  rbac_authorization_enabled = true

  # 7 είναι το ελάχιστο που δέχεται το Azure. Το default (90) κρατάει το όνομα
  # δεσμευμένο παγκοσμίως για 90 μέρες μετά από κάθε destroy, μπλοκάροντας
  # οποιοδήποτε rebuild με το ίδιο όνομα.
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  tags = local.tags
}

# -----------------------------------------------------------------------------
# Role Assignment — VM Managed Identity → Key Vault
# "Key Vault Secrets Officer" καλύπτει και το write (Ansible) και το read (CSI),
# οπότε ένα role assignment αρκεί.
#
# ΠΡΟΣΟΧΗ: Η δημιουργία role assignment απαιτεί "Owner" ή
# "User Access Administrator" στο subscription. Με μόνο "Contributor" αυτό
# αποτυγχάνει — δες το README για το χειροκίνητο workaround.
# -----------------------------------------------------------------------------
resource "azurerm_role_assignment" "vm_keyvault_secrets" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = azurerm_linux_virtual_machine.main.identity[0].principal_id
}
