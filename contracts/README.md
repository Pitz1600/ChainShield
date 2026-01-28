# ChainShield Smart Contracts

This directory contains the ChainShield smart contract for recording transaction hashes on the Ethereum blockchain.

## 📋 Prerequisites

- Node.js 18+
- Truffle: `npm install -g truffle`
- MetaMask (for Sepolia) or Ganache (for local)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:
```env
# For Sepolia testnet
PRIVATE_KEY=your_metamask_private_key
INFURA_API_KEY=your_infura_key
# OR
ALCHEMY_API_KEY=your_alchemy_key

# For Ganache (local)
# No .env needed, just start Ganache
```

### 3. Compile Contract

```bash
npm run compile
```

### 4. Deploy Contract

**Local (Ganache):**
```bash
npm run migrate:dev
```

**Sepolia Testnet:**
```bash
npm run migrate:sepolia
```

### 5. Copy Contract Address

After deployment, copy the contract address from the output and add to `backend/.env`:
```env
CONTRACT_ADDRESS=0x...
```

## 📝 Contract Details

**Contract Name:** ChainShield  
**Solidity Version:** 0.8.19  
**Network:** Sepolia Testnet (or Ganache for local)

**Functions:**
- `recordTransaction(bytes32 _txHash)` - Record transaction hash
- `verifyTransaction(bytes32 _txHash)` - Verify hash exists
- `getTransaction(bytes32 _txHash)` - Get transaction details
- `getTotalRecords()` - Get total count

## 🔍 Verify on Etherscan

After deployment to Sepolia:
1. Go to https://sepolia.etherscan.io
2. Search for your contract address
3. View contract and transactions

## 📚 More Information

See `BLOCKCHAIN_SETUP.md` for detailed setup instructions.
