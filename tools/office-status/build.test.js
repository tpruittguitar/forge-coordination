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
test('idle + fresh signal -> working (ACTIVE_WINDOW promote)', () => {
  const o = office(); o.bots[2].status = 'idle'; o.bots[2].last_action_at = new Date(NOW - 3 * H).toISOString();
  const { doc } = B.build(o, [{ bot: 'ChatGPT', at: NOW - 5 * 60000, source: 'fresh commit' }], NOW);
  assert.equal(row(doc, 'ChatGPT').status, 'working');
});
test('working + signal 31 min old -> idle (ACTIVE_WINDOW demote)', () => {
  const o = office(); o.bots[2].last_action_at = new Date(NOW - 31 * 60000).toISOString();
  const { doc } = B.build(o, [], NOW);
  assert.equal(row(doc, 'ChatGPT').status, 'idle');
  assert.equal(B.ACTIVE_WINDOW, 30 * 60000);
});
test('needs_tim with a fresh signal is never promoted', () => {
  const o = office();
  const { doc } = B.build(o, [{ bot: 'Claude', at: NOW - 60000, source: 'fresh' }], NOW);
  assert.equal(row(doc, 'Claude').status, 'needs_tim');
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

const reading = (provider, at, usedPct, status = 'OK', meter = 'weekly') => ({ provider, at, usedPct, status, meter, resetsAt: '2026-11-22T16:00:00Z' });
const jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + '\n';
test('usage picks newest weekly OK per provider by timestamp, not file order', () => {
  const text = jsonl([
    reading('CLAUDE', '2026-11-16T13:10:17.990Z', 36),
    reading('GROK', '2026-11-16T13:11:00Z', 36),
    reading('CHATGPT', '2026-11-16T13:12:00Z', 83),
    reading('CLAUDE', '2026-11-16T07:00:00Z', 27),
    reading('CLAUDE', '2026-11-16T14:00:00Z', 99, 'OK', 'session'),
  ]);
  const o = office(), { doc, changed } = B.build(o, [], NOW, text);
  assert.equal(changed, true);
  assert.equal(doc.updated_at, '2026-11-16T15:00:00Z');
  assert.deepEqual(doc.usage.services.map(s => [s.name, s.pct_used, s.pct_left]), [['Grok Bot', 36, 64], ['Claude', 36, 64], ['ChatGPT', 83, 17]]);
  assert.equal(doc.usage.services[1].as_of, '2026-11-16T13:10:17.990Z');
  assert.equal(doc.usage.services[1].resets_at, '2026-11-22T16:00:00Z');
  assert.equal(doc.usage.as_of, '2026-11-16T13:12:00Z');
  assert.equal(doc.usage.next_check_at, '2026-11-16T19:05:00Z');
  assert.deepEqual(o.usage, office().usage);
  // same instant: the President fixture row sits exactly at the 30-min ACTIVE_WINDOW edge, so +1 min would rightly flip it idle
  assert.equal(B.build(doc, [], NOW, text).changed, false);
});
test('newest non-OK keeps last OK values and flags failure; recovery clears flag', () => {
  const rows = [reading('CLAUDE', '2026-11-16T14:00:00Z', null, 'UNREADABLE'), reading('CLAUDE', '2026-11-16T13:00:00Z', 36)];
  const usage = B.usageFromReadings(jsonl(rows), NOW);
  assert.deepEqual(usage.services[1], { name: 'Claude', as_of: '2026-11-16T13:00:00Z', pct_used: 36, pct_left: 64, resets_at: '2026-11-22T16:00:00Z', stale: true, last_reading_status: 'UNREADABLE', last_reading_at: '2026-11-16T14:00:00Z' });
  rows.push(reading('CLAUDE', '2026-11-16T14:30:00Z', 40));
  assert.equal(B.usageFromReadings(jsonl(rows), NOW).services[1].stale, undefined);
});
test('no OK reading reports absence without inventing numbers', () => {
  const usage = B.usageFromReadings(jsonl([reading('GROK', '2026-11-16T14:00:00Z', null, 'CHROME_UNAVAILABLE')]), NOW);
  assert.equal(usage.as_of, null);
  assert.deepEqual(usage.services[0], { name: 'Grok Bot', as_of: null, status: 'NO_OK_READING', stale: true, last_reading_status: 'CHROME_UNAVAILABLE', last_reading_at: '2026-11-16T14:00:00Z' });
  assert.deepEqual(usage.services[1], { name: 'Claude', as_of: null, status: 'NO_OK_READING' });
});
test('next check is strictly after build time, across midnight and both DST transitions', () => {
  for (const [now, expected] of [
    ['2026-11-16T07:04:59Z', '2026-11-16T07:05:00Z'],
    ['2026-11-16T07:05:00Z', '2026-11-16T13:05:00Z'],
    ['2026-11-16T13:05:00Z', '2026-11-16T19:05:00Z'],
    ['2026-11-16T19:05:00Z', '2026-11-17T01:05:00Z'],
    ['2026-11-17T01:05:00Z', '2026-11-17T07:05:00Z'],
    ['2026-07-16T12:05:00Z', '2026-07-16T18:05:00Z'],
    ['2026-03-08T06:59:00Z', '2026-03-08T12:05:00Z'], // 02:05 does not exist
    ['2026-11-01T05:59:00Z', '2026-11-01T07:05:00Z'], // 02:05 is after fall back
  ]) assert.equal(B.nextCheckAt(Date.parse(now)), expected, now);
});

const USAGE_ID = 'f1a70b7a-6051-45d7-8031-e46a4cba066f';
const withUsageRow = () => {
  const o = office();
  o.bots.push({ bot: 'Usage Budget', bot_id: USAGE_ID, task: 'Usage watch', status: 'idle', last_action: 'x', last_action_at: '2026-11-16T06:47:00Z', screen: { title: 'old', lines: ['old'], updated_at: '2026-11-16T06:47:00Z' } });
  return o;
};
test('Usage Budget screen: one line per service, updated_at = usage.as_of, other rows unchanged', () => {
  const o = withUsageRow();
  o.usage = { as_of: '2026-11-16T13:12:00Z', services: [
    { name: 'Grok Bot', as_of: '2026-11-16T13:12:00Z', pct_used: 46, pct_left: 54, resets_at: '2026-11-22T16:00:00Z' },
    { name: 'Claude', as_of: '2026-11-16T13:00:00Z', pct_used: 36, pct_left: 64 },
    { name: 'ChatGPT', as_of: null, status: 'NO_OK_READING' } ] };
  const { doc } = B.build(o, [], NOW);
  assert.deepEqual(row(doc, 'Usage Budget').screen, { title: 'AI usage', lines: ['Grok Bot: 54% left, resets Nov 22', 'Claude: 64% left, reset unknown', 'ChatGPT: unknown'], updated_at: '2026-11-16T13:12:00Z' });
  assert.deepEqual(doc.bots.filter(b => b.bot_id !== USAGE_ID), o.bots.filter(b => b.bot_id !== USAGE_ID));
  assert.equal(row(doc, 'Usage Budget').task, 'Usage watch');
});
test('Usage Budget screen is built from fresh readings and flags a change', () => {
  const { doc, changed } = B.build(withUsageRow(), [], NOW, jsonl([reading('GROK', '2026-11-16T13:12:00Z', 46)]));
  assert.equal(changed, true);
  assert.equal(row(doc, 'Usage Budget').screen.lines[0], 'Grok Bot: 54% left, resets Nov 22');
  assert.equal(row(doc, 'Usage Budget').screen.updated_at, '2026-11-16T13:12:00Z');
});
test('missing usage block leaves the Usage Budget row untouched', () => {
  const o = withUsageRow(); delete o.usage;
  assert.deepEqual(row(B.build(o, [], NOW).doc, 'Usage Budget'), o.bots[3]);
  const o2 = withUsageRow(); o2.usage = { as_of: '2026-11-16T13:00:00Z' };
  assert.deepEqual(row(B.build(o2, [], NOW).doc, 'Usage Budget'), o2.bots[3]);
});

/* Hermes desk (foreman-cockpit #474) resolves by bot_id; the row is hand-written, so the rebuild must keep it. */
test('live OFFICE_STATUS.json: 15 bots incl. Hermes, and the row survives build.js', () => {
  const fs = require('fs'), path = require('path'), ask = require('./ask.js');
  const root = path.resolve(__dirname, '../..');
  const office = JSON.parse(fs.readFileSync(path.join(root, 'control/OFFICE_STATUS.json'), 'utf8'));
  const HERMES = '15ab4cfb-2d51-4809-9ae3-f1285ebd829f';
  const check = doc => {
    assert.equal(doc.bots.length, 15);
    assert.equal(new Set(doc.bots.map(b => b.bot_id)).size, 15, 'bot_ids are unique');
    const h = doc.bots.filter(b => b.bot_id === HERMES);
    assert.equal(h.length, 1); assert.equal(h[0].bot, 'Hermes');
  };
  check(office);
  const asks = { open: ask.collect(root, 'open'), resolved: ask.collect(root, 'resolved') };
  const readings = fs.readFileSync(path.join(root, 'usage/AI_USAGE_READINGS.jsonl'), 'utf8');
  const once = B.build(office, [], Date.now(), readings, asks).doc;
  check(once);
  check(B.build(once, [], Date.now() + 3600000, readings, asks).doc);
});
