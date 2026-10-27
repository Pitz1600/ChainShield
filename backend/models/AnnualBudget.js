const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  barangayId: { type: String, required: true, immutable: true },
  fiscalYear: { type: Number, required: true, immutable: true },
  totalCentavos: { type: Number, required: true },
  reservedCentavos: { type: Number, default: 0 },
  reference: String, remarks: String,
  reconciled: { type: Boolean, default: false }, revision: { type: Number, default: 1 },
  history: [{ action: String, previousCentavos: Number, newCentavos: Number, reason: String, reference: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date, backupId: mongoose.Schema.Types.ObjectId }]
}, { timestamps: true });
schema.index({ barangayId: 1, fiscalYear: 1 }, { unique: true });
module.exports = mongoose.model('AnnualBudget', schema);
