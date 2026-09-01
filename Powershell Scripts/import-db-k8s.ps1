# Seed the MongoDB pod running in Kubernetes with the JSON DB Collections.
# Requires: MongoDB Database Tools (mongoimport) installed on the host.
# Download: https://www.mongodb.com/try/download/database-tools

$collections = @("users","profiles","buildings","apartments","expenses","consumptions","payments")
$dbName      = "commons-db"
$user        = "admin"
$pass        = "admin123"
$jsonDir     = Join-Path (Split-Path $PSScriptRoot -Parent) "JSON DB Collections"

Write-Host "Starting port-forward to MongoDB pod..."
$pf = Start-Job { kubectl port-forward svc/mongodb 27017:27017 -n urbansync }
Start-Sleep -Seconds 3

try {
    foreach ($col in $collections) {
        $file = Join-Path $jsonDir "$col.json"
        Write-Host "Importing $col..."
        mongoimport `
            --host localhost:27017 `
            --db $dbName `
            --authenticationDatabase admin `
            -u $user -p $pass `
            --collection $col `
            --file $file `
            --drop
    }
    Write-Host ""
    Write-Host "Database import completed."
} finally {
    Stop-Job $pf
    Remove-Job $pf
    Write-Host "Port-forward closed."
}
