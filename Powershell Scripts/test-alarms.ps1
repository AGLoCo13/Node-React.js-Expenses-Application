# test-alarms.ps1
# Demonstrates the Alarm Ingestion pipeline (A6) and the notifications API (B5).
#
# What it proves, end to end:
#   1. an alarm published on building-alarms becomes a Notification for the
#      building administrator                                    -> +1 unread
#   2. the SAME message published again is deduplicated by the
#      unique (user, dedupeKey) index                            -> +0 unread
#   3. a second, different alarm still gets through              -> +1 unread
#   4. a malformed message is dead-lettered, not retried forever -> building-alarms.dlq depth +1
#   5. PATCH /api/notifications/:id/read lowers the unread count -> the bell works
#
# Messages are published through the RabbitMQ management API, which is exactly
# what "replay the same message from the RabbitMQ UI" means in the roadmap.
#
# Prerequisites (two terminals):
#   .\portforward.ps1                                            # app on http://localhost
#   kubectl port-forward -n urbansync svc/rabbitmq 15672:15672    # management API
#
# Usage:
#   .\test-alarms.ps1 -Email admin@example.com
#   .\test-alarms.ps1 -Email admin@example.com -RabbitUser user -BaseUrl http://localhost
#
# PowerShell 5.1 compatible, ASCII only.

param(
    [Parameter(Mandatory = $true)] [string]$Email,
    [string]$BaseUrl    = 'http://localhost',
    [string]$RabbitApi  = 'http://localhost:15672',
    [string]$RabbitUser = 'user',
    [string]$Queue      = 'building-alarms',
    [string]$Dlq        = 'building-alarms.dlq',
    [int]   $WaitMs     = 2500
)

$ErrorActionPreference = 'Stop'

function Invoke-Api {
    param([string]$Method, [string]$Url, [hashtable]$Headers, $Body, [string]$ContentType)
    try {
        $p = @{ Method = $Method; Uri = $Url; Headers = $Headers; UseBasicParsing = $true; TimeoutSec = 60 }
        if ($null -ne $Body) { $p['Body'] = $Body }
        if ($ContentType)    { $p['ContentType'] = $ContentType }
        $r = Invoke-WebRequest @p
        $b = $null; try { $b = $r.Content | ConvertFrom-Json } catch { $b = $r.Content }
        return @{ Status = [int]$r.StatusCode; Body = $b }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $sr = New-Object IO.StreamReader($resp.GetResponseStream()); $txt = $sr.ReadToEnd(); $sr.Close()
        $b = $null; try { $b = $txt | ConvertFrom-Json } catch { $b = $txt }
        return @{ Status = [int]$resp.StatusCode; Body = $b }
    }
}

function Read-Secret {
    param([string]$Prompt)
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    return $plain
}

function Publish-Alarm {
    # Publishes one message to the default exchange with routing key = queue name.
    param([string]$PayloadJson, [string]$RoutingKey)
    $body = @{
        properties       = @{ delivery_mode = 2 }
        routing_key      = $RoutingKey
        payload          = $PayloadJson
        payload_encoding = 'string'
    } | ConvertTo-Json -Depth 5 -Compress
    $r = Invoke-Api POST "$RabbitApi/api/exchanges/%2F/amq.default/publish" $rabbitHeaders $body 'application/json'
    if ($r.Status -ne 200) { throw "publish failed: HTTP $($r.Status)" }
    if (-not $r.Body.routed) { Write-Host "  warning: broker reports the message was NOT routed (is $RoutingKey declared?)" -ForegroundColor Yellow }
}

function Get-QueueDepth {
    param([string]$Name)
    $r = Invoke-Api GET "$RabbitApi/api/queues/%2F/$Name" $rabbitHeaders $null $null
    if ($r.Status -ne 200) { return -1 }
    return [int]$r.Body.messages
}

function Get-Unread {
    param([string]$Token)
    $r = Invoke-Api GET "$BaseUrl/api/notifications?unread=true" @{ Authorization = $Token } $null $null
    if ($r.Status -ne 200) { throw "GET /api/notifications -> HTTP $($r.Status)" }
    return $r.Body
}

function Show {
    param([string]$Label, [int]$Actual, [int]$Expected)
    $ok = ($Actual -eq $Expected)
    $color = 'Green'; if (-not $ok) { $color = 'Red' }
    $mark = 'PASS'; if (-not $ok) { $mark = 'FAIL' }
    Write-Host ("  {0,-46} {1}  (got {2}, expected {3})" -f $Label, $mark, $Actual, $Expected) -ForegroundColor $color
}

# --- credentials ------------------------------------------------------------------------
$appPass    = Read-Secret "Password for $Email"
$rabbitPass = Read-Secret "RabbitMQ password for user '$RabbitUser'"
$pair       = [Text.Encoding]::ASCII.GetBytes("${RabbitUser}:${rabbitPass}")
$rabbitHeaders = @{ Authorization = 'Basic ' + [Convert]::ToBase64String($pair) }

# --- login ------------------------------------------------------------------------------
$login = Invoke-Api POST "$BaseUrl/api/login" @{} (@{ email = $Email; password = $appPass } | ConvertTo-Json -Compress) 'application/json'
if ($login.Status -ne 200) { throw "login failed: HTTP $($login.Status)" }
$token = $login.Body.token
Write-Host "logged in as $Email" -ForegroundColor Cyan

$before    = Get-Unread $token
$dlqBefore = Get-QueueDepth $Dlq
Write-Host ("unread before: {0}   {1} depth before: {2}" -f $before.unreadCount, $Dlq, $dlqBefore) -ForegroundColor Cyan
Write-Host ''

# A stable alarm id makes the dedupe key deterministic, exactly like a real
# ThingsBoard "Alarm Created" event replayed from the UI.
$alarmId = [guid]::NewGuid().ToString()
$hot = @{
    alarmId    = $alarmId
    type       = 'High Temperature'
    status     = 'ACTIVE'
    severity   = 'CRITICAL'
    deviceName = 'Ap2 Thermostat'
    value      = 29.4
    startTs    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress

$fuel = @{
    alarmId    = [guid]::NewGuid().ToString()
    type       = 'Low Fuel'
    status     = 'ACTIVE'
    severity   = 'CRITICAL'
    deviceName = 'Building A Fuel Tank'
    value      = 15
    startTs    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress

Write-Host '1. publish High Temperature (Ap2)'                  -ForegroundColor White
Publish-Alarm $hot $Queue
Start-Sleep -Milliseconds $WaitMs
$after1 = Get-Unread $token
Show 'new notification created' ($after1.unreadCount - $before.unreadCount) 1

Write-Host '2. publish the SAME message again (replay)'          -ForegroundColor White
Publish-Alarm $hot $Queue
Start-Sleep -Milliseconds $WaitMs
$after2 = Get-Unread $token
Show 'deduplicated, no second notification' ($after2.unreadCount - $after1.unreadCount) 0

Write-Host '3. publish Low Fuel (building-wide)'                 -ForegroundColor White
Publish-Alarm $fuel $Queue
Start-Sleep -Milliseconds $WaitMs
$after3 = Get-Unread $token
Show 'second, different alarm gets through' ($after3.unreadCount - $after2.unreadCount) 1

Write-Host '4. publish a malformed message'                      -ForegroundColor White
Publish-Alarm '{"nonsense":true}' $Queue
Start-Sleep -Milliseconds $WaitMs
$after4 = Get-Unread $token
Show 'no notification from garbage' ($after4.unreadCount - $after3.unreadCount) 0
$dlqAfter = Get-QueueDepth $Dlq
if ($dlqAfter -lt 0) {
    Write-Host '  note: could not read the DLQ depth (management API reachable?)' -ForegroundColor Yellow
} else {
    Show 'parked on building-alarms.dlq' ($dlqAfter - [Math]::Max($dlqBefore,0)) 1
}

Write-Host '5. mark the newest notification as read'             -ForegroundColor White
$newest = $after4.notifications[0]
$read = Invoke-Api PATCH "$BaseUrl/api/notifications/$($newest._id)/read" @{ Authorization = $token } $null $null
if ($read.Status -ne 200) { throw "PATCH read -> HTTP $($read.Status)" }
Show 'unread count drops by one' ($after4.unreadCount - $read.Body.unreadCount) 1

Write-Host ''
Write-Host 'messages seen by the ingestion service:' -ForegroundColor Cyan
foreach ($n in $after4.notifications | Select-Object -First 4) {
    $flat = ('{0,-18} {1,-9} {2}' -f $n.type, $n.severity, $n.message)
    Write-Host "  $flat"
}
Write-Host ''
Write-Host 'metrics (alarms_processed_total):' -ForegroundColor Cyan
$m = Invoke-Api GET "$BaseUrl/metrics" @{} $null $null
if ($m.Status -eq 200) {
    ($m.Body -split "`n") | Where-Object { $_ -like 'alarms_processed_total*' } | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host '  /metrics not reachable through the ingress' -ForegroundColor Yellow
}
