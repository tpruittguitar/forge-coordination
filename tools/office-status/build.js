#!/usr/bin/env node
/* Keeps control/OFFICE_STATUS.json bot rows from going stale when nobody hand-edits them (ITEM 17).
   Plain code: no LLM, no network, no secrets. Inputs are files already in this checkout, plus `git log` of it:
     control/AUTOMATIONS_STATUS.json           latest last_run_at per automation, with owner AI (ai)
     state/AUTOMATION_EXECUTION_EVIDENCE.json  executions[].at / schedules.active[].lastRunAt per automation id
     control/AI_AUTOMATION_TASKS.json          automation id -> owner AI (to attribute the evidence above)
     receipts/*                                file names carrying <PROVIDER>-<yyyymmdd>T<hhmmss>Z or -<yyyymmdd>-<hhmm>ET
     control/changes/*.txt                     pending change records <provider>-<yyyymmdd-hhmm>-<slug>.txt (ET)
     control/CHANGE_RECORDS_CONSUMED.txt       registered change records (same name pattern)
     usage/AI_USAGE_READINGS.jsonl             weekly usage readings per provider
     git log (last 200 commits)                commit author identity, or a PROVIDER=<x> line in the message
   Merge rule (everything hand-written is kept: task text, needs_tim, bot list/order, avatars, ids, screens ...):
     - last_action_at moves only FORWARD, to the newest real signal; signals more than 1 min in the future are ignored.
     - each bot with a signal gets "last_signal": {"at","source"} (also never moves backwards).
     - status "working" or "idle" is set from the newest activity (last_action_at or last_signal): within 30 min (ACTIVE_WINDOW)
       it is "working", older it is "idle".
       needs_tim / waiting_tim / blocked / anything else is never touched.
     - top-level updated_at changes only when bot rows or usage changed. Output: 2-space JSON, existing key order, newline.
   Not readable from this repo (gaps): office-mailbox start/finish lines (private repo), Grok Bot chat/terminal
   screens (only President's hand-written "screen" blocks exist here), and any repo signal for Root, Software, GUI,
   QA bot, Sniffer, Comp, Archive, Usage Budget, HR - Bot Trainer, Gauge, Edgar. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const MIN = 60000, HOUR = 60 * MIN, ACTIVE_WINDOW = 30 * MIN, FUTURE_SLACK = MIN;
const OUT = 'control/OFFICE_STATUS.json';
const ask = require('./ask.js');   // asks/open is the single source for needs_tim

/* Which office row each signal belongs to. Provider tokens come from receipt names, change-record names and PROVIDER=. */
const PROVIDER_BOT = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', PRESIDENT: 'President' };
const AUTHOR_BOT = { 'President (Grok Bot)': 'President', ForgeChatGPT: 'ChatGPT', 'forge-code-coordinator': 'ChatGPT' };
const AI_BOT = { ChatGPT: 'ChatGPT', Claude: 'Claude' };   // AUTOMATIONS_STATUS / AI_AUTOMATION_TASKS owner -> office row

const time = v => { if (v == null || v === '') return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const iso = t => new Date(Math.floor(t / 1000) * 1000).toISOString().replace('.000Z', 'Z');
const floorSec = t => Math.floor(t / 1000) * 1000;

/* America/New_York wall time -> UTC ms (DST-aware). */
function etOffsetMin(ms) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
  const g = k => Number(p.find(x => x.type === k).value);
  return Math.round((ms - Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'))) / MIN);
}
function etToUtc(y, mo, d, h, mi) { const local = Date.UTC(y, mo, d, h, mi); return local + etOffsetMin(local + etOffsetMin(local) * MIN) * MIN; }
const ymd = s => [Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))];

/* Search actual UTC minutes so skipped/repeated ET hours follow the reader's wall-clock schedule. */
function nextCheckAt(now) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric' });
  for (let at = Math.floor(now / MIN) * MIN + MIN; at <= now + 30 * HOUR; at += MIN) {
    const parts = fmt.formatToParts(new Date(at)), get = k => Number(parts.find(p => p.type === k).value);
    if ([2, 8, 14, 20].includes(get('hour')) && get('minute') === 5) return iso(at);
  }
}
function usageFromReadings(text, now) {
  const latest = {}, ok = {};
  for (const line of String(text || '').split('\n').filter(l => l.trim())) {
    const r = JSON.parse(line);
    if (r.meter !== 'weekly' || time(r.at) == null) continue;
    if (!latest[r.provider] || time(r.at) >= time(latest[r.provider].at)) latest[r.provider] = r;
    if (r.status === 'OK' && (!ok[r.provider] || time(r.at) >= time(ok[r.provider].at))) ok[r.provider] = r;
  }
  const services = [['GROK', 'Grok Bot'], ['CLAUDE', 'Claude'], ['CHATGPT', 'ChatGPT']].map(([provider, name]) => {
    const r = ok[provider], bad = latest[provider];
    const service = r ? { name, as_of: r.at, pct_used: r.usedPct, pct_left: Number((100 - r.usedPct).toFixed(2)), resets_at: r.resetsAt }
      : { name, as_of: null, status: 'NO_OK_READING' };
    if (bad && bad.status !== 'OK') Object.assign(service, { stale: true, last_reading_status: bad.status, last_reading_at: bad.at });
    return service;
  });
  const newest = services.filter(s => s.as_of).sort((a, b) => time(b.as_of) - time(a.as_of))[0];
  return { as_of: newest ? newest.as_of : null, services, next_check_at: nextCheckAt(now) };
}

/* ---------- signal extractors (pure; each returns [{bot, at(ms), source}]) ---------- */
function receiptSignals(names) {
  const out = [], re = /(?:^|[-_])(CHATGPT|CLAUDE|GROK)-(\d{8})(?:T(\d{2})(\d{2})(\d{2})Z|-(\d{2})(\d{2})ET)/;
  for (const n of names || []) {
    const m = re.exec(n); if (!m || !PROVIDER_BOT[m[1]]) continue;
    const [y, mo, d] = ymd(m[2]);
    const at = m[3] != null ? Date.UTC(y, mo, d, +m[3], +m[4], +m[5]) : etToUtc(y, mo, d, +m[6], +m[7]);
    if (Number.isFinite(at)) out.push({ bot: PROVIDER_BOT[m[1]], at, source: 'receipt receipts/' + n });
  }
  return out;
}
/* <provider>-<yyyymmdd>-<hhmm>-<slug>; hhmm is ET. Date-only names (no time) are skipped. */
function changeRecordName(name) {
  const m = /^([a-z]+)-(\d{8})-(\d{4})(?:-|\.txt$|$)/i.exec(name); if (!m) return null;
  const bot = PROVIDER_BOT[m[1].toUpperCase()]; if (!bot) return null;
  const [y, mo, d] = ymd(m[2]); const at = etToUtc(y, mo, d, +m[3].slice(0, 2), +m[3].slice(2));
  return Number.isFinite(at) ? { bot, at } : null;
}
function changeSignals(pendingNames, consumedText) {
  const out = [];
  for (const n of pendingNames || []) { const s = changeRecordName(n); if (s) out.push(Object.assign(s, { source: 'change record control/changes/' + n })); }
  for (const line of String(consumedText || '').split('\n')) {
    const m = /^CONSUMED\s+(REV-\d+)\s+(\S+)/.exec(line); if (!m) continue;
    const s = changeRecordName(m[2]); if (s) out.push(Object.assign(s, { source: 'change register ' + m[1] + ' ' + m[2] }));
  }
  return out;
}
/* git log --format='%h%x1f%aI%x1f%an%x1f%B%x1e' */
function gitSignals(logText) {
  const out = [];
  for (const rec of String(logText || '').split('\x1e')) {
    const [sha, date, author, body] = rec.replace(/^\s+/, '').split('\x1f'); const at = time(date); if (!sha || at == null) continue;
    const subject = String(body || '').split('\n')[0].slice(0, 60);
    const bots = new Set(); if (AUTHOR_BOT[author]) bots.add(AUTHOR_BOT[author]);
    for (const m of String(body || '').matchAll(/\bPROVIDER=([A-Za-z]+)/g)) { const b = PROVIDER_BOT[m[1].toUpperCase()]; if (b) bots.add(b); }
    for (const bot of bots) out.push({ bot, at, source: 'git ' + sha + ' (' + author + ') ' + subject });
  }
  return out;
}
function automationSignals(autoStatus, evidence, tasks) {
  const out = [];
  for (const a of (autoStatus && autoStatus.automations) || []) {
    const bot = AI_BOT[a.ai], at = time(a.last_run_at); if (bot && at != null) out.push({ bot, at, source: 'automation ' + a.name + ' (control/AUTOMATIONS_STATUS.json)' });
  }
  const owner = {};
  for (const [k, t] of Object.entries((tasks && tasks.tasks) || {})) owner[t.nativeId || k.toLowerCase().replace(/_/g, '-')] = t.owner;
  const ev = [].concat(((evidence && evidence.executions) || []).map(e => [e.id, e.at]), ((evidence && evidence.schedules && evidence.schedules.active) || []).map(e => [e.id, e.lastRunAt]));
  for (const [id, when] of ev) {
    const bot = AI_BOT[owner[id]], at = time(when); if (bot && at != null) out.push({ bot, at, source: 'automation ' + id + ' (state/AUTOMATION_EXECUTION_EVIDENCE.json)' });
  }
  return out;
}

/* ---------- merge ---------- */
/* Newest valid signal per bot. Ties keep the first seen (inputs are passed in a fixed order -> deterministic). */
function newestByBot(signals, now) {
  const best = {};
  for (const s of signals) {
    if (!s || !s.bot || !Number.isFinite(s.at) || s.at > now + FUTURE_SLACK) continue;
    const at = floorSec(s.at), cur = best[s.bot];
    if (!cur || at > cur.at || (at === cur.at && s.source < cur.source)) best[s.bot] = { at, source: s.source };
  }
  return best;
}
function mergeBot(row, sig, now) {
  const r = Object.assign({}, row);
  if (sig) {
    const prevSig = r.last_signal && time(r.last_signal.at);
    if (prevSig == null || sig.at > prevSig) r.last_signal = { at: iso(sig.at), source: sig.source };
    const cur = time(r.last_action_at);
    if (cur == null || sig.at > cur) r.last_action_at = iso(sig.at);
  }
  if (r.status === 'working' || r.status === 'idle') {
    const ts = [time(r.last_action_at), r.last_signal && time(r.last_signal.at)].filter(t => t != null && t <= now + FUTURE_SLACK);
    if (ts.length) r.status = now - Math.max(...ts) > ACTIVE_WINDOW ? 'idle' : 'working';
  }
  return r;
}
/* Usage Budget row screen, from the computed usage block. Plain formatting only; missing fields are said to be unknown, never invented. */
const USAGE_ROW_ID = 'f1a70b7a-6051-45d7-8031-e46a4cba066f';
const resetDay = v => { const t = time(v); return t == null ? null : new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(t)); };
function usageLine(s) {
  const name = (s && s.name) || 'unknown service';
  const left = s && Number.isFinite(s.pct_left) ? s.pct_left : null;
  if (left == null) return name + ': unknown';
  const day = resetDay(s.resets_at);
  return name + ': ' + left + '% left, ' + (day ? 'resets ' + day : 'reset unknown');
}
function usageScreen(row, usage) {
  const screen = Object.assign({}, row.screen, { title: 'AI usage', lines: usage.services.map(usageLine) });
  if (usage.as_of) screen.updated_at = usage.as_of;
  return Object.assign({}, row, { screen });
}
/* Returns { doc, changed }. `office` is the parsed OFFICE_STATUS.json; it is not mutated. */
function build(office, signals, now, readings, asks) {
  if (!office || !Array.isArray(office.bots)) return { doc: office, changed: false };
  const best = newestByBot(signals, now);
  const usage = readings === undefined ? office.usage : usageFromReadings(readings, now);
  const hasUsage = !!usage && Array.isArray(usage.services);
  const bots = office.bots.map(b => {
    if (!b || typeof b !== 'object') return b;
    const m = mergeBot(b, best[b.bot], now);
    return hasUsage && b.bot_id === USAGE_ROW_ID ? usageScreen(m, usage) : m;
  });
  const needs_tim = asks ? ask.build(office, asks.open, asks.resolved).needs_tim : office.needs_tim;
  const changed = JSON.stringify(bots) !== JSON.stringify(office.bots) || JSON.stringify(usage) !== JSON.stringify(office.usage) ||
    JSON.stringify(needs_tim) !== JSON.stringify(office.needs_tim);
  const doc = Object.assign({}, office, { bots, usage });
  if (asks) doc.needs_tim = needs_tim;
  if (changed) { if ('generated_at' in doc && !('updated_at' in doc)) doc.generated_at = iso(now); else doc.updated_at = iso(now); }
  return { doc, changed };
}
const serialize = doc => JSON.stringify(doc, null, 2) + '\n';

function collect(root) {
  const rd = p => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch (e) { return null; } };
  const js = p => { try { return JSON.parse(rd(p)); } catch (e) { return null; } };
  const ls = p => { try { return fs.readdirSync(path.join(root, p)).sort(); } catch (e) { return []; } };
  let log = '';
  try { log = execFileSync('git', ['log', '-n', '200', '--format=%h%x1f%aI%x1f%an%x1f%B%x1e'], { cwd: root, encoding: 'utf8', maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { log = ''; }
  return [].concat(
    automationSignals(js('control/AUTOMATIONS_STATUS.json'), js('state/AUTOMATION_EXECUTION_EVIDENCE.json'), js('control/AI_AUTOMATION_TASKS.json')),
    receiptSignals(ls('receipts')),
    changeSignals(ls('control/changes').filter(n => n.endsWith('.txt')), rd('control/CHANGE_RECORDS_CONSUMED.txt')),
    gitSignals(log));
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), file = path.join(root, OUT);
  let office; try { office = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('OFFICE_STATUS.json missing or invalid; nothing to do'); process.exit(0); }
  let asks; try { asks = { open: ask.collect(root, 'open'), resolved: ask.collect(root, 'resolved') }; } catch (e) { console.error('asks unreadable, needs_tim left as is: ' + e.message); }
  const { doc, changed } = build(office, collect(root), Date.now(), fs.readFileSync(path.join(root, 'usage/AI_USAGE_READINGS.jsonl'), 'utf8'), asks);
  if (changed) fs.writeFileSync(file, serialize(doc));
  console.log(changed ? 'wrote OFFICE_STATUS.json (bot rows and usage refreshed)' : 'OFFICE_STATUS.json unchanged');
}
module.exports = { nextCheckAt, usageFromReadings, build, serialize, mergeBot, newestByBot, receiptSignals, changeSignals, changeRecordName, gitSignals, automationSignals, etToUtc, ACTIVE_WINDOW };
