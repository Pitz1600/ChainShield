# Quick Ganache Test Script
# This verifies that Ganache blockchain is running

Write-Host "🔍 Testing Ganache Blockchain Connection..." -ForegroundColor Cyan
Write-Host ""

try {
    $body = @{
        jsonrpc = "2.0"
        method = "eth_blockNumber"
        params = @()
        id = 1
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:7546" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.result) {
        $blockNumber = [Convert]::ToInt32($response.result, 16)
        Write-Host "✅ SUCCESS: Ganache is running!" -ForegroundColor Green
        Write-Host "📦 Current block number: $blockNumber" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📊 Ganache Details:" -ForegroundColor Cyan
        Write-Host "   - RPC URL: http://localhost:7545" -ForegroundColor White
        Write-Host "   - Network ID: 1337" -ForegroundColor White
        Write-Host "   - Accounts: 10 pre-funded with 1000 ETH each" -ForegroundColor White
        Write-Host ""
        Write-Host "🎉 Blockchain service is healthy!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ FAILED: Cannot connect to Ganache" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check if Ganache container is running:" -ForegroundColor White
    Write-Host "   docker ps | Select-String 'ganache'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Check Ganache logs:" -ForegroundColor White
    Write-Host "   docker logs chainshield-ganache" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Restart Ganache:" -ForegroundColor White
    Write-Host "   docker compose restart ganache" -ForegroundColor Gray
    Write-Host ""
    $errorMsg = $_.Exception.Message
    Write-Host "Error details: $errorMsg" -ForegroundColor Red
}
