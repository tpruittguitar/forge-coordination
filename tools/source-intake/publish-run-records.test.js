'use strict';
// publish-run-records.sh against a temp clone and a local bare remote (no network, no GitHub). cs-59c4d9d5.
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const SCRIPT = path.join(__dirname, 'publish-run-records.sh');
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', INTAKE_PUBLISH_NO_SLEEP: '1' };
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-run-records-'));
  const remote = path.join(root, 'remote.git'), seed = path.join(root, 'seed'), work = path.join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'main', remote);
  git(root, 'init', '-q', '-b', 'main', seed);
  write(seed, 'tools/upstream-ledger/store.cjs', "module.exports={readDrain:(r)=>JSON.parse(require('fs').readFileSync(r+'/state/INTAKE_DRAIN.json','utf8'))};\n");
  write(seed, 'state/INTAKE_DRAIN.json', '{"v":"base"}\n');
  write(seed, 'state/intake-drain-archive/a.json', '{"a":"base"}\n');
  write(seed, 'receipts/auto-intake/OLD.json', '{"old":true}\n');
  write(seed, 'other.txt', 'base\n');
  git(seed, 'add', '-A'); git(seed, 'commit', '-q', '-m', 'seed'); git(seed, 'remote', 'add', 'origin', remote); git(seed, 'push', '-q', 'origin', 'main');
  git(root, 'clone', '-q', remote, work);
  const other = (mutate) => {
    const dir = fs.mkdtempSync(path.join(root, 'other-'));
    git(root, 'clone', '-q', remote, dir); mutate(dir);
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'other writer'); git(dir, 'push', '-q', 'origin', 'main');
  };
  const show = (file) => git(root, '--git-dir', remote, 'show', 'main:' + file);
  const run = () => spawnSync('bash', [SCRIPT], { cwd: work, env: ENV, encoding: 'utf8' });
  const thisRun = () => { write(work, 'receipts/auto-intake/R1.json', '{"run":1}\n'); write(work, 'state/INTAKE_DRAIN.json', '{"v":"run"}\n'); };
  return { root, remote, work, other, show, run, thisRun };
}

test('a) first push succeeds: receipts and drain land', () => {
  const f = fixture(); f.thisRun();
  const r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(f.show('receipts/auto-intake/R1.json'), '{"run":1}');
  assert.strictEqual(f.show('state/INTAKE_DRAIN.json'), '{"v":"run"}');
});

test('b) rejected push, drain unchanged on main: retry publishes receipts and this run drain, keeps the other commit', () => {
  const f = fixture(); f.thisRun();
  f.other((dir) => write(dir, 'other.txt', 'main moved\n'));
  const r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(f.show('receipts/auto-intake/R1.json'), '{"run":1}');
  assert.strictEqual(f.show('state/INTAKE_DRAIN.json'), '{"v":"run"}');
  assert.strictEqual(f.show('other.txt'), 'main moved');
});

test('c) rejected push, drain changed on main: receipts land, main drain is kept, exit 0', () => {
  const f = fixture(); f.thisRun();
  f.other((dir) => { write(dir, 'state/INTAKE_DRAIN.json', '{"v":"main"}\n'); write(dir, 'state/intake-drain-archive/a.json', '{"a":"main"}\n'); });
  const r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(f.show('receipts/auto-intake/R1.json'), '{"run":1}');
  assert.strictEqual(f.show('state/INTAKE_DRAIN.json'), '{"v":"main"}');
  assert.strictEqual(f.show('state/intake-drain-archive/a.json'), '{"a":"main"}');
  assert.match(r.stderr, /Leaving the drain to main/);
  assert.doesNotMatch(r.stderr, /Rebuild validation/);
});

test('d) an already-committed unpushed run record on a clean index is still pushed', () => {
  const f = fixture(); f.thisRun();
  git(f.work, 'add', '-A'); git(f.work, 'commit', '-q', '-m', 'AUTO-INTAKE-BOT: run record');
  f.other((dir) => write(dir, 'other.txt', 'main moved\n'));
  const r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(f.show('receipts/auto-intake/R1.json'), '{"run":1}');
  assert.strictEqual(f.show('state/INTAKE_DRAIN.json'), '{"v":"run"}');
  assert.strictEqual(f.show('other.txt'), 'main moved');
  assert.match(r.stderr, /Re-publishing 1 unpushed run record/);
});

test('e) exhausted bounded retries exit 1', () => {
  const f = fixture(); f.thisRun();
  write(f.remote, 'hooks/pre-receive', '#!/bin/sh\nexit 1\n'); fs.chmodSync(path.join(f.remote, 'hooks/pre-receive'), 0o755);
  const r = f.run();
  assert.strictEqual(r.status, 1, r.stderr);
  assert.match(r.stderr, /after 6 attempts/);
  assert.throws(() => f.show('receipts/auto-intake/R1.json'));
});

test('f) no receipts/auto-intake dir, or nothing to publish: exit 0 and main is untouched', () => {
  const f = fixture();
  const head = git(f.root, '--git-dir', f.remote, 'rev-parse', 'main');
  let r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  fs.rmSync(path.join(f.work, 'receipts'), { recursive: true });
  r = f.run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(git(f.root, '--git-dir', f.remote, 'rev-parse', 'main'), head);
});
