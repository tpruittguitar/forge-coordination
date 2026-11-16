const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ask = require('./ask.js'), B = require('./build.js'), S = require('./needs-tim-section.js');
const NOW = Date.parse('2026-11-16T15:00:00Z');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntim-'));
  fs.mkdirSync(path.join(root, 'asks/open'), { recursive: true }); fs.mkdirSync(path.join(root, 'asks/resolved'));
  const put = (id, raisedAt) => fs.writeFileSync(path.join(root, 'asks/open', id + '.json'),
    JSON.stringify({ id, title: 'Title ' + id, raisedBy: 'CLAUDE', raisedAt }));
  put('ASK-X1', '2026-11-13T15:00:00Z'); put('ASK-X2', '2026-11-16T14:00:00Z');
  return { root, put };
}
const load = root => ({ open: ask.collect(root, 'open'), resolved: ask.collect(root, 'resolved') });

test('resolving an ask removes it from both the office board and the section', () => {
  const { root } = fixture();
  let a = load(root);
  let doc = B.build({ needs_tim: [], bots: [] }, [], NOW, undefined, a).doc, md = S.render(a.open, a.resolved, NOW);
  assert.deepEqual(doc.needs_tim.map(i => i.text), ['Title ASK-X1', 'Title ASK-X2']);
  assert.match(md, /\*\*ASK-X1\*\* — Title ASK-X1 \(asking: Claude, age: 3d\)/);
  assert.match(md, /ASK-X2.*age: 1h/);
  fs.renameSync(path.join(root, 'asks/open/ASK-X1.json'), path.join(root, 'asks/resolved/ASK-X1.json'));
  a = load(root);
  doc = B.build(doc, [], NOW, undefined, a).doc; md = S.render(a.open, a.resolved, NOW);
  assert.deepEqual(doc.needs_tim.map(i => i.text), ['Title ASK-X2']);
  assert.ok(!md.includes('ASK-X1') && md.includes('ASK-X2'));
});

test('empty list renders the checkmark line', () => {
  assert.equal(S.render([], [], NOW), S.BEGIN + '\n' + S.EMPTY + '\n' + S.END);
  assert.equal(S.EMPTY, 'Nothing needs Tim right now ✓');
});

test('merge keeps text outside markers byte-identical and overwrites inside', () => {
  const pre = 'Hand note  \r\n\t\n', post = '\n\nTrailing hand text, no newline';
  const existing = pre + S.BEGIN + '\nhand edit\n' + S.END + post;
  const out = S.merge(existing, S.render([], [], NOW));
  assert.equal(out, pre + S.render([], [], NOW) + post);
  assert.ok(!out.includes('hand edit'));
  assert.equal(S.merge(out, S.render([], [], NOW)), out);
});

test('merge inserts markers at the end when missing, keeping existing text', () => {
  const existing = 'Only hand text\n';
  const out = S.merge(existing, S.render([], [], NOW));
  assert.ok(out.startsWith(existing) && out.includes(S.BEGIN) && out.trimEnd().endsWith(S.END));
});
