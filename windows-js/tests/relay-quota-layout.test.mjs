import test from 'node:test';
import assert from 'node:assert/strict';
import {formatQuota} from '../src/core/quota.mjs';

test('relay amounts fit in a single row and keep full precision in tooltips', () => {
  const now = Date.now();
  const view = formatQuota({source:'api-balance', queryOk:true, observedAt:now,
    balance:{amount:12.04419348, todaySpent:1.60932714, currency:'USD'}}, 'countdown', now);
  assert.equal(view.header, 'API 余额 · USD');
  assert.deepEqual(view.rows.map(row => row.leftText), ['12.0442', '1.6093']);
  assert.deepEqual(view.rows.map(row => row.tooltip), ['12.04419348 USD', '1.60932714 USD']);
});
