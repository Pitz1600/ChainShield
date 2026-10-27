const mongoose = require('mongoose');
// One private document per file keeps binary data out of expenditure documents.
const schema = new mongoose.Schema({
  budgetProposalId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  expenditureId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  originalName: { type: String, required: true, immutable: true },
  mimeType: { type: String, required: true, immutable: true },
  bytes: { type: Number, required: true, immutable: true },
  sha256: { type: String, required: true, immutable: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  uploaderName: { type: String, required: true, immutable: true },
  uploadedAt: { type: Date, required: true, immutable: true },
  explanation: { type: String, required: true, immutable: true },
  data: { type: Buffer, required: true, immutable: true, select: false }
}, { versionKey: false });
schema.index({ budgetProposalId: 1, expenditureId: 1, uploadedAt: 1 });
module.exports = mongoose.model('AuditorEvidence', schema);
