'use strict';
// REV-156 end-to-end on a synthetic master with canned boards and a canned JobSpy file. Needs a foreman-cockpit checkout.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), FC = process.env.ENRICH_FC_DIR || path.resolve(ROOT, '../foreman-cockpit');
const row = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;

test('REV-156 trial: boards + JobSpy, NEW vs EXISTING, read-only', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev156-'));
  fs.writeFileSync(path.join(dir, 'master.txt'), [
    row(1, 'V2I-00000000000A', 'Acme', 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111;ANTI_RESURRECTION=YES;DO_NOT_REWORK=YES').replace('READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE', 'APPLIED | REJECTED_BY_EMPLOYER'),
    row(2, 'V2I-00000000000B', 'Globex', 'Plant Manager', 'Reno, NV', 'SOURCE_URL=https://www.linkedin.com/jobs/view/plant-manager-401'),
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'priority.txt'), 'DREAM (x): 1\n- Shield AI | careers: https://shield.ai/careers | Dallas\nP1 (y): 2\n- AEVEX | careers: https://job-boards.greenhouse.io/aevexaerospace | Tampa\n- Path Robotics | careers: UNKNOWN | Columbus\n');
  fs.writeFileSync(path.join(dir, 'jobspy.json'), JSON.stringify({ searches: [{ site: 'linkedin', term: 'Plant Manager', returned: 2 }], errors: [{ site: 'indeed', term: 'Plant Manager', error: '403' }], jobs: [
    { site: 'linkedin', title: 'Plant Manager', company: 'Globex', location: 'Reno, NV', job_url: 'https://www.linkedin.com/jobs/view/plant-manager-401' },
    { site: 'linkedin', title: 'Director of Manufacturing', company: 'Initech', location: 'Austin, TX', job_url: 'https://www.linkedin.com/jobs/view/9', min_amount: 180000, max_amount: 220000, interval: 'yearly' } ] }));
  const out = path.join(dir, 'out');
  cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')], { env: Object.assign({}, process.env, { TRIAL_FC_DIR: FC, TRIAL_MASTER_FILE: path.join(dir, 'master.txt'), TRIAL_PRIORITY_FILE: path.join(dir, 'priority.txt'), TRIAL_JOBSPY_FILE: path.join(dir, 'jobspy.json'), TRIAL_OUT_DIR: out, TRIAL_FAST: '1' }), stdio: 'pipe', timeout: 60000 });
  const r = JSON.parse(fs.readFileSync(path.join(out, 'source-trial-report.json'), 'utf8')), s = r.summary;
  const titles = r.new_roles.map(x => x.company + '|' + x.title).sort();
  assert.deepStrictEqual(titles, ['AEVEX|Plant Manager', 'Acme|Senior Director, Quality Assurance', 'Initech|Director of Manufacturing', 'Shield AI|Director of Production'].sort());
  assert.deepStrictEqual(r.existing_roles.map(x => x.company + '|' + x.title).sort(), ['Acme|Director of Quality', 'Globex|Plant Manager']);
  assert.strictEqual(r.protected_roles.some(x => x.company === 'Acme' && x.title === 'Director of Quality'), true, 'parsed master-line protected state survives into report');
  assert.strictEqual(s.boards.protected >= 1, true, 'protected state included in board counts');
  assert.strictEqual(s.boards.existing >= s.boards.protected, true);
  assert.strictEqual(s.boards.new, 3); assert.strictEqual(s.jobspy.new, 1); assert.strictEqual(s.jobspy.sites.linkedin.returned, 2);
  assert.deepStrictEqual(s.priority_boards_probed.map(p => [p.company, p.found]), [['Shield AI', 'lever:shieldai'], ['Path Robotics', null]]);
  assert.strictEqual(r.new_roles.find(x => x.company === 'Acme').pay, '$200K-$250K');
  assert.strictEqual(r.new_roles[0].tier !== '', true, 'priority companies listed first');
  const md = fs.readFileSync(path.join(out, 'source-trial-report.md'), 'utf8');
  assert.match(md, /JobSpy errors: indeed: 403/); assert.match(md, /no board found: Path Robotics/);
  fs.rmSync(dir, { recursive: true, force: true });
});
