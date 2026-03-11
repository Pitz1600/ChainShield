# Performance improvements (generated 2026-03-10)

Baseline (from `performance_analysis_report.json`, analysis date `2026-03-02`):
- AI integrity checker (slowest AI prediction case): `0.5839 s`
- Transaction uploading (Blockchain Transaction API): `1.1418 s`

Baseline (from `barangay_gas_analysis.json`):
- Highest per-transaction gas cost: `budget_allocation` (`140000` gas, `PHP 525.00` @ `25` gwei)

## Implemented in code

### Integrity checker: reduce N+1 database queries
File: `backend/services/multiStageFraudPipeline.js`
- Batches `countDocuments` frequency checks (24h and 1h) into 2 aggregation queries for the whole batch.
- Caches `buildProfile(fromAddress)` per address within a batch to avoid repeated aggregations.

Expected effect:
- Lower latency and better throughput on large CSV imports where many rows share the same `fromAddress`.

### CSV upload: parse once, track correct row numbers, clean up temp files
File: `backend/controllers/csvImportController.js`
- Maps + validates rows during streaming CSV parse (no second pass over `rawRows`).
- Preserves original CSV row numbers in the response via `rowRefs[]`.
- Deletes the uploaded CSV after processing (best-effort) to reduce disk growth under `backend/uploads`.

### Blockchain transaction upload: fewer RPC round-trips
File: `backend/services/blockchainService.js`
- Adds a small gas price cache (`BLOCKCHAIN_GAS_PRICE_CACHE_MS`, default `10000`) to reduce repeated `eth_gasPrice` calls.
- Makes the extra `eth_getBlockByNumber` call optional:
  - Set `BLOCKCHAIN_INCLUDE_BLOCK_TIMESTAMP=true` only if you need the on-chain block timestamp.

## Next improvements (not implemented yet)

### Integrity checker / CSV import
- Use `insertMany`/`bulkWrite` in `processBatch()` to avoid per-transaction `save()` latency.
- Add a batch size limit (e.g., process 200–500 rows per chunk) to avoid long single-request runtimes.
- Make Graph/ML service calls optional per import (`opts.skipGraph`, `opts.skipMl`) to provide a fast “validation-only” mode.

### Blockchain gas cost
- Consider event-only logging (no storage writes) for the audit trail to reduce gas, or store a periodic Merkle root instead of per-tx writes.
- Prefer L2 (Optimism/Arbitrum/Base) for audit logging, or batch multiple suspicious hashes into one on-chain write.

### Transaction uploading time
- Move on-chain writes to an async queue: return the API response immediately and finalize the blockchain receipt in the background.
- If you must wait synchronously, consider skipping `estimateGas` for a fixed gas limit with a safety buffer (only if your contract method cannot revert).

