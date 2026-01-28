const { Web3 } = require('web3');
const crypto = require('crypto');

class BlockchainService {
  constructor() {
    // Use free APIs: Infura, Alchemy, or public RPC endpoints
    // Free options:
    // - Infura: https://sepolia.infura.io/v3/YOUR_KEY (free tier: 100k requests/day)
    // - Alchemy: https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY (free tier: 300M compute units/month)
    // - Public RPC: https://rpc.sepolia.org (no key needed, but rate limited)
    this.rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org';
    this.useFreeAPI = process.env.USE_FREE_BLOCKCHAIN_API === 'true' || !process.env.BLOCKCHAIN_RPC_URL;
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.account = process.env.BLOCKCHAIN_ACCOUNT;
    this.privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    // Initialize Web3 only if RPC URL is provided
    if (this.rpcUrl && this.rpcUrl !== 'none') {
      try {
        this.web3 = new Web3(this.rpcUrl);
      } catch (error) {
        console.warn('Web3 initialization failed, using hash-based simulation:', error.message);
        this.web3 = null;
      }
    } else {
      this.web3 = null;
    }

    // Initialize contract ABI (minimal)
    this.contractABI = [
      {
        "inputs": [{ "internalType": "bytes32", "name": "_txHash", "type": "bytes32" }],
        "name": "recordTransaction",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{ "internalType": "bytes32", "name": "_txHash", "type": "bytes32" }],
        "name": "verifyTransaction",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{ "internalType": "bytes32", "name": "_txHash", "type": "bytes32" }],
        "name": "getTransaction",
        "outputs": [
          { "internalType": "bytes32", "name": "", "type": "bytes32" },
          { "internalType": "uint256", "name": "", "type": "uint256" },
          { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    // Initialize contract instance if address is provided
    if (this.contractAddress && this.web3) {
      try {
        this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
        console.log(`✅ Smart contract initialized at: ${this.contractAddress}`);
      } catch (error) {
        console.error('❌ Failed to initialize contract:', error.message);
        this.contract = null;
      }
    } else {
      this.contract = null;
      if (this.web3 && !this.contractAddress) {
        console.warn('⚠️  Web3 connected but CONTRACT_ADDRESS not set. Deploy contract first. See BLOCKCHAIN_SETUP.md');
      }
    }
  }

  /**
   * Generate transaction hash for blockchain storage
   * Uses SHA-256 to create a unique hash of transaction data
   */
  generateTxHash(transaction) {
    const data = JSON.stringify({
      transactionId: transaction.transactionId,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      amount: transaction.amount,
      timestamp: transaction.timestamp?.toISOString() || new Date().toISOString(),
      transactionType: transaction.transactionType,
      agency: transaction.agency
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Record transaction hash on blockchain
   * FULL BLOCKCHAIN IMPLEMENTATION - Records hash on Ethereum blockchain via smart contract
   * Only stores hash, timestamp, and verifier ID - NO PII or financial details
   */
  async recordTransactionHash(txHash, metadata = {}) {
    try {
      // Convert hex string to bytes32 format
      const hashBytes32 = '0x' + txHash.padStart(64, '0').slice(0, 64);

      // PRIORITY 1: Full blockchain implementation via smart contract
      if (this.contract && this.account && this.privateKey && this.web3) {
        try {
          console.log('Recording transaction hash on blockchain via smart contract...');

          // Get gas price
          const gasPrice = await this.web3.eth.getGasPrice();

          // Estimate gas
          const gasEstimate = await this.contract.methods.recordTransaction(hashBytes32).estimateGas({
            from: this.account
          });

          // Create transaction
          const tx = this.contract.methods.recordTransaction(hashBytes32);

          // Sign transaction
          const signedTx = await this.web3.eth.accounts.signTransaction(
            {
              from: this.account,
              to: this.contractAddress,
              data: tx.encodeABI(),
              gas: gasEstimate,
              gasPrice: gasPrice
            },
            this.privateKey
          );

          // Send transaction to blockchain
          const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

          console.log(`Transaction recorded on blockchain: ${receipt.transactionHash}`);
          console.log(`Block number: ${receipt.blockNumber}`);

          // Get block timestamp
          const block = await this.web3.eth.getBlock(receipt.blockNumber);

          return {
            success: true,
            transactionHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
            blockHash: receipt.blockHash,
            timestamp: block.timestamp ? Number(block.timestamp) * 1000 : Date.now(),
            verifierId: this.account,
            method: 'smart_contract',
            gasUsed: receipt.gasUsed.toString(),
            confirmations: 1,
            note: 'Transaction hash recorded on Ethereum blockchain via smart contract'
          };
        } catch (contractError) {
          console.error('Smart contract recording failed:', contractError.message);
          console.error('Full error:', contractError);
          console.error('Error stack:', contractError.stack);
          throw new Error(`Failed to record on blockchain: ${contractError.message}`);
        }
      }

      // PRIORITY 2: If contract not deployed, try direct transaction (advanced)
      if (this.web3 && this.account && this.privateKey) {
        try {
          console.warn('Smart contract not deployed. Attempting direct transaction...');
          // This would require a more complex setup, so we'll throw an error
          throw new Error('Smart contract not configured. Please deploy contract first.');
        } catch (error) {
          console.error('Direct transaction failed:', error.message);
        }
      }

      // FALLBACK: If blockchain not available, throw error (don't silently fallback)
      if (!this.web3) {
        throw new Error('Blockchain connection not available. Please configure BLOCKCHAIN_RPC_URL.');
      }

      if (!this.contractAddress) {
        throw new Error('Smart contract not deployed. Please deploy contract and set CONTRACT_ADDRESS.');
      }

      if (!this.account || !this.privateKey) {
        throw new Error('Blockchain account not configured. Please set BLOCKCHAIN_ACCOUNT and BLOCKCHAIN_PRIVATE_KEY.');
      }

      throw new Error('Blockchain recording failed. Please check configuration.');

    } catch (error) {
      console.error('Blockchain recording error:', error.message);
      throw new Error(`Failed to record transaction on blockchain: ${error.message}`);
    }
  }

  /**
   * Verify transaction integrity on blockchain
   * FULL BLOCKCHAIN VERIFICATION - Checks if hash exists on Ethereum blockchain
   */
  async verifyTransaction(txHash) {
    try {
      const hashBytes32 = '0x' + txHash.padStart(64, '0').slice(0, 64);

      if (!this.contract) {
        throw new Error('Smart contract not initialized. Cannot verify transaction.');
      }

      // Call smart contract to verify
      const verified = await this.contract.methods.verifyTransaction(hashBytes32).call();

      if (verified) {
        // Get transaction details from contract
        const txData = await this.contract.methods.getTransaction(hashBytes32).call();

        return {
          verified: true,
          blockNumber: txData[1] ? Number(txData[1]) : null,
          timestamp: txData[1] ? Number(txData[1]) * 1000 : null,
          verifierId: txData[2] || null,
          txHash: txData[0] || hashBytes32,
          note: 'Transaction verified on Ethereum blockchain'
        };
      } else {
        return {
          verified: false,
          note: 'Transaction hash not found on blockchain'
        };
      }
    } catch (error) {
      console.error('Blockchain verification error:', error.message);
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber() {
    try {
      return await this.web3.eth.getBlockNumber();
    } catch (error) {
      console.warn('Could not fetch block number:', error.message);
      return 0;
    }
  }

  /**
   * Check blockchain connection
   * Works with free APIs or hash-based mode
   */
  async checkConnection() {
    // Hash-based mode (no blockchain)
    if (!this.web3 || this.rpcUrl === 'none') {
      return {
        connected: true,
        mode: 'hash_based',
        note: 'Using hash-based storage (no blockchain connection needed)'
      };
    }

    try {
      const blockNumber = await this.web3.eth.getBlockNumber();
      const networkId = await this.web3.eth.net.getId().catch(() => null);

      return {
        connected: true,
        blockNumber,
        networkId,
        rpcUrl: this.rpcUrl,
        mode: this.useFreeAPI ? 'free_api' : 'local'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        mode: 'error',
        fallback: 'System will use hash-based storage'
      };
    }
  }
}

module.exports = new BlockchainService();
