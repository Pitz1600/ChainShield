#!/bin/bash
# Verify Blockchain Transaction Script (Linux)
# Usage: ./verify-blockchain-hash.sh <transaction-hash>

if [ -z "$1" ]; then
    echo "❌ Error: Transaction hash required"
    echo "Usage: $0 <transaction-hash>"
    echo "Example: $0 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    exit 1
fi

TRANSACTION_HASH="$1"

echo "🔍 Verifying blockchain transaction..."
echo "Hash: $TRANSACTION_HASH"
echo ""

# Prepare the JSON-RPC request
request_body=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "method": "eth_getTransactionReceipt",
  "params": ["$TRANSACTION_HASH"],
  "id": 1
}
EOF
)

# Query Ganache
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$request_body" \
  http://localhost:7546 2>/dev/null)

# Check if transaction was found
if echo "$response" | grep -q '"result"' && ! echo "$response" | grep -q '"result":null'; then
    
    # Extract fields using grep/cut or jq if available
    if command -v jq &> /dev/null; then
        block_number=$(echo "$response" | jq -r '.result.blockNumber // "N/A"')
        gas_used=$(echo "$response" | jq -r '.result.gasUsed // "N/A"')
        status=$(echo "$response" | jq -r '.result.status // "N/A"')
        block_hash=$(echo "$response" | jq -r '.result.blockHash // "N/A"')
        from=$(echo "$response" | jq -r '.result.from // "N/A"')
        to=$(echo "$response" | jq -r '.result.to // "N/A"')
        
        # Determine status text
        if [ "$status" = "0x1" ]; then
            status_text="SUCCESS ✅"
        else
            status_text="FAILED ❌"
        fi
    else
        # Fallback parsing without jq
        block_number=$(echo "$response" | grep -o '"blockNumber":"0x[^"]*' | cut -d'"' -f4)
        gas_used=$(echo "$response" | grep -o '"gasUsed":"0x[^"]*' | cut -d'"' -f4)
        status=$(echo "$response" | grep -o '"status":"0x[^"]*' | cut -d'"' -f4)
        block_hash=$(echo "$response" | grep -o '"blockHash":"0x[^"]*' | cut -d'"' -f4)
        from=$(echo "$response" | grep -o '"from":"0x[^"]*' | cut -d'"' -f4)
        to=$(echo "$response" | grep -o '"to":"0x[^"]*' | cut -d'"' -f4)
        
        if [ "$status" = "0x1" ]; then
            status_text="SUCCESS ✅"
        else
            status_text="FAILED ❌"
        fi
    fi
    
    echo "✅ TRANSACTION VERIFIED ON GANACHE BLOCKCHAIN!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📦 Block Number: $block_number"
    echo "  ⛽ Gas Used: $gas_used"
    echo "  ✔️  Status: $status_text"
    echo "  📄 Block Hash: $block_hash"
    echo "  🔗 From: $from"
    echo "  🎯 To: $to"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Show full transaction details
    echo ""
    echo "Full Receipt:"
    if command -v jq &> /dev/null; then
        echo "$response" | jq '.result'
    else
        echo "$response"
    fi
    
else
    echo "❌ Transaction not found on blockchain"
    echo "   This could mean:"
    echo "   - The transaction hasn't been mined yet"
    echo "   - The hash is incorrect"
    echo "   - Ganache was restarted (data is lost)"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if Ganache is running: docker ps | grep ganache"
    echo "  2. Verify port 7546 is accessible: netstat -tuln | grep 7546"
    echo "  3. Check Ganache logs: docker logs chainshield-ganache"
    echo ""
    echo "Response: $response"
    exit 1
fi
