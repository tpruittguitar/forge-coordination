'use strict';
/* Which jobs waiting on Tim repeat a role he already applied to, was rejected from, or declined (Tim 2026-11-03).
   Reads the canonical master and the published decision queue, writes state/APPLIED_DUPLICATES_REPORT.json and .md, then
   (unless APPLIED_DUP_DRY=1 or a local master file is used) applies it through the Writer: same-posting rows are closed as
   DUPLICATE of the row Tim already decided; every other match stays active with a PRIOR_APPLICATION label.
   Local, report only: APPLIED_DUP_MASTER_FILE=<master.txt> node tools/applied-duplicates/run.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const M = require('./match');
const ROOT = path.resolve(__dirname, '../..');

function connection() {
  const fc = path.resolve(process.env.APPLIED_DUP_FC_DIR || '_fc'), cfg = {};
  vm.runInNewContext(fs.readFileSync(path.join(fc, 'pipeline-connection.js'), 'utf8').replace(/^var /m, 'this.'), cfg);
  return cfg.PipelineConnection;
}
async function masterText() {
  if (process.env.APPLIED_DUP_MASTER_FILE) return { text: fs.readFileSync(process.env.APPLIED_DUP_MASTER_FILE, 'utf8'), source: { kind: 'LOCAL_FILE', file: path.basename(process.env.APPLIED_DUP_MASTER_FILE) } };
  const R = require('../source-intake/writer-reader');
  const result = await R.read('master', { key: connection().key });
  const text = result.data.text; R.parseMaster(text); // completeness marker and identity checks; throws when incomplete
  return { text, source: { kind: 'CANONICAL_WRITER_MASTER', readAt: result.completedAt || null } };
}

function markdown(report) {
  const c = report.counts, row = i => `| ${i.score ?? ''} | ${i.company} | ${i.title} | ${i.label} | ${i.evidence.replace(/\|/g, '/')} | ${i.id} → ${i.matches[0].id} |`;
  const table = (title, list, note) => [`## ${title} (${list.length})`, note, '', '| Score | Company | Title | Label | Evidence | Rows |', '|---|---|---|---|---|---|', ...list.map(row), ''];
  const by = o => report.items.filter(i => i.outcome === o);
  return [
    '# Applied-duplicate dry run', '',
    `Generated ${report.at} from ${report.masterSource.kind}.`, '',
    `Of ${c.waiting} jobs waiting on Tim, ${c.matched} match a role he already applied to, was rejected from, or declined:`,
    `- **Closed as duplicates (same posting): ${c.CLOSE_CANDIDATE}**`,
    `- Kept, labeled with the earlier application (new posting, different site, or possible repeat): ${c.KEEP_LABEL}`, '',
    report.applied ? `Writer: ${report.applied.closed} closed, ${report.applied.labeled} labeled, ${report.applied.already} already done, ${report.applied.deferred} deferred to the next run, ${report.applied.failed} failed.` : 'Report only: nothing was written.', '',
    'Not covered: applications that exist only as an email and were never recorded in the master. Those need the email lane.', '',
    ...table('Closed: same posting', by('CLOSE_CANDIDATE'), 'Marked DUPLICATE of the row Tim already decided. Reopen from the row if one is wrong.'),
    ...table('Kept, labeled', by('KEEP_LABEL'), 'Still active. Tim\'s normal Apply or Decline settles them; nothing waits on him.'),
  ].join('\n') + '\n';
}

async function main() {
  const { text, source } = await masterText();
  const lines = text.split(/\r?\n/).filter(l => /^\d+\s*\|\s*V2[A-Z]-/.test(l));
  const qFile = path.join(ROOT, 'state/PIPELINE_WAITING_QUEUES.json');
  const queue = fs.existsSync(qFile) ? JSON.parse(fs.readFileSync(qFile, 'utf8')) : null;
  const waitingIds = queue?.ids?.decision?.length ? new Set(queue.ids.decision) : null;
  const result = M.classify(lines, { waitingIds });
  const report = {
    schema: 'forge.applied-duplicates.v2', at: new Date().toISOString(),
    masterSource: { ...source, rows: lines.length, sha256: crypto.createHash('sha256').update(text).digest('hex') },
    waitingSource: waitingIds ? { file: 'state/PIPELINE_WAITING_QUEUES.json', at: queue.at, decision: waitingIds.size } : { fallback: 'active statuses' },
    ...result
  };
  const dry = process.env.APPLIED_DUP_DRY === '1' || !!process.env.APPLIED_DUP_MASTER_FILE;
  report.mode = dry ? 'REPORT_ONLY' : 'APPLY';
  if (!dry && result.items.length) {
    const conn = connection();
    const fetchJson = async (url, opts) => { const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(90000) }); if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); };
    report.applied = await require('./apply').apply(result.items, { url: conn.url, key: conn.key, parseLine: M.parseLine, fetchJson });
  }
  fs.writeFileSync(path.join(ROOT, 'state/APPLIED_DUPLICATES_REPORT.json'), JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(ROOT, 'state/APPLIED_DUPLICATES_REPORT.md'), markdown(report));
  console.log(JSON.stringify({ mode: report.mode, counts: report.counts, rules: report.rules, applied: report.applied || null }));
}
if (require.main === module) main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { markdown };
