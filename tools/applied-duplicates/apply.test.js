'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('./apply'), M = require('./match');
const line = (id, co, title, status, kv = '') => `1 | ${id} | ${co} | ${title} | ${status} | X/Y | - | UNKNOWN | UNKNOWN | ${kv}`;
const close = { id: 'V2I-A', company: 'GE Vernova', title: 'Repair Quality Leader', outcome: 'CLOSE_CANDIDATE', rule: 'SAME_BY_TIMELINE', label: 'Applied 2026-10-25 · likely the same posting', evidence: 'e1', matches: [{ id: 'V2E-B' }] };
const keep = { id: 'V2I-C', company: 'Blue Origin', title: 'Lunar Manager', outcome: 'KEEP_LABEL', rule: 'NEW_REQUISITION', label: 'Applied 2026-07-01 · Rejected 2026-08-04 · this is a new posting', evidence: 'e2', matches: [{ id: 'V2I-D' }] };
function writer(lines, replies) {
  const posts = [];
  return { posts, fetchJson: async (url, opts) => {
    if (!opts) { const ids = new URL(url).searchParams.get('ids').split(','); return { ok: true, rows: ids.map(id => lines[id] ? { primaryId: id, found: true, matches: 1, line: lines[id] } : { primaryId: id, found: false }) }; }
    const body = JSON.parse(opts.body); posts.push(body); const r = replies.shift(); if (r instanceof Error) throw r; return typeof r === 'function' ? r(body) : r;
  } };
}
const ok = body => ({ mode: 'BATCH_RULING_SINGLE_COMMIT', writeId: 'w', results: body.requests.map(() => ({ ok: true })) });
const opts = w => ({ url: 'https://w.example/exec', key: 'k', parseLine: M.parseLine, fetchJson: w.fetchJson, wait: async () => {}, today: '2026-11-03' });

test('closes same-posting rows as DUPLICATE of the decided row and labels kept rows', async () => {
  const w = writer({ 'V2I-A': line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'SCOUT_INTAKE'), 'V2I-C': line('V2I-C', 'Blue Origin', 'Lunar Manager', 'SCOUT_INTAKE') }, [ok]);
  const s = await A.apply([close, keep], opts(w));
  assert.deepEqual([s.closed, s.labeled, s.failed], [1, 1, 0]);
  const [d, l] = w.posts[0].requests.map(r => r.ruling);
  assert.equal(d.kind, 'DUPLICATE'); assert.equal(d.dupOf, 'V2E-B'); assert.equal(d.fields.DUP_DETECTED_BY, 'APPLIED-DUPLICATES-BOT');
  assert.equal(l.kind, 'ENRICH'); assert.equal(l.fields.PRIOR_APPLICATION, keep.label);
});

test('skips rows that were decided, changed, protected or already labeled since the report', async () => {
  const w = writer({
    'V2I-A': line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'APPLIED'),
    'V2I-C': line('V2I-C', 'Blue Origin', 'Lunar Manager', 'SCOUT_INTAKE', 'PRIOR_APPLICATION=' + keep.label)
  }, []);
  const s = await A.apply([close, keep], opts(w));
  assert.equal(w.posts.length, 0); assert.deepEqual(s.skipped, { NO_LONGER_ACTIVE: 1, ALREADY_LABELED: 1 });
  const p = A.plan([close], '2026-11-03')[0];
  assert.equal(A.stillApplies(p, line('V2I-A', 'GE Vernova', 'Different Title', 'SCOUT_INTAKE'), M.parseLine), 'ROW_CHANGED');
  assert.equal(A.stillApplies(p, line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'SCOUT_INTAKE', 'ANTI_RESURRECTION=YES'), M.parseLine), 'PROTECTED');
});

test('request IDs depend only on content, so a retry is idempotent', () => {
  const a = A.plan([close, keep], '2026-11-03'), b = A.plan([close, keep], '2026-11-04');
  assert.deepEqual(a.map(p => p.ruling.requestId), b.map(p => p.ruling.requestId));
  assert.notEqual(A.plan([{ ...keep, label: keep.label + ' changed' }], '2026-11-03')[0].ruling.requestId, a[1].ruling.requestId);
});

test('waits out the write fence, then defers on a lost reply without re-posting', async () => {
  const lines = { 'V2I-A': line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'SCOUT_INTAKE') };
  let w = writer(lines, [{ mode: 'WRITE_FENCE', retryAfterMs: 1000 }, ok]);
  assert.equal((await A.apply([close], opts(w))).closed, 1); assert.equal(w.posts.length, 2);
  w = writer(lines, [new Error('HTTP 404')]);
  const s = await A.apply([close], opts(w));
  assert.equal(w.posts.length, 1); assert.equal(s.deferred, 1); assert.equal(s.closed, 0);
});

test('an ok result without a committed write is not counted as written', async () => {
  const w = writer({ 'V2I-A': line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'SCOUT_INTAKE') }, [{ mode: 'BATCH_RULING_RETRY', results: [{ ok: true }] }]);
  const s = await A.apply([close], opts(w));
  assert.equal(s.closed, 0); assert.equal(s.deferred, 1);
});
