#!/usr/bin/env node
/* Builds control/AUTOMATIONS_STATUS.json for the 3D office Automations and Writer health boards.
   Inputs (all already in this repo; no LLM, no secrets, no network):
     control/AI_AUTOMATION_TASKS.json          which automations exist, owner AI, retired flag, nativeSchedule / scheduleIntent
     state/AUTOMATION_SCHEDULE_READBACK.json   native RRULEs (local Codex automations)
     state/AUTOMATION_EXECUTION_EVIDENCE.json  latest run per automation (lastRunAt, status) from the receipts
     state/WRITER_ACTIVITY.json                Writer write counts / problem receipts (receipt-derived)
   Output: { generated_at, automations:[{ai,name,schedule,last_run_at,result,next_run_at,running,started_at,stale,writer}],
             runs:[{ai,name,start,end,result,writer,expected}] (yesterday..tomorrow, ET), writer_health:{metric:{value,status,source}} }
   Writer ping: no unauthenticated read-only Writer endpoint exists, so last_ping has no source (null) by design. */
'use strict';
const fs = require('fs'), path = require('path');
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, TZ = 'America/New_York';
const DEFAULT_RUN_MIN = 10;
const THRESHOLDS = { last_write_age_min: [90, 240], writes_per_hour: [1, 0], error_rate: [0.05, 0.2], lock_waits: [1, 3] };

function etOffsetMin(ms) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
  const g = k => Number(p.find(x => x.type === k).value);
  return Math.round((ms - Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'))) / MIN);
}
/* ET local wall time (y, m, d, h, min) -> UTC ms */
function etToUtc(y, mo, d, h, mi) { const local = Date.UTC(y, mo, d, h, mi); return local + etOffsetMin(local + etOffsetMin(local) * MIN) * MIN; }
function etDayStart(ms) { const e = new Date(ms - etOffsetMin(ms) * MIN); return etToUtc(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 0, 0); }

/* Minimal RRULE / schedule-intent support: FREQ=HOURLY;BYMINUTE=m  and  FREQ=DAILY;BYHOUR=h1,h2;BYMINUTE=m (ET). */
function parseSchedule(s) {
  if (!s) return null;
  if (typeof s === 'object') { const f = String(s.frequency || '').toUpperCase(); if (f === 'HOURLY' && Number.isInteger(s.minute)) return { freq: 'HOURLY', minutes: [s.minute], hours: null }; if (f === 'DAILY' && Array.isArray(s.hours)) return { freq: 'DAILY', hours: s.hours, minutes: [s.minute || 0] }; return null; }
  const str = String(s);
  const m = /Hourly at minute (\d+)/i.exec(str); if (m) return { freq: 'HOURLY', minutes: [Number(m[1])], hours: null };
  const kv = Object.fromEntries(str.replace(/^RRULE:/, '').split(';').map(p => p.split('=')));
  const list = v => (v ? v.split(',').map(Number).filter(Number.isFinite) : null);
  if (kv.FREQ === 'HOURLY') return { freq: 'HOURLY', minutes: list(kv.BYMINUTE) || [0], hours: null };
  if (kv.FREQ === 'DAILY') return { freq: 'DAILY', hours: list(kv.BYHOUR) || [0], minutes: list(kv.BYMINUTE) || [0] };
  return null;
}
function occurrences(sch, from, to) {
  const out = []; if (!sch) return out;
  for (let d = etDayStart(from) - DAY; d <= to + DAY; d += DAY) {
    const e = new Date(d + 12 * HOUR - etOffsetMin(d + 12 * HOUR) * MIN), y = e.getUTCFullYear(), mo = e.getUTCMonth(), da = e.getUTCDate();
    const hours = sch.freq === 'HOURLY' ? Array.from({ length: 24 }, (_, h) => h) : sch.hours;
    for (const h of hours) for (const mi of sch.minutes) { const t = etToUtc(y, mo, da, h, mi); if (t >= from && t < to) out.push(t); }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
function intervalMs(sch) { if (!sch) return null; if (sch.freq === 'HOURLY') return HOUR / sch.minutes.length; return DAY / (sch.hours.length * sch.minutes.length); }
function nextRun(sch, now) { return occurrences(sch, now + 1, now + 2 * DAY)[0] || null; }

/* Simplified result from the receipt status words. */
function mapResult(status) {
  const s = String(status || '').toUpperCase();
  if (!s) return 'EMPTY';
  if (/FAIL|ERROR|BLOCKED|UNAVAILABLE|REJECT|TIMEOUT/.test(s)) return 'FAIL';
  if (/EMPTY|NO_WORK|NOTHING|NONE|IDLE/.test(s)) return 'EMPTY';
  if (/DEFER|SKIP|LOCK|PAUSE|HOLD/.test(s)) return 'SKIP';
  if (/^OK|SUCCESS|EXECUTED|COMPLETE|PARTIAL|DONE|PASS/.test(s)) return 'OK';
  return 'SKIP';
}
function isStale(lastRun, sch, now) { const iv = intervalMs(sch); return lastRun == null || (iv != null && now - lastRun > 2 * iv); }
const writerTouching = (key, t) => /WRITER|GOFER/i.test(key + ' ' + (t.role || '') + ' ' + (t.procedure || '') + ' ' + (t.executeVia || ''));

function healthStatus(metric, v) {
  const th = THRESHOLDS[metric]; if (v == null || !th) return null;
  if (metric === 'writes_per_hour') return v >= th[0] ? 'green' : v > th[1] ? 'amber' : 'red';
  return v <= th[0] ? 'green' : v <= th[1] ? 'amber' : 'red';
}
function writerHealth(wa, evidence, now) {
  const H = {};
  const put = (k, value, source) => { H[k] = { value: value == null ? null : value, status: source ? healthStatus(k, value) : null, source: source || null }; };
  put('last_ping', null, null);       // no unauthenticated read-only Writer ping endpoint exists
  put('queue_depth', null, null);     // WRITER_QUEUE lives on Google Drive; not readable from this repo without secrets
  put('timeout_rate', null, null);    // receipts do not record Writer timeouts separately
  if (wa && Array.isArray(wa.buckets)) {
    const withWrites = wa.buckets.filter(b => b && b.writes > 0 && Date.parse(b.start)).map(b => Date.parse(b.start));
    const last = withWrites.length ? Math.max(...withWrites) : null;
    put('last_write_age_min', last == null ? null : Math.round((now - last) / MIN), 'state/WRITER_ACTIVITY.json buckets');
    const recent = wa.buckets.filter(b => b && now - Date.parse(b.start) <= 6 * HOUR);
    put('writes_per_hour', recent.length ? +(recent.reduce((n, b) => n + (b.writes || 0), 0) / 6).toFixed(2) : 0, 'state/WRITER_ACTIVITY.json buckets (last 6 h)');
    const jobs = (wa.recent && wa.recent.jobs) || 0, problems = Array.isArray(wa.problemReceipts) ? wa.problemReceipts.length : 0;
    put('error_rate', jobs ? +(problems / jobs).toFixed(3) : 0, 'state/WRITER_ACTIVITY.json problemReceipts / recent.jobs');
  } else { put('last_write_age_min', null, null); put('writes_per_hour', null, null); put('error_rate', null, null); }
  const ex = [].concat(evidence && evidence.executions || [], evidence && evidence.schedules && evidence.schedules.active || []);
  put('lock_waits', ex.filter(e => /LOCK/i.test(e.status || '') && now - Date.parse(e.at || e.lastRunAt || 0) <= DAY).length, 'state/AUTOMATION_EXECUTION_EVIDENCE.json (lock statuses, last 24 h)');
  return H;
}

function build(inputs, now) {
  const tasks = (inputs.tasks && inputs.tasks.tasks) || {};
  const rr = new Map(((inputs.readback && inputs.readback.local) || []).map(a => [a.taskKey, a]));
  const ev = new Map(((inputs.evidence && inputs.evidence.schedules && inputs.evidence.schedules.active) || []).map(a => [a.id, a]));
  const day0 = etDayStart(now) - DAY, day3 = day0 + 3 * DAY;
  const automations = [], runs = [];
  for (const [key, t] of Object.entries(tasks)) {
    if (t.retired) continue;
    const native = rr.get(key), id = (native && native.id) || t.nativeId || key.toLowerCase().replace(/_/g, '-');
    const sch = parseSchedule((native && native.status === 'ACTIVE' && native.rrule) || t.nativeSchedule || t.scheduleIntent);
    const e = ev.get(id), last = e && Date.parse(e.lastRunAt) ? Date.parse(e.lastRunAt) : null;
    const writer = writerTouching(key, t), stale = isStale(last, sch, now), result = stale && sch ? 'STALE' : e ? mapResult(e.status) : 'EMPTY', nxt = nextRun(sch, now);
    automations.push({ ai: t.owner || 'Other', name: key, schedule: (native && native.rrule) || (typeof t.scheduleIntent === 'string' ? t.scheduleIntent : t.nativeSchedule ? JSON.stringify(t.nativeSchedule) : t.scheduleIntent ? JSON.stringify(t.scheduleIntent) : ''),
      last_run_at: last ? new Date(last).toISOString() : null, result, next_run_at: nxt ? new Date(nxt).toISOString() : null, running: false, started_at: null, stale, writer });
    const iv = intervalMs(sch), dur = Math.min(DEFAULT_RUN_MIN * MIN, iv || Infinity);
    for (const t0 of occurrences(sch, day0, day3)) {
      const actual = last != null && Math.abs(last - t0) < Math.min(iv || HOUR, HOUR) / 2 + 15 * MIN;
      runs.push({ ai: t.owner || 'Other', name: key, start: new Date(t0).toISOString(), end: new Date(t0 + dur).toISOString(), result: actual ? mapResult(e.status) : t0 > now ? 'UPCOMING' : 'NO_RECEIPT', writer, expected: !actual });
    }
  }
  return { generated_at: new Date(now).toISOString(), schema: 'forge.automations-status.v1', automations, runs, writer_health: writerHealth(inputs.writer, inputs.evidence, now) };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), rd = p => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch (e) { return null; } };
  const out = build({ tasks: rd('control/AI_AUTOMATION_TASKS.json'), readback: rd('state/AUTOMATION_SCHEDULE_READBACK.json'), evidence: rd('state/AUTOMATION_EXECUTION_EVIDENCE.json'), writer: rd('state/WRITER_ACTIVITY.json') }, Date.now());
  const file = path.join(root, 'control/AUTOMATIONS_STATUS.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // keep generated_at stable when nothing else changed, so the Action only commits real changes
  const same = prev && JSON.stringify(Object.assign({}, prev, { generated_at: 0 })) === JSON.stringify(Object.assign({}, out, { generated_at: 0 }));
  if (!same) fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(same ? 'AUTOMATIONS_STATUS.json unchanged' : 'wrote AUTOMATIONS_STATUS.json: ' + out.automations.length + ' automations, ' + out.runs.length + ' runs');
}
module.exports = { build, parseSchedule, occurrences, nextRun, intervalMs, mapResult, isStale, writerHealth, healthStatus, etDayStart, THRESHOLDS };
