# test-idempotency.ps1
# Demonstrates the Idempotency pattern on POST /api/expenses.
#
#   1. logs in (password asked interactively, never echoed) and resolves the admin profile
#   2. sends the SAME expense twice with the SAME Idempotency-Key
#        -> 1st: 201 created, header Idempotency-Key echoed
#        -> 2nd: 201 with the SAME _id and header Idempotency-Replayed: true  (no duplicate!)
#   3. sends the same key with a DIFFERENT amount   -> 422 (key reused for another payload)
#   4. sends a NEW key                              -> 201 with a new _id
#   5. counts expenses before/after: exactly +2 rows, not +4
#
# Usage:
#   .\test-idempotency.ps1 -Email admin@example.com
#   .\test-idempotency.ps1 -Email admin@example.com -BaseUrl http://localhost
#
# PowerShell 5.1 compatible, ASCII only.

param(
    [Parameter(Mandatory = $true)] [string]$Email,
    [string]$BaseUrl = 'http://localhost',
    [int]   $Amount  = 42
)

$ErrorActionPreference = 'Stop'

function Invoke-Api {
    # Returns @{ Status=<int>; Headers=<hashtable>; Body=<object> } and never throws on 4xx/5xx
    param([string]$Method, [string]$Url, [hashtable]$Headers, $Body, [string]$ContentType)
    try {
        $p = @{ Method = $Method; Uri = $Url; Headers = $Headers; UseBasicParsing = $true; TimeoutSec = 60 }
        if ($null -ne $Body)        { $p['Body'] = $Body }
        if ($ContentType)           { $p['ContentType'] = $ContentType }
        $r = Invoke-WebRequest @p
        $b = $null; try { $b = $r.Content | ConvertFrom-Json } catch { $b = $r.Content }
        return @{ Status = [int]$r.StatusCode; Headers = $r.Headers; Body = $b }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $sr = New-Object IO.StreamReader($resp.GetResponseStream()); $txt = $sr.ReadToEnd(); $sr.Close()
        $b = $null; try { $b = $txt | ConvertFrom-Json } catch { $b = $txt }
        $h = @{}; foreach ($k in $resp.Headers.AllKeys) { $h[$k] = $resp.Headers[$k] }
        return @{ Status = [int]$resp.StatusCode; Headers = $h; Body = $b }
    }
}

function Show {
    param([string]$Label, $R, [int]$Expect)
    $color = 'Green'; if ($R.Status -ne $Expect) { $color = 'Red' }
    $replayed = ''; if ($R.Headers['Idempotency-Replayed']) { $replayed = '  Idempotency-Replayed: ' + $R.Headers['Idempotency-Replayed'] }
    $id = ''; if ($R.Body -and $R.Body.PSObject.Properties['_id']) { $id = '  _id=' + $R.Body._id }
    $err = ''; if ($R.Body -and $R.Body.PSObject.Properties['error']) { $err = '  error=' + $R.Body.error }
    Write-Host ("{0,-44} HTTP {1} (expected {2}){3}{4}{5}" -f $Label, $R.Status, $Expect, $id, $replayed, $err) -ForegroundColor $color
}

# --- 1. login ---------------------------------------------------------------------------
$secure = Read-Host -Prompt "Password for $Email" -AsSecureString
$bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$login  = Invoke-Api POST "$BaseUrl/api/login" @{} (@{ email = $Email; password = $plain } | ConvertTo-Json -Compress) 'application/json'
Remove-Variable plain, secure -ErrorAction SilentlyContinue
if ($login.Status -ne 200) { Write-Host "Login failed: HTTP $($login.Status)" -ForegroundColor Red; exit 1 }
$auth = @{ Authorization = $login.Body.token }
Write-Host "Logged in as $Email" -ForegroundColor Cyan

$prof = Invoke-Api GET "$BaseUrl/api/profile" $auth
$bld  = Invoke-Api GET "$BaseUrl/api/buildings/$($prof.Body.profileId)" $auth
$profileId = $bld.Body.profile.user._id
if (-not $profileId) { $profileId = $prof.Body.profileId }
Write-Host "Profile used for expenses: $profileId" -ForegroundColor Cyan

# --- 2..4 the actual test -----------------------------------------------------------------
$before = (Invoke-Api GET "$BaseUrl/api/expenses/$profileId" $auth).Body.Count
$key1 = [guid]::NewGuid().ToString()
$key2 = [guid]::NewGuid().ToString()
$now  = (Get-Date).ToString('o')
$month = (Get-Date).Month; $year = (Get-Date).Year

# The UI sends multipart/form-data (the receipt file goes along), so we do the same via curl.exe
# (built into Windows 10+). express.json() would not parse a form POST.
$tmpBody = [IO.Path]::GetTempFileName(); $tmpHdr = [IO.Path]::GetTempFileName()
function Post-Expense {
    param([string]$Key, [int]$Total, [switch]$NoAuth)
    $curlArgs = @('-s', '-o', $tmpBody, '-D', $tmpHdr, '-w', '%{http_code}', '-X', 'POST', "$BaseUrl/api/expenses",
              '-H', "Idempotency-Key: $Key",
              '-F', "profile=$profileId", '-F', "total=$Total", '-F', "date_created=$now",
              '-F', "month=$month", '-F', "year=$year", '-F', 'type_expenses=General')
    if (-not $NoAuth) { $curlArgs += @('-H', "Authorization: $($auth.Authorization)") }
    $code = & curl.exe @curlArgs
    $body = $null; try { $body = Get-Content $tmpBody -Raw | ConvertFrom-Json } catch { $body = Get-Content $tmpBody -Raw }
    $h = @{}
    foreach ($line in (Get-Content $tmpHdr)) { if ($line -match '^([^:]+):\s*(.*)$') { $h[$matches[1]] = $matches[2].Trim() } }
    return @{ Status = [int]$code; Headers = $h; Body = $body }
}

Write-Host "`nSame payload, same key, sent twice:" -ForegroundColor Yellow
$r1 = Post-Expense -Key $key1 -Total $Amount
Show '  #1 first submission'           $r1 201
$r2 = Post-Expense -Key $key1 -Total $Amount
Show '  #2 retry (same key)'           $r2 201
if ($r1.Body._id -and $r1.Body._id -eq $r2.Body._id) { Write-Host "  -> same _id returned: no duplicate expense created" -ForegroundColor Green }
else { Write-Host "  -> DIFFERENT _id: idempotency NOT working" -ForegroundColor Red }

Write-Host "`nSame key, different payload:" -ForegroundColor Yellow
$r3 = Post-Expense -Key $key1 -Total ($Amount + 1)
Show '  #3 key reused with other amount' $r3 422

Write-Host "`nNew key:" -ForegroundColor Yellow
$r4 = Post-Expense -Key $key2 -Total $Amount
Show '  #4 new key, new expense'       $r4 201

Write-Host "`nWithout token (auth is now enforced on POST /api/expenses):" -ForegroundColor Yellow
$r5 = Post-Expense -Key ([guid]::NewGuid().ToString()) -Total $Amount -NoAuth
Show '  #5 anonymous request'          $r5 401
Remove-Item $tmpBody, $tmpHdr -ErrorAction SilentlyContinue

# --- 5. count -------------------------------------------------------------------------------
$after = (Invoke-Api GET "$BaseUrl/api/expenses/$profileId" $auth).Body.Count
$delta = $after - $before
$color = 'Green'; if ($delta -ne 2) { $color = 'Red' }
Write-Host ("`nExpenses for this profile: {0} -> {1}  (+{2}, expected +2 out of 5 POSTs)" -f $before, $after, $delta) -ForegroundColor $color
Write-Host "Backend log lines to look for:  [idempotency] stored / replay / release" -ForegroundColor DarkGray
Write-Host "Clean up the two test expenses from 'View Expenses' in the UI if you want." -ForegroundColor DarkGray

Remove-Variable auth, login -ErrorAction SilentlyContinue
