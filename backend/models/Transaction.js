const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fromAddress: {
    type: String,
    required: true,
    index: true
  },
  toAddress: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'ETH'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  blockNumber: Number,
  gasUsed: Number,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  flagged: {
    type: Boolean,
    default: false
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);