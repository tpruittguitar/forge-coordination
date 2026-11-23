'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pick } = require('./kick');
const now = Date.parse('2026-11-23T00:30:00Z');
const run = (status, minsAgo) => ({ status, created_at: new Date(now - minsAgo * 60000).toISOString() });

test('dispatches the most overdue workflow, one at a time, and waits while the group is busy', () => {
  const wv = r => ({ workflow: 'writer-verify.yml', maxMinutes: 35, run: r });
  const rr = r => ({ workflow: 'receipt-recovery.yml', maxMinutes: 65, run: r });
  assert.equal(pick([wv(run('completed', 200)), rr(run('completed', 360))], now), 'receipt-recovery.yml');
  assert.equal(pick([wv(run('completed', 10)), rr(run('completed', 30))], now), null);
  assert.equal(pick([wv(run('in_progress', 2)), rr(run('completed', 360))], now), null);
  assert.equal(pick([wv(run('queued', 16000)), rr(run('completed', 360))], now), 'writer-verify.yml'); // a ghost queued run does not block
  assert.equal(pick([wv(null), rr(run('completed', 5))], now), 'writer-verify.yml');
});
