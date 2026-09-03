# gemini-latency-probe.ps1
# Measures raw Gemini API latency from THIS machine, bypassing Knative and the
# Node SDK entirely. Use it to tell "the model is slow" apart from "something in
# our pipeline is slow", and to compare models / thinking levels for the SLA chapter.
#
# The API key is read from the cluster Secret into a local variable and is never
# printed. Output per call: elapsed seconds, thinking tokens, output tokens.
#
# Examples (from the repo root or from Powershell Scripts\):
#   .\gemini-latency-probe.ps1
#   .\gemini-latency-probe.ps1 -Model gemini-3.6-flash -Thinking low -Runs 8 -SleepSeconds 3
#   .\gemini-latency-probe.ps1 -Thinking default        # omit thinkingConfig entirely
#
# PowerShell 5.1 compatible (no ??, no ternary).

param(
    [string]$Model        = 'gemini-3.5-flash-lite',
    [string]$Thinking     = 'minimal',     # minimal | low | medium | high | default (=omit)
    [int]   $Runs         = 6,
    [int]   $SleepSeconds = 5,
    [string]$Namespace    = 'urbansync'
)

$ErrorActionPreference = 'Stop'

# --- key from the cluster, never echoed ---------------------------------------
$b64 = kubectl get secret urbansync-secrets -n $Namespace -o jsonpath='{.data.gemini-api-key}'
if (-not $b64) { Write-Host "Could not read gemini-api-key from secret urbansync-secrets" -ForegroundColor Red; exit 1 }
$key = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
$headers = @{ 'x-goog-api-key' = $key; 'Content-Type' = 'application/json' }
$uri = "https://generativelanguage.googleapis.com/v1beta/models/$Model`:generateContent"

# --- request body ----------------------------------------------------------------
$genCfg = @{ responseMimeType = 'text/plain'; temperature = 0 }
if ($Thinking -and $Thinking -ne 'default') {
    $genCfg['thinkingConfig'] = @{ thinkingLevel = $Thinking }
}
$body = @{
    contents         = @(@{ parts = @(@{ text = 'Reply with the single word OK' }) })
    generationConfig = $genCfg
} | ConvertTo-Json -Depth 6 -Compress

Write-Host ("Model: {0}   thinking: {1}   runs: {2}   sleep: {3}s" -f $Model, $Thinking, $Runs, $SleepSeconds) -ForegroundColor Cyan
Write-Host ("{0,-4} {1,9} {2,9} {3,7}  {4}" -f 'run', 'seconds', 'thoughts', 'out', 'answer') -ForegroundColor DarkGray

$times = @()
for ($i = 1; $i -le $Runs; $i++) {
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r  = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -TimeoutSec 120
        $sw.Stop()
        $sec = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        $times += $sec
        $u = $r.usageMetadata
        $thoughts = 0; if ($u -and $u.PSObject.Properties['thoughtsTokenCount']) { $thoughts = $u.thoughtsTokenCount }
        $out = 0;      if ($u -and $u.PSObject.Properties['candidatesTokenCount']) { $out = $u.candidatesTokenCount }
        $answer = ''
        try { $answer = $r.candidates[0].content.parts[0].text.Trim() } catch { $answer = '(no text)' }
        $color = 'Green'; if ($sec -gt 5) { $color = 'Yellow' }; if ($sec -gt 12) { $color = 'Red' }
        Write-Host ("{0,-4} {1,9:N2} {2,9} {3,7}  {4}" -f $i, $sec, $thoughts, $out, $answer) -ForegroundColor $color
    } catch {
        $msg = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
        if ($msg.Length -gt 160) { $msg = $msg.Substring(0, 160) }
        Write-Host ("{0,-4} FAILED  {1}" -f $i, $msg) -ForegroundColor Red
    }
    if ($i -lt $Runs) { Start-Sleep -Seconds $SleepSeconds }
}

if ($times.Count -gt 0) {
    $sorted = $times | Sort-Object
    $p50 = $sorted[[math]::Floor(($sorted.Count - 1) * 0.5)]
    $max = $sorted[-1]
    Write-Host ("`nmin {0:N2}s   p50 {1:N2}s   max {2:N2}s   ({3}/{4} ok)" -f $sorted[0], $p50, $max, $times.Count, $Runs) -ForegroundColor Cyan
}

Remove-Variable key, headers, b64 -ErrorAction SilentlyContinue
