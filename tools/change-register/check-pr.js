#!/usr/bin/env node
/* PR check for the change-record flow (see consolidate.js). A PR must:
   - add at least one valid change record, control/changes/<id>.txt, whose id was never consumed before;
   - leave the entries of control/CHANGE_REGISTER.txt alone (no REV line added, removed or changed; header text may change);
   - leave the CONSUMED lines of control/CHANGE_RECORDS_CONSUMED.txt alone (the consolidator's ledger; RESERVED lines are
     Tim's reservations and may change in a reviewed PR).
   Bot authors (login ending in [bot]) and PRs carrying the label change-register-override (Tim's) are exempt.
   Run: node tools/change-register/check-pr.js --base <sha> --head <sha> [--author login] [--labels a,b] [--root .] */
'use strict';
const path = require('path'), cp = require('child_process');
const { parseRecord, parseLedger, entryLines, isRecordFile, recordId, REGISTER, LEDGER, RECORDS_DIR } = require('./consolidate.js');

const OVERRIDE_LABEL = 'change-register-override';

/* changed: [{status: 'A'|'M'|'D', path}]; read(rev, path) -> text or null; rev is 'base' or 'head'. */
function checkPr({ changed, read, author, labels }) {
  const errors = [], notes = [];
  const exempt = /\[bot\]$/.test(author || '') || (labels || []).indexOf(OVERRIDE_LABEL) >= 0;
  const { consumed } = parseLedger(read('base', LEDGER));
  let records = 0;
  changed.forEach(c => {
    if (c.path === REGISTER) {
      const before = entryLines(read('base', REGISTER) || ''), after = entryLines(read('head', REGISTER) || '');
      if (before.join('\n') !== after.join('\n')) {
        errors.push(REGISTER + ': register entries changed. Add a change record in ' + RECORDS_DIR + '/ instead; ' +
          'the REV is assigned when the PR merges. (Remove your REV line from this file.)');
      } else notes.push(REGISTER + ': header text changed; entries unchanged');
      return;
    }
    if (c.path === LEDGER) {
      const consumedLines = t => String(t || '').split(/\r?\n/).filter(l => /^CONSUMED\b/.test(l)).join('\n');
      if (consumedLines(read('base', LEDGER)) !== consumedLines(read('head', LEDGER))) errors.push(LEDGER + ': CONSUMED lines are written only by the change-register workflow');
      else notes.push(LEDGER + ': RESERVED lines changed');
      return;
    }
    if (path.posix.dirname(c.path) !== RECORDS_DIR) return;
    const name = path.posix.basename(c.path);
    if (!isRecordFile(name)) return;
    const id = recordId(name);
    if (c.status === 'D') { notes.push(c.path + ': record deleted'); return; }
    const { errors: errs } = parseRecord(read('head', c.path) || '', id);
    errs.forEach(e => errors.push(c.path + ': ' + e));
    if (consumed[id]) errors.push(c.path + ': record id "' + id + '" was already used for ' + consumed[id] + '; pick a new file name');
    if (c.status === 'A' && !errs.length) records++;
  });
  if (!records && !changed.some(c => c.status === 'M' && path.posix.dirname(c.path) === RECORDS_DIR && isRecordFile(path.posix.basename(c.path)))) {
    errors.push('no change record: add ' + RECORDS_DIR + '/<provider>-<yyyymmdd-hhmm>-<slug>.txt (see ' + RECORDS_DIR + '/README.txt)');
  }
  if (exempt && errors.length) { notes.push('exempt (' + (/\[bot\]$/.test(author || '') ? 'bot author' : OVERRIDE_LABEL + ' label') + '); would have failed:'); errors.forEach(e => notes.push('  ' + e)); return { ok: true, errors: [], notes }; }
  return { ok: !errors.length, errors, notes };
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const root = path.resolve(opt('--root') || '.'), base = opt('--base'), head = opt('--head');
  if (!base || !head) { console.error('usage: check-pr.js --base <sha> --head <sha> [--author login] [--labels a,b]'); process.exit(2); }
  const g = a => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  const mergeBase = g(['merge-base', base, head]).trim();
  const changed = g(['diff', '--no-renames', '--name-status', mergeBase, head]).split('\n').filter(Boolean)
    .map(l => { const [status, p] = l.split('\t'); return { status: status[0], path: p }; });
  const read = (rev, p) => { try { return g(['show', (rev === 'base' ? mergeBase : head) + ':' + p]); } catch (e) { return null; } };
  const labels = (opt('--labels') || '').split(',').map(s => s.trim()).filter(Boolean);
  const res = checkPr({ changed, read, author: opt('--author'), labels });
  res.notes.forEach(n => console.log(n));
  res.errors.forEach(e => console.log('::error::' + e));
  if (res.ok) console.log('change-record check passed');
  process.exit(res.ok ? 0 : 1);
}

module.exports = { checkPr, OVERRIDE_LABEL };
