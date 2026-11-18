'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const S = require('../programmed-coordinator/store.cjs'), R = require('./release-enrichment-returns.cjs');

test('releases only no-source returns stuck on WORKING_SOURCE_ROUTE_REQUIRED; re-run releases nothing', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-enrich-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const batch = 'receipts/CHATGPT_HELPERS/X/B.json';
  S.save(root, batch, { items: [{ primaryId: 'V2I-A', recommendation: 'NEEDS_SOURCE_EVIDENCE' }, { primaryId: 'V2I-B', recommendation: 'ENRICHMENT_EVIDENCE_READY' },
    { primaryId: 'V2I-C', recommendation: 'NEEDS_SOURCE_EVIDENCE' }, { primaryId: 'V2I-D', recommendation: 'NEEDS_SOURCE_EVIDENCE' }] });
  const it = (id, status = 'EXCEPTION') => ({ itemKey: id, batch, status });
  const state = { items: { 'T:V2I-A': it('V2I-A'), 'T:V2I-B': it('V2I-B'), 'T:V2I-C': it('V2I-C'), 'T:V2I-D': it('V2I-D', 'POST_IN_FLIGHT_UNKNOWN') },
    exceptions: { 'T:V2I-A': { reason: 'WORKING_SOURCE_ROUTE_REQUIRED' }, 'T:V2I-B': { reason: 'SOURCE_ROUTE_BACKOFF' }, 'T:V2I-C': { reason: 'ORIGINAL_TRANSACTION_FENCE' } } };
  const work = { items: ['V2I-A', 'V2I-B', 'V2I-C', 'V2I-D'].map(primaryId => ({ primaryId, status: 'RETURNED_PENDING_REVIEW' })) };
  const ids = R.select(root, work, state);
  assert.deepEqual([...ids], ['V2I-A'], 'fenced, ready and in-flight returns stay put');
  assert.equal(R.release(work, ids, { at: '2026-11-17T16:30:00Z' }), 1);
  assert.equal(work.items[0].status, 'RELEASED'); assert.equal(work.items[0].release.previousStatus, 'RETURNED_PENDING_REVIEW');
  assert.equal(R.release(work, R.select(root, work, state)), 0);
});
