'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const H = require('./shared.cjs'), { reassign, counts, FROM, TO } = require('./reassign-claude-assigned-to-hermes.cjs');

const item = (id, taskKey, status) => ({ primaryId: id, kind: 'ENRICHMENT', taskKey, provider: H.TASKS[taskKey], assignmentVersion: 1, status, sourceVersion: 'v1' });
const work = () => ({
  schema: 'forge.shared-helper-work.v1', assignmentId: 'A', enabled: true, routingActive: true,
  providers: {
    FORGE_CLAUDE_SHARED_HELPER: { provider: 'Claude', available: true },
    FORGE_GROK_SHARED_HELPER: { provider: 'Grok', available: false },
    FORGE_SNIFFER_SHARED_HELPER: { provider: 'Sniffer', available: false }
  },
  items: [
    item('V2I-A', FROM, 'ASSIGNED'),
    item('V2I-B', FROM, 'PROTECTED_SKIP'),
    item('V2I-C', FROM, 'RETURNED_PENDING_REVIEW'),
    item('V2I-D', FROM, 'ASSIGNED'),
    item('V2I-E', 'FORGE_GROK_SHARED_HELPER', 'PROTECTED_SKIP'),
    item('V2I-F', 'FORGE_SNIFFER_SHARED_HELPER', 'ALREADY_COMPLETE')
  ]
});

test('moves only Claude ASSIGNED items to Hermes and leaves everything else untouched', () => {
  const w = work(), before = counts(w), r = reassign(w), after = counts(w);
  assert.equal(before.claudeAssigned, 2);
  assert.equal(r.moved, 2);
  assert.equal(after.claudeAssigned, 0);
  assert.equal(after.hermesAssigned, 2);
  assert.equal(after.protectedSkip, before.protectedSkip);
  assert.equal(w.providers[FROM].available, true, 'Claude stays available');
  assert.equal(w.providers[TO].provider, 'Hermes');
  assert.equal(w.providers[TO].available, true);
  const a = w.items.find(i => i.primaryId === 'V2I-A');
  assert.equal(a.taskKey, TO); assert.equal(a.provider, 'Hermes'); assert.equal(a.assignmentVersion, 2);
  assert.equal(a.assignmentHistory[0].provider, 'Claude');
  assert.equal(a.assignmentHistory[0].taskKey, FROM);
  assert.equal(w.items.find(i => i.primaryId === 'V2I-B').provider, 'Claude');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-B').status, 'PROTECTED_SKIP');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-C').provider, 'Claude');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-E').provider, 'Grok');
  assert.equal(w.items.find(i => i.primaryId === 'V2I-F').provider, 'Sniffer');
});

test('re-running moves nothing', () => {
  const w = work(); reassign(w); assert.equal(reassign(w).moved, 0);
});
