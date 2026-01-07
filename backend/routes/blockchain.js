const express = require('express');
const router = express.Router();
const blockchainService = require('../services/blockchainService');
const auth = require('../middleware/auth');

// Verify blockchain connection
router.get('/status', auth, async (req, res) => {
  try {
    const status = await blockchainService.checkConnection();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify transaction on blockchain
router.post('/verify', auth, async (req, res) => {
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

module.exports = router;
