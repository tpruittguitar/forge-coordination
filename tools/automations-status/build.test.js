// node --test tools/automations-status/build.test.js   (EXAMPLE inputs only)
const test = require('node:test'), assert = require('node:assert/strict');
const B = require('./build.js');
const NOW = Date.parse('2026-11-16T12:30:00Z'); // 7:30 AM ET
test('result mapping', () => {
  assert.deepEqual(['OK', 'PARTIAL_WITH_PENDING_COORDINATOR_CONSUMPTION', 'DEFERRED_SHARED_LOCK', 'NO_WORK', 'CHROME_UNAVAILABLE', '', 'WEIRD'].map(B.mapResult), ['OK', 'OK', 'SKIP', 'EMPTY', 'FAIL', 'EMPTY', 'SKIP']);
});
test('next-run computation from RRULE and schedule intent (ET, DST-aware)', () => {
  const daily = B.parseSchedule('RRULE:FREQ=DAILY;BYHOUR=2,8,14,20;BYMINUTE=5;BYSECOND=0');
  assert.equal(new Date(B.nextRun(daily, NOW)).toISOString(), '2026-11-16T13:05:00.000Z');
  const hourly = B.parseSchedule('Hourly at minute 12, America/New_York');
  assert.equal(new Date(B.nextRun(hourly, NOW)).toISOString(), '2026-11-16T13:12:00.000Z');
  assert.equal(B.intervalMs(daily), 6 * 3600000);
  assert.equal(B.parseSchedule({ frequency: 'HOURLY', minute: 25 }).minutes[0], 25);
  const summer = Date.parse('2026-07-01T12:30:00Z');
  assert.equal(new Date(B.nextRun(daily, summer)).toISOString(), '2026-07-01T12:05:00.000Z'.replace('12:05', '18:05'));
});
test('staleness: older than two intervals is STALE, never OK', () => {
  const tasks = { tasks: { EX_A: { owner: 'ChatGPT' }, EX_GONE: { owner: 'Grok', retired: true } } };
  const readback = { local: [{ id: 'ex-a', taskKey: 'EX_A', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=0' }] };
  const fresh = B.build({ tasks, readback, evidence: { schedules: { active: [{ id: 'ex-a', lastRunAt: '2026-11-16T12:00:30Z', status: 'OK' }] } } }, NOW);
  assert.equal(fresh.automations.length, 1, 'retired tasks dropped'); assert.equal(fresh.automations[0].result, 'OK');
  const old = B.build({ tasks, readback, evidence: { schedules: { active: [{ id: 'ex-a', lastRunAt: '2026-11-16T09:00:00Z', status: 'OK' }] } } }, NOW);
  assert.deepEqual([old.automations[0].result, old.automations[0].stale], ['STALE', true]);
});
test('runs cover yesterday, today and tomorrow (ET days) and mark writer-touching tasks', () => {
  const out = B.build({ tasks: { tasks: { FORGE_APPLICATION_WRITER_GOFER: { owner: 'ChatGPT' } } }, readback: { local: [{ id: 'g', taskKey: 'FORGE_APPLICATION_WRITER_GOFER', status: 'ACTIVE', rrule: 'RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=0' }] } }, NOW);
  assert.equal(out.runs.length, 3); assert.ok(out.runs.every(r => r.writer));
  assert.deepEqual(out.runs.map(r => r.start), ['2026-11-15T14:00:00.000Z', '2026-11-16T14:00:00.000Z', '2026-11-17T14:00:00.000Z']);
  assert.deepEqual(out.runs.map(r => r.result), ['NO_RECEIPT', 'UPCOMING', 'UPCOMING']);
});
test('writer health: thresholds and no-data metrics have a null source', () => {
  const wa = { buckets: [{ start: '2026-11-16T11:00:00Z', writes: 3 }, { start: '2026-11-16T10:00:00Z', writes: 0 }], recent: { jobs: 100 }, problemReceipts: [1, 2] };
  const h = B.writerHealth(wa, { executions: [{ at: '2026-11-16T10:00:00Z', status: 'DEFERRED_SHARED_LOCK' }] }, NOW);
  assert.deepEqual([h.last_write_age_min.value, h.last_write_age_min.status], [90, 'green']);
  assert.equal(h.error_rate.value, 0.02); assert.equal(h.error_rate.status, 'green');
  assert.equal(h.lock_waits.value, 1);
  for (const k of ['last_ping', 'queue_depth', 'timeout_rate']) assert.deepEqual(h[k], { value: null, status: null, source: null });
  assert.equal(B.healthStatus('error_rate', 0.5), 'red'); assert.equal(B.healthStatus('writes_per_hour', 0), 'red');
});
