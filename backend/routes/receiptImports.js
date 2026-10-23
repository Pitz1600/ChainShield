const express = require('express');
const multer = require('multer');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { requireOfficial } = require('../middleware/roleMiddleware');
const store = require('../services/localImportReceiptStore');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 0, parts: 10 } }).array('receipts', 10);
const guard = [(req, res, next) => { req.receiptReadOnly = true; next(); }, auth];
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
// Existing transaction detail endpoint permits all authenticated staff roles to view
// staged and archived rows. Require the exact group's complete set of existing rows.
async function authorizeGroup(id) {
  const group = await store.read(id);
  if (!group.transactionIds.length || await Transaction.countDocuments({ transactionId: { $in: group.transactionIds } }) !== group.transactionIds.length) {
    throw Object.assign(new Error('CSV import unavailable'), { status: 404 });
  }
  return group;
}
router.get('/receipt-imports', ...guard, wrap(async (req, res) => {
  const groups = [];
  for (const m of await store.list()) {
    try { groups.push(store.publicGroup(await authorizeGroup(m.importId))); }
    catch (err) { if (err.status !== 404) throw err; }
  }
  res.json({ imports: groups.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)) });
}));
router.post('/receipt-imports/:importId/receipts', ...guard, requireOfficial,
  wrap(async (req, res) => { await authorizeGroup(req.params.importId); await new Promise((resolve, reject) => upload(req, res, err => err ? reject(err) : resolve())); res.json(store.publicGroup(await store.add(req.params.importId, req.files, req.user._id))); }));
router.get('/transactions/:txId/import-receipts', ...guard, wrap(async (req, res) => {
  if (!/^[0-9a-f]{24}$/i.test(req.params.txId)) return res.status(400).json({ error: 'Invalid transaction identifier' });
  const tx = await Transaction.findById(req.params.txId).select('transactionId').lean();
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  const group = (await store.list()).find(m => m.transactionIds.includes(tx.transactionId));
  res.json({ group: group ? store.publicGroup(await authorizeGroup(group.importId)) : null });
}));
router.get('/receipt-imports/:importId/receipts/:receiptId/file', ...guard, wrap(async (req, res) => {
  const group = await authorizeGroup(req.params.importId);
  const receipt = group.receipts.find(r => r.receiptId === req.params.receiptId);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  res.set({ 'Content-Type': receipt.mimeType, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store' });
  res.attachment(receipt.originalName);
  res.sendFile(store.filePath(group.importId, receipt), err => { if (err && !res.headersSent) res.status(404).json({ error: 'Receipt file unavailable' }); });
}));
router.use((err, req, res, next) => {
  if (!req.receiptReadOnly) return next(err);
  console.error('Receipt request failed:', err.message);
  res.status(err.status || (err instanceof multer.MulterError ? 400 : 500)).json({ error: err.status || err instanceof multer.MulterError ? err.message : 'Receipt storage unavailable' });
});
module.exports = router;
