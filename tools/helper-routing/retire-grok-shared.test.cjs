'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const H = require('./shared.cjs'), { retire } = require('./retire-grok-shared.cjs');

const item = (id, taskKey, status) => ({ primaryId: id, kind: 'ENRICHMENT', taskKey, provider: H.TASKS[taskKey], assignmentVersion: 1, status, sourceVersion: 'v1' });
const work = () => ({
  schema: 'forge.shared-helper-work.v1', assignmentId: 'A', enabled: true, routingActive: true,
  providers: { FORGE_CLAUDE_SHARED_HELPER: { provider: 'Claude', available: true }, FORGE_GROK_SHARED_HELPER: { provider: 'Grok', available: true } },
  items: [item('V2I-A', 'FORGE_GROK_SHARED_HELPER', 'ASSIGNED'), item('V2I-B', 'FORGE_GROK_SHARED_HELPER', 'RETURNED_PENDING_REVIEW'),
    item('V2I-C', 'FORGE_CLAUDE_SHARED_HELPER', 'ASSIGNED'), item('V2I-D', 'FORGE_GROK_SHARED_HELPER', 'PROTECTED_SKIP')]
});

test('moves only ASSIGNED Grok items to Claude, keeps history, bumps version, turns Grok off', () => {
  const w = work(), r = retire(w, { at: '2026-11-17T14:30:00Z' });
  assert.equal(r.moved, 1);
  const a = w.items.find(i => i.primaryId === 'V2I-A');
  assert.equal(a.taskKey, 'FORGE_CLAUDE_SHARED_HELPER'); assert.equal(a.provider, 'Claude'); assert.equal(a.assignmentVersion, 2);
  assert.equal(a.assignmentHistory[0].provider, 'Grok');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-B').provider, 'Grok', 'returned evidence keeps its owner');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-D').provider, 'Grok');
  assert.equal(w.providers.FORGE_GROK_SHARED_HELPER.available, false);
  assert.equal(H.next(w, 'FORGE_GROK_SHARED_HELPER').items.length, 0, 'retired Grok gets no page items');
  assert.ok(H.next(w, 'FORGE_CLAUDE_SHARED_HELPER').items.some(i => i.primaryId === 'V2I-A'));
});

test('re-running moves nothing', () => {
  const w = work(); retire(w); assert.equal(retire(w).moved, 0);
});
