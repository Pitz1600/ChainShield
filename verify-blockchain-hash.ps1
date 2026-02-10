param(
    [Parameter(Mandatory=$true)]
    [string]$TransactionHash
)

Write-Host "🔍 Verifying blockchain transaction..." -ForegroundColor Cyan
Write-Host "Hash: $TransactionHash" -ForegroundColor Yellow

# Get transaction receipt
$body = @{
    jsonrpc = "2.0"
    method = "eth_getTransactionReceipt"
    params = @($TransactionHash)
    id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:7546" -Method Post -Body $body -ContentType "application/json"
    
    if ($response.result) {
        Write-Host "`n✅ TRANSACTION VERIFIED ON GANACHE BLOCKCHAIN!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "  📦 Block Number: $($response.result.blockNumber)" -ForegroundColor White
        Write-Host "  ⛽ Gas Used: $($response.result.gasUsed)" -ForegroundColor White
        Write-Host "  ✔️  Status: $(if ($response.result.status -eq '0x1') {'SUCCESS'} else {'FAILED'})" -ForegroundColor $(if ($response.result.status -eq '0x1') {'Green'} else {'Red'})
        Write-Host "  📄 Block Hash: $($response.result.blockHash)" -ForegroundColor White
        Write-Host "  🔗 From: $($response.result.from)" -ForegroundColor White
        Write-Host "  🎯 To: $($response.result.to)" -ForegroundColor White
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        
        # Show full transaction details
        Write-Host "`nFull Receipt:" -ForegroundColor Cyan
        $response.result | ConvertTo-Json -Depth 5 | Write-Host
        
    } else {
        Write-Host "`n❌ Transaction not found on blockchain" -ForegroundColor Red
        Write-Host "   This could mean:" -ForegroundColor Yellow
        Write-Host "   - The transaction hasn't been mined yet" -ForegroundColor Yellow
        Write-Host "   - The hash is incorrect" -ForegroundColor Yellow
        Write-Host "   - Ganache was restarted (data is lost)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error connecting to Ganache: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if Ganache is running: docker ps | Select-String 'ganache'" -ForegroundColor White
    Write-Host "  2. Verify port 7545 is accessible" -ForegroundColor White
    Write-Host "  3. Try: Test-NetConnection localhost -Port 7545" -ForegroundColor White
}
