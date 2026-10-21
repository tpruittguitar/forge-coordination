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
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8')), by = {};
    out.sample.forEach(s => { by[s.id] = s.fields; });
    assert.strictEqual(out.dry, true); assert.strictEqual(out.writer_ok, 0);
    assert.deepStrictEqual([by['V2I-00000000000A'].SALARY_BASIS, by['V2I-00000000000A'].SALARY_BASE_LOW, by['V2I-00000000000A'].DEGREE_REQ], ['EMPLOYER_POSTED', 170000, 'REQUIRED']);
    assert.deepStrictEqual([by['V2I-00000000000B'].SALARY_BASIS, by['V2I-00000000000B'].SALARY_BASE_HIGH, by['V2I-00000000000B'].SALARY_SOURCE], ['EMPLOYER_POSTED', 190000, 'https://www.linkedin.com/jobs/view/4012345678']);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_BASIS, 'FORGE-ESTIMATE');
    // REV-138: the comparables are the same employer (Acme), so step 1 applies; BLS is offline in the test (NO_BLS, conf unchanged)
    assert.strictEqual(by['V2I-00000000000C'].SALARY_CONF, 'HIGH');
    assert.match(by['V2I-00000000000C'].SALARY_SOURCE, /^same-employer:V2I-00000000000E,V2I-00000000000F$/);
    assert.match(by['V2I-00000000000C'].SALARY_NOTE, /FORGE-ESTIMATE from 2 same-employer posted range\(s\) \[V2I-00000000000E, V2I-00000000000F\]; same employer, 2 posted range\(s\).*BLS state wage n\/a; this posting read, no pay stated; uncertainty: narrow/);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_ESTIMATE_BASIS, undefined);
    assert.deepStrictEqual(out.estimate_samples.map(x => [x.id, x.basis, x.source, x.bls]), [['V2I-00000000000C', 'POSTING_READ', 'SAME_EMPLOYER', 'NO_BLS']]);
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

test('Tim 2026-10-21 02:15 ET: 2 failed posting reads on different days allow an estimate marked NO_POSTING_READ; 1 does not', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev136-')), master = path.join(dir, 'master.txt'), ledger = path.join(dir, 'ledger.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = () => { cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_LEDGER: ledger }), stdio: 'pipe', timeout: 60000 }); return JSON.parse(fs.readFileSync(report, 'utf8')); };
  try {
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: {} }));
    let out = run();
    assert.ok(!out.estimate_samples.some(x => x.id === 'V2I-00000000000G'), '1 failed read: still waiting'); assert.strictEqual(out.estimates_no_posting_read, undefined);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: { 'V2I-00000000000G': { dates: [yesterday], n: 1 } } }));
    out = run();
    const g = out.estimate_samples.find(x => x.id === 'V2I-00000000000G');
    assert.ok(g, '2 failed reads on different days: estimated'); assert.strictEqual(g.basis, 'NO_POSTING_READ'); assert.strictEqual(out.estimates_no_posting_read, 1);
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: { 'V2I-00000000000G': { dates: [new Date().toISOString().slice(0, 10)], n: 1 } } }));
    out = run();
    assert.ok(!out.estimate_samples.some(x => x.id === 'V2I-00000000000G'), 'two reads on the same day count once');
    assert.strictEqual(out.skipped_closed, 1, 'a CLOSED row is still skipped');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Tim 2026-10-21 03:10 ET: a comparables range shared by 3+ eligible roles goes in at LOW; same-employer estimates are unaffected', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev139-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const r2 = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
  const read = 'FEASIBILITY_ATTEMPT_ASOF=2026-10-20; DATE_ADDED=2026-10-19';   // posting already checked by a lane: estimate allowed
  fs.writeFileSync(master, [
    r2(1, 'V2I-0000000000S1', 'Zeta', 'Plant Manager', 'Akron, OH', read), r2(2, 'V2I-0000000000S2', 'Kappa', 'Plant Manager', 'Toledo, OH', read),
    r2(3, 'V2I-0000000000S3', 'Lambda', 'Plant Manager', 'Dayton, OH', read),
    r2(4, 'V2I-0000000000P1', 'Omega', 'Plant Manager', 'Columbus, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
    r2(5, 'V2I-0000000000P2', 'Sigma', 'Plant Manager', 'Detroit, MI', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=170000; SALARY_BASE_HIGH=210000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  ].join('\n') + '\n');
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(dir, 'bls.json'), ENRICH_EMPLOYER_CACHE: path.join(dir, 'emp.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.strictEqual(out.est_shared_low, 3);
    out.estimate_samples.filter(x => /^V2I-0000000000S/.test(x.id)).forEach(x => { assert.strictEqual(x.est[2], 'LOW'); assert.match(x.basis_detail, /range shared by 3 eligible roles/); });
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('REV-140: archived posted pay stays a comparable; remembered same-employer postings are reused; weak LOW estimates are upgraded', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev140-')), master = path.join(dir, 'master.txt'), archive = path.join(dir, 'archive.txt'), emp = path.join(dir, 'employer.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const r2 = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
  const read = 'FEASIBILITY_ATTEMPT_ASOF=2026-10-20; DATE_ADDED=2026-10-19';
  fs.writeFileSync(master, [
    r2(1, 'V2I-00000000Z001', 'Zeta Corp', 'Plant Manager', 'Akron, OH', read),                                                  // remembered Zeta posting
    r2(2, 'V2I-00000000U001', 'Upsilon', 'Plant Manager', 'Toledo, OH', 'SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=comparables:V2I-X; SALARY_BASE_LOW=150000; SALARY_BASE_HIGH=190000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
    r2(3, 'V2I-00000000U002', 'Upsilon', 'Plant Manager', 'Lima, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=175000; SALARY_BASE_HIGH=215000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  ].join('\n') + '\n');
  fs.writeFileSync(archive, r2(9, 'V2I-00000000A001', 'Archived Co', 'Plant Manager', 'Canton, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=165000; SALARY_BASE_HIGH=205000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS') + '\n');
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(emp, JSON.stringify({ employers: { zeta: [{ title: 'Plant Manager', location: 'Seattle, WA', state: 'WA', pay: { low: 190000, high: 240000 }, page: 'https://example.com/zeta/1', seen: today }] } }));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_ARCHIVE_FILE: archive, ENRICH_EMPLOYER_CACHE: emp, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(dir, 'bls.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8')), by = {}; out.estimate_samples.forEach(x => { by[x.id] = x; });
    assert.strictEqual(out.archive_anchors, 1, 'archived posted pay is a comparable');
    assert.strictEqual(by['V2I-00000000Z001'].source, 'SAME_EMPLOYER'); assert.match(by['V2I-00000000Z001'].basis_detail, /Plant Manager \(WA\) \$190K-\$240K/);
    assert.strictEqual(out.upgraded, 1); assert.strictEqual(by['V2I-00000000U001'].basis, 'UPGRADE'); assert.strictEqual(by['V2I-00000000U001'].source, 'SAME_EMPLOYER');
    assert.strictEqual(JSON.parse(fs.readFileSync(emp, 'utf8')).employers.zeta.length, 1, 'cache kept, not duplicated');
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
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: path.join(dir, 'ledger.json') }), stdio: 'pipe', timeout: 60000 });
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

test('QA REV-139: on BATCH_RULING_RETRY ("master changed") ok:true items are not counted as saved and are resubmitted next run', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev139-retry-')), master = path.join(dir, 'master.txt'), rows = path.join(dir, 'writer.json'), posts = path.join(dir, 'posts.jsonl'), ledger = path.join(dir, 'ledger.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const byId = {}; MASTER.trim().split('\n').forEach(l => { byId[l.split(' | ')[1]] = l; });
  fs.writeFileSync(rows, JSON.stringify(byId));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = mode => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: ledger, ENRICH_TEST_WRITER_MODE: mode }), stdio: 'pipe', timeout: 60000 });
  const ids = () => fs.readFileSync(posts, 'utf8').trim().split('\n').map(JSON.parse).flatMap(b => b.requests).map(q => q.ruling.primaryId).sort();
  try {
    run('RETRY');
    const first = ids(), out = JSON.parse(fs.readFileSync(report, 'utf8')), led = JSON.parse(fs.readFileSync(ledger, 'utf8'));
    assert.ok(first.length > 0);
    assert.strictEqual(out.writer_ok, 0, 'nothing was written'); assert.strictEqual(out.writer_not_written, first.length); assert.strictEqual(out.writer_retry, 1);
    first.forEach(id => assert.strictEqual(led.submitted[id], undefined, id + ' must not be marked submitted'));
    fs.rmSync(posts, { force: true });
    run('COMMIT');
    assert.deepStrictEqual(ids(), first, 'the same rows go again on the next run instead of waiting 48 h');
    const out2 = JSON.parse(fs.readFileSync(report, 'utf8')), led2 = JSON.parse(fs.readFileSync(ledger, 'utf8'));
    assert.strictEqual(out2.writer_ok, first.length); first.forEach(id => assert.ok(led2.submitted[id], id + ' saved after a committed batch'));
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an unchanged dry run leaves the report byte for byte (no hourly commit)', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev121-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = () => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json') }), stdio: 'pipe', timeout: 60000 });
  try {
    fs.rmSync(report, { force: true }); run(); const first = fs.readFileSync(report, 'utf8');
    run(); assert.strictEqual(fs.readFileSync(report, 'utf8'), first);
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

