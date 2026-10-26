const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  budgetProposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetProposal', required: true, immutable: true, index: true },
  allocationId: { type: String, required: true, immutable: true },
  submissionKey: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  amountCentavos: { type: Number, required: true, immutable: true },
  input: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  sourceRecordId: { type: String, immutable: true },
  sourceCsvHash: { type: String, immutable: true },
  sourceRowNumber: { type: Number, immutable: true },
  sourceFilename: { type: String, immutable: true },
  sourcePayer: { type: String, immutable: true },
  sourcePayee: { type: String, immutable: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', index: true },
  assessmentStatus: { type: String, enum: ['pending', 'complete', 'unavailable'], default: 'pending' },
  assessment: mongoose.Schema.Types.Mixed,
  reviewStatus: { type: String, enum: ['submitted', 'correction_required', 'verified', 'rejected'], default: 'submitted' },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewReason: String,
  evidence: [{ categories: [String], originalName: String, mimeType: String, bytes: Number, sha256: String, uploadedBy: mongoose.Schema.Types.ObjectId, uploadedAt: Date, version: Number, reason: String, data: { type: Buffer, select: false } }],
  history: [{ actor: mongoose.Schema.Types.ObjectId, action: String, at: Date, reason: String }]
}, { timestamps: true });
schema.index({ budgetProposalId: 1, submissionKey: 1 }, { unique: true });
schema.index({ budgetProposalId: 1, sourceRecordId: 1 }, { unique: true, partialFilterExpression: { sourceRecordId: { $type: 'string' } } });
schema.index({ budgetProposalId: 1, sourceCsvHash: 1, sourceRowNumber: 1 }, { unique: true, partialFilterExpression: { sourceCsvHash: { $type: 'string' } } });
module.exports = mongoose.model('BudgetExpenditure', schema);
