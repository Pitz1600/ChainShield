import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryReadRequest } from '../src/utils/retryReadRequest.js';
test('ledger reads recover from backend restarts and Vite proxy failures', async () => {
  for (const error of [{ code: 'ERR_NETWORK' }, { response: { status: 500, data: '' } }, { response: { status: 502 } }, { response: { status: 503 } }]) {
    let calls = 0; const waits = [];
    const result = await retryReadRequest(async () => { if (++calls < 3) throw error; return { transactions: ['saved-import'] }; }, { wait: async ms => waits.push(ms) });
    assert.equal(calls, 3); assert.deepEqual(waits, [750, 1500]);
    assert.deepEqual(result.transactions, ['saved-import']);
  }
});
test('retries stop at the bound and never retry permissions, validation, cancellations, or application errors', async () => {
  let calls = 0; const error = { code: 'ERR_NETWORK' };
  await assert.rejects(retryReadRequest(async () => { calls++; throw error; }, { wait: async () => {} }), e => e === error);
  assert.equal(calls, 5);
  for (const error of [{ response: { status: 400 } }, { response: { status: 401 } }, { response: { status: 403 } }, { response: { status: 404 } }, { response: { status: 500, data: { error: 'Storage unavailable' } } }, { code: 'ERR_CANCELED', request: {} }]) {
    let calls = 0;
    await assert.rejects(retryReadRequest(async () => { calls++; throw error; }, { wait: async () => assert.fail('unexpected retry') }), e => e === error);
    assert.equal(calls, 1);
  }
});
