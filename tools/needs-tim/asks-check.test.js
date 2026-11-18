'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { check } = require('./asks-check.js');
const SCRIPT = path.join(__dirname, 'asks-check.js');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asks-check-'));
  fs.mkdirSync(path.join(root, 'asks', 'open'), { recursive: true });
  fs.mkdirSync(path.join(root, 'asks', 'resolved'), { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.com');
  fs.writeFileSync(path.join(root, 'asks', 'open', 'ASK-1.json'), JSON.stringify({ id: 'ASK-1', title: 'Q?' }) + '\n');
  git('add', '-A'); git('commit', '-qm', 'raise ASK-1');
  return { root, git };
}
const run = root => { try { return { code: 0, out: execFileSync('node', [SCRIPT, root], { encoding: 'utf8', stdio: 'pipe' }) }; } catch (e) { return { code: e.status, out: String(e.stderr) }; } };

test('resolve with git mv removes the open file in the same commit and the check is green', () => {
  const { root, git } = fixture();
  git('mv', 'asks/open/ASK-1.json', 'asks/resolved/ASK-1.json');
  const p = path.join(root, 'asks', 'resolved', 'ASK-1.json');
  fs.writeFileSync(p, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(p, 'utf8')), { resolvedAt: '2026-11-18T00:10:00-05:00', resolvedBy: 'ROOT', ruling: 'test' })) + '\n');
  git('add', '-A'); git('commit', '-qm', 'resolve ASK-1');
  const changed = git('show', '--name-status', '--format=', 'HEAD').trim();
  assert.match(changed, /asks\/open\/ASK-1\.json/);
  assert.ok(!fs.existsSync(path.join(root, 'asks', 'open', 'ASK-1.json')));
  assert.deepStrictEqual(check(root), []);
  assert.strictEqual(run(root).code, 0);
});

test('a planted duplicate (same file name) makes the check red', () => {
  const { root } = fixture();
  fs.copyFileSync(path.join(root, 'asks', 'open', 'ASK-1.json'), path.join(root, 'asks', 'resolved', 'ASK-1.json'));
  assert.strictEqual(check(root).length, 1);
  const r = run(root); assert.strictEqual(r.code, 1); assert.match(r.out, /DUPLICATE asks\/open\/ASK-1\.json/);
});

test('a planted duplicate under a different file name but the same id makes the check red', () => {
  const { root } = fixture();
  fs.writeFileSync(path.join(root, 'asks', 'resolved', 'OTHER.json'), JSON.stringify({ id: 'ASK-1', ruling: 'x' }) + '\n');
  assert.strictEqual(run(root).code, 1);
});
