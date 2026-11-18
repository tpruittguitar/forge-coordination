'use strict';
// node --test tools/claude-box-runner/next-work.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { nextWork, parseArgs } = require('./next-work.js');

const data = {
  meta: { tags: ['a', 'b'] },
  items: [
    { primaryId: 'V1', status: 'OPEN', retryAt: '2026-11-03', note: 'x'.repeat(400) },
    { primaryId: 'V2', status: 'DONE', retryAt: '2026-11-01' },
    { primaryId: 'V3', status: 'OPEN' },
    { primaryId: 'V4', status: 'OPEN', retryAt: '2026-11-02' },
  ],
};
const opt = extra => Object.assign({ n: 10, path: null, where: [], sort: null, fields: null }, extra);

test('auto-picks the largest list, filters, limits and trims', () => {
  const r = nextWork(data, opt({ n: 2, where: ['status=OPEN'] }));
  assert.deepEqual(r.head, { path: 'items', total: 4, matched: 3, shown: 2 });
  assert.deepEqual(r.items.map(i => i.primaryId), ['V1', 'V3']);
  assert.equal(r.items[0].note.length, 301);   // 300 chars + ellipsis
});

test('sort ascending with missing values last; != filter; fields projection', () => {
  const r = nextWork(data, opt({ sort: 'retryAt', where: ['status!=DONE'], fields: ['primaryId'] }));
  assert.deepEqual(r.items, [{ primaryId: 'V4' }, { primaryId: 'V1' }, { primaryId: 'V3' }]);
});

test('object maps become items with _key; explicit --path; empty-value match', () => {
  const m = { cases: { k1: { reason: 'A' }, k2: { reason: 'B', owner: 'Claude' }, k3: { reason: 'C' } } };
  const r = nextWork(m, opt({ where: ['owner='], fields: ['reason'] }));
  assert.deepEqual(r.head, { path: 'cases', total: 3, matched: 2, shown: 2 });
  assert.deepEqual(r.items, [{ _key: 'k1', reason: 'A' }, { _key: 'k3', reason: 'C' }]);
  assert.equal(nextWork(data, opt({ path: 'meta.tags' })).head.total, 2);
  assert.throws(() => nextWork(data, opt({ path: 'nope.x' })), /path not found/);
});

test('CLI prints a header line plus N lines and rejects bad options', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nw-')), 'w.json');
  fs.writeFileSync(f, JSON.stringify(data));
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'next-work.js'), f, '--n', '1', '--fields', 'primaryId'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].total, 4);
  assert.deepEqual(lines[1], { primaryId: 'V1' });
  assert.throws(() => parseArgs([f, '--bogus']), /unknown option/);
  assert.throws(() => parseArgs([f, '--n', '-1']), /non-negative/);
  assert.equal(cp.spawnSync(process.execPath, [path.join(__dirname, 'next-work.js')], { encoding: 'utf8' }).status, 2);
});
