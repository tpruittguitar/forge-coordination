'use strict';
// node --test tools/claude-box-runner/build-prompt.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const B = require('./build-prompt.js');

const ROOT = path.resolve(__dirname, '../..');
const lanes = JSON.parse(fs.readFileSync(path.join(ROOT, 'control/CLAUDE_BOX_LANES.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'control/AI_AUTOMATION_TASKS.json'), 'utf8'));
const KEYS = Object.keys(lanes.lanes);
const env = { RUN_ID: 'FORGE-CLAUDE-BOX-TEST-20261117-1900ET', WORKDIR: '/w/repo', INSTRUCTION_COMMIT: 'abc123', PRIVATE_DIR: '/p', RUN_STARTED_UTC: '2026-11-18T00:00:00Z' };

test('shared header is 600 tokens or fewer and covers the required rules', () => {
  const h = fs.readFileSync(path.join(ROOT, lanes.common), 'utf8');
  assert.ok(B.estTokens(h) <= B.HEADER_MAX_TOKENS, 'header ' + B.estTokens(h) + ' tokens');
  for (const must of ['Claude', 'INSTRUCTION_COMMIT', 'NEVER CONSIDER FIRST', 'WRITER IS THE AUTHORITY', 'NO REPLAY',
    'receipts/CLAUDE_BOX/<TASK_KEY>/<RUN_ID>.json', 'forge.claude-box-run.v1', 'next-work.js']) assert.ok(h.includes(must), 'header lacks ' + must);
});

for (const key of KEYS) {
  test(key + ': brief <= 1500 tokens; prompt has only its own task entry and no old reads', () => {
    const r = B.buildPrompt(ROOT, key, env);
    assert.ok(B.estTokens(r.brief) <= B.BRIEF_MAX_TOKENS, key + ' brief ' + B.estTokens(r.brief) + ' tokens');
    assert.ok(r.brief.includes(key), 'brief names its task');
    assert.ok(r.prompt.includes('TASK ENTRY (control/AI_AUTOMATION_TASKS.json tasks.' + key + '): ' + JSON.stringify(registry.tasks[key])));
    assert.ok(r.prompt.includes('RUN_ID=' + env.RUN_ID) && r.prompt.includes('INSTRUCTION_COMMIT=abc123'));
    for (const other of Object.keys(registry.tasks)) {
      if (other !== key && !r.brief.includes(other)) assert.ok(!r.prompt.includes('"' + other + '"'), key + ' prompt carries the entry of ' + other);
    }
    // nothing tells the lane to read the old shared material
    assert.ok(!/Follow control\/FORGE_SHARED_AUTOMATION_ENTRY|Read registry\.common|Read it at INSTRUCTION_COMMIT|That packet is the procedure/.test(r.prompt));
    assert.ok(Buffer.byteLength(r.prompt) < 9000, key + ' prompt ' + Buffer.byteLength(r.prompt) + ' bytes');
    if (registry.tasks[key].route === 'runtime') assert.match(r.prompt, /RUNTIME MANIFEST ENTRY \(runtime\/current\.json\): \{"release_id":"[0-9a-f]+","owner":"Claude"\}/);
  });
}

test('unknown task -> exit 3 (NO_BOX_MAPPING); --meta prints model, timeout, cockpit, tools', () => {
  const run = args => cp.spawnSync(process.execPath, [path.join(__dirname, 'build-prompt.js'), ROOT, ...args], { encoding: 'utf8' });
  assert.equal(run(['NOT_A_LANE', '--meta']).status, 3);
  const meta = run(['FORGE_AI_USAGE_READER', '--meta']);
  assert.equal(meta.status, 0);
  const [model, timeout, fc, tools] = meta.stdout.trim().split('\t');
  assert.deepEqual([model, timeout, fc], ['haiku', '10', '0']);
  assert.ok(tools.split(',').includes('Bash(bash tools/claude-box-runner/claude-usage.sh)'));
});

test('run-lane.sh logs PROMPT_BYTES equal to the prompt claude receives (stubbed git/claude)', { skip: process.platform === 'win32' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runlane-'));
  const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
  const realGit = cp.execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(bin, 'git'), `#!/usr/bin/env bash
for a in "$@"; do if [ "$a" = clone ]; then cp -r "$STUB_REPO" "\${@: -1}"; exit 0; fi; [ "$a" = fetch ] && exit 0; done
exec ${realGit} "$@"
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/usr/bin/env bash\nprintf "%s" "$2" > "$STUB_OUT"\n', { mode: 0o755 });
  const repo = path.join(tmp, 'repo');   // minimal git repo holding just what the runner and builder need
  for (const rel of ['control/CLAUDE_BOX_LANES.json', 'control/AI_AUTOMATION_TASKS.json', 'runtime/current.json', lanes.common,
    lanes.lanes.FORGE_AI_USAGE_READER.procedure, 'tools/claude-box-runner/build-prompt.js']) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(repo, rel));
  }
  const g = a => cp.execFileSync(realGit, ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'ignore' });
  g(['init', '-q']); g(['add', '-A']); g(['commit', '-qm', 'fixture']);
  const home = path.join(tmp, 'home'), out = path.join(tmp, 'prompt.txt');
  const r = cp.spawnSync('bash', [path.join(__dirname, 'run-lane.sh'), 'FORGE_AI_USAGE_READER'], {
    encoding: 'utf8', env: Object.assign({}, process.env, { PATH: bin + ':' + process.env.PATH, STUB_REPO: repo, STUB_OUT: out, FORGE_LANES_HOME: home }) });
  assert.equal(r.status, 0, r.stderr);
  const logDir = path.join(home, 'logs/FORGE_AI_USAGE_READER'), log = fs.readFileSync(path.join(logDir, fs.readdirSync(logDir)[0]), 'utf8');
  const bytes = Number((/PROMPT_BYTES=(\d+)/.exec(log) || [])[1]);
  assert.equal(bytes, fs.statSync(out).size);
  assert.match(fs.readFileSync(path.join(home, 'logs/prompt-bytes.tsv'), 'utf8'), new RegExp('\\tFORGE_AI_USAGE_READER\\t\\S+\\t' + bytes + '\\n'));
  assert.match(log, /DONE rc=0/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
