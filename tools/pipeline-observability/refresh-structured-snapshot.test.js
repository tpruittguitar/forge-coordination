'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { refresh } = require('./refresh-structured-snapshot');

const NOW = Date.parse('2026-11-27T13:00:00Z');
const minutesAgo = minutes => new Date(NOW - minutes * 60_000).toISOString();
const healthy = (jobs, times = {}) => ({
  ok: true,
  dataAvailable: true,
  snapshot: { jobs, generatedAt: minutesAgo(10), ...times },
});

async function run({ health = healthy(8000), imported = { ok: true, imported: true, stored: true, jobs: 8000 },
  live = async () => 8000, key = 'test-secret', force = false } = {}) {
  const calls = [];
  const result = await refresh({
    key,
    force,
    now: () => NOW,
    liveCount: async passedKey => {
      assert.equal(passedKey, key);
      calls.push('master');
      return live();
    },
    fetch: async (url, options) => {
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      const base = 'https://foreman-cockpit.pages.dev/api/structured';
      if (options.method === 'GET') {
        assert.equal(url, base + '/health');
        assert.equal(options.headers, undefined);
        calls.push('health');
        return health instanceof Response ? health : Response.json(health);
      }
      assert.equal(options.method, 'POST');
      assert.equal(url, base + '/admin/import-from-writer');
      assert.deepEqual(options.headers, { 'x-writer-key': key });
      calls.push('import');
      return imported instanceof Response ? imported : Response.json(imported);
    },
  });
  assert.ok(!JSON.stringify(result).includes('test-secret'));
  return { result, calls };
}

test('fresh snapshot with matching live count does not import', async () => {
  const { result, calls } = await run();
  assert.equal(result.status, 'current');
  assert.deepEqual(calls, ['health', 'master']);
});

test('fresh snapshot with 7851 vs 8000 live jobs imports', async () => {
  const { result, calls } = await run({ health: healthy(7851) });
  assert.equal(result.status, 'refreshed');
  assert.equal(result.reason, 'count-mismatch');
  assert.equal(result.snapshotJobs, 7851);
  assert.equal(result.liveJobs, 8000);
  assert.equal(result.importedJobs, 8000);
  assert.deepEqual(calls, ['health', 'master', 'import']);
});

for (const [reason, health] of [
  ['missing', { ok: true, dataAvailable: false, snapshot: null }],
  ['stale', healthy(7851, { generatedAt: minutesAgo(38 * 60) })],
  ['invalid-timestamp', healthy(8000, { generatedAt: '' })],
]) {
  test(reason + ' snapshot triggers import without a separate master read', async () => {
    const { result, calls } = await run({ health });
    assert.equal(result.status, 'refreshed');
    assert.equal(result.reason, reason);
    assert.deepEqual(calls, ['health', 'import']);
  });
}

test('storedAt takes precedence over generatedAt when present', async () => {
  const { result } = await run({
    health: healthy(8000, { generatedAt: minutesAgo(61), meta: { storedAt: minutesAgo(60) } }),
  });
  assert.equal(result.status, 'current');
});

test('force imports even when health is unavailable', async () => {
  const { result, calls } = await run({ force: true, health: new Response(null, { status: 503 }) });
  assert.equal(result.status, 'refreshed');
  assert.equal(result.reason, 'forced');
  assert.equal(result.healthError, 'HTTP_503');
  assert.deepEqual(calls, ['health', 'import']);
});

test('health errors do not trigger an import', async () => {
  for (const [health, error] of [
    [new Response(null, { status: 503 }), 'HTTP_503'],
    [new Response('<html>'), 'REQUEST_OR_JSON_FAILED'],
    [{ ok: true }, 'INVALID_RESPONSE'],
  ]) {
    const { result, calls } = await run({ health });
    assert.equal(result.status, 'failed');
    assert.equal(result.stage, 'health');
    assert.equal(result.error, error);
    assert.deepEqual(calls, ['health']);
  }
});

test('Writer read failure is reported without an import or credential leakage', async () => {
  const { result, calls } = await run({ live: async () => { throw Error('test-secret'); } });
  assert.equal(result.status, 'failed');
  assert.equal(result.stage, 'live-master');
  assert.deepEqual(calls, ['health', 'master']);
});

test('import must confirm it stored the snapshot', async () => {
  for (const [imported, error] of [
    [new Response(null, { status: 502 }), 'HTTP_502'],
    [{ ok: true, imported: true, stored: false, jobs: 8000 }, 'SNAPSHOT_NOT_CONFIRMED'],
  ]) {
    const { result } = await run({ force: true, imported });
    assert.equal(result.status, 'failed');
    assert.equal(result.stage, 'import');
    assert.equal(result.error, error);
  }
});

test('CLI emits one JSON line and exits nonzero without a key', () => {
  assert.throws(() => execFileSync(process.execPath, [require.resolve('./refresh-structured-snapshot')], {
    encoding: 'utf8', env: { ...process.env, FORGE_WRITER_KEY: '' },
  }), error => {
    assert.equal(error.status, 1);
    assert.equal(error.stdout.trim().split('\n').length, 1);
    assert.equal(JSON.parse(error.stdout).error, 'FORGE_WRITER_KEY_MISSING');
    return true;
  });
});
