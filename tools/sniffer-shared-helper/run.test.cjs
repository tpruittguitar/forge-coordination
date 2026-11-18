'use strict';
const { test } = require('node:test'), a = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./run.cjs'), H = require('../helper-routing/shared.cjs'), S = require('../programmed-coordinator/store.cjs');
const item = n => ({ kind: 'ENRICHMENT', primaryId: 'V2I-' + n, company: 'Factory', title: 'Plant Manager', location: 'Austin, TX', missingFields: ['DEGREE', 'SALARY'], taskKey: R.TASK, provider: 'Sniffer', assignmentVersion: 2, sourceVersion: 'v1', status: 'ASSIGNED' });
const work = n => ({ schema: 'forge.shared-helper-work.v1', enabled: true, routingActive: true, assignmentId: 'A', providers: { FORGE_CLAUDE_SHARED_HELPER: { provider: 'Claude', available: true }, FORGE_GROK_SHARED_HELPER: { provider: 'Grok', available: false }, [R.TASK]: { provider: 'Sniffer', available: true } }, items: Array.from({ length: n }, (_, n) => item(n)) });
const quote = 'A bachelor degree or equivalent experience is required.', text = 'Employer posting. '.repeat(30) + quote;
const result = { exit: 0, facts: [{ quote, url: 'https://example.com/jobs/1', tag: 'source-stated' }] };
function tmp(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sniffer-runner-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
test('strips opt-in OpenAI and paid Gemini environment, leaves free providers', () => {
 const env = R.researchEnv({ RESEARCH_OPENAI_CREDIT: '1', GEMINI_API_KEY: 'bad', OPENAI_API_KEY: 'bad', GROQ_API_KEY: 'present' });
 a.deepEqual(env, { GROQ_API_KEY: 'present' });
});
test('fails closed if research config can invoke OpenAI without opt-in', t => {
 const dir = tmp(t);fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ providers: { openai: { opt_in_only: false } } }));
 a.throws(() => R.assertFreeOnly(dir), /NOT_OPT_IN/);
});
test('pages beyond the first twenty items and resumes without researching returned unchanged work', () => {
 const w = work(45), p = { items: {} };
 w.items.slice(0, 30).forEach(i => { p.items[H.key(i)] = { assignmentVersion: i.assignmentVersion, sourceVersion: i.sourceVersion, outcome: 'RETURNED' }; });
 const r = R.select(w, p); a.equal(r.picked.length, 15); a.equal(new Set(r.picked.map(H.key)).size, 15);
});
test('limits each artifact to twenty, retry waits a day, skips non-enrichment and unsupported gaps', () => {
 const w = work(50), p = { items: {} }; a.equal(R.select(w, p).picked.length, 20);
 p.items[H.key(w.items[0])] = { assignmentVersion: 2, sourceVersion: 'v1', outcome: 'NO_EVIDENCE', retryAfter: new Date(Date.now() + 3600e3).toISOString() };
 a.equal(R.due(w.items[0], p), false); w.items[0].assignmentVersion++; a.equal(R.due(w.items[0], p), true);
 w.items[0].kind = 'DISCOVERY'; delete w.items[0].primaryId;w.items[0].key = 'discovery:0'; w.items[1].missingFields = ['FIT'];
 w.items = w.items.slice(0, 3);const r = R.select(w, p);a.equal(r.skipped.notEnrichment, 1);a.equal(r.skipped.noQuestion, 1);
});
test('only source-linked literal quote is returned as research-only batch; no inferred or invented fields', () => {
 const i = item(1), ev = R.evidenceItem(i, result, { text: () => text });a.equal(ev.writerSubmitted, false);a.equal(ev.sourceEvidence.proposedRawFields.DEGREE_TEXT, quote);
 const b = { schema: 'forge.shared-helper-batch.v1', provider: 'Sniffer', taskKey: R.TASK, assignmentId: 'A', runId: 'FORGE-SNIFFER-TEST', instructionCommit: 'a'.repeat(40), items: [ev] };
 const w = work(1);w.items = [i];a.equal(H.validateBatch(b, w).valid, true);
 a.equal(R.evidenceItem(i, { ...result, exit: 75 }, { text: () => text }), null);
 a.equal(R.evidenceItem(i, { exit: 0, facts: [{ ...result.facts[0], tag: 'inference' }] }, { text: () => text }), null);
 a.equal(R.evidenceItem(i, result, { text: () => 'unrelated text '.repeat(30) }), null);
});
test('salary is only extracted from an explicit annual dollar range and employer-stated fact', () => {
 a.deepEqual(R.salary('$150,000 - $180,000 per year'), { low: 150000, high: 180000 });a.equal(R.salary('$50 - $70 per hour'), null);
 const i = item(1), f = { quote: '$150,000 - $180,000 per year', url: 'https://example.com/jobs/1', tag: 'third-party' };
 a.equal(R.evidenceItem(i, { exit: 0, facts: [f] }, { text: () => 'Employer. '.repeat(50) + f.quote }), null);
});
test('never combines fields from different sources into one source-bound item', () => {
 const facts = [...result.facts, { quote: '$150,000 - $180,000 per year', url: 'https://other.com/job', tag: 'source-stated' }];
 const e = R.evidenceItem(item(1), { exit: 0, facts }, { text: () => text + facts[1].quote });a.equal(e.sourceEvidence.proposedRawFields.SALARY_BASE_LOW, undefined);
});
test('runner validates before delivery; saving progress happens after successful delivery only', t => {
 const root = tmp(t), dir = path.join(root, 'progress'); S.save(root, H.FILE, work(1));
 require('node:child_process').execFileSync('git', ['init', '-q'], { cwd: root });
 require('node:child_process').execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'base'], { cwd: root });
 let called = 0;
 const r = R.run({ root, apply: true, ask: () => [result], text: () => text, progressDir: dir, deliver: () => { called++;return 'test-branch'; } });
 a.equal(r.returned, 1);a.equal(r.branch, 'test-branch');a.equal(r.writerSubmitted, false);a.equal(called, 1);a.ok(fs.existsSync(path.join(root, r.file)));
 a.equal(R.run({ root, apply: true, ask: () => { throw Error('must not ask again'); }, text: () => text, progressDir: dir }).status, 'NO_DUE_WORK');
});
