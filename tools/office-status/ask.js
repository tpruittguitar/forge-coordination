#!/usr/bin/env node
'use strict';
// Local files only. Preview JSON by default; --write updates only needs_tim.
const fs = require('node:fs'), path = require('node:path');
const OUT = 'control/OFFICE_STATUS.json';
const BOT = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', GROK: 'President', PRESIDENT: 'President' };
const token = value => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

function waitingOnTim(ask) {
  const status = token(ask.status);
  if (['ANSWERED', 'RESOLVED', 'CLOSED'].includes(status) ||
      ask.answered === true || ask.resolved === true || ask.answeredAt || ask.resolvedAt) return false;
  const owner = ask.waitingOn ?? ask.waiting_on ?? ask.nextOwner ?? ask.NEXT_OWNER;
  if (owner != null && token(owner) !== 'TIM') return false;
  if (/^(AWAITING|WAITING|NEEDS)_/.test(status)) {
    return /^(AWAITING|WAITING|NEEDS)_(ON_)?TIM$/.test(status);
  }
  // asks/README.md: an open ask without a resolution is a question for Tim.
  return true;
}

// Pure: open/resolved entries are {file, ask}; neither inputs nor office are mutated.
// Sort by source filename (code-point order), independent of filesystem enumeration.
function build(office, open, resolved) {
  const closedIds = new Set(resolved.map(({ ask }) => ask.id).filter(Boolean));
  const closedFiles = new Set(resolved.map(({ file }) => file));
  const needs_tim = open.slice().sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
    .filter(({ file, ask }) => ask.id && !closedIds.has(ask.id) && !closedFiles.has(file) && waitingOnTim(ask))
    .map(({ file, ask }) => ({
      text: ask.title || ask.id,
      link: 'https://github.com/tpruittguitar/forge-coordination/blob/main/asks/open/' + encodeURIComponent(file),
      bot: BOT[token(ask.raisedBy)] || ask.raisedBy || '',
    }));
  return { ...office, needs_tim };
}

function collect(root, directory) {
  const dir = path.join(root, 'asks', directory);
  // Fail on missing/unreadable/invalid input rather than publishing an incomplete list.
  return fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => ({
    file, ask: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')),
  }));
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--write')) throw Error('Usage: node tools/office-status/ask.js [--write]');
    const root = path.resolve(__dirname, '../..'), file = path.join(root, OUT);
    const office = JSON.parse(fs.readFileSync(file, 'utf8'));
    const doc = build(office, collect(root, 'open'), collect(root, 'resolved'));
    const output = JSON.stringify(doc, null, 2) + '\n';
    if (args[0] === '--write') fs.writeFileSync(file, output);
    else process.stdout.write(output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { build };
