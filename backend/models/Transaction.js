const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction ID (Barangay Transaction Format)
  transactionId: {
    type: String,
    unique: true,
    index: true
  },

  // Blockchain fields
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  blockHash: String,
  blockNumber: Number,
  blockchainTxId: String, // Ethereum transaction ID
  gasUsed: Number,

  // Barangay Context
  transactionType: {
    type: String,
    enum: ['Social Welfare', 'Procurement', 'Grant', 'Tax', 'Revenue', 'Emergency Funds', 'Other'],
    required: true,
    index: true
  },
  programName: String, // e.g., "4Ps", "SAP", "TUPAD", "AICS"
  agency: String, // e.g., "DSWD", "DOH", "DILG", "DOF"

  // Transaction details
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
    default: 'PHP'
  },

  // Beneficiary info (anonymized/hashed only - no PII)
  beneficiaryId: String, // Hashed/anonymized ID
  beneficiaryType: {
    type: String,
    enum: ['Individual', 'Household', 'Organization', 'Barangay Office', 'Vendor', 'Contractor']
  },

  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  staged: {
    type: Boolean,
    default: false,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Suspicious', 'Flagged', 'Rejected'],
    default: 'Pending',
    index: true
  },
  verifiedBy: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Risk assessment results
  flagged: {
    type: Boolean,
    default: false,
    index: true
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    index: true
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    index: true
  },

  // Graph analytics
  graphNodeId: String, // Neo4j node ID (optional)
  networkFeatures: {
    degree: Number,
    inDegree: Number,
    outDegree: Number,
    clusteringCoefficient: Number,
    betweennessCentrality: Number
  },

  // Risk patterns detected
  fraudPatterns: [{
    type: {
      type: String,
      enum: ['Fund Convergence', 'Circular Movement', 'Shell Wallet', 'Collusion', 'Rapid Sequential Transactions', 'Unusual Amount', 'Suspicious Timing', 'Geographic Anomaly', 'Other']
    },
    severity: String,
    description: String
  }]
}, { timestamps: true });

// Generate transaction ID before saving
transactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    const prefix = 'PH-GOV-';
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    this.transactionId = prefix + randomNum;
  }
  next();
});

// Indexes for performance
transactionSchema.index({ transactionType: 1, timestamp: -1 });
transactionSchema.index({ riskLevel: 1, flagged: 1 });
transactionSchema.index({ agency: 1, programName: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
