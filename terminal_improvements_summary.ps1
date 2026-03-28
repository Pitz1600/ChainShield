param(
  [string]$PerformanceReportPath = "performance_analysis_report.json",
  [string]$GasAnalysisPath = "barangay_gas_analysis.json",
  [string]$OutTextPath = "improvements_summary.txt"
)

$ErrorActionPreference = "Stop"

function Get-JsonFile($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing required file: $path"
  }
  return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Line($s = "") { $script:lines.Add([string]$s) | Out-Null }

$perf = Get-JsonFile $PerformanceReportPath
$gas = Get-JsonFile $GasAnalysisPath

$results = @($perf.results)
if (-not $results -or $results.Count -eq 0) { throw "No results in $PerformanceReportPath" }

$aiCandidates = $results | Where-Object { $_.unit -eq "seconds" -and $_.test_case -like "AI Fraud Prediction*" }
if (-not $aiCandidates -or $aiCandidates.Count -eq 0) { throw "No AI rows found in $PerformanceReportPath" }
$aiSlowest = $aiCandidates | Sort-Object { [double]$_.raw_result } -Descending | Select-Object -First 1

$blockCandidates = $results | Where-Object { $_.unit -eq "seconds" -and ($_.test_case -eq "Blockchain Transaction API" -or $_.test_case -like "*Blockchain Transaction*") }
if (-not $blockCandidates -or $blockCandidates.Count -eq 0) { throw "No blockchain tx timing row found in $PerformanceReportPath" }
$txUpload = $blockCandidates | Sort-Object { [double]$_.raw_result } -Descending | Select-Object -First 1

$monthly = $gas.monthly_costs
if (-not $monthly) { throw "Missing 'monthly_costs' in $GasAnalysisPath" }
$maxGasCost = $monthly.PSObject.Properties.Value | Sort-Object { [double]$_.cost_php } -Descending | Select-Object -First 1

$generatedLocal = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

$script:lines = New-Object System.Collections.Generic.List[string]

function KV([string]$k, [string]$v) {
  $keyWidth = 26
  Line ("{0,-$keyWidth} : {1}" -f $k, $v)
}

$rule = "-" * 86
Line $rule
Line ("{0,56}" -f "ChainShield Improvements Report")
Line $rule
Line

KV "Analysis Date" ($perf.analysis_date)
KV "Generated (local)" $generatedLocal
Line

Line ("AI Integrity Analysis")
KV "Execution Time" ("{0:N4} seconds" -f [double]$aiSlowest.raw_result)
KV "Test Case" ($aiSlowest.test_case)
KV "Performance Rating" ($aiSlowest.performance_rating)
Line
Line ("Improvements Applied")
Line ("  - Reduced N+1 MongoDB queries in batch processing")
Line ("  - Aggregated frequency checks (24h + 1h) per address for the whole batch")
Line ("  - Cached behavioral profiles per fromAddress within the batch")
Line ("  - File: backend/services/multiStageFraudPipeline.js")
Line

Line ("Blockchain Gas Analysis")
KV "Highest Cost (per tx)" ("PHP {0:N2}" -f [double]$maxGasCost.cost_php)
KV "Transaction Type" ($maxGasCost.transaction_type)
KV "Gas Units" ([string][int]$maxGasCost.gas_units)
KV "Gas Price" ("{0} gwei" -f [double]$maxGasCost.gas_price_gwei)
Line
Line ("Improvements Applied")
Line ("  - No direct on-chain gasUnits change in this patch (gasUsed)")
Line ("  - Recommended: batch commits (Merkle root) or event-only logging; consider L2 for audit trail")
Line

Line ("Blockchain Transaction Analysis")
KV "Execution Time" ("{0:N4} seconds" -f [double]$txUpload.raw_result)
KV "Test Case" ($txUpload.test_case)
KV "Performance Rating" ($txUpload.performance_rating)
Line
Line ("Improvements Applied")
Line ("  - Reduced RPC overhead with a short gas price cache")
Line ("  - Made post-transaction block timestamp fetch optional")
Line ("  - File: backend/services/blockchainService.js")
Line

Line ("Config Knobs")
KV "BLOCKCHAIN_GAS_PRICE_CACHE_MS" "10000 (default)"
KV "BLOCKCHAIN_INCLUDE_BLOCK_TIMESTAMP" "true only if needed"
Line
Line $rule

$text = ($script:lines -join [Environment]::NewLine)
$text | Set-Content -LiteralPath $OutTextPath -Encoding UTF8
Write-Host $text
Write-Host
Write-Host ("Wrote: {0}" -f $OutTextPath)
