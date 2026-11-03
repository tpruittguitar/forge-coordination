'use strict';
/* Dry-run report: which jobs waiting on Tim repeat a role he already applied to, was rejected from, or declined.
   Reads the canonical master (read-only Writer 'master' action) and the published decision queue, then writes
   state/APPLIED_DUPLICATES_REPORT.json and .md. Makes no Writer submissions and changes no rows.
   Local: APPLIED_DUP_MASTER_FILE=<master.txt> node tools/applied-duplicates/run.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const M = require('./match');
const ROOT = path.resolve(__dirname, '../..');

async function masterText() {
  if (process.env.APPLIED_DUP_MASTER_FILE) return { text: fs.readFileSync(process.env.APPLIED_DUP_MASTER_FILE, 'utf8'), source: { kind: 'LOCAL_FILE', file: path.basename(process.env.APPLIED_DUP_MASTER_FILE) } };
  const fc = path.resolve(process.env.APPLIED_DUP_FC_DIR || '_fc'), cfg = {};
  vm.runInNewContext(fs.readFileSync(path.join(fc, 'pipeline-connection.js'), 'utf8'), cfg);
  const R = require('../source-intake/writer-reader');
  const result = await R.read('master', { key: cfg.PipelineConnection.key });
  const text = result.data.text; R.parseMaster(text); // completeness marker and identity checks; throws when incomplete
  return { text, source: { kind: 'CANONICAL_WRITER_MASTER', readAt: result.completedAt || null } };
}

function markdown(report) {
  const c = report.counts, row = i => `| ${i.score ?? ''} | ${i.company} | ${i.title} | ${i.label} | ${i.evidence.replace(/\|/g, '/')} | ${i.id} → ${i.matches[0].id} |`;
  const table = (title, list, note) => [`## ${title} (${list.length})`, note, '', '| Score | Company | Title | Label | Evidence | Rows |', '|---|---|---|---|---|---|', ...list.map(row), ''];
  const by = o => report.items.filter(i => i.outcome === o);
  return [
    '# Applied-duplicate dry run', '',
    `Generated ${report.at} from ${report.masterSource.kind}. DRY RUN: nothing was closed or changed.`, '',
    `Of ${c.waiting} jobs waiting on Tim, ${c.matched} match a role he already applied to, was rejected from, or declined:`,
    `- **Would close (same posting): ${c.CLOSE_CANDIDATE}**`,
    `- Keep, labeled as a new posting or different site: ${c.KEEP_LABEL}`,
    `- Ask Tim (Same role / Different role): ${c.ASK_TIM}`, '',
    'Not covered: applications that exist only as an email and were never recorded in the master. Those need the email lane.', '',
    ...table('Would close: same posting', by('CLOSE_CANDIDATE'), 'Automatic closing starts only after Tim approves this list.'),
    ...table('Ask Tim', by('ASK_TIM'), 'Kept visible. One tap settles the whole role.'),
    ...table('Keep: new posting or different site', by('KEEP_LABEL'), 'Genuine new openings; shown with the earlier application dates.'),
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
    schema: 'forge.applied-duplicates.v1', mode: 'DRY_RUN', at: new Date().toISOString(),
    masterSource: { ...source, rows: lines.length, sha256: crypto.createHash('sha256').update(text).digest('hex') },
    waitingSource: waitingIds ? { file: 'state/PIPELINE_WAITING_QUEUES.json', at: queue.at, decision: waitingIds.size } : { fallback: 'active statuses' },
    ...result
  };
  fs.writeFileSync(path.join(ROOT, 'state/APPLIED_DUPLICATES_REPORT.json'), JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(ROOT, 'state/APPLIED_DUPLICATES_REPORT.md'), markdown(report));
  console.log(JSON.stringify({ counts: report.counts, rules: report.rules }));
}
if (require.main === module) main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { markdown };
