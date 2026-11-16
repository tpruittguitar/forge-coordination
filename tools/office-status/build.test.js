// node --test tools/office-status/build.test.js   (EXAMPLE inputs only)
const test = require('node:test'), assert = require('node:assert/strict');
const B = require('./build.js');
const NOW = Date.parse('2026-11-16T15:00:00Z'); // 10:00 AM ET
const H = 3600000;
const office = () => ({
  updated_at: '2026-11-16T14:00:00Z',
  needs_tim: [{ text: 'EXAMPLE ask', link: 'https://example.invalid/x', bot: 'President' }],
  bots: [
    { bot: 'President', bot_id: 'id-p', task: 'EXAMPLE task', status: 'working', last_action: 'EXAMPLE', last_action_at: '2026-11-16T14:30:00Z', question: '', link: '', screen: { title: 'S', lines: ['a'] } },
    { bot: 'Claude', bot_id: 'id-c', task: 'EXAMPLE claude', status: 'needs_tim', last_action: 'x', last_action_at: '2026-11-16T10:00:00Z', question: 'EXAMPLE?', link: '' },
    { bot: 'ChatGPT', bot_id: 'id-g', status: 'working', task: 't', last_action: 'y', last_action_at: '2026-11-16T14:50:00Z', avatar_color: '#123456' },
  ],
  items: [{ id: 'ex-1', title: 'EXAMPLE item' }],
  usage: { as_of: '2026-11-16T13:00:00Z' },
});
const row = (doc, name) => doc.bots.find(b => b.bot === name);

test('newer signal moves last_action_at forward and records last_signal', () => {
  const { doc, changed } = B.build(office(), [{ bot: 'President', at: Date.parse('2026-11-16T14:45:12.345Z'), source: 'git abc (President (Grok Bot)) EXAMPLE' }], NOW);
  assert.equal(changed, true);
  assert.equal(row(doc, 'President').last_action_at, '2026-11-16T14:45:12Z');
  assert.deepEqual(row(doc, 'President').last_signal, { at: '2026-11-16T14:45:12Z', source: 'git abc (President (Grok Bot)) EXAMPLE' });
  assert.equal(doc.updated_at, '2026-11-16T15:00:00Z');
});
test('older signal never moves last_action_at back (mixed offsets compared as instants)', () => {
  const o = office(); o.bots[0].last_action_at = '2026-11-16T09:30:00-05:00';
  const { doc } = B.build(o, [{ bot: 'President', at: Date.parse('2026-11-16T14:00:00Z'), source: 'old' }], NOW);
  assert.equal(row(doc, 'President').last_action_at, '2026-11-16T09:30:00-05:00');
  assert.equal(row(doc, 'President').last_signal.at, '2026-11-16T14:00:00Z');
});
test('future signal (> 1 min ahead) is ignored', () => {
  const { doc, changed } = B.build(office(), [{ bot: 'ChatGPT', at: NOW + 5 * 60000, source: 'future' }], NOW);
  assert.equal(changed, false);
  assert.equal(row(doc, 'ChatGPT').last_action_at, '2026-11-16T14:50:00Z');
  assert.equal(row(doc, 'ChatGPT').last_signal, undefined);
  assert.equal(doc.updated_at, '2026-11-16T14:00:00Z');
});
test('working + newest activity 3 h old -> idle', () => {
  const o = office(); o.bots[2].last_action_at = new Date(NOW - 3 * H).toISOString();
  const { doc } = B.build(o, [{ bot: 'ChatGPT', at: NOW - 4 * H, source: 'older receipt' }], NOW);
  assert.equal(row(doc, 'ChatGPT').status, 'idle');
  // a fresh signal keeps it working
  const fresh = B.build(o, [{ bot: 'ChatGPT', at: NOW - 30 * 60000, source: 'new receipt' }], NOW).doc;
  assert.equal(row(fresh, 'ChatGPT').status, 'working');
});
test('needs_tim status and top-level needs_tim are never touched', () => {
  const o = office(); o.bots[1].last_action_at = new Date(NOW - 10 * H).toISOString();
  const { doc } = B.build(o, [{ bot: 'Claude', at: NOW - 6 * H, source: 'receipt' }], NOW);
  assert.equal(row(doc, 'Claude').status, 'needs_tim');
  assert.deepEqual(doc.needs_tim, office().needs_tim);
  for (const st of ['waiting_tim', 'blocked']) { const p = office(); p.bots[1].status = st; assert.equal(row(B.build(p, [], NOW).doc, 'Claude').status, st); }
});
test('hand-written fields, bot order and key order are preserved', () => {
  const o = office();
  const { doc } = B.build(o, [{ bot: 'ChatGPT', at: Date.parse('2026-11-16T14:55:00Z'), source: 's' }, { bot: 'Nobody', at: NOW, source: 'x' }], NOW);
  assert.deepEqual(doc.bots.map(b => b.bot), ['President', 'Claude', 'ChatGPT']);
  const g = row(doc, 'ChatGPT');
  assert.deepEqual(Object.keys(g), ['bot', 'bot_id', 'status', 'task', 'last_action', 'last_action_at', 'avatar_color', 'last_signal']);
  assert.equal(g.avatar_color, '#123456'); assert.equal(g.task, 't'); assert.equal(g.last_action, 'y');
  assert.deepEqual(row(doc, 'President'), o.bots[0]);
  assert.deepEqual(doc.items, o.items); assert.deepEqual(doc.usage, o.usage);
  assert.deepEqual(Object.keys(doc), Object.keys(o));
});
test('second run on its own output = no change (byte-identical)', () => {
  const sig = [{ bot: 'ChatGPT', at: Date.parse('2026-11-16T14:55:00.900Z'), source: 's' }, { bot: 'President', at: NOW - 5 * H, source: 'p' }];
  const o = office(); o.bots[0].last_action_at = new Date(NOW - 3 * H).toISOString();
  const first = B.build(o, sig, NOW);
  assert.equal(first.changed, true);
  const text = B.serialize(first.doc);
  assert.ok(text.endsWith('}\n') && text.includes('\n  "bots": ['));
  const second = B.build(JSON.parse(text), sig, NOW + 10 * 60000);
  assert.equal(second.changed, false);
  assert.equal(B.serialize(second.doc), text);
});
test('signal extractors: receipts, change records, git log, automations', () => {
  const r = B.receiptSignals(['FORGE-OUTCOME-CHATGPT-20261116T142631Z_SUMMARY.json', 'FORGE-COORDINATOR-CHATGPT-20261101-2057ET_TERMINAL.json', 'X-GROK-20261116T120000Z.txt', 'README.txt']);
  assert.deepEqual(r.map(s => [s.bot, new Date(s.at).toISOString()]), [['ChatGPT', '2026-11-16T14:26:31.000Z'], ['ChatGPT', '2026-11-02T01:57:00.000Z']]);
  const c = B.changeSignals(['claude-20261116-1005-office-status-auto.txt', 'README.txt'], 'CONSUMED REV-973  president-20261116-0941-office-refresh  direct  2026-11-16\nCONSUMED REV-971  chatgpt-20261113-helper-evidence-pr357  #357  2026-11-13\n');
  assert.deepEqual(c.map(s => [s.bot, new Date(s.at).toISOString()]), [['Claude', '2026-11-16T15:05:00.000Z'], ['President', '2026-11-16T14:41:00.000Z']]);
  const log = 'aaa\x1f2026-11-16T09:57:33-05:00\x1fPresident (Grok Bot)\x1foffice: refresh\n\x1e\nbbb\x1f2026-11-16T14:00:00Z\x1ftpruittguitar\x1fMerge thing\n\n* record (PROVIDER=claude)\n\x1e\nccc\x1f2026-11-16T14:01:00Z\x1fforge-needs-tim-bot\x1fNEEDS-TIM-BOT: x\x1e';
  assert.deepEqual(B.gitSignals(log).map(s => [s.bot, new Date(s.at).toISOString()]), [['President', '2026-11-16T14:57:33.000Z'], ['Claude', '2026-11-16T14:00:00.000Z']]);
  const a = B.automationSignals({ automations: [{ ai: 'ChatGPT', name: 'EX_A', last_run_at: '2026-11-16T14:29:04.839Z' }, { ai: 'Grok', name: 'EX_G', last_run_at: '2026-11-16T14:00:00Z' }, { ai: 'Claude', name: 'EX_C', last_run_at: null }] },
    { executions: [{ id: 'ex-c', at: '2026-11-16T13:00:00Z' }] }, { tasks: { EX_C: { owner: 'Claude' } } });
  assert.deepEqual(a.map(s => s.bot), ['ChatGPT', 'Claude']);
});
