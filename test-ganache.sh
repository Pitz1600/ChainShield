#!/bin/bash
# Quick Ganache Test Script (Linux)
# This verifies that Ganache blockchain is running

echo "🔍 Testing Ganache Blockchain Connection..."
echo ""

# Prepare the JSON-RPC request
request_body=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
EOF
)

# Try to connect to Ganache
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$request_body" \
  http://localhost:7546 2>/dev/null)

# Check if we got a response
if echo "$response" | grep -q '"result"'; then
    # Extract block number (it's in hex format)
    block_hex=$(echo "$response" | grep -o '"result":"0x[^"]*' | cut -d'"' -f4)
    
    if [ -n "$block_hex" ]; then
        # Convert hex to decimal
        block_number=$((16#${block_hex#0x}))
        
        echo "✅ SUCCESS: Ganache is running!"
        echo "📦 Current block number: $block_number"
        echo ""
        echo "📊 Ganache Details:"
        echo "   - RPC URL: http://localhost:7546"
        echo "   - Network ID: 1337"
        echo "   - Accounts: 10 pre-funded with 1000 ETH each"
        echo ""
        echo "🎉 Blockchain service is healthy!"
    else
        echo "✅ Ganache is running (but couldn't parse block number)"
    fi
else
    echo "❌ FAILED: Cannot connect to Ganache"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check if Ganache container is running:"
    echo "   docker ps | grep ganache"
    echo ""
    echo "2. Check Ganache logs:"
    echo "   docker logs chainshield-ganache"
    echo ""
    echo "3. Restart Ganache:"
    echo "   docker compose restart ganache"
    echo ""
    echo "Response received: $response"
    exit 1
fi
