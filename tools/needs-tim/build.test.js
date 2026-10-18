'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { build, parseName, parseBody, etIso } = require('./build.js');

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'needs-tim-'));
  Object.keys(files).forEach(rel => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof files[rel] === 'string' ? files[rel] : JSON.stringify(files[rel])); });
  return root;
}
const NOW = '2026-10-18T16:00:00-04:00';
const ids = r => r.items.map(i => i.id).sort();

test('ET timestamps use EDT before Nov 1 2026 and EST after', () => {
  assert.strictEqual(etIso('20261018', '1530'), '2026-10-18T15:30:00-04:00');
  assert.strictEqual(etIso('20261102', '0900'), '2026-11-02T09:00:00-05:00');
});

test('receipt names map to lane, provider, run and phase', () => {
  assert.deepStrictEqual(parseName('AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-0902ET_TERMINAL.txt').lane, 'EMAIL');
  const g = parseName('FORGE_GOFER_CLAUDE_20261018_1450ET.txt'); assert.strictEqual(g.lane, 'GOFER'); assert.strictEqual(g.provider, 'CLAUDE');
  assert.strictEqual(parseName('AI_REASON_RUN_RECEIPT_FORGE_POSTING_VALIDATION_CLAUDE_20261013_0329ET.txt').lane, 'POSTVAL');
  assert.strictEqual(parseName('AI_REASON_RUN_RECEIPT_FORGE_WEB_CAREER_DISCOVERY_GROK_20261012-1610ET.txt').lane, 'WEB');
  assert.strictEqual(parseName('FORGE-POSTVAL-CHATGPT-20261015-1618ET_START.txt').phase, 'START');
  assert.strictEqual(parseName('AI_REASON_CHANGE_RECORD_CLAUDE_ATS_CHECKER_20261013.txt'), null);
  assert.strictEqual(parseName('EMAIL_BACKFILL_STATE_20261013_0102ET.txt'), null);
  const b = parseName('AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261013-0102ET-BACKFILL26_TERMINAL.txt');
  assert.ok(b.runKey.indexOf('BACKFILL26') > 0, 'backfill variants are separate runs');
});

test('outcome comes from any of the status keys or a HARD_BLOCKED stop reason', () => {
  assert.strictEqual(parseBody('RUN_TERMINAL_STATUS=HARD_BLOCKED\n').status, 'HARD_BLOCKED');
  assert.strictEqual(parseBody('TERMINAL_STATUS=PARTIAL_WITH_WORK (cap)\n').status, 'PARTIAL_WITH_WORK');
  assert.strictEqual(parseBody('STOP_REASON=HARD_BLOCKED: index empty\n').status, 'HARD_BLOCKED');
  assert.strictEqual(parseBody('{"TERMINAL_STATUS":"PARTIAL_WITH_WORK","NEXT_OWNER":"Tim for 21"}').nextOwner, 'Tim for 21');
});

test('latest blocked run is a blocking failure; a later clean run clears it', () => {
  const blocked = repo({
    'receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-0900ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=HARD_BLOCKED\nSTOP_REASON=Writer index unreadable\nNEXT_ACTION=Restore the index\n'
  });
  const r = build({ root: blocked, now: NOW });
  const it = r.items.find(i => i.id === 'run-blocked:EMAIL|CHATGPT');
  assert.ok(it); assert.strictEqual(it.level, 'BLOCKING'); assert.strictEqual(it.section, 'FAILED'); assert.match(it.detail, /unreadable/); assert.match(it.action, /Restore/);
  const cleared = repo({
    'receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-0900ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=HARD_BLOCKED\n',
    'receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-1200ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=PARTIAL_WITH_WORK\n'
  });
  assert.ok(!build({ root: cleared, now: NOW }).items.some(i => i.id.indexOf('run-blocked') === 0));
});

test('a run with only a START receipt older than 6 h is flagged unfinished', () => {
  const r = build({ root: repo({ 'receipts/FORGE-POSTVAL-CHATGPT-20261018-0800ET_START.txt': 'RUN_STATUS=IN_PROGRESS\n' }), now: NOW });
  assert.ok(r.items.some(i => i.id === 'run-unfinished:POSTVAL|CHATGPT' && i.level === 'WATCH'));
  const fresh = build({ root: repo({ 'receipts/FORGE-POSTVAL-CHATGPT-20261018-1400ET_START.txt': 'RUN_STATUS=IN_PROGRESS\n' }), now: NOW });
  assert.ok(!fresh.items.some(i => i.id.indexOf('run-unfinished') === 0));
});

test('lane silence is judged per lane across providers (a lane handed to another AI is not overdue)', () => {
  const f = {};
  ['0100', '0400', '0700', '1000'].forEach(t => { f['receipts/AI_REASON_RUN_RECEIPT_FORGE-WEB-GROK-20261016-' + t + 'ET_TERMINAL.txt'] = 'RUN_TERMINAL_STATUS=COMPLETE\n'; });
  ['0100', '0400', '0700', '1000', '1300'].forEach(t => { f['receipts/AI_REASON_RUN_RECEIPT_FORGE-WEB-CLAUDE-20261018-' + t + 'ET_TERMINAL.txt'] = 'RUN_TERMINAL_STATUS=COMPLETE\n'; });
  assert.ok(!build({ root: repo(f), now: NOW }).items.some(i => i.id.indexOf('lane-overdue') === 0));
  const quiet = {};
  ['0100', '0400', '0700', '1000', '1300'].forEach(t => { quiet['receipts/AI_REASON_RUN_RECEIPT_FORGE-WEB-CLAUDE-20261016-' + t + 'ET_TERMINAL.txt'] = 'RUN_TERMINAL_STATUS=COMPLETE\n'; });
  const it = build({ root: repo(quiet), now: NOW }).items.find(i => i.id === 'lane-overdue:WEB');
  assert.ok(it); assert.strictEqual(it.section, 'UPKEEP'); assert.doesNotMatch(it.title, /\d+ h ago/);
});

test('NEXT_OWNER naming Tim becomes a decision; dismissal hides it only for that source file', () => {
  const src = 'receipts/AI_REASON_RUN_RECEIPT_FORGE-INDEX-CHATGPT-20261017-2305ET_TERMINAL.txt';
  const base = { [src]: 'RUN_TERMINAL_STATUS=PARTIAL_WITH_WORK\nNEXT_OWNER=Tim (merge)\nNEXT_ACTION=Merge PR118\n' };
  assert.ok(build({ root: repo(base), now: NOW }).items.some(i => i.id === 'run-next-owner:INDEX|CHATGPT' && i.section === 'DECIDE'));
  const d = Object.assign({}, base, { 'asks/resolved/DISMISS-1.json': { id: 'DISMISS-1', reason: 'merged', dismiss: [{ itemId: 'run-next-owner:INDEX|CHATGPT', source: src }] } });
  const r = build({ root: repo(d), now: NOW });
  assert.ok(!r.items.some(i => i.id === 'run-next-owner:INDEX|CHATGPT')); assert.strictEqual(r.dismissed.length, 1);
  const again = Object.assign({}, d, { 'receipts/AI_REASON_RUN_RECEIPT_FORGE-INDEX-CHATGPT-20261018-1000ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=PARTIAL_WITH_WORK\nNEXT_OWNER=Tim again\n' });
  assert.ok(build({ root: repo(again), now: NOW }).items.some(i => i.id === 'run-next-owner:INDEX|CHATGPT'), 'a newer receipt raising it again brings it back');
});

test('asks: open items show until a resolved file with the same id exists; covers suppresses vague receipt items', () => {
  const gofer = { RUN_ID: 'FORGE-GOFER-CLAUDE-20261018-1450ET', PROVIDER: 'CLAUDE', TERMINAL_STATUS: 'PARTIAL_WITH_WORK', CARRY_FORWARD_HOLDS: 'Archive holds 21, 130; Tim rulings needed on 21/22 and 130.', HELD: { 'Novo VP Ops': 'outcome not readable. Next: read email body or ask Tim.', 'Tesla 283760': 'Next: read req; if different resend; else route to Tim.', 'Muon': 'Role not provable; no write.' }, NEXT_OWNER: 'Tim for 21/22' };
  const f = { 'receipts/FORGE_GOFER_CLAUDE_20261018_1450ET.txt': gofer, 'asks/open/ASK-1.json': { id: 'ASK-1', title: 'Pick one', section: 'JOBS', options: ['A', 'B'], covers: ['gofer-archive:'] } };
  let r = build({ root: repo(f), now: NOW });
  assert.ok(r.items.some(i => i.id === 'ask:ASK-1' && i.section === 'JOBS'));
  assert.ok(!r.items.some(i => i.id.indexOf('gofer-archive:') === 0), 'covered by the open ask');
  assert.strictEqual(r.items.find(i => i.id.indexOf('gofer-held:Novo') === 0).level, 'ACTION');
  assert.strictEqual(r.items.find(i => i.id.indexOf('gofer-held:Tesla') === 0).level, 'WATCH', 'conditional route-to-Tim is a watch');
  assert.ok(!r.items.some(i => i.id.indexOf('gofer-held:Muon') === 0), 'holds that do not need Tim are not listed');
  f['asks/resolved/ASK-1.json'] = { id: 'ASK-1', ruling: 'A' };
  r = build({ root: repo(f), now: NOW });
  assert.ok(!r.items.some(i => i.id === 'ask:ASK-1'));
  assert.ok(r.items.some(i => i.id.indexOf('gofer-archive:') === 0), 'vague item returns once the specific ask is closed while the receipt still says so');
});

test('open handoffs are listed unless superseded or referenced by a later receipt', () => {
  const f = { 'handoffs/FORGE_X_20261016_0003ET.txt': 'INCIDENT=INDEX_ZERO\nHANDOFF_STATUS=OPEN\n', 'handoffs/OLD_20261015_0100ET.txt': 'HANDOFF_STATUS=OPEN\nSUPERSEDED by Y\n' };
  let r = build({ root: repo(f), now: NOW });
  assert.deepStrictEqual(ids(r), ['handoff-open:FORGE_X_20261016_0003ET.txt']);
  f['receipts/FORGE_GOFER_CLAUDE_20261018_1450ET.txt'] = { TERMINAL_STATUS: 'COMPLETE', NOTE: 'reconciled FORGE_X_20261016_0003ET' };
  r = build({ root: repo(f), now: NOW });
  assert.ok(!r.items.some(i => i.id.indexOf('handoff-open') === 0));
});

test('rejected edit requests and open pull requests are listed with links', () => {
  const r = build({ root: repo({ 'edit-requests/rejected/CHATGPT_20261018_1000ET.json.result.txt': 'REJECT stale base_blob_sha (current abc)' }), now: NOW, prs: [{ repo: 'foreman-cockpit', number: 42, title: '[DO NOT MERGE] old', draft: true, created_at: '2026-10-05T00:00:00Z', url: 'https://github.com/x/42' }, { repo: 'foreman-cockpit', number: 120, title: 'CLAUDE fix', draft: false, created_at: '2026-10-18T19:00:00Z', url: 'https://github.com/x/120' }] });
  assert.ok(r.items.some(i => i.id.indexOf('edit-rejected:') === 0 && i.section === 'FAILED'));
  assert.strictEqual(r.items.find(i => i.id === 'pr:foreman-cockpit#42').level, 'WATCH');
  assert.strictEqual(r.items.find(i => i.id === 'pr:foreman-cockpit#120').level, 'ACTION');
  assert.strictEqual(r.items.find(i => i.id === 'pr:foreman-cockpit#120').sourceUrl, 'https://github.com/x/120');
});

test('items sort blocking first and counts add up', () => {
  const r = build({ root: repo({ 'receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-0900ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=HARD_BLOCKED\n', 'asks/open/A.json': { id: 'A', level: 'WATCH' } }), now: NOW });
  assert.strictEqual(r.items[0].level, 'BLOCKING');
  assert.strictEqual(r.counts.total, r.counts.BLOCKING + r.counts.ACTION + r.counts.WATCH);
  assert.strictEqual(r.counts.total, r.counts.DECIDE + r.counts.JOBS + r.counts.FAILED + r.counts.UPKEEP);
});

test('an unreadable ask file is reported, never silently skipped', () => {
  const r = build({ root: repo({ 'asks/open/BAD.json': '{not json' }), now: NOW });
  assert.ok(r.items.some(i => i.id === 'ask-unreadable:BAD.json'));
});

test('instruction-runtime block codes (BLOCKED_AUTHORITY etc.) are blocking failures', () => {
  ['BLOCKED_AUTHORITY', 'PAYLOAD_VALIDATION_BLOCKED', 'WRITER_TRANSPORT_BLOCKED', 'BLOCKED_MAILBOX_VISIBILITY'].forEach(code => {
    const r = build({ root: repo({ ['receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-1700ET_TERMINAL.txt']: 'RUN_TERMINAL_STATUS=' + code + '\nSTOP_REASON=packet hash unavailable\n' }), now: '2026-10-18T18:00:00-04:00' });
    const it = r.items.find(i => i.id === 'run-blocked:EMAIL|CHATGPT');
    assert.ok(it && it.level === 'BLOCKING', code);
  });
  const ok = build({ root: repo({ 'receipts/AI_REASON_RUN_RECEIPT_FORGE-EMAIL-CHATGPT-20261018-1700ET_TERMINAL.txt': 'RUN_TERMINAL_STATUS=PARTIAL_WITH_WORK\n' }), now: '2026-10-18T18:00:00-04:00' });
  assert.ok(!ok.items.some(i => i.id.indexOf('run-blocked') === 0));
});
