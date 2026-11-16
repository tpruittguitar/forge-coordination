#!/usr/bin/env node
'use strict';
// Zero-dependency cron daemon for the Claude box lanes (the box has no cron).
// Reads crontab.txt (5-field cron in America/New_York + TASK_KEY), checks once a
// minute, starts due lanes detached through run-lane.sh, never runs a missed
// window, writes a heartbeat and a pid file so a second copy exits.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const TZ = 'America/New_York';
const FIELDS = [['minute', 0, 59], ['hour', 0, 23], ['dom', 1, 31], ['month', 1, 12], ['dow', 0, 7]];

function parseField(text, min, max) {
  const out = new Set();
  for (const part of String(text).split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw Error('bad cron field: ' + text);
    const step = m[2] === undefined ? 1 : Number(m[2]);
    if (!Number.isInteger(step) || step < 1) throw Error('bad cron step: ' + text);
    let lo, hi;
    if (m[1] === '*') { lo = min; hi = max; }
    else if (m[1].includes('-')) [lo, hi] = m[1].split('-').map(Number);
    else { lo = Number(m[1]); hi = m[2] === undefined ? lo : max; }
    if (lo < min || hi > max || lo > hi) throw Error('cron value out of range: ' + text);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

function parseLine(line) {
  const s = line.replace(/#.*/, '').trim();
  if (!s) return null;
  const parts = s.split(/\s+/);
  if (parts.length !== 6) throw Error('cron line needs 5 fields + TASK_KEY: ' + line);
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(parts[5])) throw Error('bad TASK_KEY: ' + parts[5]);
  const spec = { task: parts[5], text: parts.slice(0, 5).join(' ') };
  FIELDS.forEach(([name, min, max], i) => { spec[name] = parseField(parts[i], min, max); spec[name + 'Star'] = parts[i] === '*'; });
  if (spec.dow.has(7)) spec.dow.add(0);
  return spec;
}

function parseCrontab(text) { return text.split(/\r?\n/).map(parseLine).filter(Boolean); }

// Wall-clock fields of a Date in America/New_York.
function zoned(date, tz = TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { year: +parts.year, month: +parts.month, dom: +parts.day, hour: +parts.hour, minute: +parts.minute, dow };
}

function matches(spec, date, tz = TZ) {
  const z = zoned(date, tz);
  if (!spec.minute.has(z.minute) || !spec.hour.has(z.hour) || !spec.month.has(z.month)) return false;
  // Standard cron: when both day fields are restricted, either may match.
  const domOk = spec.dom.has(z.dom), dowOk = spec.dow.has(z.dow);
  if (spec.domStar || spec.dowStar) return domOk && dowOk;
  return domOk || dowOk;
}

// Local-minute key: a repeated DST fall-back minute is the same window, so a
// lane never runs twice for one scheduled wall-clock time.
function minuteKey(date, tz = TZ) {
  const z = zoned(date, tz);
  const p = n => String(n).padStart(2, '0');
  return `${z.year}-${p(z.month)}-${p(z.dom)}T${p(z.hour)}:${p(z.minute)}`;
}

// Jobs due at exactly this minute. Only the current minute is ever evaluated;
// windows that passed while the daemon was down or asleep are skipped.
function due(specs, date, lastKey, tz = TZ) {
  const key = minuteKey(date, tz);
  if (key === lastKey) return { key, tasks: [] };
  return { key, tasks: specs.filter(s => matches(s, date, tz)).map(s => s.task) };
}

module.exports = { parseField, parseLine, parseCrontab, zoned, matches, minuteKey, due };

if (require.main === module) {
  const HOME = process.env.FORGE_LANES_HOME || '/home/box/forge-lanes';
  const DIR = __dirname;
  const CRONTAB = process.env.FORGE_BOX_CRONTAB || path.join(DIR, 'crontab.txt');
  const RUN_LANE = path.join(DIR, 'run-lane.sh');
  const PID = path.join(HOME, 'scheduler.pid');
  const HEARTBEAT = path.join(HOME, 'scheduler.heartbeat');
  const LOG = path.join(HOME, 'logs', 'scheduler.log');
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const log = msg => fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);

  // Single instance: an existing live scheduler keeps running; this copy exits.
  try {
    const old = Number(fs.readFileSync(PID, 'utf8').trim());
    if (old && old !== process.pid) {
      let alive = false;
      try { process.kill(old, 0); alive = /scheduler\.js/.test(fs.readFileSync(`/proc/${old}/cmdline`, 'utf8')); } catch { alive = false; }
      if (alive) { console.error(`scheduler already running (pid ${old}); exiting`); process.exit(0); }
    }
  } catch { /* no pid file */ }
  fs.writeFileSync(PID, String(process.pid));
  const release = () => { try { if (fs.readFileSync(PID, 'utf8').trim() === String(process.pid)) fs.unlinkSync(PID); } catch { } };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log(`STOP ${sig}`); process.exit(0); });

  let lastKey = minuteKey(new Date()); // start-up minute is never back-filled
  log(`START pid=${process.pid} crontab=${CRONTAB} skipCurrentMinute=${lastKey}`);
  const tick = () => {
    const now = new Date();
    let specs = [], error = null;
    try { specs = parseCrontab(fs.readFileSync(CRONTAB, 'utf8')); } catch (e) { error = e.message; log(`CRONTAB_ERROR ${e.message}`); }
    const { key, tasks } = due(specs, now, lastKey);
    lastKey = key;
    for (const task of tasks) {
      try {
        const child = spawn('bash', [RUN_LANE, task], { detached: true, stdio: 'ignore', cwd: HOME, env: process.env });
        child.unref();
        log(`STARTED ${task} pid=${child.pid} window=${key}ET`);
      } catch (e) { log(`START_FAILED ${task} ${e.message}`); }
    }
    fs.writeFileSync(HEARTBEAT, JSON.stringify({ at: now.toISOString(), pid: process.pid, windowET: key, jobs: specs.length, started: tasks, crontabError: error }) + '\n');
    setTimeout(tick, 60000 - (Date.now() % 60000) + 1000);
  };
  setTimeout(tick, 60000 - (Date.now() % 60000) + 1000);
}
