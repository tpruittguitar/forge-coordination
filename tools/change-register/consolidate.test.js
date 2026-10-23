'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { consolidate, parseRecord, run, prFromSubject, etDate, entryLines } = require('./consolidate.js');
const { checkPr } = require('./check-pr.js');

/* A cut of the real register, including the two REV-184 lines and the REV-187/189-191 gaps. */
const REGISTER = [
  'FORGE CHANGE REGISTER — header',
  '',
  'REV      DATE        REPO                 PR / COMMIT   STATUS   WHAT',
  'REV-183  2026-10-22  forge-coordination   direct        LIVE     Gofer receipt 1652ET',
  'REV-184  2026-10-22  forge-coordination   direct        LIVE     Gofer receipt 1853ET',
  'REV-184  2026-10-22  forge-coordination   #40           DRAFT    Source intake production PR default-off scaffold',
  'REV-188  2026-10-22  forge-coordination   #40           DRAFT    Tim approved the five PR #40 canary candidates',
  'REV-194  2026-10-22  forge-coordination   PR_PENDING    DRAFT    Independent-QA fix: durable recorder',
  ''].join('\n');
const LEDGER = '# ledger\nRESERVED REV-195  #44  open PR\n';
const rec = (id, order, what, extra) => ({ id, order, pr: '#' + (50 + order), date: '2026-10-23', text: (extra || '') + 'WHAT=' + what + '\n' });

test('records land in merge order with the next REV after the highest used or reserved number', () => {
  const r = consolidate({ register: REGISTER, ledger: LEDGER, records: [rec('b-second', 2, 'Second'), rec('a-first', 1, 'First'), rec('c-third', 3, 'Third')] });
  assert.deepStrictEqual(r.added.map(a => a.id + ' ' + a.rev), ['a-first REV-196', 'b-second REV-197', 'c-third REV-198']);
  assert.strictEqual(r.added[0].line, 'REV-196  2026-10-23  forge-coordination   #51           MERGED   First');
  assert.ok(r.register.endsWith('MERGED   Third\n'));
});

test('records merged in the same commit are ordered by file name', () => {
  const r = consolidate({ register: REGISTER, ledger: '', records: [rec('zeta', 1, 'Z'), rec('alpha', 1, 'A')] });
  assert.deepStrictEqual(r.added.map(a => a.id), ['alpha', 'zeta']);
  assert.deepStrictEqual(r.added.map(a => a.rev), ['REV-195', 'REV-196']);
});

test('history is preserved byte for byte, including duplicate REV-184 and CRLF endings', () => {
  const r = consolidate({ register: REGISTER, ledger: LEDGER, records: [rec('one', 1, 'One')] });
  assert.ok(r.register.startsWith(REGISTER));
  assert.strictEqual(entryLines(r.register).filter(l => l.startsWith('REV-184')).length, 2);
  const crlf = REGISTER.replace(/\n/g, '\r\n');
  const c = consolidate({ register: crlf, ledger: '', records: [rec('one', 1, 'One')] });
  assert.ok(c.register.startsWith(crlf) && c.register.endsWith('One\r\n'));
  const noNl = REGISTER.replace(/\n$/, '');
  const n = consolidate({ register: noNl, ledger: '', records: [rec('one', 1, 'One')] });
  assert.ok(n.register.startsWith(noNl + '\n'), 'a missing final newline is added, nothing else changes');
});

test('re-running with the consumed records gone, or still present, adds nothing', () => {
  const first = consolidate({ register: REGISTER, ledger: LEDGER, records: [rec('one', 1, 'One'), rec('two', 2, 'Two')] });
  const empty = consolidate({ register: first.register, ledger: first.ledger, records: [] });
  assert.strictEqual(empty.register, first.register); assert.strictEqual(empty.ledger, first.ledger);
  const again = consolidate({ register: first.register, ledger: first.ledger, records: [rec('one', 1, 'One'), rec('two', 2, 'Two')] });
  assert.strictEqual(again.register, first.register);
  assert.deepStrictEqual(again.refused.map(r => r.id), ['one', 'two']);
  assert.match(again.refused[0].reason, /already consumed as REV-196/);
});

test('duplicates are refused: same repo, PR and WHAT as a register line or an earlier record', () => {
  const old = { id: 'restate', order: 1, pr: '#40', date: '2026-10-23', text: 'WHAT=Tim approved the five PR #40 canary  candidates\n' };
  const r = consolidate({ register: REGISTER, ledger: '', records: [old, rec('xx-a', 2, 'Same'), Object.assign(rec('yy-b', 3, 'Same'), { pr: '#52' })] });
  assert.deepStrictEqual(r.refused.map(x => x.id + ':' + /REV-\d+/.exec(x.reason)[0]), ['restate:REV-188', 'yy-b:REV-195']);
  assert.deepStrictEqual(r.added.map(a => a.id), ['xx-a']);
  const other = consolidate({ register: REGISTER, ledger: '', records: [rec('xx-a', 2, 'Same'), rec('yy-b', 3, 'Same')] });
  assert.strictEqual(other.added.length, 2, 'same WHAT from a different PR is a different change');
});

test('a reserved REV is honoured once; unreserved or used REVs are rejected', () => {
  const r = consolidate({ register: REGISTER, ledger: LEDGER, records: [rec('pr44', 1, 'CI switch', 'REV=REV-195\n'), rec('later', 2, 'Later')] });
  assert.deepStrictEqual(r.added.map(a => a.rev), ['REV-195', 'REV-196']);
  const bad = consolidate({ register: REGISTER, ledger: LEDGER, records: [rec('p', 1, 'X', 'REV=REV-190\n'), rec('q', 2, 'Y', 'REV=REV-184\n')] });
  assert.strictEqual(bad.added.length, 0); assert.strictEqual(bad.rejected.length, 2);
  assert.strictEqual(bad.register, REGISTER);
});

test('invalid records are rejected and left alone; valid ones still land', () => {
  const r = consolidate({ register: REGISTER, ledger: '', records: [
    { id: 'bad', order: 1, pr: '#1', date: '2026-10-23', text: 'STATUS=OPEN\nCOLOR=red\n' },
    { id: 'Bad Name', order: 2, pr: '#1', date: '2026-10-23', text: 'WHAT=x\n' },
    { id: 'cockpit', order: 3, pr: '#1', date: '2026-10-23', text: 'REPO=foreman-cockpit\nWHAT=x\n' },
    rec('good', 4, 'Good')] });
  assert.deepStrictEqual(r.rejected.map(x => x.id), ['bad', 'Bad Name', 'cockpit']);
  assert.ok(r.rejected[0].errors.some(e => /unknown key COLOR/.test(e)) && r.rejected[0].errors.some(e => /STATUS must be/.test(e)));
  assert.deepStrictEqual(r.added.map(a => a.rev), ['REV-195']);
});

test('record fields: PR and DATE override what git found; WHAT may contain "="', () => {
  const p = parseRecord('# comment\nREPO=foreman-cockpit\nPR=#131\nSTATUS=live\nDATE=2026-10-21\nWHAT=a=b\n', 'claude-x');
  assert.deepStrictEqual(p.errors, []); assert.strictEqual(p.fields.WHAT, 'a=b'); assert.strictEqual(p.fields.STATUS, 'LIVE');
  const r = consolidate({ register: REGISTER, ledger: '', records: [{ id: 'claude-x', order: 1, pr: '#60', date: '2026-10-23', text: 'REPO=foreman-cockpit\nPR=#131\nSTATUS=LIVE\nDATE=2026-10-21\nWHAT=Cockpit fix\n' }] });
  assert.strictEqual(r.added[0].line, 'REV-195  2026-10-21  foreman-cockpit      #131          LIVE     Cockpit fix');
});

test('lane label keys are tolerated: PROVIDER/RUN_ID ignored, CHANGE means WHAT', () => {
  const p = parseRecord('PROVIDER=Claude\nRUN_ID=FORGE-POSTVAL-CLAUDE-20261023-0430ET\nCHANGE=Added a receipt\n', 'claude-20261023-0430-postval-receipt');
  assert.deepStrictEqual(p.errors, []); assert.strictEqual(p.fields.WHAT, 'Added a receipt');
  assert.ok(!('PROVIDER' in p.fields) && !('RUN_ID' in p.fields));
  assert.ok(parseRecord('WHAT=One\nCHANGE=Two\n', 'claude-x').errors.some(e => /CHANGE is another name for WHAT/.test(e)));
  assert.ok(parseRecord('CHANGE=One\nWHAT=Two\n', 'claude-x').errors.some(e => /WHAT given twice/.test(e)));
  assert.ok(parseRecord('PROVIDER=Claude\n', 'claude-x').errors.some(e => /WHAT is required/.test(e)), 'ignored keys do not stand in for WHAT');
});

test('merge subjects give the PR number; ET dates', () => {
  assert.strictEqual(prFromSubject('Merge pull request #43 from tpruittguitar/fix/x'), '#43');
  assert.strictEqual(prFromSubject('REV-196 · thing (#45)'), '#45');
  assert.strictEqual(prFromSubject('NEEDS-TIM-BOT: rebuild attention list'), null);
  assert.strictEqual(etDate('2026-10-23T02:30:00Z'), '2026-10-22');
});

/* End to end on a real git repo: two PR branches merged with merge commits, in the opposite order to their creation. */
function sh(cwd, ...a) { return cp.execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
test('run() orders by merge order on main, resolves PR numbers, deletes consumed files, and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'change-register-'));
  const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), s); };
  sh(root, 'init', '-q', '-b', 'main'); sh(root, 'config', 'user.email', 't@e'); sh(root, 'config', 'user.name', 't'); sh(root, 'config', 'commit.gpgsign', 'false');
  w('control/CHANGE_REGISTER.txt', REGISTER); w('control/changes/README.txt', 'format notes\n');
  sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'init');
  sh(root, 'checkout', '-q', '-b', 'early'); w('control/changes/aaa-early.txt', 'WHAT=Branch made first, merged second\n'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'early');
  sh(root, 'checkout', '-q', 'main'); sh(root, 'checkout', '-q', '-b', 'late'); w('control/changes/zzz-late.txt', 'WHAT=Branch made second, merged first\n'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'late');
  sh(root, 'checkout', '-q', 'main');
  sh(root, 'merge', '-q', '--no-ff', 'late', '-m', 'Merge pull request #61 from x/late');
  sh(root, 'merge', '-q', '--no-ff', 'early', '-m', 'Merge pull request #60 from x/early');
  const res = run(root);
  assert.deepStrictEqual(res.added.map(a => a.id + ' ' + a.rev), ['zzz-late REV-195', 'aaa-early REV-196']);
  assert.match(res.added[0].line, /#61\s+MERGED/);
  assert.ok(!fs.existsSync(path.join(root, 'control/changes/zzz-late.txt')) && fs.existsSync(path.join(root, 'control/changes/README.txt')));
  const reg = fs.readFileSync(path.join(root, 'control/CHANGE_REGISTER.txt'), 'utf8');
  assert.ok(reg.startsWith(REGISTER));
  assert.match(fs.readFileSync(path.join(root, 'control/CHANGE_RECORDS_CONSUMED.txt'), 'utf8'), /CONSUMED REV-195  zzz-late  #61  \d{4}-\d{2}-\d{2}/);
  sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'CHANGE-REGISTER-BOT');
  const again = run(root);
  assert.strictEqual(again.added.length + again.refused.length + again.rejected.length, 0);
  assert.strictEqual(fs.readFileSync(path.join(root, 'control/CHANGE_REGISTER.txt'), 'utf8'), reg);
  // A stale branch bringing a consumed record back is refused and the file removed.
  w('control/changes/zzz-late.txt', 'WHAT=Branch made second, merged first\n'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'Merge pull request #62 from x/stale');
  const stale = run(root);
  assert.deepStrictEqual(stale.refused.map(r => r.id), ['zzz-late']); assert.strictEqual(stale.added.length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'control/changes/zzz-late.txt')));
});

/* ---- PR check ---- */
function reader(files) { return (rev, p) => (files[rev] && p in files[rev] ? files[rev][p] : null); }
const ADD = [{ status: 'A', path: 'control/changes/claude-20261022-2000-x.txt' }];
const okRecord = { 'control/changes/claude-20261022-2000-x.txt': 'WHAT=Thing\n' };

test('PR check passes a PR that adds one valid record', () => {
  const r = checkPr({ changed: ADD.concat([{ status: 'M', path: 'tools/x.js' }]), read: reader({ base: {}, head: okRecord }), author: 'tpruittguitar', labels: [] });
  assert.deepStrictEqual(r.errors, []); assert.ok(r.ok);
});

test('PR check rejects a direct register entry, a ledger edit, a missing record and a reused id', () => {
  const base = { 'control/CHANGE_REGISTER.txt': REGISTER, 'control/CHANGE_RECORDS_CONSUMED.txt': 'CONSUMED REV-195  claude-20261022-2000-x  #50  2026-10-22\n' };
  const head = Object.assign({}, okRecord, { 'control/CHANGE_REGISTER.txt': REGISTER + 'REV-195  2026-10-22  forge-coordination   #45  OPEN  mine\n' });
  const r = checkPr({ changed: ADD.concat([{ status: 'M', path: 'control/CHANGE_REGISTER.txt' }, { status: 'M', path: 'control/CHANGE_RECORDS_CONSUMED.txt' }]), read: reader({ base, head }), author: 'tpruittguitar', labels: [] });
  assert.ok(!r.ok);
  assert.ok(r.errors.some(e => /register entries changed/.test(e)));
  assert.ok(r.errors.some(e => /CONSUMED lines are written only by the change-register workflow/.test(e)));
  assert.ok(r.errors.some(e => /already used for REV-195/.test(e)));
  const none = checkPr({ changed: [{ status: 'M', path: 'README.md' }], read: reader({ base: {}, head: {} }), author: 'x', labels: [] });
  assert.ok(!none.ok && /no change record/.test(none.errors[0]));
  const bad = checkPr({ changed: ADD, read: reader({ base: {}, head: { 'control/changes/claude-20261022-2000-x.txt': 'STATUS=OPEN\n' } }), author: 'x', labels: [] });
  assert.ok(!bad.ok && bad.errors.some(e => /WHAT is required/.test(e)));
});

test('PR check allows RESERVED ledger lines to change (bootstrap and Tim reservations)', () => {
  const r = checkPr({ changed: ADD.concat([{ status: 'A', path: 'control/CHANGE_RECORDS_CONSUMED.txt' }]),
    read: reader({ base: {}, head: Object.assign({}, okRecord, { 'control/CHANGE_RECORDS_CONSUMED.txt': '# x\nRESERVED REV-195  #44  note\n' }) }), author: 'x', labels: [] });
  assert.ok(r.ok, r.errors.join('; '));
});

test('PR check allows header-only register edits and exempts bots and the override label', () => {
  const head = Object.assign({}, okRecord, { 'control/CHANGE_REGISTER.txt': REGISTER.replace('header', 'new header rule') });
  const r = checkPr({ changed: ADD.concat([{ status: 'M', path: 'control/CHANGE_REGISTER.txt' }]), read: reader({ base: { 'control/CHANGE_REGISTER.txt': REGISTER }, head }), author: 'x', labels: [] });
  assert.ok(r.ok, r.errors.join('; '));
  const direct = { status: 'M', path: 'control/CHANGE_REGISTER.txt' };
  const files = { base: { 'control/CHANGE_REGISTER.txt': REGISTER }, head: { 'control/CHANGE_REGISTER.txt': REGISTER + 'REV-195  x\n' } };
  assert.ok(checkPr({ changed: [direct], read: reader(files), author: 'forge-bot[bot]', labels: [] }).ok);
  assert.ok(checkPr({ changed: [direct], read: reader(files), author: 'x', labels: ['change-register-override'] }).ok);
  assert.ok(!checkPr({ changed: [direct], read: reader(files), author: 'x', labels: ['other'] }).ok);
});
