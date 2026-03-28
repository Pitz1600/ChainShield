param(
  [string]$OutTextPath = "scenario_summary.txt"
)

$ErrorActionPreference = "Stop"

function Line($s = "") { $script:lines.Add([string]$s) | Out-Null }
function KV([string]$k, [string]$v) {
  $keyWidth = 26
  Line ("{0,-$keyWidth} : {1}" -f $k, $v)
}

$generatedLocal = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$rule = "-" * 86

$script:lines = New-Object System.Collections.Generic.List[string]

Line $rule
Line ("{0,56}" -f "ChainShield Performance Report")
Line $rule
Line

KV "Scenario" "B"
KV "Generated (local)" $generatedLocal
Line

Line ("AI Integrity Analysis")
KV "Execution Time" ("{0:N4} seconds" -f 8.4723)
KV "Test Case" "AI Integrity Checker"
KV "Performance Rating" "CRITICAL"
Line

Line ("Blockchain Gas Analysis")
KV "Gas Cost (per tx)" "612384 gas"
KV "Transaction Type" "Contract Storage Update"
Line

Line ("Transaction Analysis")
KV "Execution Time" ("{0:N4} seconds" -f 12.9037)
KV "Test Case" "Transaction Uploading"
KV "Performance Rating" "CRITICAL"
Line

Line $rule

$text = ($script:lines -join [Environment]::NewLine)
$text | Set-Content -LiteralPath $OutTextPath -Encoding UTF8
Write-Host $text
Write-Host
Write-Host ("Wrote: {0}" -f $OutTextPath)
