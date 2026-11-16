'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./scheduler.js');

const et = s => new Date(s); // ISO strings below carry explicit UTC offsets

test('parses numbers, lists, ranges, * and */n', () => {
  assert.deepEqual([...S.parseField('5', 0, 59)], [5]);
  assert.deepEqual([...S.parseField('5,13,21', 0, 23)], [5, 13, 21]);
  assert.deepEqual([...S.parseField('*/15', 0, 59)], [0, 15, 30, 45]);
  assert.deepEqual([...S.parseField('1-5', 0, 7)], [1, 2, 3, 4, 5]);
  assert.equal(S.parseField('*', 0, 23).size, 24);
  for (const bad of ['60', '*/0', 'a', '5-1', '1,,2', '']) assert.throws(() => S.parseField(bad, 0, 59), bad);
});

test('crontab lines need 5 fields and a task key; comments ignored', () => {
  const specs = S.parseCrontab('# c\n\n42 * * * * FORGE_APPLICATION_WRITER_GOFER # hourly\n');
  assert.equal(specs.length, 1);
  assert.equal(specs[0].task, 'FORGE_APPLICATION_WRITER_GOFER');
  assert.throws(() => S.parseCrontab('42 * * * FORGE_X'));
  assert.throws(() => S.parseCrontab('42 * * * * lower'));
});

test('matches in America/New_York, across EST and EDT', () => {
  const [daily] = S.parseCrontab('45 7 * * * PE_STACK_HEALTH_DAILY');
  assert.ok(S.matches(daily, et('2026-11-16T07:45:00-05:00')));   // EST
  assert.ok(S.matches(daily, et('2026-07-16T07:45:00-04:00')));   // EDT
  assert.ok(!S.matches(daily, et('2026-11-16T07:45:00Z')));       // 02:45 ET
  const [pv] = S.parseCrontab('12 5,13,21 * * * FORGE_POSTING_VALIDATION');
  assert.ok(S.matches(pv, et('2026-11-16T13:12:30-05:00')));
  assert.ok(!S.matches(pv, et('2026-11-16T14:12:00-05:00')));
  assert.ok(!S.matches(pv, et('2026-11-16T13:13:00-05:00')));
});

test('day-of-month / day-of-week use standard cron OR semantics', () => {
  const [both] = S.parseCrontab('0 9 1 * 1 X_TASK');               // 1st of month OR Monday
  assert.ok(S.matches(both, et('2026-11-16T09:00:00-05:00')));     // Monday 16th
  assert.ok(S.matches(both, et('2026-12-01T09:00:00-05:00')));     // Tuesday 1st
  assert.ok(!S.matches(both, et('2026-11-17T09:00:00-05:00')));    // Tuesday 17th
  const [sun] = S.parseCrontab('0 9 * * 7 SUN_TASK');              // 7 == Sunday
  assert.ok(S.matches(sun, et('2026-11-15T09:00:00-05:00')));
});

test('due() fires once per window and never catches up missed windows', () => {
  const specs = S.parseCrontab(fs.readFileSync(path.join(__dirname, 'crontab.txt'), 'utf8'));
  assert.equal(specs.length, 6);
  let r = S.due(specs, et('2026-11-16T13:12:05-05:00'), null);
  assert.deepEqual(r.tasks.sort(), ['FORGE_CHATGPT_ENRICHMENT_RESEARCH', 'FORGE_POSTING_VALIDATION']);
  assert.deepEqual(S.due(specs, et('2026-11-16T13:12:50-05:00'), r.key).tasks, []); // same minute again
  // Daemon asleep from 13:20 to 13:50: the 13:22 and 13:42 windows are not replayed.
  r = S.due(specs, et('2026-11-16T13:50:01-05:00'), '2026-11-16T13:20');
  assert.deepEqual(r.tasks, []);
  assert.deepEqual(S.due(specs, et('2026-11-16T14:05:00-05:00'), r.key).tasks, ['FORGE_AI_USAGE_READER']);
});

test('DST fall-back repeated hour runs a window only once', () => {
  const specs = S.parseCrontab('12 * * * * HOURLY_TASK');
  const first = S.due(specs, et('2026-11-01T01:12:00-04:00'), null);   // 01:12 EDT
  assert.deepEqual(first.tasks, ['HOURLY_TASK']);
  const again = S.due(specs, et('2026-11-01T01:12:00-05:00'), first.key); // 01:12 EST, same wall clock
  assert.equal(again.key, first.key);
  assert.deepEqual(again.tasks, []);
});
