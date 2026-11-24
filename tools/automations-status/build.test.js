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

test('est_per_run / est_week: last receipt duration and 0 calls times an hourly schedule', () => {
  const receipt = {
    runId: 'FORGE-GOFER-CHATGPT-20261123T214451Z',
    at: '2026-11-23T21:45:38.614Z',
    fundingMode: 'NO_MODEL_INVOCATION',
    taskKey: 'FORGE_APPLICATION_WRITER_GOFER'
  };
  const out = B.build({
    tasks: { tasks: { FORGE_APPLICATION_WRITER_GOFER: { owner: 'ChatGPT' } } },
    readback: { local: [{ id: 'forge-application-writer-gofer', taskKey: 'FORGE_APPLICATION_WRITER_GOFER', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=42;BYSECOND=0' }] },
    evidence: { executions: [{ id: 'forge-application-writer-gofer', evidenceFiles: ['receipts/gofer.json'] }], schedules: { active: [{ id: 'forge-application-writer-gofer', lastRunAt: '2026-11-23T21:45:38.614Z', status: 'DEFERRED_GRANT_RUNTIME_UNVERIFIED' }] } },
    readReceipt: p => p === 'receipts/gofer.json' ? receipt : null
  }, NOW);
  const row = out.automations[0];
  assert.equal(row.runs_per_week, 168);
  assert.equal(row.est_per_run, '0 calls, 48 s');
  assert.equal(row.est_week, '0 calls, 2.2 h');
});

test('est fields stay null without a receipt; a paused native task has weekly est 0', () => {
  const live = B.build({
    tasks: { tasks: { PE_STACK_HEALTH_DAILY: {} } },
    readback: { local: [{ id: 'pe-stack-health-daily', taskKey: 'PE_STACK_HEALTH_DAILY', status: 'ACTIVE', rrule: 'RRULE:FREQ=DAILY;BYHOUR=7;BYMINUTE=45' }] }
  }, NOW);
  assert.equal(live.automations[0].runs_per_week, 7);
  assert.equal(live.automations[0].est_per_run, null);
  assert.equal(live.automations[0].est_week, null);

  const paused = B.build({
    tasks: { tasks: { FORGE_AI_USAGE_READER: { nativeSchedule: 'Hourly at minute 05, America/New_York' } } },
    readback: { local: [{ id: 'forge-ai-usage-reader', taskKey: 'FORGE_AI_USAGE_READER', status: 'PAUSED', rrule: 'RRULE:FREQ=DAILY;BYHOUR=2,8,14,20;BYMINUTE=5' }] }
  }, NOW);
  assert.equal(paused.automations[0].runs_per_week, 0);
  assert.equal(paused.automations[0].est_week, '0');
  assert.equal(paused.automations[0].est_per_run, null);
});

test('receiptUsage and formatEst helpers', () => {
  assert.deepEqual(B.receiptUsage({ runId: 'X-20261123T214451Z', at: '2026-11-23T21:45:38Z', fundingMode: 'DEFERRED_NO_MODEL_INVOCATION' }), { minutes: 47 / 60, calls: 0 });
  assert.equal(B.formatEst(0, 47 / 60), '0 calls, 47 s');
  assert.equal(B.formatEst(null, 3.6), '3.6 min');
  assert.equal(B.formatEst(2, null), '2 calls');
  assert.equal(B.formatEst(null, null), null);
});

test('deleted box intake lanes stay off the office wall even when still listed in tasks', () => {
  const out = B.build({
    tasks: { tasks: {
      FORGE_EMAIL_DISCOVERY: { owner: 'ChatGPT' },
      FORGE_INTAKE_SCOPE_REVIEW: { owner: 'ChatGPT' },
      FORGE_INTAKE_SOURCE_RECOVERY: { owner: 'ChatGPT' },
      FORGE_INTAKE_HELD_RECONCILIATION: { owner: 'ChatGPT' }
    } },
    readback: { local: [
      { id: 'email', taskKey: 'FORGE_EMAIL_DISCOVERY', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=2' },
      { id: 'scope', taskKey: 'FORGE_INTAKE_SCOPE_REVIEW', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=32' },
      { id: 'recovery', taskKey: 'FORGE_INTAKE_SOURCE_RECOVERY', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=42' },
      { id: 'held', taskKey: 'FORGE_INTAKE_HELD_RECONCILIATION', status: 'ACTIVE', rrule: 'RRULE:FREQ=HOURLY;BYMINUTE=52' }
    ] }
  }, NOW);
  assert.deepEqual(out.automations.map(a => a.name), ['FORGE_EMAIL_DISCOVERY']);
  assert.ok(out.runs.every(r => r.name === 'FORGE_EMAIL_DISCOVERY'));
});

test('never-ran rows with no schedule stay off the wall; last_run_by is evidence-only', () => {
  const evPath = 'receipts/FORGE-CHATGPT-BOX-FORGE-POSTING-VALIDATION-20261116T181810Z.json';
  const out = B.build({
    tasks: { tasks: {
      FORGE_EMAIL_DISCOVERY: { owner: 'ChatGPT' },
      FORGE_CLAUDE_INTAKE_A: { owner: 'Claude' },
      FORGE_CLAUDE_SHARED_HELPER: { owner: 'Claude', scheduleIntent: { timezone: 'America/New_York', frequency: 'HOURLY', minute: 25 } },
      FORGE_CHATGPT_ENRICHMENT_RESEARCH: { owner: 'ChatGPT', nativeSchedule: 'Hourly at minute 12, America/New_York' },
      FORGE_POSTING_VALIDATION: { owner: 'ChatGPT' },
      FORGE_AI_USAGE_READER: { owner: 'Any', nativeSchedule: 'Hourly at minute 05, America/New_York' }
    } },
    readback: { local: [
      { id: 'posting', taskKey: 'FORGE_POSTING_VALIDATION', status: 'ACTIVE', rrule: 'RRULE:FREQ=DAILY;BYHOUR=5,13,21;BYMINUTE=12' },
      { id: 'usage', taskKey: 'FORGE_AI_USAGE_READER', status: 'PAUSED', rrule: 'RRULE:FREQ=DAILY;BYHOUR=2,8,14,20;BYMINUTE=5' }
    ] },
    evidence: { schedules: { active: [
      { id: 'posting', lastRunAt: '2026-11-16T18:18:10.672Z', status: 'OK', evidenceFiles: [evPath] }
    ] } }
  }, NOW);
  const names = out.automations.map(a => a.name);
  assert.deepEqual(names.sort(), ['FORGE_AI_USAGE_READER', 'FORGE_CHATGPT_ENRICHMENT_RESEARCH', 'FORGE_POSTING_VALIDATION']);
  const posting = out.automations.find(a => a.name === 'FORGE_POSTING_VALIDATION');
  assert.equal(posting.last_run_by, 'ChatGPT');
  const enrich = out.automations.find(a => a.name === 'FORGE_CHATGPT_ENRICHMENT_RESEARCH');
  assert.equal(enrich.last_run_by, '');
  assert.equal(enrich.paused, false);
  const paused = out.automations.find(a => a.name === 'FORGE_AI_USAGE_READER');
  assert.equal(paused.paused, true);
  assert.equal(paused.runs_per_week, 0);
  assert.equal(paused.last_run_by, '');
});
