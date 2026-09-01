# cleanup-dead-files.ps1
# NOTHING in here runs automatically. Every action line is commented out on
# purpose — read the reasoning, uncomment only what you agree with, then run
# it locally so any deletion lands in a normal, reviewable commit.
#
# Status as of the last audit: the first round of dead files (root
# package.json/package-lock.json, root docker-compose.yml, terraform.tfstate,
# git-cleanup.bat, ansible-test/, k8s/backend+frontend/deployment.yaml,
# k8s/README.md) is already gone — you deleted those yourself. What's left:

Set-Location (Split-Path $PSScriptRoot -Parent)   # repo root, regardless of where this is run from

# --- LIKELY DEAD but confirm with your teammate first ---
# git rm urbansync-v2/k8s/knative/minio-webhook.sh
#   Not called by bootstrap-local.ps1 (which configures the MinIO webhook
#   inline via `mc` commands instead). Only mentioned in README.md prose.
#   If nobody runs it by hand, it's safe to remove.

# --- SUPERSEDED DOC, kept for now with a deprecation banner instead of deleted ---
# urbansync-v2/SETUP.md is superseded by urbansync-v2/SETUP-LOCAL-K8S.md but
# is still linked from README.md and PERFECT-10-ROADMAP.md. A "superseded"
# banner was added to the top of the file rather than deleting it outright —
# delete it once you've confirmed nothing external still links to it:
# git rm urbansync-v2/SETUP.md
# (then remove the two links to it in README.md and PERFECT-10-ROADMAP.md)

# --- DO NOT DELETE (confirmed still actively used) ---
# Powershell Scripts/import-db-k8s.ps1   -> used by bootstrap-local.ps1 and SETUP-LOCAL-K8S.md
# Powershell Scripts/import-db.bat       -> used by SETUP-LOCAL-K8S.md
# Powershell Scripts/portforward.ps1     -> the unified port-forward manager, used interactively
# Powershell Scripts/seed-db-in-pod.ps1  -> mongoimport-not-installed fallback path
# Powershell Scripts/set-gemini-key.ps1  -> sets the Gemini key safely
# Powershell Scripts/bootstrap-local.ps1 -> full unattended bring-up, entry point
# urbansync-v2/k8s/start-portforward.ps1 -> called internally by bootstrap-local.ps1 (different from the root one above)
# urbansync-v2/seed-db.bat               -> docker-compose path, distinct purpose from import-db.bat (K8s path)
# docs/legacy/*.md                       -> archived v1 docs, kept for project history / grader visibility, not linked from anywhere active
