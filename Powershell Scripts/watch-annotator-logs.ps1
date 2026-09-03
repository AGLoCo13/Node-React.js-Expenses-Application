# watch-annotator-logs.ps1
# Follows the logs of the Knative receipt-annotator function even though it scales
# to zero: waits for a pod to appear, streams its logs, and when the pod goes away
# waits for the next one. Leave it running in a second terminal while you upload
# receipts in the UI. Ctrl+C to stop.
#
#   .\watch-annotator-logs.ps1                 # only the Gemini / hedge lines
#   .\watch-annotator-logs.ps1 -All            # every log line
#
# PowerShell 5.1 compatible. No secrets are read or printed.

param(
    [string]$Namespace = 'urbansync',
    [string]$Service   = 'receipt-annotator',
    [switch]$All
)

$selector = "serving.knative.dev/service=$Service"
$pattern  = 'hedge|attempt|answered|GEMINI|error|Error|cold|listening'

Write-Host ("Waiting for pods of {0} in {1} ... (upload a receipt now; Ctrl+C to stop)" -f $Service, $Namespace) -ForegroundColor Cyan

while ($true) {
    $pods = kubectl get pods -n $Namespace -l $selector -o json 2>$null | ConvertFrom-Json
    $pod  = $null
    if ($pods -and $pods.items) {
        $pod = $pods.items | Where-Object { -not $_.metadata.deletionTimestamp } |
               Sort-Object { $_.metadata.creationTimestamp } -Descending | Select-Object -First 1
    }
    if (-not $pod) { Start-Sleep -Milliseconds 700; continue }

    $name = $pod.metadata.name
    Write-Host ("`n[{0}] pod {1} is up - following logs" -f (Get-Date -Format 'HH:mm:ss'), $name) -ForegroundColor Green

    # kubectl logs -f blocks until the container exits (scale-to-zero) or the pod is deleted
    if ($All) {
        kubectl logs -n $Namespace $name -c user-container -f 2>$null
    } else {
        kubectl logs -n $Namespace $name -c user-container -f 2>$null | ForEach-Object {
            if ($_ -match $pattern) {
                $color = 'Gray'
                if ($_ -match 'hedge #')   { $color = 'Yellow' }
                if ($_ -match 'won in')    { $color = 'Green' }
                if ($_ -match 'error|Error') { $color = 'Red' }
                Write-Host $_ -ForegroundColor $color
            }
        }
    }
    Write-Host ("[{0}] pod {1} went away (scale-to-zero) - waiting for the next one" -f (Get-Date -Format 'HH:mm:ss'), $name) -ForegroundColor DarkGray
    Start-Sleep -Seconds 1
}
