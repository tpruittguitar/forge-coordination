'use strict';
// REV-156 end-to-end on a synthetic master with canned boards and a canned JobSpy file. Needs a foreman-cockpit checkout.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), FC = process.env.ENRICH_FC_DIR || path.resolve(ROOT, '../foreman-cockpit');
const row = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;

test('REV-156 trial: boards + JobSpy, NEW vs EXISTING, read-only', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev156-'));
  fs.writeFileSync(path.join(dir, 'master.txt'), [
    row(1, 'V2I-00000000000A', 'Acme', 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; ANTI_RESURRECTION=YES; DO_NOT_REWORK=YES').replace('READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE', 'APPLIED | REJECTED_BY_EMPLOYER'),
    row(2, 'V2I-00000000000B', 'Globex', 'Plant Manager', 'Reno, NV', 'SOURCE_URL=https://www.linkedin.com/jobs/view/plant-manager-401'),
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'priority.txt'), 'DREAM (x): 1\n- Shield AI | careers: https://shield.ai/careers | Dallas\nP1 (y): 2\n- AEVEX | careers: https://job-boards.greenhouse.io/aevexaerospace | Tampa\n- Path Robotics | careers: UNKNOWN | Columbus\n');
  fs.writeFileSync(path.join(dir, 'jobspy.json'), JSON.stringify({ searches: [{ site: 'linkedin', term: 'Plant Manager', returned: 2 }], errors: [{ site: 'indeed', term: 'Plant Manager', error: '403' }], jobs: [
    { site: 'linkedin', title: 'Plant Manager', company: 'Globex', location: 'Reno, NV', job_url: 'https://www.linkedin.com/jobs/view/plant-manager-401' },
    { site: 'linkedin', title: 'Director of Manufacturing', company: 'Initech', location: 'Austin, TX', job_url: 'https://www.linkedin.com/jobs/view/9', min_amount: 180000, max_amount: 220000, interval: 'yearly' } ] }));
  // Terminal archive: AEVEX's Tampa Plant Manager was declined earlier, so the board's posting is protected, not NEW.
  fs.writeFileSync(path.join(dir, 'archive.txt'), 'V2_TERMINAL_ARCHIVE\n' + row(7, 'V2I-00000000000Z', 'AEVEX', 'Plant Manager', 'Tampa, FL', 'SOURCE_URL=https://job-boards.greenhouse.io/aevexaerospace/jobs/1').replace('READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE', 'DECLINED_BY_TIM | RESOLVED/DECLINED_BY_TIM') + '\n');
  // HiringCafe is read last: Initech and Globex are already covered by JobSpy, Hyperion is HiringCafe-only.
  fs.writeFileSync(path.join(dir, 'hiringcafe.json'), JSON.stringify({ ran: true, searches: [{ search: 'Director of Quality', returned: 4 }], errors: [], jobs: [
    { site: 'hiringcafe', company: 'Initech', title: 'Director of Manufacturing', location: 'Austin, Texas, United States', job_url: 'https://hiringcafe.com/job/dir-mfg-initech-aaaa1111', hiringcafe_id: 'aaaa1111' },
    { site: 'hiringcafe', company: 'Globex', title: 'Plant Manager', location: 'Reno, NV', job_url: 'https://hiringcafe.com/job/plant-manager-globex-bbbb2222', hiringcafe_id: 'bbbb2222' },
    { site: 'hiringcafe', company: 'Hyperion Robotics', title: 'Director of Quality', location: 'Columbus, OH', job_url: 'https://hiringcafe.com/job/dir-quality-hyperion-cccc3333', hiringcafe_id: 'cccc3333', min_amount: 190000, max_amount: 230000, interval: 'yearly' },
    { site: 'hiringcafe', company: 'Hyperion Robotics', title: 'Software Engineer', location: 'Columbus, OH', job_url: 'https://hiringcafe.com/job/swe-hyperion-dddd4444', hiringcafe_id: 'dddd4444' } ] }));
  const out = path.join(dir, 'out');
  cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')], { env: Object.assign({}, process.env, { TRIAL_FC_DIR: FC, TRIAL_MASTER_FILE: path.join(dir, 'master.txt'), TRIAL_PRIORITY_FILE: path.join(dir, 'priority.txt'), TRIAL_JOBSPY_FILE: path.join(dir, 'jobspy.json'), TRIAL_HIRINGCAFE_FILE: path.join(dir, 'hiringcafe.json'), TRIAL_ARCHIVE_FILE: path.join(dir, 'archive.txt'), TRIAL_OUT_DIR: out, TRIAL_FAST: '1' }), stdio: 'pipe', timeout: 60000 });
  const r = JSON.parse(fs.readFileSync(path.join(out, 'source-trial-report.json'), 'utf8')), s = r.summary;
  const titles = r.new_roles.map(x => x.company + '|' + x.title).sort();
  assert.deepStrictEqual(titles, ['Acme|Senior Director, Quality Assurance', 'Hyperion Robotics|Director of Quality', 'Initech|Director of Manufacturing', 'Shield AI|Director of Production'].sort());
  assert.deepStrictEqual(r.existing_roles.map(x => x.company + '|' + x.title).sort(), ['AEVEX|Plant Manager', 'Acme|Director of Quality', 'Globex|Plant Manager']);
  assert.strictEqual(r.protected_roles.some(x => x.company === 'AEVEX' && x.title === 'Plant Manager'), true, 'archived terminal role is protected, never NEW');
  assert.deepStrictEqual([s.archive.read, s.archive.rows], [true, 1]);
  assert.strictEqual(r.protected_roles.some(x => x.company === 'Acme' && x.title === 'Director of Quality'), true, 'parsed master-line protected state survives into report');
  assert.strictEqual(s.boards.protected >= 1, true, 'protected state included in board counts');
  assert.strictEqual(s.boards.existing >= s.boards.protected, true);
  assert.strictEqual(s.boards.new, 2); assert.strictEqual(s.jobspy.new, 1); assert.strictEqual(s.jobspy.sites.linkedin.returned, 2);
  assert.deepStrictEqual(s.priority_boards_probed.map(p => [p.company, p.found]), [['Shield AI', 'lever:shieldai'], ['Path Robotics', null]]);
  assert.strictEqual(r.new_roles.find(x => x.company === 'Acme').pay, '$200K-$250K');
  assert.strictEqual(r.new_roles[0].tier !== '', true, 'priority companies listed first');
  assert.deepStrictEqual([s.hiringcafe.returned, s.hiringcafe.matches, s.hiringcafe.unique, s.hiringcafe.new], [4, 3, 1, 1]);
  assert.deepStrictEqual(s.hiringcafe.already_found_by, { JOBSPY: 2 }, 'overlap attributed to the source that found the role first');
  assert.strictEqual(r.new_roles.find(x => x.company === 'Hyperion Robotics').source, 'HIRINGCAFE');
  assert.strictEqual(r.new_roles.find(x => x.company === 'Initech').source, 'JOBSPY:linkedin', 'earlier source keeps the role');
  assert.strictEqual(r.new_roles.find(x => x.company === 'Hyperion Robotics').pay, '$190K-$230K');
  const md = fs.readFileSync(path.join(out, 'source-trial-report.md'), 'utf8');
  assert.match(md, /Terminal archive: 1 rows read/); assert.match(md, /JobSpy errors: indeed: 403/); assert.match(md, /\| HiringCafe \(4 returned; 2 already found by JOBSPY 2\) \| 3 \(1 unique\) \| 1 \| 0 \|/); assert.match(md, /no board found: Path Robotics/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('board cursor follows Explorer rank and resumes at next', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev-cursor-'));
  fs.writeFileSync(path.join(dir, 'master.txt'), [
    row(1, 'V2I-00000000000A', 'Acme', 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111'),
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'priority.txt'), 'DREAM (x): 1\n- Shield AI | careers: https://shield.ai/careers | Dallas\nP1 (y): 1\n- AEVEX | careers: https://job-boards.greenhouse.io/aevexaerospace | Tampa\nPAUSED (z): 1\n- Machina Labs | careers: https://job-boards.greenhouse.io/acme | Chatsworth\n');
  fs.writeFileSync(path.join(dir, 'archive.txt'), 'V2_TERMINAL_ARCHIVE\n');
  const out = path.join(dir, 'out'), cursor = path.join(dir, 'board-cursor.json');
  const env = extra => Object.assign({}, process.env, { TRIAL_FC_DIR: FC, TRIAL_MASTER_FILE: path.join(dir, 'master.txt'), TRIAL_PRIORITY_FILE: path.join(dir, 'priority.txt'), TRIAL_ARCHIVE_FILE: path.join(dir, 'archive.txt'), TRIAL_OUT_DIR: out, TRIAL_CURSOR_FILE: cursor, TRIAL_FAST: '1', TRIAL_BOARDS_ONLY: '1', TRIAL_MAX_BOARDS: '1' }, extra);
  const run = extra => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')], { env: env(extra), stdio: 'pipe', timeout: 60000 });
  run();
  const first = JSON.parse(fs.readFileSync(path.join(out, 'board-discovery-report.json'), 'utf8'));
  const cur = JSON.parse(fs.readFileSync(cursor, 'utf8'));
  assert.deepStrictEqual(first.boards.map(b => b.board), ['lever:shieldai']);
  assert.strictEqual(cur.next, 'greenhouse:aevexaerospace');
  assert.strictEqual(cur.order.some(b => b.company === 'Machina Labs'), false, 'PAUSED is not in the board order');
  run();
  const second = JSON.parse(fs.readFileSync(path.join(out, 'board-discovery-report.json'), 'utf8'));
  assert.deepStrictEqual(second.boards.map(b => b.board), ['greenhouse:aevexaerospace']);
  assert.strictEqual(JSON.parse(fs.readFileSync(cursor, 'utf8')).next, 'greenhouse:acme');
  // A failed board is retained independently of the normal cursor. Recovery must not skip unread rotation work.
  const H=require('./board-health'),healthFile=path.join(out,'board-health.json'),health=H.loadState(fs.readFileSync(healthFile,'utf8'));
  H.record(health,{kind:'greenhouse',key:'greenhouse:acme',board:'acme',companies:new Set(['Acme'])},{status:'TEMPORARY_FAILURE',jobs:[],error:'HTTP 503',httpStatus:503,attempts:3,succeeded:0,failed:1},'2026-01-01T00:00:00Z');
  fs.writeFileSync(healthFile,JSON.stringify(health));fs.writeFileSync(cursor,JSON.stringify({next:'greenhouse:aevexaerospace'}));
  run();
  const recovered=JSON.parse(fs.readFileSync(path.join(out,'board-discovery-report.json'),'utf8'));
  assert.deepStrictEqual(recovered.boards.map(b=>b.board),['greenhouse:acme']);
  assert.strictEqual(JSON.parse(fs.readFileSync(cursor,'utf8')).next,'greenhouse:aevexaerospace');
  assert.strictEqual(JSON.parse(fs.readFileSync(healthFile,'utf8')).boards['greenhouse:acme'].status,'OK');
  run();assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(out,'board-discovery-report.json'),'utf8')).boards.map(b=>b.board),['greenhouse:aevexaerospace']);
  fs.rmSync(dir, { recursive: true, force: true });
});
