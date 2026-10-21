'use strict';
// REV-116 end-to-end dry run on a synthetic master: posting pay (ATS, then aggregator) before any estimate.
// Needs a foreman-cockpit checkout: ENRICH_FC_DIR (default ../foreman-cockpit next to this repo).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), FC = process.env.ENRICH_FC_DIR || path.resolve(ROOT, '../foreman-cockpit');
const row = (n, id, title, loc, payload) => `${n} | ${id} | Acme | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
const MASTER = [
  row(1, 'V2I-00000000000A', 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19'),
  row(2, 'V2I-00000000000B', 'Director of Quality', 'Akron, OH', 'SOURCE_URL=https://www.linkedin.com/jobs/view/director-quality-4012345678; DATE_ADDED=2026-10-18'),
  row(3, 'V2I-00000000000C', 'Director of Quality', 'Toledo, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333; DATE_ADDED=2026-10-17'),
  row(4, 'V2I-00000000000D', 'Director of Quality', 'Canton, OH', 'SOURCE_URL=https://example.com/careers/9; DATE_ADDED=2026-10-16'),
  row(5, 'V2I-00000000000E', 'Director, Quality', 'Detroit, MI', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=150000; SALARY_BASE_HIGH=190000; SALARY_MIDPOINT=170000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  row(6, 'V2I-00000000000F', 'Director, Quality', 'Columbus, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; SALARY_MIDPOINT=180000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  row(8, 'V2I-00000000000H', 'Director of Quality', 'Kent, OH', 'ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/888; ATS_CHECK_RESULT=CLOSED; LIVENESS=CLOSED_EMPLOYER_404; DATE_ADDED=2026-10-14'),
  row(7, 'V2I-00000000000G', 'Director of Quality', 'Lima, OH', 'SOURCE_URL=https://www.linkedin.com/jobs/view/9; ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/404; DATE_ADDED=2026-10-15'),
].join('\n') + '\n';

test('dry run: ATS pay, then aggregator pay, estimate only after the posting was read', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev116-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1' }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8')), by = {};
    out.sample.forEach(s => { by[s.id] = s.fields; });
    assert.strictEqual(out.dry, true); assert.strictEqual(out.writer_ok, 0);
    assert.deepStrictEqual([by['V2I-00000000000A'].SALARY_BASIS, by['V2I-00000000000A'].SALARY_BASE_LOW, by['V2I-00000000000A'].DEGREE_REQ], ['EMPLOYER_POSTED', 170000, 'REQUIRED']);
    assert.deepStrictEqual([by['V2I-00000000000B'].SALARY_BASIS, by['V2I-00000000000B'].SALARY_BASE_HIGH, by['V2I-00000000000B'].SALARY_SOURCE], ['EMPLOYER_POSTED', 190000, 'https://www.linkedin.com/jobs/view/4012345678']);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_BASIS, 'FORGE-ESTIMATE');
    assert.strictEqual(by['V2I-00000000000C'].SALARY_CONF, 'MED');
    assert.match(by['V2I-00000000000C'].SALARY_NOTE, /FORGE-ESTIMATE from 2 employer-posted comparable\(s\) \[V2I-00000000000E, V2I-00000000000F\].*this posting read, no pay stated; uncertainty: moderate/);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_ESTIMATE_BASIS, undefined);
    assert.deepStrictEqual(out.estimate_samples.map(x => x.id), ['V2I-00000000000C']);
    assert.strictEqual(by['V2I-00000000000D'], undefined, 'posting never read: no estimate');
    assert.strictEqual(out.estimate_waiting_for_posting, 2, 'D (never read) and G (ATS 404 unconfirmed, no aggregator read): Tim 2026-10-20 rule, an estimate only after a posting was read');
    // REV-136 (Grok Bot QA #19): the ATS link is found in ATS_POSTING_URL; a taken-down posting is reported, not retried or estimated
    // Grok Bot re-QA: a 404 is not proof the posting is gone (a bad address answers 404 too); it is reported, and the row still
    // gets its aggregator read and estimate. Closing belongs to the Writer's ATS checker.
    assert.strictEqual(out.ats_candidates, 4); assert.strictEqual(out.ats_unconfirmed, 1);
    assert.deepStrictEqual(out.ats_unconfirmed_rows.map(x => [x.id, x.status, x.checker]), [['V2I-00000000000G', 404, 'not checked']]);
    assert.strictEqual(out.skipped_closed, 1, 'a row the checker closed is skipped');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('submit: rows are re-read from the Writer first; pay a lane wrote meanwhile is never overwritten', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev119-')), master = path.join(dir, 'master.txt'), rows = path.join(dir, 'writer.json'), posts = path.join(dir, 'posts.jsonl'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const lines = MASTER.trim().split('\n'), byId = {}; lines.forEach(l => { byId[l.split(' | ')[1]] = l; });
  byId['V2I-00000000000C'] += '; SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=181000; SALARY_BASE_HIGH=222000; SALARY_MIDPOINT=201500';   // a lane posted pay after the read
  delete byId['V2I-00000000000B'];                                                                                                          // row gone (archived) since the read
  fs.writeFileSync(rows, JSON.stringify(byId));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: path.join(dir, 'ledger.json') }), stdio: 'pipe', timeout: 60000 });
    const sent = fs.readFileSync(posts, 'utf8').trim().split('\n').map(JSON.parse), reqs = sent.flatMap(b => b.requests), by = {};
    reqs.forEach(q => { by[q.ruling.primaryId] = q.ruling.fields; });
    assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].action, 'batch');
    assert.strictEqual(by['V2I-00000000000A'].SALARY_BASIS, 'EMPLOYER_POSTED');
    assert.strictEqual(by['V2I-00000000000B'], undefined, 'row no longer in the master: dropped');
    assert.ok(by['V2I-00000000000C'], 'degree still goes'); assert.strictEqual(by['V2I-00000000000C'].SALARY_BASIS, undefined, 'lane pay kept');
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.strictEqual(out.guard_dropped, 1); assert.strictEqual(out.submitted, reqs.length); assert.strictEqual(out.writer_ok, reqs.length);
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an unchanged dry run leaves the report byte for byte (no hourly commit)', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev121-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = () => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1' }), stdio: 'pipe', timeout: 60000 });
  try {
    fs.rmSync(report, { force: true }); run(); const first = fs.readFileSync(report, 'utf8');
    run(); assert.strictEqual(fs.readFileSync(report, 'utf8'), first);
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

