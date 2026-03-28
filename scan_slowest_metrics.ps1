param(
  [string]$PerformanceReportPath = "performance_analysis_report.json",
  [string]$GasAnalysisPath = "barangay_gas_analysis.json",
  [string]$OutPath = "metrics_report.json"
)

$ErrorActionPreference = "Stop"

function Get-JsonFile($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing required file: $path"
  }
  return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}

$perf = Get-JsonFile $PerformanceReportPath
$gas = Get-JsonFile $GasAnalysisPath

$results = @($perf.results)
if (-not $results -or $results.Count -eq 0) {
  throw "No results found in $PerformanceReportPath"
}

# Detect AI-related timing rows automatically
$aiCandidates = $results | Where-Object {
  $_.unit -eq "seconds" -and $_.test_case -match "AI"
}

if (-not $aiCandidates -or $aiCandidates.Count -eq 0) {
  throw "No AI-related timing rows found in $PerformanceReportPath"
}

$aiMetric = $aiCandidates | Sort-Object { [double]$_.raw_result } -Descending | Select-Object -First 1

# Detect blockchain transaction timing rows
$blockchainTxCandidates = $results | Where-Object {
  $_.unit -eq "seconds" -and $_.test_case -match "Blockchain"
}

if (-not $blockchainTxCandidates -or $blockchainTxCandidates.Count -eq 0) {
  throw "No blockchain timing rows found in $PerformanceReportPath"
}

$txUploadMetric = $blockchainTxCandidates | Sort-Object { [double]$_.raw_result } -Descending | Select-Object -First 1

# Gas cost analysis
$monthly = $gas.monthly_costs
if (-not $monthly) {
  throw "Missing 'monthly_costs' in $GasAnalysisPath"
}

$maxGasCost = $monthly.PSObject.Properties.Value |
  Sort-Object { [double]$_.cost_php } -Descending |
  Select-Object -First 1

# Compare metrics
$timeMetrics = @(
  [pscustomobject]@{
    name = "AI Integrity Analysis"
    seconds = [double]$aiMetric.raw_result
    case = $aiMetric.test_case
  },
  [pscustomobject]@{
    name = "Blockchain Transaction Upload"
    seconds = [double]$txUploadMetric.raw_result
    case = $txUploadMetric.test_case
  }
)

$dominantMetric = $timeMetrics | Sort-Object seconds -Descending | Select-Object -First 1

# Build report
$report = [pscustomobject]@{

  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")

  sources = [pscustomobject]@{
    performance_report = $PerformanceReportPath
    gas_analysis = $GasAnalysisPath
  }

  performance_report_analysis_date = $perf.analysis_date

  ai_integrity_analysis = [pscustomobject]@{
    execution_seconds = [double]$aiMetric.raw_result
    test_case = $aiMetric.test_case
    threshold_sec = [double]$aiMetric.threshold
    rating = $aiMetric.performance_rating
  }

  transaction_uploading = [pscustomobject]@{
    execution_seconds = [double]$txUploadMetric.raw_result
    test_case = $txUploadMetric.test_case
    threshold_sec = [double]$txUploadMetric.threshold
    rating = $txUploadMetric.performance_rating
  }

  blockchain_gas_cost = [pscustomobject]@{
    cost_php = [double]$maxGasCost.cost_php
    cost_eth = [double]$maxGasCost.cost_eth
    cost_usd = [double]$maxGasCost.cost_usd
    gas_units = [int]$maxGasCost.gas_units
    transaction_type = $maxGasCost.transaction_type
    name = $maxGasCost.name
    gas_price_gwei = [double]$maxGasCost.gas_price_gwei
  }

  dominant_processing_metric = [pscustomobject]@{
    component = $dominantMetric.name
    seconds = $dominantMetric.seconds
    case = $dominantMetric.case
  }
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutPath -Encoding UTF8

Write-Host ""
Write-Host "------------------------------------------------------------"
Write-Host "                ChainShield Performance Report"
Write-Host "------------------------------------------------------------"

Write-Host ("Analysis Date              : {0}" -f $perf.analysis_date)
Write-Host ""

Write-Host "AI Integrity Analysis"
Write-Host ("  Execution Time           : {0:N4} seconds" -f [double]$aiMetric.raw_result)
Write-Host ("  Test Case                : {0}" -f $aiMetric.test_case)
Write-Host ("  Performance Rating       : {0}" -f $aiMetric.performance_rating)
Write-Host ""

Write-Host "Blockchain Transaction Upload"
Write-Host ("  Execution Time           : {0:N4} seconds" -f [double]$txUploadMetric.raw_result)
Write-Host ("  Test Case                : {0}" -f $txUploadMetric.test_case)
Write-Host ("  Performance Rating       : {0}" -f $txUploadMetric.performance_rating)
Write-Host ""

Write-Host "Blockchain Gas Cost Metrics"
Write-Host ("  Cost (PHP)               : {0:N2}" -f [double]$maxGasCost.cost_php)
Write-Host ("  Gas Units                : {0}" -f [int]$maxGasCost.gas_units)
Write-Host ("  Gas Price (Gwei)         : {0}" -f [double]$maxGasCost.gas_price_gwei)
Write-Host ("  Transaction Type         : {0}" -f $maxGasCost.transaction_type)
Write-Host ""

Write-Host "Dominant Processing Metric"
Write-Host ("  Component                : {0}" -f $dominantMetric.name)
Write-Host ("  Execution Time           : {0:N4} seconds" -f $dominantMetric.seconds)
Write-Host ""

Write-Host "Report File"
Write-Host ("  Output Path              : {0}" -f $OutPath)

Write-Host "------------------------------------------------------------"