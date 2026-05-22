# =============================================================================
# main.tf — OpenTofu Infrastructure for Gas Receipts OCR System
# =============================================================================
# Αρχείο: main.tf
# Σκοπός: Ορισμός του Azure provider (AzureRM) και όλων των πόρων
#         για το Βήμα 2: Δίκτυο και Virtual Machine.
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

# =============================================================================
# RESOURCE GROUP
# =============================================================================
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project     = "gas-receipts-ocr"
    environment = "dev"
    managed_by  = "opentofu"
  }
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

  tags = {
    project    = "gas-receipts-ocr"
    managed_by = "opentofu"
  }
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

  tags = {
    project    = "gas-receipts-ocr"
    managed_by = "opentofu"
  }
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
    destination_port_ranges    = ["80", "8080"]  # Προσοχή: Εδώ είναι ranges στον πληθυντικό
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    project    = "gas-receipts-ocr"
    managed_by = "opentofu"
  }
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

  tags = {
    project    = "gas-receipts-ocr"
    managed_by = "opentofu"
  }
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
  size                = "Standard_B2s"
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  # Αυθεντικοποίηση μέσω SSH key (όχι κωδικός)
  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  # Ubuntu 22.04 LTS
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  tags = {
    project    = "gas-receipts-ocr"
    managed_by = "opentofu"
  }
}
