const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  txHash: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  fraudType: {
    type: String,
    enum: ['Procurement Fraud', 'Tax Evasion', 'Welfare Fraud', 'Identity Fraud', 'Money Laundering', 'Other'],
    required: true
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  reasons: [{
    type: String
  }],
  features: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  shapValues: {
    type: Map,
    of: Number
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'closed', 'false_positive'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  }
}, { timestamps: true });

alertSchema.index({ status: 1, severity: -1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);