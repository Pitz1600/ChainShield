const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  proposalNumber: { type: String, unique: true, required: true },
  barangayId: { type: String, required: true, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: String, fiscalYear: Number, proposalType: String, sector: String, justification: String,
  items: [mongoose.Schema.Types.Mixed], totalAmountCentavos: { type: Number, default: 0 },
  expenditureReserved: { type: Map, of: Number, default: {} },
  documents: [{ originalName: String, mimeType: String, bytes: Number, data: { type: Buffer, select: false } }],
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'ADMIN_APPROVED', 'REJECTED'], default: 'DRAFT' },
  revision: { type: Number, default: 1 },
  submittedAt: Date, reviewedAt: Date, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewerRemarks: String,
  legalAuthorizationStatus: { type: String, default: 'NOT_RECORDED', immutable: true },
  // Embedded append-only events commit atomically with the state and submitted snapshot.
  history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: String, from: String, to: String, revision: Number, at: Date, remarks: String, snapshot: mongoose.Schema.Types.Mixed, snapshotHash: String }]
}, { timestamps: true });
schema.index({ createdBy: 1, barangayId: 1, createdAt: -1 });
schema.index({ status: 1, submittedAt: -1 });
module.exports = mongoose.model('BudgetProposal', schema);
