const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
// Existing mutation endpoints must not bypass budget reservations or auditor review.
module.exports = async (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const pathId = req.path.split('/').filter(Boolean)[0];
  const ids = [pathId, ...(Array.isArray(req.body?.ids) ? req.body.ids : [])].filter(id => typeof id === 'string' && mongoose.isValidObjectId(id));
  if (!ids.length) return next();
  try {
    const linked = await Transaction.exists({ _id: { $in: ids }, transactionId: /^EXP-/ });
    if (linked) return res.status(409).json({ error: 'Review budget-linked expenditures from their approved budget page' });
    next();
  } catch (err) { next(err); }
};
