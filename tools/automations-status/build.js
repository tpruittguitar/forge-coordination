#!/usr/bin/env node
/* Builds control/AUTOMATIONS_STATUS.json for the 3D office Automations and Writer health boards.
   Inputs (all already in this repo; no LLM, no secrets, no network):
     control/AI_AUTOMATION_TASKS.json          which automations exist, owner AI, retired flag, nativeSchedule / scheduleIntent
     state/AUTOMATION_SCHEDULE_READBACK.json   native RRULEs (local Codex automations)
     state/AUTOMATION_EXECUTION_EVIDENCE.json  latest run per automation (lastRunAt, status) from the receipts
     state/WRITER_ACTIVITY.json                Writer write counts / problem receipts (receipt-derived)
   Output: { generated_at, automations:[{ai,name,schedule,last_run_at,last_run_by,result,next_run_at,running,started_at,stale,writer,
             est_per_run,est_week,runs_per_week,paused}],
             runs:[{ai,name,start,end,result,writer,expected}] (yesterday..tomorrow, ET), writer_health:{metric:{value,status,source}} }
   est_per_run / est_week are display strings labeled "est." on the office wall (cs-0e5860cc).
   Per-run comes from the latest evidence receipt (duration = runId timestamp to `at`;
   AI calls = 0 when fundingMode says no model invocation, else aiInvestigations).
   Weekly is that figure times runs_per_week from the active schedule (0 if the native task is paused).
   No network; receipts not listed in evidence are not opened. Duration is not invented when missing.
   Writer ping: no unauthenticated read-only Writer endpoint exists, so last_ping has no source (null) by design. */
'use strict';
const fs = require('fs'), path = require('path');
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY, TZ = 'America/New_York';
const DEFAULT_RUN_MIN = 10;
// Box lanes deleted 2026-11-23 (cs-a7e4613b / cs-0170c263). Keep them off the 3D office wall
// even though they remain in AI_AUTOMATION_TASKS.json.
const HIDDEN_FROM_WALL = new Set(['FORGE_INTAKE_SCOPE_REVIEW', 'FORGE_INTAKE_SOURCE_RECOVERY', 'FORGE_INTAKE_HELD_RECONCILIATION']);
// Scheduled but never ran (no receipt). Off the wall only (cs-0af97164); registrations stay in AI_AUTOMATION_TASKS.json.
const HIDDEN_NEVER_RAN = new Set(['FORGE_CLAUDE_SHARED_HELPER']);
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
// Lanes have no owner (Tim 2026-11-22): the AI shown is whoever's receipt ran it last.
const RUNNER = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', HERMES: 'Hermes', SNIFFER: 'Sniffer' };
function ranBy(e) { const m = ((e && e.evidenceFiles) || []).join(' ').match(/-(CHATGPT|CLAUDE|HERMES|SNIFFER)-/); return m ? RUNNER[m[1]] : 'Any'; }
// Last-run provenance for the wall (cs-0af97164): a real runner from the receipt, else blank (the wall shows a dash). Never invent a name.
function lastRunBy(e, last) { if (!last) return ''; const who = ranBy(e); return who === 'Any' ? '' : who; }
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


/* Usage estimates for the office Automations wall (cs-0e5860cc). */
function runIdMs(s) {
  const m = String(s || '').match(/(20\d{6})T(\d{6})/);
  if (!m) return null;
  return Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8), +m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4, 6));
}
function receiptUsage(rec) {
  if (!rec || typeof rec !== 'object') return { minutes: null, calls: null };
  let calls = null;
  if (/NO_MODEL_INVOCATION/i.test(String(rec.fundingMode || ''))) calls = 0;
  else if (typeof rec.aiInvestigations === 'number' && Number.isFinite(rec.aiInvestigations)) calls = rec.aiInvestigations;
  const t0 = runIdMs(rec.runId), t1 = Date.parse(rec.at);
  let minutes = null;
  if (t0 && t1 && t1 >= t0 && t1 - t0 < 6 * HOUR) minutes = (t1 - t0) / MIN;
  return { minutes, calls };
}
function fmtMin(min) {
  if (min == null || !Number.isFinite(min)) return null;
  const sec = min * 60;
  if (sec < 90) return Math.round(sec) + ' s';
  if (min < 90) return String(+(Math.round(min * 10) / 10)).replace(/\.0$/, '') + ' min';
  return String(+(Math.round((min / 60) * 10) / 10)).replace(/\.0$/, '') + ' h';
}
function fmtCalls(n) {
  if (n == null || !Number.isFinite(n)) return null;
  const v = Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : +n.toFixed(1);
  return v + (v === 1 ? ' call' : ' calls');
}
function formatEst(calls, minutes) {
  const parts = [fmtCalls(calls), fmtMin(minutes)].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
function runsPerWeek(sch, native) {
  if (native && native.status && native.status !== 'ACTIVE') return 0;
  const iv = intervalMs(sch);
  if (!iv) return null;
  return WEEK / iv;
}
function readListedReceipt(entry, readReceipt) {
  if (!entry || !readReceipt) return null;
  for (const p of entry.evidenceFiles || []) {
    const rec = readReceipt(p);
    if (rec && typeof rec === 'object') return rec;
  }
  return null;
}

function build(inputs, now) {
  const tasks = (inputs.tasks && inputs.tasks.tasks) || {};
  const rr = new Map(((inputs.readback && inputs.readback.local) || []).map(a => [a.taskKey, a]));
  const ev = new Map(((inputs.evidence && inputs.evidence.schedules && inputs.evidence.schedules.active) || []).map(a => [a.id, a]));
  const exById = new Map(((inputs.evidence && inputs.evidence.executions) || []).map(a => [a.id, a]));
  const readReceipt = inputs.readReceipt || (p => null);
  const day0 = etDayStart(now) - DAY, day3 = day0 + 3 * DAY;
  const automations = [], runs = [];
  for (const [key, t] of Object.entries(tasks)) {
    if (t.retired || HIDDEN_FROM_WALL.has(key) || HIDDEN_NEVER_RAN.has(key)) continue;
    const native = rr.get(key), id = (native && native.id) || t.nativeId || key.toLowerCase().replace(/_/g, '-');
    const sch = parseSchedule((native && native.status === 'ACTIVE' && native.rrule) || t.nativeSchedule || t.scheduleIntent);
    const e = ev.get(id), last = e && Date.parse(e.lastRunAt) ? Date.parse(e.lastRunAt) : null;
    const writer = writerTouching(key, t), stale = isStale(last, sch, now), result = stale && sch ? 'STALE' : e ? mapResult(e.status) : 'EMPTY', nxt = nextRun(sch, now);
    const rec = readListedReceipt(exById.get(id) || e, readReceipt), used = receiptUsage(rec);
    const rp = runsPerWeek(sch, native), paused = rp === 0;
    // No receipt and no schedule: never-ran / dead registration. Hide from the wall only (cs-0af97164).
    if (!last && !e && !sch && !paused) continue;
    const est_per_run = formatEst(used.calls, used.minutes);
    const est_week = rp === 0 ? '0' : formatEst(rp != null && used.calls != null ? rp * used.calls : null, rp != null && used.minutes != null ? rp * used.minutes : null);
    automations.push({ ai: ranBy(e), name: key, schedule: (native && native.rrule) || (typeof t.scheduleIntent === 'string' ? t.scheduleIntent : t.nativeSchedule ? JSON.stringify(t.nativeSchedule) : t.scheduleIntent ? JSON.stringify(t.scheduleIntent) : ''),
      last_run_at: last ? new Date(last).toISOString() : null, last_run_by: lastRunBy(e, last), result, next_run_at: nxt ? new Date(nxt).toISOString() : null, running: false, started_at: null, stale, writer,
      est_per_run, est_week, runs_per_week: rp, paused });
    const iv = intervalMs(sch), dur = Math.min(DEFAULT_RUN_MIN * MIN, iv || Infinity);
    for (const t0 of occurrences(sch, day0, day3)) {
      const actual = last != null && Math.abs(last - t0) < Math.min(iv || HOUR, HOUR) / 2 + 15 * MIN;
      runs.push({ ai: ranBy(e), name: key, start: new Date(t0).toISOString(), end: new Date(t0 + dur).toISOString(), result: actual ? mapResult(e.status) : t0 > now ? 'UPCOMING' : 'NO_RECEIPT', writer, expected: !actual });
    }
  }
  return { generated_at: new Date(now).toISOString(), schema: 'forge.automations-status.v1', automations, runs, writer_health: writerHealth(inputs.writer, inputs.evidence, now) };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), rd = p => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch (e) { return null; } };
  const readReceipt = p => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch (e) { return null; } };
  const out = build({ tasks: rd('control/AI_AUTOMATION_TASKS.json'), readback: rd('state/AUTOMATION_SCHEDULE_READBACK.json'), evidence: rd('state/AUTOMATION_EXECUTION_EVIDENCE.json'), writer: rd('state/WRITER_ACTIVITY.json'), readReceipt }, Date.now());
  const file = path.join(root, 'control/AUTOMATIONS_STATUS.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // keep generated_at stable when nothing else changed, so the Action only commits real changes
  const same = prev && JSON.stringify(Object.assign({}, prev, { generated_at: 0 })) === JSON.stringify(Object.assign({}, out, { generated_at: 0 }));
  if (!same) fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(same ? 'AUTOMATIONS_STATUS.json unchanged' : 'wrote AUTOMATIONS_STATUS.json: ' + out.automations.length + ' automations, ' + out.runs.length + ' runs');
}
module.exports = { build, parseSchedule, occurrences, nextRun, intervalMs, mapResult, isStale, writerHealth, healthStatus, etDayStart, THRESHOLDS, receiptUsage, formatEst, runsPerWeek, fmtMin, fmtCalls };
