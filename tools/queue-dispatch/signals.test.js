'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { parseStamp, collect } = require('./signals');

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-queue-dispatch-'));
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('parseStamp accepts ISO and compact run stamps', () => {
  assert.equal(parseStamp('2026-11-17T23:37:33Z'), Date.parse('2026-11-17T23:37:33Z'));
  assert.equal(parseStamp('20261117T235621Z'), Date.parse('2026-11-17T23:56:21Z'));
  assert.equal(parseStamp('20261118T061743371Z'), Date.parse('2026-11-18T06:17:43.371Z'));
});

test('intake collect reads waiting and this-run insertedIds only', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'receipts/auto-intake'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state/UPSTREAM_FLOW.json'), JSON.stringify({
    schema: 'forge.upstream-flow.v1', waiting: 922, counts: { WAITING: 406 }
  }));
  fs.writeFileSync(path.join(root, 'receipts/auto-intake/FORGE-AUTO-20261117T134156Z.json'), JSON.stringify({
    sourceRunId: 'FORGE-AUTO-20261117T134156Z',
    reconciliation: { insertedIds: ['V2I-OLD'], beforeCount: 1, afterCount: 2 }
  }));
  fs.writeFileSync(path.join(root, 'receipts/auto-intake/FORGE-AUTO-20261117T235621Z.json'), JSON.stringify({
    sourceRunId: 'FORGE-AUTO-20261117T235621Z',
    reconciliation: { insertedIds: ['V2I-A', 'V2I-B'], beforeCount: 9245, afterCount: 9260 }
  }));
  fs.writeFileSync(path.join(root, 'receipts/auto-intake/FORGE-AUTO-20261117T235621Z.candidates.json'), JSON.stringify([{ id: 1 }]));
  const since = Date.parse('2026-11-17T23:37:33Z');
  assert.deepEqual(collect('source-intake-auto', root, since), {
    lane: 'source-intake-auto', waiting: 922, wroteRows: 2, flowPresent: true
  });
}));

test('enrich collect uses this-run report fields and ignores a stale report', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  const report = {
    at: '2026-11-18T06:27:09.810Z',
    run: 'FORGE-ENRICH_ATS-ATSBOT-20261118T061743371Z',
    not_attempted: 528,
    research_budget_exhausted: false
  };
  fs.writeFileSync(path.join(root, 'state/enrich-ats-pay-report.json'), JSON.stringify(report));
  assert.deepEqual(collect('enrich-ats-pay', root, Date.parse('2026-11-18T06:14:01Z')), {
    lane: 'enrich-ats-pay', fromThisRun: true, notAttempted: 528, researchBudgetExhausted: false
  });
  assert.deepEqual(collect('enrich-ats-pay', root, Date.parse('2026-11-18T06:30:00Z')), {
    lane: 'enrich-ats-pay', fromThisRun: false
  });
}));

test('missing since does not count leftover receipts or reports as this run', () => fixture(root => {
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'receipts/auto-intake'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state/UPSTREAM_FLOW.json'), JSON.stringify({
    schema: 'forge.upstream-flow.v1', waiting: 922
  }));
  fs.writeFileSync(path.join(root, 'receipts/auto-intake/FORGE-AUTO-20261117T235621Z.json'), JSON.stringify({
    reconciliation: { insertedIds: ['V2I-A'] }
  }));
  fs.writeFileSync(path.join(root, 'state/enrich-ats-pay-report.json'), JSON.stringify({
    at: '2026-11-18T06:27:09.810Z', not_attempted: 528, research_budget_exhausted: false
  }));
  assert.deepEqual(collect('source-intake-auto', root, NaN), {
    lane: 'source-intake-auto', waiting: 922, wroteRows: 0, flowPresent: true
  });
  assert.deepEqual(collect('enrich-ats-pay', root, NaN), {
    lane: 'enrich-ats-pay', fromThisRun: false
  });
}));
