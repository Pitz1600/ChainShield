const { test } = require('node:test');
const assert = require('node:assert/strict');
const Transaction = require('../models/Transaction');
const controller = require('../controllers/transactionController');

test('review details record reviewer and time, and clear both on undo', async () => {
  const original = Transaction.findById;
  const transaction = { _id: 'record', remarks: [], flagged: false, save: async () => {} };
  Transaction.findById = async () => transaction;
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  const req = { params: { id: 'record' }, user: { firstName: 'Ana', lastName: 'Santos' }, body: { status: 'Verified' } };
  try {
    await controller.updateVerificationStatus(req, res);
    assert.equal(transaction.verifiedBy, 'Ana Santos');
    assert.ok(transaction.verifiedAt instanceof Date);
    assert.equal(res.body.transaction.verifiedAt, transaction.verifiedAt);
    req.body.status = 'Pending';
    await controller.updateVerificationStatus(req, res);
    assert.equal(transaction.verifiedBy, undefined);
    assert.equal(transaction.verifiedAt, undefined);
    assert.equal(res.body.transaction.verifiedAt, null);
    await controller.approveTransaction(req, res);
    assert.equal(transaction.verifiedBy, 'Ana Santos');
    assert.ok(transaction.verifiedAt instanceof Date);
    assert.equal(res.body.transaction.verifiedAt, transaction.verifiedAt);
  } finally { Transaction.findById = original; }
});

test('history summaries preserve currency and reviewer metadata for detail views', async () => {
  const originalFind = Transaction.find;
  const originalCount = Transaction.countDocuments;
  const reviewedAt = new Date('2026-10-17T01:00:00Z');
  const records = [{ _id: 'record', amount: 25, currency: 'EUR', verifiedBy: 'Ana Santos', verifiedAt: reviewedAt }];
  const query = { sort() { return this; }, limit() { return this; }, skip() { return this; }, select() { return Promise.resolve(records); } };
  Transaction.find = () => query;
  Transaction.countDocuments = async () => records.length;
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  try {
    await controller.getMyTransactions({ query: {}, user: { role: 'barangay_official' } }, res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.transactions[0].currency, 'EUR');
    assert.equal(res.body.transactions[0].verifiedBy, 'Ana Santos');
    assert.equal(res.body.transactions[0].verifiedAt, reviewedAt);
  } finally { Transaction.find = originalFind; Transaction.countDocuments = originalCount; }
});
