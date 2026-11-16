const test = require('node:test'), assert = require('node:assert/strict');
const { build } = require('./ask.js');
const entry = (id, fields = {}, file = id + '.json') => ({ file, ask: { id, title: 'Question ' + id, raisedBy: 'CHATGPT', ...fields } });

test('open asks default to Tim; explicit AWAITING_TIM is included with the existing item shape', () => {
  const doc = build({}, [entry('A'), entry('B', { status: 'AWAITING_TIM', raisedBy: 'GROK' })], []);
  assert.deepEqual(doc.needs_tim, [
    { text: 'Question A', link: 'https://github.com/tpruittguitar/forge-coordination/blob/main/asks/open/A.json', bot: 'ChatGPT' },
    { text: 'Question B', link: 'https://github.com/tpruittguitar/forge-coordination/blob/main/asks/open/B.json', bot: 'President' },
  ]);
});

test('resolved directory closes matching IDs or filenames; inline answered/resolved asks drop off', () => {
  const open = [entry('A'), entry('B'), entry('C', { status: 'answered' }), entry('D', { status: 'RESOLVED' }),
    entry('E', { answeredAt: '2026-11-16' }), entry('F', { resolvedAt: '2026-11-16' }),
    entry('G', { answered: true }), entry('H', { resolved: true })];
  assert.deepEqual(build({}, open, [entry('A', {}, 'other-name.json'), entry('other-id', {}, 'B.json')]).needs_tim, []);
});

test('asks explicitly waiting on someone else are excluded', () => {
  const open = [entry('A', { status: 'AWAITING_CLAUDE' }), entry('B', { waitingOn: 'Claude' }),
    entry('C', { nextOwner: 'ChatGPT' }), entry('D', { status: 'AWAITING_TIM', NEXT_OWNER: 'GROK' }),
    entry('E', { waiting_on: 'Tim' }), entry('F', { status: 'waiting on Tim' })];
  assert.deepEqual(build({}, open, []).needs_tim.map(item => item.text), ['Question E', 'Question F']);
});

test('rebuild preserves every other OFFICE_STATUS key and does not mutate inputs', () => {
  const office = { updated_at: 'unchanged', needs_tim: [{ text: 'stale', link: '', bot: '' }],
    bots: [{ bot: 'Claude', status: 'working' }], usage: { custom: [1] }, extra: { future: true } };
  const open = [entry('B'), entry('A')];
  const before = structuredClone({ office, open });
  const doc = build(office, open, []);
  const { needs_tim, ...other } = doc;
  const { needs_tim: old, ...expected } = office;
  assert.deepEqual(other, expected);
  assert.deepEqual({ office, open }, before);
  assert.deepEqual(needs_tim.map(item => item.text), ['Question A', 'Question B']);
  assert.deepEqual(build(doc, open.slice().reverse(), []), doc);
  assert.deepEqual(build(office, [], []).needs_tim, []);
});
