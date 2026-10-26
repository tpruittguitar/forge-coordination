#!/usr/bin/env node
/* CHANGE REGISTER consolidator. Every PR used to append its own line to control/CHANGE_REGISTER.txt, so every merge to
   main put every other open PR in conflict, and branch-chosen REVs collided (two REV-184 lines, 2026-10-22). Now a PR
   adds its own record file, control/changes/<id>.txt (no REV), and this tool, run by .github/workflows/change-register.yml
   on main, appends one register line per record in merge order with the next REV, logs the record in
   control/CHANGE_RECORDS_CONSUMED.txt and deletes the record file.
   Guarantees: the existing register text is never changed, only appended to (checked before writing); a record id that
   was consumed before, or a record repeating an existing line (same repo, PR and WHAT), is refused; a second run with no
   new records changes nothing. Pure Node, no dependencies.
   Run: node tools/change-register/consolidate.js [--root .] [--summary out.json] */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');

const REGISTER = 'control/CHANGE_REGISTER.txt';
const LEDGER = 'control/CHANGE_RECORDS_CONSUMED.txt';
const RECORDS_DIR = 'control/changes';
const REPOS = ['forge-coordination', 'foreman-cockpit', 'forge-policy', 'forge-writer-state'];
const HOME_REPO = 'forge-coordination';
const STATUSES = ['MERGED', 'LIVE'];
const KEYS = ['REPO', 'PR', 'STATUS', 'DATE', 'WHAT', 'REV'];
/* Keys lanes have put in records by mistake (POSTVAL, 2026-10-23), with the fix to show in the error. They stay errors. */
const KEY_HINTS = {
  PROVIDER: 'PROVIDER belongs in the commit message, not the record; delete this line',
  RUN_ID: 'RUN_ID belongs in the commit message, not the record; delete this line',
  CHANGE: 'use WHAT= for the description',
};
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/;
const WHAT_MAX = 1000;

/* Files in control/changes/ that are records: <id>.txt, except README.txt and names starting with "_". */
function isRecordFile(name) {
  if (!/\.txt$/.test(name) || /^readme\.txt$/i.test(name) || name.startsWith('_')) return false;
  return true;
}
function recordId(name) { return name.replace(/\.txt$/, ''); }

/* Record text -> {fields, errors}. KEY=VALUE lines; "#" lines and blank lines ignored; WHAT may contain "=". */
function parseRecord(text, id) {
  const fields = {}, errors = [];
  if (id !== undefined && !ID_RE.test(id)) errors.push('file name must be letters, digits, ".", "_" or "-" (3-100 chars) + .txt');
  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq < 1) { errors.push('line ' + (i + 1) + ': expected KEY=VALUE'); return; }
    const key = line.slice(0, eq).trim().toUpperCase(), value = line.slice(eq + 1).trim();
    if (KEYS.indexOf(key) < 0) { errors.push('line ' + (i + 1) + ': unknown key ' + key + (KEY_HINTS[key] ? ': ' + KEY_HINTS[key] : '') + ' (allowed: ' + KEYS.join(', ') + ')'); return; }
    if (key in fields) { errors.push('line ' + (i + 1) + ': ' + key + ' given twice'); return; }
    fields[key] = value;
  });
  if (!fields.REPO) fields.REPO = HOME_REPO;
  if (!fields.STATUS) fields.STATUS = 'MERGED';
  fields.STATUS = fields.STATUS.toUpperCase();
  if (REPOS.indexOf(fields.REPO) < 0) errors.push('REPO must be one of ' + REPOS.join(', '));
  if (STATUSES.indexOf(fields.STATUS) < 0) errors.push('STATUS must be ' + STATUSES.join(' or ') + ' (the record is registered when it lands on main)');
  if (!fields.WHAT) errors.push('WHAT is required');
  else if (fields.WHAT.length > WHAT_MAX) errors.push('WHAT is longer than ' + WHAT_MAX + ' characters');
  if (fields.PR !== undefined && !/^(#\d+|direct)$/.test(fields.PR)) errors.push('PR must be #<number> or direct (omit it to use the PR that merges this record)');
  if (fields.REPO !== HOME_REPO && !fields.PR) errors.push('PR is required when REPO is not ' + HOME_REPO + ' (the merging PR is a ' + HOME_REPO + ' PR)');
  if (fields.DATE !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fields.DATE)) errors.push('DATE must be YYYY-MM-DD');
  if (fields.REV !== undefined && !/^REV-\d{3,}$/.test(fields.REV)) errors.push('REV must look like REV-187 (only for a number reserved in ' + LEDGER + ')');
  return { fields, errors };
}

function revNumbers(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach(l => { const m = l.match(/^REV-(\d+)\b/); if (m) out.push(+m[1]); });
  return out;
}
/* The register's table lines (REV-NNN ...), in order. The PR check compares these between base and head. */
function entryLines(text) { return String(text).split(/\r?\n/).filter(l => /^REV-\d+\b/.test(l)).map(l => l.replace(/\s+$/, '')); }

/* Ledger: "CONSUMED REV-195  <id>  <pr>  <date>" and "RESERVED REV-187  <pr>  <note>" lines. */
function parseLedger(text) {
  const consumed = {}, reserved = {};
  String(text || '').split(/\r?\n/).forEach(l => {
    let m = l.match(/^CONSUMED\s+(REV-\d+)\s+(\S+)/); if (m) { consumed[m[2]] = m[1]; return; }
    m = l.match(/^RESERVED\s+(REV-\d+)\s+(\S+)/); if (m) reserved[m[1]] = m[2];
  });
  return { consumed, reserved };
}

function pad(s, w) { s = String(s); return s.length + 2 > w ? s + '  ' : s.padEnd(w); }
function formatLine(rev, f) {
  return pad(rev, 9) + pad(f.DATE, 12) + pad(f.REPO, 21) + pad(f.PR, 14) + pad(f.STATUS, 9) + f.WHAT;
}
const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
function dupKey(repo, pr, what) { return norm(repo) + '|' + norm(pr) + '|' + norm(what); }
function registerKeys(text) {
  const keys = {};
  entryLines(text).forEach(l => {
    const m = l.match(/^(REV-\d+)\s+\S+\s+(\S+)\s+(\S+)\s+\S+\s+(.*)$/);
    if (m) keys[dupKey(m[2], m[3], m[4])] = m[1];
  });
  return keys;
}

/* ET calendar date of an ISO timestamp (the register's dates are Tim's local dates). */
function etDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/* Pure core. records: [{id, text, order, pr, date}] where order is merge position on main (lower = earlier), pr is the
   merging PR ("#45" or "direct") and date the merge date (YYYY-MM-DD), both from git. Returns the new register and
   ledger text plus what happened to each record:
   added [{id, rev, line}] (delete the file), refused [{id, reason}] (duplicate; delete the file),
   rejected [{id, errors}] (invalid; leave the file for a person to fix). */
function consolidate({ register, ledger, records }) {
  const eol = /\r\n/.test(register) ? '\r\n' : '\n';
  const ledgerEol = /\r\n/.test(ledger || '') ? '\r\n' : '\n';
  const { consumed, reserved } = parseLedger(ledger);
  const used = {}; revNumbers(register).forEach(n => { used[n] = true; });
  let next = Math.max(0, ...revNumbers(register), ...Object.keys(reserved).map(r => +r.slice(4))) + 1;
  const seen = registerKeys(register), batchIds = {};
  const added = [], refused = [], rejected = [], lines = [], ledgerLines = [];
  const sorted = records.slice().sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  sorted.forEach(r => {
    const { fields, errors } = parseRecord(r.text, r.id);
    if (errors.length) { rejected.push({ id: r.id, errors }); return; }
    if (consumed[r.id]) { refused.push({ id: r.id, reason: 'record id already consumed as ' + consumed[r.id] }); return; }
    if (batchIds[r.id]) { refused.push({ id: r.id, reason: 'record id appears twice in this run' }); return; }
    const f = Object.assign({}, fields, { PR: fields.PR || r.pr || 'direct', DATE: fields.DATE || r.date });
    if (!f.DATE) { rejected.push({ id: r.id, errors: ['no DATE and no merge date known'] }); return; }
    const key = dupKey(f.REPO, f.PR, f.WHAT);
    if (seen[key]) { refused.push({ id: r.id, reason: 'same REPO, PR and WHAT as ' + seen[key] }); return; }
    let rev;
    if (f.REV) {
      const n = +f.REV.slice(4);
      if (!reserved[f.REV]) { rejected.push({ id: r.id, errors: [f.REV + ' is not reserved in ' + LEDGER + '; omit REV to get the next number'] }); return; }
      if (used[n]) { rejected.push({ id: r.id, errors: [f.REV + ' is already in the register; omit REV to get the next number'] }); return; }
      rev = f.REV;
    } else {
      while (used[next]) next++;
      rev = 'REV-' + String(next).padStart(3, '0');
    }
    used[+rev.slice(4)] = true; batchIds[r.id] = true;
    const line = formatLine(rev, f);
    seen[key] = rev; lines.push(line); added.push({ id: r.id, rev, line });
    ledgerLines.push('CONSUMED ' + pad(rev, 9) + pad(r.id, 2) + pad(f.PR, 2) + f.DATE);
  });
  let newRegister = register, newLedger = ledger || '';
  if (lines.length) {
    if (newRegister && !/\n$/.test(newRegister)) newRegister += eol;
    newRegister += lines.join(eol) + eol;
    if (newLedger && !/\n$/.test(newLedger)) newLedger += ledgerEol;
    newLedger += ledgerLines.map(l => l.replace(/\s+$/, '')).join(ledgerEol) + ledgerEol;
  }
  if (!newRegister.startsWith(register)) throw new Error('refusing to write: existing register text would change');
  if (!newLedger.startsWith(ledger || '')) throw new Error('refusing to write: existing ledger text would change');
  return { register: newRegister, ledger: newLedger, added, refused, rejected };
}

/* ---- git side: where each record landed on main ---- */
function git(root, args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function prFromSubject(subject) {
  let m = subject.match(/^Merge pull request #(\d+)\b/); if (m) return '#' + m[1];
  m = subject.match(/\(#(\d+)\)\s*$/); if (m) return '#' + m[1];
  return null;
}
/* Rebase merges leave no PR number in the subject; ask GitHub when a token is available. */
function prFromApi(sha) {
  if (!process.env.GITHUB_REPOSITORY || !(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)) return null;
  try {
    const n = cp.execFileSync('gh', ['api', 'repos/' + process.env.GITHUB_REPOSITORY + '/commits/' + sha + '/pulls', '--jq', '.[0].number // empty'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d+$/.test(n) ? '#' + n : null;
  } catch (e) { return null; }
}
function landing(root, rel, mainOrder) {
  let out = '';
  try { out = git(root, ['log', '--first-parent', '--diff-filter=A', '-1', '--format=%H%x09%cI%x09%s', '--', rel]); } catch (e) { out = ''; }
  if (!out) return { order: Number.MAX_SAFE_INTEGER, pr: null, date: etDate(new Date().toISOString()) };
  const [sha, iso, ...rest] = out.split('\t'), subject = rest.join('\t');
  return { order: sha in mainOrder ? mainOrder[sha] : Number.MAX_SAFE_INTEGER, pr: prFromSubject(subject) || prFromApi(sha) || 'direct', date: etDate(iso), sha };
}

function run(root) {
  const dir = path.join(root, RECORDS_DIR);
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(isRecordFile).sort() : [];
  const mainOrder = {};
  if (names.length) {
    let list = [];
    try { list = git(root, ['rev-list', '--first-parent', '--reverse', 'HEAD']).split('\n'); } catch (e) { list = []; }
    list.forEach((sha, i) => { mainOrder[sha] = i; });
  }
  const records = names.map(n => {
    const rel = RECORDS_DIR + '/' + n;
    return Object.assign({ id: recordId(n), text: fs.readFileSync(path.join(dir, n), 'utf8'), file: rel }, landing(root, rel, mainOrder));
  });
  const regPath = path.join(root, REGISTER), ledPath = path.join(root, LEDGER);
  const register = fs.readFileSync(regPath, 'utf8'), ledger = fs.existsSync(ledPath) ? fs.readFileSync(ledPath, 'utf8') : '';
  const res = consolidate({ register, ledger, records });
  if (res.register !== register) fs.writeFileSync(regPath, res.register);
  if (res.ledger !== ledger) fs.writeFileSync(ledPath, res.ledger);
  res.added.concat(res.refused).forEach(r => fs.unlinkSync(path.join(dir, r.id + '.txt')));
  return res;
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const root = path.resolve(opt('--root') || '.');
  const res = run(root);
  res.added.forEach(a => console.log('added ' + a.rev + ' from ' + a.id));
  res.refused.forEach(r => console.log('::warning file=' + RECORDS_DIR + '/' + r.id + '.txt::refused (record removed): ' + r.reason));
  res.rejected.forEach(r => console.log('::error file=' + RECORDS_DIR + '/' + r.id + '.txt::invalid record left in place: ' + r.errors.join('; ')));
  if (!res.added.length && !res.refused.length && !res.rejected.length) console.log('no pending change records');
  const summary = opt('--summary');
  if (summary) fs.writeFileSync(summary, JSON.stringify({ added: res.added, refused: res.refused, rejected: res.rejected }, null, 2));
}

module.exports = { consolidate, parseRecord, parseLedger, formatLine, entryLines, revNumbers, isRecordFile, recordId, prFromSubject, etDate, run,
  REGISTER, LEDGER, RECORDS_DIR, ID_RE };
