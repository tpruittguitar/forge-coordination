#!/usr/bin/env node
'use strict';
// Renders the President checksheet "Needs Tim" section from asks/open as Markdown. Local files only.
//   node tools/office-status/needs-tim-section.js [--out FILE] [--merge EXISTING_SECTION_FILE]
// --merge replaces only the text between the markers (appends markers if missing); everything else is kept byte-identical.
const fs = require('node:fs'), path = require('node:path');
const { collect, waitingEntries, BOT, token } = require('./ask.js');
const BEGIN = '<!-- NEEDS_TIM:BEGIN generated from asks/open -->', END = '<!-- NEEDS_TIM:END -->';
const EMPTY = 'Nothing needs Tim right now ✓';

function ageOf(ask, file, now) {
  let t = Date.parse(ask.raisedAt);
  if (!Number.isFinite(t)) { const m = /(\d{4})(\d{2})(\d{2})/.exec(ask.id || file); t = m ? Date.UTC(+m[1], m[2] - 1, +m[3]) : NaN; }
  if (!Number.isFinite(t)) return 'age unknown';
  const d = Math.floor(Math.max(0, now - t) / 86400000);
  if (d >= 1) return d + 'd';
  const h = Math.floor(Math.max(0, now - t) / 3600000);
  return h >= 1 ? h + 'h' : '<1h';
}

// Same set and order as the office board (waitingEntries sorts by source filename).
function render(open, resolved, now) {
  const rows = waitingEntries(open, resolved);
  const body = rows.length ? rows.map(({ file, ask }) => {
    const who = BOT[token(ask.raisedBy)] || ask.raisedBy || 'unknown';
    return '- **' + ask.id + '** — ' + String(ask.title || ask.summary || ask.id).replace(/\s+/g, ' ').trim() +
      ' (asking: ' + who + ', age: ' + ageOf(ask, file, now) + ')';
  }).join('\n') : EMPTY;
  return BEGIN + '\n' + body + '\n' + END;
}

function merge(existing, block) {
  const b = existing.indexOf(BEGIN), e = b < 0 ? -1 : existing.indexOf(END, b + BEGIN.length);
  if (b >= 0 && e >= 0) return existing.slice(0, b) + block + existing.slice(e + END.length);
  const sep = existing === '' ? '' : existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + sep + block + '\n';
}

if (require.main === module) {
  try {
    const a = process.argv.slice(2); let out, mergeFile;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '--out' && a[i + 1]) out = a[++i]; else if (a[i] === '--merge' && a[i + 1]) mergeFile = a[++i];
      else throw Error('Usage: node tools/office-status/needs-tim-section.js [--out FILE] [--merge EXISTING_SECTION_FILE]');
    }
    const root = path.resolve(__dirname, '../..');
    const block = render(collect(root, 'open'), collect(root, 'resolved'), Date.now());
    const text = mergeFile ? merge(fs.readFileSync(mergeFile, 'utf8'), block) : block + '\n';
    if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { render, merge, BEGIN, END, EMPTY };
