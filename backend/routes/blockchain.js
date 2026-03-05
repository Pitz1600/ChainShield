const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const blockchainService = require('../services/blockchainService');
const auth = require('../middleware/auth');
const { requireAdmin, requireRole } = require('../middleware/roleMiddleware');

// Verify blockchain connection - Enhanced admin endpoint
router.get('/status', auth, requireAdmin, async (req, res) => {
  try {
    const status = await blockchainService.checkConnection();

    // Get additional Web3 info if connected
    let accountInfo = null;
    if (blockchainService.web3 && blockchainService.account) {
      try {
        const balance = await blockchainService.web3.eth.getBalance(blockchainService.account);
        const balanceInEth = blockchainService.web3.utils.fromWei(balance, 'ether');

        accountInfo = {
          address: blockchainService.account,
          balance: balanceInEth + ' ETH',
          balanceWei: balance.toString(),
          hasSufficientFunds: parseFloat(balanceInEth) > 0.01
        };
      } catch (err) {
        accountInfo = { error: err.message };
      }
    }

    res.json({
      success: true,
      blockchain: {
        ...status,
        contract: {
          address: blockchainService.contractAddress || 'Not configured',
          initialized: !!blockchainService.contract
        },
        account: accountInfo,
        rpcUrl: blockchainService.rpcUrl
      }
    });
  } catch (error) {
    console.error('Blockchain status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify transaction on blockchain (Auditor/Admin only)
router.post('/verify', auth, requireRole(['auditor', 'administrator']), async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }

    const verification = await blockchainService.verifyTransaction(txHash);
    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current block number
router.get('/block-number', auth, async (req, res) => {
  try {
    const blockNumber = await blockchainService.getCurrentBlockNumber();
    res.json({ blockNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test blockchain recording (Admin only)
router.post('/test', auth, requireAdmin, async (req, res) => {
  try {
    const testHash = crypto.createHash('sha256')
      .update(`test_${Date.now()}_${Math.random()}`)
      .digest('hex');

    console.log('🧪 Testing Ganache blockchain recording...');

    const result = await blockchainService.recordTransactionHash(testHash, {
      test: true,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: '✅ Blockchain test successful! Transaction recorded on Ganache.',
      data: result
    });
  } catch (error) {
    console.error('❌ Blockchain test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      troubleshooting: {
        possibleCauses: [
          'Ganache container is not running',
          'Smart contract not deployed to Ganache',
          'Blockchain account has insufficient ETH',
          'RPC URL is incorrect or unreachable',
          'Contract address is invalid'
        ],
        quickFixes: [
          '1. Check Ganache: docker ps | Select-String "ganache"',
          '2. Verify .env has BLOCKCHAIN_RPC_URL=http://host.docker.internal:7545',
          '3. Ensure CONTRACT_ADDRESS is set in .env',
          '4. Check account ETH balance at /api/blockchain/status',
          '5. Deploy contract if needed: cd contracts && npm run deploy'
        ]
      }
    });
  }
});

module.exports = router;
