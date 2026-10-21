#!/usr/bin/env node
/* NEEDS TIM builder (Tim 2026-10-18 15:41 ET: "one place I can go to know what maintenance needs my attention").
   Reads this repo as written today and publishes attention/NEEDS_TIM.json for the Pipeline Explorer "Needs you" page.
   Sources: asks/ register, latest run receipt per lane, open handoffs, rejected edit requests, open pull requests
   (passed in as JSON by the workflow). Pure Node, no dependencies. Read-only except the one output file.
   Run: node tools/needs-tim/build.js [--root .] [--prs prs.json] [--now ISO] [--out attention/NEEDS_TIM.json] */
'use strict';
const fs = require('fs'), path = require('path');

const PROVIDERS = ['CLAUDE', 'CHATGPT', 'GROK'];
const LANE_ALIAS = { 'POSTING-VALIDATION': 'POSTVAL', 'WEB-CAREER-DISCOVERY': 'WEB', 'EMAIL-DISCOVERY': 'EMAIL' };
const UNFINISHED = /^(IN_PROGRESS|STARTED|PENDING|PREFLIGHT|ACTIVE|QUEUED_PENDING_WRITER)$/;
/* BLOCKED_* includes the 2026-10-18 instruction-runtime codes (BLOCKED_AUTHORITY, PAYLOAD_VALIDATION_BLOCKED) and older
   lane codes (WRITER_TRANSPORT_BLOCKED, BLOCKED_MAILBOX_VISIBILITY). */
const BLOCKED = /^(HARD_BLOCKED|FAILED|FAILED_NO_WORK|FAILED_WITH_\w+|BLOCKED_\w+|\w+_BLOCKED)$/;
const H = 3600000, DAY = 24 * H;

/* US Eastern offset for a local ET date: EDT from the 2nd Sunday of March to the 1st Sunday of November. */
function etOffset(y, m, d) {
  const nth = (month, n) => { const first = new Date(Date.UTC(y, month, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); };
  const start = nth(2, 2), end = nth(10, 1), md = m * 100 + d;
  return md >= 300 + start && md < 1100 + end ? '-04:00' : '-05:00';
}
function etIso(ymd, hhmm) {
  const y = +ymd.slice(0, 4), m = +ymd.slice(4, 6), d = +ymd.slice(6, 8), t = hhmm || '0000';
  return ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8) + 'T' + t.slice(0, 2) + ':' + t.slice(2, 4) + ':00' + etOffset(y, m, d);
}
function normLane(s) { s = String(s || '').toUpperCase().replace(/_/g, '-').replace(/^-+|-+$/g, ''); return LANE_ALIAS[s] || s; }

/* Receipt file name -> {lane, provider, at, runKey, phase}. Null for files that are not lane run receipts. */
function parseName(file) {
  const base = file.replace(/\.(txt|json)$/i, '');
  if (/^(AI_REASON_CHANGE_RECORD|AI_REASON_CHECK|AI_REASON_RUN_EVAL|EMAIL_BACKFILL_)/.test(base)) return null;
  const re = /FORGE[-_]([A-Z][A-Z_-]*?)[-_](CLAUDE|CHATGPT|GROK)[-_](\d{8})(?:[-_](\d{4})ET)?([-_A-Z0-9]*)$/;
  let m = base.match(re), lane, provider, ymd, hhmm, tail;
  if (m) { [, lane, provider, ymd, hhmm, tail] = m; }
  else {
    m = base.match(/FORGE[-_]([A-Z][A-Z_-]*?)[-_](\d{8})[-_](\d{4})ET([-_A-Z0-9]*)$/);
    if (!m) return null;
    [, lane, ymd, hhmm, tail] = m; provider = 'UNKNOWN';
  }
  lane = normLane(lane);
  if (/POSTVAL|POSTING/.test(lane) && lane.indexOf('FORGE') >= 0) lane = 'POSTVAL';
  const phaseM = String(tail || '').match(/(TERMINAL_DETAIL|TERMINAL|STANDDOWN|CHECKPOINT\d*|PREFLIGHT|START|EVAL\d*)$/);
  const phase = phaseM ? phaseM[1].replace(/\d+$/, '') : '';
  const variant = String(tail || '').replace(/[-_]?(TERMINAL_DETAIL|TERMINAL|STANDDOWN|CHECKPOINT\d*|PREFLIGHT|START|EVAL\d*)$/, '').replace(/^[-_]+/, '');
  return { lane, provider, at: etIso(ymd, hhmm), runKey: lane + '|' + provider + '|' + ymd + (hhmm || '') + (variant ? '|' + variant : ''), phase };
}

function field(text, key) {
  const m = text.match(new RegExp('^\\s*' + key + '\\s*[=:]\\s*(.+)$', 'm'));
  return m ? m[1].trim() : '';
}
/* Receipt body -> outcome fields. Handles key=value text receipts and single-object JSON (gofer). */
function parseBody(text) {
  const out = { status: '', stop: '', nextOwner: '', nextAction: '', timDecisions: '', blocker: '', json: null, provider: '' };
  const t = String(text || '').trim();
  if (t[0] === '{') { try { out.json = JSON.parse(t); } catch (e) { out.json = null; } }
  if (out.json) {
    const j = out.json, s = v => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));
    out.status = s(j.RUN_TERMINAL_STATUS || j.TERMINAL_STATUS || j.RUN_STATUS || j.STATUS).toUpperCase().split(/[\s(]/)[0];
    out.stop = s(j.STOP_REASON || j.TERMINAL_REASON); out.nextOwner = s(j.NEXT_OWNER); out.nextAction = s(j.NEXT_ACTION);
    out.timDecisions = s(j.TIM_DECISIONS); out.blocker = s(j.HARD_BLOCKER || j.OLDEST_BLOCKER); out.provider = s(j.PROVIDER).toUpperCase();
    return out;
  }
  const st = t.match(/^\s*(?:RUN_TERMINAL_STATUS|TERMINAL_STATUS|RUN_STATUS)\s*[=:]\s*([A-Z_]+)/m);
  out.status = st ? st[1] : '';
  if (!out.status) { const cv = t.match(/^\s*COVERAGE_STATUS\s*[=:]\s*([A-Z_]+)/m); if (cv) out.status = cv[1]; }
  out.stop = field(t, 'STOP_REASON') || field(t, 'TERMINAL_REASON');
  if (!out.status && /^HARD_BLOCKED/.test(out.stop)) out.status = 'HARD_BLOCKED';
  out.nextOwner = field(t, 'NEXT_OWNER'); out.nextAction = field(t, 'NEXT_ACTION');
  out.timDecisions = field(t, 'TIM_DECISIONS'); out.blocker = field(t, 'HARD_BLOCKER') || field(t, 'REMAINING_BLOCKERS');
  out.provider = (field(t, 'PROVIDER') || '').toUpperCase().split(/\s/)[0];
  return out;
}
const mentionsTim = s => /\bTim\b/.test(String(s || ''));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const ghUrl = (repo, p) => 'https://github.com/tpruittguitar/' + repo + '/blob/main/' + p.split(path.sep).join('/');
function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; }
function list(dir) { try { return fs.readdirSync(dir).filter(f => !f.startsWith('.')); } catch (e) { return []; } }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

function build(opts) {
  const root = opts.root || '.', now = opts.now ? Date.parse(opts.now) : Date.now(), items = [], lanes = [];
  const add = it => { if (it.source) it.source = String(it.source).split(path.sep).join('/'); items.push(it); };

  /* 1. asks/ register: open = asks/open/*.json without a matching asks/resolved/<id>.json */
  const resolved = {}, dismissed = {}, covered = [];
  list(path.join(root, 'asks', 'resolved')).filter(f => f.endsWith('.json')).forEach(f => {
    try {
      const r = JSON.parse(read(path.join(root, 'asks', 'resolved', f))); if (!r) return;
      if (r.id) resolved[r.id] = r;
      (Array.isArray(r.dismiss) ? r.dismiss : []).forEach(d => { if (d && d.itemId) dismissed[d.itemId + '@' + String(d.source || '').split(path.sep).join('/')] = r; });
    } catch (e) { /* skip unreadable */ }
  });
  list(path.join(root, 'asks', 'open')).filter(f => f.endsWith('.json')).forEach(f => {
    const rel = path.join('asks', 'open', f); let a;
    try { a = JSON.parse(read(path.join(root, rel))); } catch (e) {
      add({ id: 'ask-unreadable:' + f, section: 'UPKEEP', level: 'ACTION', title: 'Unreadable ask file ' + f, detail: 'The JSON in this file does not parse, so its question cannot be shown.', action: 'Any AI: fix the JSON.', source: rel, sourceUrl: ghUrl('forge-coordination', rel), at: null, raisedBy: '' });
      return;
    }
    if (!a || !a.id || resolved[a.id]) return;
    (Array.isArray(a.covers) ? a.covers : []).forEach(c => { covered.push(String(c)); });
    add({ id: 'ask:' + a.id, section: a.section === 'JOBS' ? 'JOBS' : 'DECIDE', level: a.level || 'ACTION', title: a.title || a.id, detail: a.detail || '', blocks: a.blocks || '', options: Array.isArray(a.options) ? a.options : [], recommended: a.recommended || '', action: a.action || 'Answer in chat; the AI records it in asks/resolved/.', source: rel, sourceUrl: ghUrl('forge-coordination', rel), at: a.raisedAt || null, raisedBy: a.raisedBy || '', askId: a.id, links: Array.isArray(a.links) ? a.links : [] });
  });

  /* 2. run receipts: newest receipt per run, newest run per lane+provider */
  const runs = {};
  list(path.join(root, 'receipts')).forEach(f => {
    const n = parseName(f); if (!n) return;
    const rel = path.join('receipts', f), b = parseBody(read(path.join(root, rel)));
    const provider = n.provider !== 'UNKNOWN' ? n.provider : (PROVIDERS.indexOf(b.provider) >= 0 ? b.provider : 'UNKNOWN');
    const key = n.runKey.replace('|UNKNOWN|', '|' + provider + '|');
    const rank = n.phase === 'TERMINAL' || n.phase === 'TERMINAL_DETAIL' || n.phase === 'STANDDOWN' ? 3 : (n.phase === 'CHECKPOINT' ? 2 : 1);
    const cur = runs[key];
    if (!cur || rank > cur.rank) runs[key] = { lane: n.lane, provider, at: n.at, phase: n.phase, rank, file: rel, body: b };
  });
  const fams = {};
  Object.keys(runs).forEach(k => { const r = runs[k], fk = r.lane + '|' + r.provider; (fams[fk] = fams[fk] || []).push(r); });
  Object.keys(fams).sort().forEach(fk => {
    const rs = fams[fk].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), last = rs[rs.length - 1], b = last.body;
    const name = last.lane + (last.provider !== 'UNKNOWN' ? ' · ' + last.provider : '');
    const recent = rs.filter(r => now - Date.parse(r.at) <= 7 * DAY);
    const gaps = []; for (let i = Math.max(1, rs.length - 6); i < rs.length; i++) gaps.push((Date.parse(rs[i].at) - Date.parse(rs[i - 1].at)) / H);
    const med = median(gaps), sinceH = (now - Date.parse(last.at)) / H;
    const finished = last.rank === 3 || (b.status && !UNFINISHED.test(b.status));
    const lane = { lane: last.lane, provider: last.provider, lastAt: last.at, lastStatus: b.status || (finished ? 'UNSTATED' : 'UNFINISHED'), lastFile: last.file, runs7d: recent.length, usualGapHours: med == null ? null : Math.round(med * 10) / 10, overdue: false };
    const src = { source: last.file, sourceUrl: ghUrl('forge-coordination', last.file), at: last.at, raisedBy: last.provider };
    if (BLOCKED.test(b.status || '')) {
      add(Object.assign({ id: 'run-blocked:' + fk, section: 'FAILED', level: 'BLOCKING', title: name + ' — last run ' + b.status.replace(/_/g, ' ').toLowerCase(), detail: clip(b.blocker || b.stop || 'No reason recorded in the receipt.', 400), action: clip(b.nextAction || 'Owner lane: clear the blocker on its next run; if it repeats, route it to Tim with the exact step needed.', 300) }, src));
    }
    if (!finished && sinceH > 6 && now - Date.parse(last.at) <= 7 * DAY) {
      add(Object.assign({ id: 'run-unfinished:' + fk, section: 'FAILED', level: 'WATCH', title: name + ' — run never wrote a terminal receipt', detail: 'Last receipt phase: ' + (last.phase || b.status || 'unknown') + '. Work from that run may be incomplete or unrecorded.', action: 'Owner lane: write the terminal receipt or rerun; check whether its Writer requests landed.' }, src));
    }
    if (last.lane === 'GOFER' && b.json) {
      const held = b.json.HELD && typeof b.json.HELD === 'object' ? b.json.HELD : {};
      Object.keys(held).forEach(k => { const cond = /\b(else|otherwise|if [^.]*then)\b[^.]*\bTim\b/i.test(held[k]); if (mentionsTim(held[k])) add(Object.assign({ id: 'gofer-held:' + k.slice(0, 80), section: 'JOBS', level: cond ? 'WATCH' : 'ACTION', title: 'Application record held: ' + clip(k, 120), detail: clip(held[k], 400), action: cond ? 'The gofer checks this first; it comes to you only if that check fails.' : 'Tell Claude the outcome (applied / rejected / not mine) so the gofer can record it.' }, src)); });
      const cf = String(b.json.CARRY_FORWARD_HOLDS || ''), cm = cf.match(/Tim rulings? needed on ([^;.]+)/i);
      if (cm) add(Object.assign({ id: 'gofer-archive:' + cm[1].trim(), section: 'JOBS', level: 'ACTION', title: 'Archive items need your ruling: ' + cm[1].trim(), detail: clip(cf, 400), action: 'Tell Claude your ruling per archive item; the gofer applies it next run.' }, src));
    } else if (mentionsTim(b.nextOwner)) {
      add(Object.assign({ id: 'run-next-owner:' + fk, section: 'DECIDE', level: 'ACTION', title: name + ' — next step is yours', detail: clip(b.nextOwner, 300), action: clip(b.nextAction || b.nextOwner, 300) }, src));
    }
    if (b.timDecisions) add(Object.assign({ id: 'run-tim-decisions:' + fk, section: 'DECIDE', level: 'ACTION', title: name + ' — decisions recorded as open', detail: clip(b.timDecisions, 400), action: 'Rule in chat; the AI records the ruling.' }, src));
    lanes.push(lane);
  });

  /* 2b. lane silence: judged per lane across providers, so a lane handed from one AI to another is not "overdue" */
  /* REV-155: a lane Tim paused (control/PAUSED_LANES.json) is quiet on purpose; it is marked paused, never "gone quiet". */
  let paused = {};
  try { const pj = JSON.parse(read(path.join(root, 'control', 'PAUSED_LANES.json')) || '{}'); Object.keys(pj.lanes || {}).forEach(k => { paused[normLane(k)] = pj.lanes[k]; }); } catch (e) { paused = {}; }
  const byLane = {};
  Object.keys(runs).forEach(k => { const r = runs[k]; (byLane[r.lane] = byLane[r.lane] || []).push(r); });
  Object.keys(byLane).sort().forEach(ln => {
    const rs = byLane[ln].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), last = rs[rs.length - 1];
    const recent = rs.filter(r => now - Date.parse(r.at) <= 7 * DAY);
    if (recent.length < 4) return;
    const gaps = []; for (let i = Math.max(1, rs.length - 6); i < rs.length; i++) gaps.push((Date.parse(rs[i].at) - Date.parse(rs[i - 1].at)) / H);
    const med = median(gaps), sinceH = (now - Date.parse(last.at)) / H, limit = Math.max(2 * med, 6);
    if (paused[ln]) { lanes.filter(l => l.lane === ln).forEach(l => { l.paused = paused[ln].since || true; }); return; }
    if (med == null || sinceH <= limit) return;
    lanes.filter(l => l.lane === ln).forEach(l => { l.overdue = true; });
    add({ id: 'lane-overdue:' + ln, section: 'UPKEEP', level: sinceH > 4 * Math.max(med, 3) ? 'ACTION' : 'WATCH', title: ln + ' lane has gone quiet (usually reports every ' + (Math.round(med * 10) / 10) + ' h)', detail: 'Last receipt ' + last.file.replace(/^receipts[\\/]/, '') + ' (' + last.provider + ', status ' + (last.body.status || 'unstated') + '). The scheduled task may be paused, out of usage, or failing before it writes a receipt. If this lane was retired on purpose, tell Claude so it can be dismissed.', action: 'Check the lane\'s scheduled task and its AI usage; restart it if stopped.', source: last.file, sourceUrl: ghUrl('forge-coordination', last.file), at: last.at, raisedBy: last.provider });
  });

  /* 3. handoffs still marked open and never referenced by a later receipt */
  const receiptTexts = list(path.join(root, 'receipts')).map(f => ({ f, t: read(path.join(root, 'receipts', f)) }));
  list(path.join(root, 'handoffs')).forEach(f => {
    const rel = path.join('handoffs', f), t = read(path.join(root, rel));
    if (/SUPERSEDED/i.test(t)) return;
    const open = /HANDOFF_STATUS\s*=\s*OPEN/.test(t) || /STATUS\s*=\s*Awaiting Tim/i.test(t) || /STATE\s*=\s*READY_FOR_OWNER_REVIEW/.test(t);
    if (!open) return;
    const stem = f.replace(/\.(txt|json)$/i, '');
    if (receiptTexts.some(x => x.t.indexOf(stem) >= 0)) return;
    const dm = f.match(/(\d{8})[-_](\d{4})ET/), at = dm ? etIso(dm[1], dm[2]) : null;
    add({ id: 'handoff-open:' + f, section: 'UPKEEP', level: 'WATCH', title: 'Handoff still marked open: ' + clip(t.split(/\r?\n/)[0] || f, 100), detail: clip(field(t, 'INCIDENT') || field(t, 'NEXT_ACTION') || field(t, 'NEXT') || f, 300), action: 'Owner: act on it, or add a closing receipt that names this file if it is already resolved.', source: rel, sourceUrl: ghUrl('forge-coordination', rel), at, raisedBy: (f.match(/^(CLAUDE|CHATGPT|GROK)/) || [])[1] || '' });
  });

  /* 4. rejected edit requests */
  list(path.join(root, 'edit-requests', 'rejected')).filter(f => f.endsWith('.result.txt')).forEach(f => {
    const rel = path.join('edit-requests', 'rejected', f), t = read(path.join(root, rel)).trim();
    const dm = f.match(/(\d{8})_(\d{4})ET/);
    add({ id: 'edit-rejected:' + f, section: 'FAILED', level: 'ACTION', title: 'Edit request rejected: ' + f.replace(/\.result\.txt$/, ''), detail: clip(t, 300), action: 'Requesting lane: fix and resubmit, or drop it.', source: rel, sourceUrl: ghUrl('forge-coordination', rel), at: dm ? etIso(dm[1], dm[2]) : null, raisedBy: (f.match(/^(CLAUDE|CHATGPT|GROK)/) || [])[1] || '' });
  });

  /* 5. open pull requests (fetched by the workflow; optional) */
  (opts.prs || []).forEach(pr => {
    const dnm = /DO NOT MERGE/i.test(pr.title || '');
    add({ id: 'pr:' + pr.repo + '#' + pr.number, section: 'UPKEEP', level: dnm || pr.draft ? 'WATCH' : 'ACTION', title: pr.repo + ' PR #' + pr.number + (pr.draft ? ' (draft)' : '') + ': ' + clip(pr.title, 120), detail: 'Open since ' + String(pr.created_at || '').slice(0, 10) + '. ' + (dnm ? 'Marked DO NOT MERGE — close it if no longer needed.' : pr.draft ? 'Draft — merge, keep, or close.' : 'Waiting for your review and merge.'), action: 'Open the PR → review → Merge (or Close with a one-line reason).', source: pr.repo + ' #' + pr.number, sourceUrl: pr.url, at: pr.created_at || null, raisedBy: (String(pr.title || '').match(/^(CLAUDE|CHATGPT|GROK)\b/) || [])[1] || '' });
  });

  const dismissedOut = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], key = it.id + '@' + String(it.source || '').split(path.sep).join('/');
    if (!it.askId && covered.some(c => it.id.indexOf(c) === 0)) { items.splice(i, 1); continue; }
    if (dismissed[key]) { dismissedOut.push({ id: it.id, source: it.source, by: dismissed[key].resolvedBy || '', reason: dismissed[key].ruling || dismissed[key].reason || '' }); items.splice(i, 1); }
  }
  const order = { BLOCKING: 0, ACTION: 1, WATCH: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || (Date.parse(a.at || 0) || 0) - (Date.parse(b.at || 0) || 0));
  const counts = { total: items.length, BLOCKING: 0, ACTION: 0, WATCH: 0, DECIDE: 0, JOBS: 0, FAILED: 0, UPKEEP: 0 };
  items.forEach(i => { counts[i.level]++; counts[i.section]++; });
  return { schema: 'forge.needs-tim.v1', builtAt: new Date(now).toISOString(), sourceCommit: opts.commit || '', counts, items, lanes, dismissed: dismissedOut };
}

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  const root = arg('--root') || '.', out = arg('--out') || path.join(root, 'attention', 'NEEDS_TIM.json');
  let prs = []; if (arg('--prs')) { try { prs = JSON.parse(fs.readFileSync(arg('--prs'), 'utf8')); } catch (e) { prs = []; } }
  const res = build({ root, prs, now: arg('--now') || '', commit: process.env.GITHUB_SHA || '' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const prev = read(out); let same = false;
  try { const p = JSON.parse(prev); same = JSON.stringify([p.items, p.lanes, p.dismissed]) === JSON.stringify([res.items, res.lanes, res.dismissed]); } catch (e) { same = false; }
  if (!same) fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
  process.stdout.write('NEEDS_TIM items=' + res.items.length + ' blocking=' + res.counts.BLOCKING + ' action=' + res.counts.ACTION + ' watch=' + res.counts.WATCH + (same ? ' (unchanged; file not rewritten)' : ' (written)') + '\n');
}
module.exports = { build, parseName, parseBody, etIso };
