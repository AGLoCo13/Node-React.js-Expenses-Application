# =============================================================================
# variables.tf — Input Variables for UrbanSync v2
# =============================================================================
# Αρχείο: variables.tf
# Σκοπός: Ορισμός όλων των μεταβλητών εισόδου του project.
#         Οι τιμές δίνονται μέσω terraform.tfvars (git-ignored).
# =============================================================================

# -----------------------------------------------------------------------------
# Azure Region
# Η γεωγραφική περιοχή όπου θα δημιουργηθούν οι πόροι.
# -----------------------------------------------------------------------------
# ΠΡΟΣΟΧΗ — Region restriction:
# Τα student/free subscriptions έχουν policy "Allowed resource deployment regions"
# (sys.regionrestriction) που επιτρέπει μόνο συγκεκριμένες περιοχές. Δες τη λίστα με:
#   az policy assignment list --query "[?name=='sys.regionrestriction'].parameters"
# Επιπλέον, το Standard_B2ms είναι "NotAvailableForSubscription" στις περισσότερες
# από αυτές. Έλεγξε τι είναι πραγματικά διαθέσιμο πριν αλλάξεις region:
#   az vm list-skus --location <region> --size Standard_B2ms --all
variable "location" {
  description = "Η Azure region όπου θα αναπτυχθεί η υποδομή. Πρέπει να επιτρέπεται από το region-restriction policy ΚΑΙ να προσφέρει το Standard_B2ms."
  type        = string
  default     = "denmarkeast"
}

# -----------------------------------------------------------------------------
# Resource Group Name
# Το όνομα του Resource Group που θα περιέχει όλους τους Azure πόρους.
# -----------------------------------------------------------------------------
variable "resource_group_name" {
  description = "Το όνομα του Azure Resource Group για το UrbanSync project. Όλοι οι υπόλοιποι πόροι παίρνουν το όνομά τους από αυτό (π.χ. '<name>-vnet', '<name>-vm')."
  type        = string
  default     = "urbansync-rg"
}

# -----------------------------------------------------------------------------
# Admin Username
# Το όνομα χρήστη του διαχειριστή για το Linux VM.
# -----------------------------------------------------------------------------
variable "admin_username" {
  description = "Το username του admin χρήστη για το Linux Virtual Machine."
  type        = string
  default     = "azureuser"
}

# -----------------------------------------------------------------------------
# SSH Public Key
# Το δημόσιο κλειδί SSH για αυθεντικοποίηση στο VM (χωρίς κωδικό).
# Παράδειγμα: file("~/.ssh/id_rsa.pub") ή το περιεχόμενο του αρχείου .pub
# -----------------------------------------------------------------------------
variable "ssh_public_key" {
  description = "Το δημόσιο κλειδί SSH (public key) για σύνδεση στο VM. Δεν έχει default — πρέπει να οριστεί στο terraform.tfvars."
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Key Vault Name
# ΔΕΝ έχει default επίτηδες: τα ονόματα Key Vault είναι μοναδικά παγκοσμίως και
# ένα διαγραμμένο vault κρατάει το όνομά του δεσμευμένο (soft delete). Ένα
# default θα οδηγούσε σε σύγκρουση με παλιά vaults — διάλεξε φρέσκο όνομα.
#
# Η ίδια τιμή πρέπει να μπει και σε:
#   - k8s/overlays/prod/secret-provider-class.yaml  (keyvaultName)
#   - infrastructure/ansible/vars/secrets.enc.yml   (azure_keyvault_name)
# -----------------------------------------------------------------------------
variable "keyvault_name" {
  description = "Το όνομα του Azure Key Vault (μοναδικό παγκοσμίως, 3-24 χαρακτήρες)."
  type        = string

  # Το validation τρέχει στο plan — δηλαδή ΠΡΙΝ δημιουργηθεί οτιδήποτε στο Azure.
  # Χωρίς αυτό, ένα άκυρο όνομα σκάει στη μέση του apply, αφού έχουν ήδη
  # δημιουργηθεί το resource group και το VM.
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.keyvault_name))
    error_message = "Το όνομα του Key Vault πρέπει να είναι 3-24 χαρακτήρες, μόνο γράμματα/αριθμοί/παύλες, να ξεκινά με γράμμα και να τελειώνει σε γράμμα ή αριθμό."
  }
}
