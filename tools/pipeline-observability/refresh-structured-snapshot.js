'use strict';

const writer = require('../source-intake/writer-reader');

const BASE = 'https://foreman-cockpit.pages.dev/api/structured';
const MAX_AGE_MS = 60 * 60 * 1000;
const validCount = n => Number.isSafeInteger(n) && n >= 0;

async function readLiveCount(key) {
  const { data } = await writer.read('master', { key });
  return writer.parseMaster(data.text).length;
}

async function refresh({
  key = process.env.FORGE_WRITER_KEY,
  force = false,
  fetch = globalThis.fetch,
  liveCount = readLiveCount,
  now = Date.now,
} = {}) {
  const summary = { check: 'structured-snapshot-refresh' };
  const fail = (stage, error) => ({ ...summary, status: 'failed', stage, error });
  const request = (path, options, timeout) =>
    fetch(BASE + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(timeout) });

  if (!key) return fail('configuration', 'FORGE_WRITER_KEY_MISSING');

  let health;
  try {
    const response = await request('/health', { method: 'GET' }, 10_000);
    if (!response.ok) summary.healthError = 'HTTP_' + response.status;
    else {
      const data = await response.json();
      if (data?.ok === true && (data.dataAvailable === false ||
          (data.dataAvailable === true && validCount(data.snapshot?.jobs)))) health = data;
      else summary.healthError = 'INVALID_RESPONSE';
    }
  } catch {
    summary.healthError = 'REQUEST_OR_JSON_FAILED';
  }
  if (!health && !force) return fail('health', summary.healthError);

  const snapshot = health?.snapshot;
  summary.snapshotJobs = snapshot?.jobs ?? null;
  // Writer imports expose generatedAt in health, but do not expose storedAt.
  const timestamp = snapshot?.meta?.storedAt ?? snapshot?.storedAt ?? snapshot?.generatedAt;
  const ageMs = now() - Date.parse(timestamp);
  summary.snapshotAgeMinutes = Number.isFinite(ageMs) ? Math.floor(ageMs / 60_000) : null;

  if (force) summary.reason = 'forced';
  else if (!health.dataAvailable) summary.reason = 'missing';
  else if (!Number.isFinite(ageMs) || ageMs < 0) summary.reason = 'invalid-timestamp';
  else if (ageMs > MAX_AGE_MS) summary.reason = 'stale';

  // A known stale or missing snapshot already needs importing. Only read the
  // live master separately when count comparison can change the decision.
  if (!summary.reason) {
    try {
      summary.liveJobs = await liveCount(key);
      if (!validCount(summary.liveJobs)) return fail('live-master', 'INVALID_COUNT');
    } catch {
      return fail('live-master', 'READ_FAILED');
    }
    if (summary.snapshotJobs === summary.liveJobs) return { ...summary, status: 'current' };
    summary.reason = 'count-mismatch';
  }

  try {
    const response = await request('/admin/import-from-writer', {
      method: 'POST',
      headers: { 'x-writer-key': key },
    }, 60_000);
    if (!response.ok) return fail('import', 'HTTP_' + response.status);
    const result = await response.json();
    if (result?.ok !== true || result.imported !== true || result.stored !== true ||
        !validCount(result.jobs)) return fail('import', 'SNAPSHOT_NOT_CONFIRMED');
    return { ...summary, status: 'refreshed', importedJobs: result.jobs };
  } catch {
    return fail('import', 'REQUEST_OR_JSON_FAILED');
  }
}

async function main() {
  const summary = await refresh({ force: process.argv.includes('--force') });
  console.log(JSON.stringify(summary));
  if (summary.status === 'failed') process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { refresh };
