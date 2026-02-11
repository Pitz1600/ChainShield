# Service Health Check Guide

## How to Verify Blockchain & AI Services are Working

### Quick Status Check

When you run `docker compose up`, you should see all 6 services starting:
```
✅ chainshield-mongodb
✅ chainshield-ganache (Blockchain)
✅ chainshield-ml-service (AI/Machine Learning)
✅ chainshield-graph-service (Network Analysis)
✅ chainshield-backend
✅ chainshield-frontend
```

---

## 1. Verify Blockchain (Ganache) is Running

### Check Docker Container Status

```powershell
docker ps | Select-String "ganache"
```

**Expected Output**:
```
chainshield-ganache   Up X minutes   0.0.0.0:8545->8545/tcp
```

### Test Blockchain Connection

> **IMPORTANT**: Ganache runs on port **7545** (not 8545) and has **no web UI**. It only provides a JSON-RPC endpoint for blockchain interactions.

#### Option A: Check from Backend Logs
When backend starts, look for:
```
✅ Smart contract initialized at: 0x397eb49822b175d440FB1f404a9019994ee5C10F
```

#### Option B: Test RPC Endpoint
Use curl or Postman to test the JSON-RPC endpoint:
```bash
curl -X POST http://localhost:7545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x0"
}
```

If you get a response, Ganache is working!

If you get a response, Ganache is working!

#### Option C: Check Transaction Recording
1. Import a CSV file with transactions
2. Check backend logs for:
```
🔗 Transaction recorded on blockchain: 0xabc123...
```

---

## 2. Verify AI/ML Service is Running

### Check Docker Container Status

```powershell
docker ps | Select-String "ml-service"
```

**Expected Output**:
```
chainshield-ml-service   Up X minutes   0.0.0.0:5001->5001/tcp
```

### Test ML Service

#### Option A: Health Check Endpoint
```bash
curl http://localhost:5001/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "model": "loaded",
  "version": "1.0.0"
}
```

#### Option B: Test Prediction
```bash
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500000,
    "transactionType": "Procurement",
    "fromAddress": "test@example.com",
    "toAddress": "vendor@example.com"
  }'
```

**Expected Response**:
```json
{
  "riskScore": 45.2,
  "riskLevel": "medium",
  "fraudProbability": 0.23,
  "prediction": "low_risk"
}
```

#### Option C: Check CSV Import
1. Upload a CSV file
2. Look for risk scores in the results
3. Backend logs should show:
```
🤖 ML prediction: Risk Score 67.5 (High)
```

### ML Service Features Being Used

When working correctly, the ML service:
- ✅ Analyzes transaction amounts
- ✅ Detects unusual patterns (frequency, convergence)
- ✅ Calculates risk scores (0-100)
- ✅ Assigns risk levels (Low, Medium, High, Critical)
- ✅ Identifies anomaly categories
- ✅ Uses inflation-adjusted features

---

## 3. Verify Graph Service (Network Analysis)

### Check Docker Container Status

```powershell
docker ps | Select-String "graph-service"
```

**Expected Output**:
```
chainshield-graph-service   Up X minutes   0.0.0.0:5002->5002/tcp
```

### Test Graph Service

```bash
curl -X POST http://localhost:5002/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "fromAddress": "test@example.com",
      "toAddress": "vendor@example.com",
      "amount": 500000
    }
  }'
```

**Expected Response**:
```json
{
  "networkFeatures": {
    "degree": 5,
    "clustering": 0.45
  },
  "fraudPatterns": [],
  "graphStats": {
    "totalNodes": 120,
    "totalEdges": 340
  }
}
```

---

## 4. End-to-End Verification

### Full System Test

1. **Start Services**:
   ```powershell
   docker compose up
   ```

2. **Check All Containers**:
   ```powershell
   docker compose ps
   ```
   All should show "Up" status.

3. **Login to ChainShield**:
   - Navigate to `http://localhost:5173`
   - Login with your credentials

4. **Import Test CSV**:
   - Go to CSV Import page
   - Upload a test transaction CSV
   - Click "Upload & Analyze"

5. **Verify Results**:
   - ✅ Column mappings detected (AI working)
   - ✅ Risk scores assigned (ML working)
   - ✅ Transactions imported successfully
   - ✅ Blockchain hashes generated (Blockchain working)

6. **Check Backend Logs**:
   ```
   ✅ ML prediction: Risk Score X
   ✅ Graph analysis: Network features detected
   ✅ Inflation rate: Fetched current rate
   🔗 Transaction recorded on blockchain: 0x...
   ```

---

## Troubleshooting

### Blockchain Not Working

**Symptoms**:
- No smart contract address in logs
- Error: "Cannot connect to blockchain"

**Solutions**:
1. Check Ganache container:
   ```powershell
   docker logs chainshield-ganache
   ```

2. Restart Ganache:
   ```powershell
   docker compose restart ganache
   ```

3. Verify port 8545 is not in use:
   ```powershell
   netstat -ano | Select-String "8545"
   ```

### ML Service Not Working

**Symptoms**:
- All risk scores are 0
- Error: "ML service unavailable"
- Transactions imported without risk assessment

**Solutions**:
1. Check ML container logs:
   ```powershell
   docker logs chainshield-ml-service
   ```

2. Verify Python dependencies installed:
   ```powershell
   docker exec chainshield-ml-service pip list
   ```

3. Restart ML service:
   ```powershell
   docker compose restart ml-service
   ```

4. Check if model file exists:
   ```powershell
   docker exec chainshield-ml-service ls -la /app/models
   ```

### Graph Service Not Working

**Symptoms**:
- No network features in fraud detection
- Error: "Graph analysis failed"

**Solutions**:
1. Check graph service logs:
   ```powershell
   docker logs chainshield-graph-service
   ```

2. Restart graph service:
   ```powershell
   docker compose restart graph-service
   ```

---

## Service URLs Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main application UI |
| Backend API | http://localhost:5000 | REST API endpoints |
| Ganache (Blockchain) | http://localhost:7545 | Ethereum blockchain RPC (no web UI) |
| ML Service | http://localhost:5001 | Machine learning predictions |
| Graph Service | http://localhost:5002 | Network analysis |
| MongoDB | localhost:27017 | Database |

---

## Healthy System Indicators

✅ **All 6 Docker containers running**  
✅ **Backend shows smart contract address**  
✅ **CSV imports show risk scores**  
✅ **Inflation rate fetched successfully**  
✅ **Transactions have blockchain hashes**  
✅ **Network features detected in analysis**  

If all of these are true, your blockchain and AI services are working correctly!
