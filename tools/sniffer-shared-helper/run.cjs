'use strict';
// Sniffer's shared-helper runner (Tim 2026-11-18 01:18 ET via President): research only, free research tool only,
// no Writer authority. Pages Sniffer's ASSIGNED items with shared.next(), asks `research` (Groq/OpenRouter/DDG/
// Tavily/Jina; never --openai-credit, Gemini key removed from its environment), and returns at most one evidence-only
// batch per run on a sniffer-shared-helper-batch-* branch that the coordinator collects. No AI agent turn per item.
//   node tools/sniffer-shared-helper/run.cjs --repo <lean main checkout> [--apply] [--max N]
// Without --apply it writes the batch into the checkout and prints a summary; nothing is pushed.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const H = require('../helper-routing/shared.cjs'), S = require('../programmed-coordinator/store.cjs');
const TASK = H.SNIFFER_TASK, DIR = 'receipts/SNIFFER_HELPERS/' + TASK + '/';
const RESEARCH = process.env.SNIFFER_RESEARCH_BIN || '/home/box/.local/bin/research';
const RESEARCH_HOME = process.env.SNIFFER_RESEARCH_HOME || '/home/box/tools/research';
const STATE_DIR = process.env.SNIFFER_STATE_DIR || '/workspace/sniffer-shared-helper';
const RETRY_HOURS = 24, MAX_CAPTURE = 200000;
const ASK = { SALARY: 'the posted base pay range (currency and period)', DEGREE: 'the degree requirement or preference' };
const lit = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

// Free providers only. The OpenAI promo key is opt-in through RESEARCH_OPENAI_CREDIT; Gemini is a paid project.
function researchEnv(env = process.env) {
  const out = { ...env };
  for (const k of ['GEMINI_API_KEY', 'RESEARCH_OPENAI_CREDIT', 'OPENAI_API_KEY']) delete out[k];
  return out;
}
function assertFreeOnly(home = RESEARCH_HOME) {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')); } catch { }
  if (cfg.providers?.openai && cfg.providers.openai.opt_in_only === false) throw Error('RESEARCH_OPENAI_NOT_OPT_IN');
}
function question(item) {
  const asks = (item.missingFields || []).filter(f => ASK[f]).map(f => ASK[f]);
  if (!asks.length || !item.company || !item.title) return null;
  return `For the "${item.title}" job at ${item.company}${item.location ? ' in ' + item.location : ''}, what does the job posting state about ${asks.join(' and ')}? Quote the posting exactly.`;
}
function pageText(url, home = RESEARCH_HOME) {
  const sha = require('node:crypto').createHash('sha256').update(url).digest('hex');
  try { const p = JSON.parse(fs.readFileSync(path.join(home, 'cache', 'pages', sha + '.json'), 'utf8')); return p.status === 'ok' ? String(p.text || '') : ''; } catch { return ''; }
}
function salary(quote) {
  if (!/\b(year|annual|annually|yr|per annum)\b/i.test(quote)) return null;
  const m = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*(?:-|–|—|to)\s*\$?\s?(\d[\d,]*(?:\.\d+)?)\s*([kK])?/.exec(quote);
  if (!m) return null;
  const n = (v, k) => Math.round(Number(v.replace(/,/g, '')) * (k ? 1000 : 1));
  const low = n(m[1], m[2] || m[4]), high = n(m[3], m[4]);
  return low >= 10000 && high >= low ? { low, high } : null;
}
// One research answer becomes one evidence item, or null (nothing usable; the item stays assigned for a later retry).
function evidenceItem(item, result, { now = new Date(), text = pageText } = {}) {
  if (!result || result.exit !== 0) return null;
  const facts = (result.facts || []).filter(f => f && f.tag !== 'inference' && /^https:\/\//.test(f.url || '') && lit(f.quote).length >= 8);
  const raw = {}; let best = null;
  for (const f of facts) {
    if (best && f.url !== best.f.url) continue;
    const body = text(f.url);
    if (lit(body).length < 300 || !lit(body).includes(lit(f.quote))) continue;
    const pay = f.tag === 'source-stated' && (item.missingFields || []).includes('SALARY') ? salary(f.quote) : null;
    if (pay && !raw.SALARY_BASE_LOW) Object.assign(raw, { SALARY_BASE_LOW: String(pay.low), SALARY_BASE_HIGH: String(pay.high), SALARY_BASIS: 'EMPLOYER_POSTED', SALARY_SOURCE: f.url });
    else if ((item.missingFields || []).includes('DEGREE') && /\b(degree|bachelor|master|ph\.?d|b\.?s\.?|associate)\b/i.test(f.quote) && !raw.DEGREE_TEXT) Object.assign(raw, { DEGREE_TEXT: lit(f.quote), DEGREE_EVIDENCE_URL: f.url });
    else continue;
    if (!best || f.tag === 'source-stated' && best.f.tag !== 'source-stated') best = { f, body };
  }
  if (!best) return null;
  raw.SOURCE_URL = best.f.url;
  const capture = Buffer.byteLength(best.body, 'utf8') <= MAX_CAPTURE ? { capture: { kind: 'TEXT_EXTRACT', text: best.body } } : { sourceSha256: S.hash(best.body) };
  return {
    kind: item.kind, primaryId: item.primaryId, assignmentVersion: item.assignmentVersion, sourceVersion: item.sourceVersion,
    writerSubmitted: false, recommendation: 'ENRICHMENT_EVIDENCE_READY',
    sourceEvidence: { company: item.company, title: item.title, location: item.location, url: best.f.url, observedAt: now.toISOString(), quote: lit(best.f.quote), ...capture, proposedRawFields: raw }
  };
}
function readProgress(dir = STATE_DIR) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'progress.json'), 'utf8')); } catch { return { items: {} }; } }
function writeProgress(p, dir = STATE_DIR) { fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, 'progress.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(p, null, 1) + '\n'); fs.renameSync(f + '.tmp', f); }
// Unchanged work already returned, or already tried without evidence in the last day, is skipped.
function due(item, progress, now = Date.now()) {
  const p = progress.items[H.key(item)];
  if (!p || p.assignmentVersion !== item.assignmentVersion || p.sourceVersion !== item.sourceVersion) return true;
  return p.outcome !== 'RETURNED' && !(Date.parse(p.retryAfter) > now);
}
function select(work, progress, { max = 20, now = Date.now() } = {}) {
  const picked = [], skipped = { notEnrichment: 0, noQuestion: 0, notDue: 0 };
  let cursor = null;
  for (;;) {
    const page = H.next(work, TASK, cursor, now);
    for (const item of page.items) {
      if (picked.length >= max) return { picked, skipped };
      if (item.kind !== 'ENRICHMENT') { skipped.notEnrichment++; continue; }
      if (!question(item)) { skipped.noQuestion++; continue; }
      if (!due(item, progress, now)) { skipped.notDue++; continue; }
      picked.push(item);
    }
    if (!page.nextAfter || !page.items.length) return { picked, skipped };
    cursor = page.nextAfter;
  }
}
function askAll(items, { bin = RESEARCH, env = researchEnv() } = {}) {
  const input = items.map(i => JSON.stringify({ question: question(i), urls: [...new Set((i.sourceUrls || []).filter(u => /^https:\/\//.test(u)))] })).join('\n') + '\n';
  const r = cp.spawnSync(bin, ['--batch', '-'], { input, env, encoding: 'utf8', maxBuffer: 64e6, timeout: 45 * 60000 });
  if (r.error) throw r.error;
  return String(r.stdout || '').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } });
}
function stamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }
function git(root, args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function run({ root, apply = false, max = 20, now = new Date(), ask = askAll, text = pageText, progressDir = STATE_DIR, deliver = deliverBranch } = {}) {
  assertFreeOnly();
  const work = H.load(root);
  if (!work.providers[TASK]?.available) return { status: 'SNIFFER_UNAVAILABLE', returned: 0 };
  const progress = readProgress(progressDir), { picked, skipped } = select(work, progress, { max, now: now.getTime() });
  if (!picked.length) return { status: 'NO_DUE_WORK', returned: 0, skipped };
  if (!Number.isInteger(max) || max < 1 || max > 20) throw Error('MAX_ITEMS_1_TO_20_REQUIRED');
  const results = ask(picked), items = [], retryAfter = new Date(now.getTime() + RETRY_HOURS * 3600e3).toISOString();
  picked.forEach((item, n) => {
    let ev = null; try { ev = evidenceItem(item, results[n], { now, text }); } catch { }
    if (ev) items.push(ev);
    progress.items[H.key(item)] = { assignmentVersion: item.assignmentVersion, sourceVersion: item.sourceVersion, at: now.toISOString(), outcome: ev ? 'RETURNED' : results[n]?.exit === 75 ? 'QUEUED' : 'NO_EVIDENCE', retryAfter };
  });
  const queued = results.filter(r => r?.exit === 75).length;
  let batch = null, file = null, branch = null;
  if (items.length) {
    const runId = 'FORGE-SNIFFER-SHARED-' + stamp(now);
    batch = { schema: 'forge.shared-helper-batch.v1', provider: 'Sniffer', taskKey: TASK, assignmentId: work.assignmentId, runId, instructionCommit: git(root, ['rev-parse', 'HEAD']), writerSubmitted: false, items };
    H.validateBatch(batch, work);
    file = DIR + runId + '.json';
    S.immutable(root, file, batch);
    if (apply) branch = deliver(root, file, runId);
  }
  // Progress is saved only for work that was actually delivered (or checked without evidence), so a failed push retries.
  if (apply) writeProgress(progress, progressDir);
  return { status: items.length ? (apply ? 'DELIVERED' : 'DRY_RUN') : 'NO_EVIDENCE', asked: picked.length, returned: items.length, queued, skipped, file, branch, writerSubmitted: false };
}
// Receipt-only branch from main: the coordinator collects it without a PR or merge (tools/routine-handoffs/delivery.cjs).
function deliverBranch(root, file, runId) {
  const branch = 'sniffer-shared-helper-batch-' + runId.slice('FORGE-SNIFFER-'.length).toLowerCase();
  git(root, ['checkout', '-q', '-B', branch]);
  git(root, ['add', file]);
  git(root, ['-c', 'user.name=forge-sniffer-helper', '-c', 'user.email=forge-sniffer-helper@users.noreply.github.com', 'commit', '-q', '-m', 'SNIFFER FORGE-SHARED-HELPER: evidence-only return ' + runId + '\n\nPROVIDER=Sniffer\nRUN_ID=' + runId]);
  git(root, ['push', '-q', 'origin', 'HEAD:refs/heads/' + branch]);
  return branch;
}
if (require.main === module) {
  const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const root = path.resolve(opt('--repo') || path.resolve(__dirname, '../..'));
  try { console.log(JSON.stringify({ at: new Date().toISOString(), ...run({ root, apply: argv.includes('--apply'), max: Math.min(20, Math.max(1, Number(opt('--max') || 20))) }) })); }
  catch (e) { console.error(JSON.stringify({ at: new Date().toISOString(), error: String(e.message || e).slice(0, 300) })); process.exitCode = 1; }
}
module.exports = { run, select, evidenceItem, question, salary, researchEnv, assertFreeOnly, due, TASK };
