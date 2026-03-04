const { Web3 } = require('web3');
const crypto = require('crypto');

/**
 * BlockchainService
 * - Owner-only smart contract writes
 * - Stores ONLY suspicious transactions to minimize gas
 * - Uses events for metadata to avoid heavy storage
 */
class BlockchainService {
  constructor() {
    this.rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org';
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.account = process.env.BLOCKCHAIN_ACCOUNT;
    this.privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    this.web3 = null;
    if (this.rpcUrl && this.rpcUrl !== 'none') {
      try {
        this.web3 = new Web3(this.rpcUrl);
      } catch (err) {
        console.warn('Web3 init failed; blockchain disabled:', err.message);
      }
    }

    // Gas-lean ABI: recordSuspicious(bytes32,uint8,bytes32)
    this.contractABI = [
      {
        inputs: [
          { internalType: 'bytes32', name: '_txHash', type: 'bytes32' },
          { internalType: 'uint8', name: '_riskScore', type: 'uint8' },
          { internalType: 'bytes32', name: '_metaHash', type: 'bytes32' }
        ],
        name: 'recordSuspicious',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [{ internalType: 'bytes32', name: '_txHash', type: 'bytes32' }],
        name: 'isRecorded',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [{ internalType: 'bytes32', name: '_txHash', type: 'bytes32' }],
        name: 'getSuspicious',
        outputs: [
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          { internalType: 'uint8', name: 'riskScore', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [],
        name: 'owner',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
      }
    ];

    if (this.contractAddress && this.web3) {
      this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
    }
  }

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
   * Record ONLY suspicious transactions on-chain to save gas.
   * txHash: sha256 hex string
   * riskScore: 0-100
   * metaHash: optional sha256 of evidence blob (off-chain)
   */
  async recordSuspiciousEvidence(txHash, riskScore, metaHash = '') {
    const hashBytes32 = '0x' + txHash.padStart(64, '0').slice(0, 64);
    const metaBytes32 = metaHash
      ? '0x' + metaHash.padStart(64, '0').slice(0, 64)
      : '0x' + ''.padStart(64, '0');

    if (!this.contract || !this.account || !this.privateKey || !this.web3) {
      throw new Error('Blockchain not configured. Set BLOCKCHAIN_RPC_URL, CONTRACT_ADDRESS, BLOCKCHAIN_ACCOUNT, BLOCKCHAIN_PRIVATE_KEY.');
    }

    const gasPrice = await this.web3.eth.getGasPrice();
    const gasEstimate = await this.contract.methods
      .recordSuspicious(hashBytes32, riskScore, metaBytes32)
      .estimateGas({ from: this.account });

    const tx = this.contract.methods.recordSuspicious(hashBytes32, riskScore, metaBytes32);
    const signedTx = await this.web3.eth.accounts.signTransaction(
      {
        from: this.account,
        to: this.contractAddress,
        data: tx.encodeABI(),
        gas: gasEstimate,
        gasPrice
      },
      this.privateKey
    );

    const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    const block = await this.web3.eth.getBlock(receipt.blockNumber);

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      blockHash: receipt.blockHash,
      timestamp: block.timestamp ? Number(block.timestamp) * 1000 : Date.now(),
      gasUsed: receipt.gasUsed?.toString(),
      method: 'smart_contract',
      riskScore
    };
  }

  async verifySuspicious(txHash) {
    if (!this.contract) throw new Error('Smart contract not initialized.');
    const hashBytes32 = '0x' + txHash.padStart(64, '0').slice(0, 64);
    const recorded = await this.contract.methods.isRecorded(hashBytes32).call();
    return recorded;
  }

  // Backward-compatible stub; clean transactions should not be recorded anymore.
  async recordTransactionHash() {
    throw new Error('recordTransactionHash is deprecated. Use recordSuspiciousEvidence for flagged transactions only.');
  }
}

module.exports = new BlockchainService();
