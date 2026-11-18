'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const cp = require('node:child_process');
const S = require('../programmed-coordinator/store.cjs');
const H = require('./shared.cjs');
const R = require('./retire-grok-shared.cjs');
const P = require('./shared-pages.cjs');

function clone(root) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-retire-grok-'));
  cp.execFileSync('cp', ['-R', root + '/.', tmp]);
  return tmp;
}

test('retire moves only assigned Grok items and keeps others', () => {
  const root = clone(path.resolve(__dirname, '../..'));
  const work = S.read(root, H.FILE);
  const grokAssigned = work.items.filter(i => i.taskKey === R.FROM && i.status === 'ASSIGNED');
  const grokOther = work.items.filter(i => i.taskKey === R.FROM && i.status !== 'ASSIGNED');
  const result = R.retire(work);
  assert.equal(result.moved, grokAssigned.length);
  assert.deepEqual(result.movedKeys.sort(), grokAssigned.map(H.key).sort());
  assert.ok(work.providers[R.TO]);
  assert.equal(work.providers[R.FROM].available, false);
  assert.equal(work.providers[R.FROM].readiness, 'RETIRED');
  assert.ok(work.providers[R.TO].provider === 'ChatGPT');
  assert.ok(work.providers[R.TO].readiness);
  assert.deepEqual(work.items.filter(i => i.taskKey === R.FROM && i.status !== 'ASSIGNED').map(H.key).sort(), grokOther.map(H.key).sort());
  assert.ok(work.items.filter(i => i.taskKey === R.TO && i.status === 'ASSIGNED').length >= grokAssigned.length);
  H.validateWork(work);
});

test('second run moves 0 and validateWork passes', () => {
  const root = clone(path.resolve(__dirname, '../..'));
  const work = S.read(root, H.FILE);
  R.retire(work);
  const second = R.retire(work);
  assert.equal(second.moved, 0);
  H.validateWork(work);
});

test('shared-assignments does not assign new items to Grok after retirement', () => {
  const root = clone(path.resolve(__dirname, '../..'));
  const work = S.read(root, H.FILE);
  R.retire(work);
  S.save(root, H.FILE, work);
  P.generate(root, { checkLock: () => {} });
  const refreshed = S.read(root, H.FILE);
  const next = H.next(refreshed, R.FROM, null, Date.now());
  assert.equal(next.items.length, 0);
});
