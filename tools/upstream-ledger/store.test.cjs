'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const Store = require('./store.cjs');
const QueueState = require('../source-intake/queue-state.cjs');
const Coordinator = require('../programmed-coordinator/store.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-ledger-store-'));
  const locate = file => path.join(root, file);
  const read = file => fs.readFileSync(locate(file), 'utf8');
  const put = (file, value) => fs.writeFileSync(locate(file), JSON.stringify(value));
  fs.mkdirSync(locate('state'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return {root, locate, read, put};
}

const firstSeen = '2026-11-03T22:00:00-05:00';
const entry = (key, status, fields = {}) => ({
  key, firstSeen, discoveryReview: {observedAt: firstSeen, findings: ['α', 'β']},
  company: 'Factory', status, title: 'Plant Manager', sourceUrl: 'https://example.test/job', ...fields
});
const ledger = entries => ({schema: 'forge.upstream-ledger.v1', at: '2026-11-05T00:00:00Z', entries, groups: {}, reportHistory: null});

test('legacy files without archives read as-is', t => {
  const f = fixture(t);
  const upstream = ledger({z: entry('z', 'EXCLUDED'), a: entry('a', 'WAITING')});
  const drain = {schema: 'forge.intake-drain.v1', items: {z: entry('z', 'ACCOUNTED_UPSTREAM')}};
  f.put(Store.LEDGER_PATH, upstream);
  f.put(Store.DRAIN_PATH, drain);
  assert.deepEqual(Store.readLedger(f.root), upstream);
  assert.deepEqual(Store.readDrain(f.root), drain);
  assert.deepEqual(Coordinator.read(f.root, Store.LEDGER_PATH), upstream);
  assert.deepEqual(QueueState.read(f.root, Store.DRAIN_PATH), drain);
});

test('ledger preserves full objects, order, canonical work and unresolved evidence', t => {
  const f = fixture(t);
  const original = ledger({
    z: entry('z', 'EXCLUDED'),
    a: entry('a', 'PRESENT', {primaryId: 'V2I-A'}),
    p: entry('p', 'PRESENT', {primaryId: 'V2I-P'}),
    i: entry('i', 'PRESENT', {primaryId: 'V2I-I', evidenceStatus: 'POST_IN_FLIGHT_UNKNOWN'}),
    h: entry('h', 'HELD'),
    u: entry('u', 'UNRECOGNIZED'),
    l: entry('l', 'EXCLUDED', {firstSeen: null}),
    d: entry('d', 'EXCLUDED', {evidenceStatus: 'POST_IN_FLIGHT_UNKNOWN', worksheetDeletion: {
      schema: 'forge.worksheet-deletion.v1', key: 'd', receiptId: 'a'.repeat(64), currentStatus: 'HELD'
    }}),
    f: entry('f', 'EXCLUDED', {evidenceStatus: 'POST_IN_FLIGHT_UNKNOWN'})
  });
  original.groups = {z: {status: 'EXCLUDED', aliases: ['z']}};
  f.put('state/PIPELINE_WAITING_QUEUES.json', {ids: {enrichment: ['V2I-P'], decision: []}});
  Store.writeLedger(f.root, original);
  const live = JSON.parse(f.read(Store.LEDGER_PATH));
  for (const id of ['a', 'z', 'l', 'd']) {
    assert.equal(live.entries[id].discoveryReview, undefined);
    assert.equal(live.entries[id].key, id);
    assert.equal(live.entries[id].company, original.entries[id].company);
  }
  for (const id of ['p', 'i', 'h', 'u', 'f']) assert.deepEqual(live.entries[id], original.entries[id]);
  assert.deepEqual(live.groups, original.groups);
  assert.deepEqual(Store.readLedger(f.root), original);
  assert.equal(JSON.stringify(Store.readLedger(f.root)), JSON.stringify(original));
  const manifest = JSON.parse(f.read(Store.LEDGER_ARCHIVE + '/manifest.json'));
  assert.deepEqual(manifest.shards.map(({name, count}) => [name, count]), [['1970-01-01.json', 1], ['2026-11-04.json', 3]]);
  const shard = JSON.parse(f.read(Store.LEDGER_ARCHIVE + '/2026-11-04.json'));
  assert.deepEqual(Object.keys(shard.entries), ['a', 'd', 'z']);
  assert.equal(shard.entries.a.detail.company, undefined);

  original.at = '2026-11-06T00:00:00Z';
  Store.writeLedger(f.root, original);
  assert.deepEqual(JSON.parse(f.read(Store.LEDGER_ARCHIVE + '/manifest.json')), manifest);
  assert.deepEqual(Store.readLedger(f.root), original);
});

test('ledger round-trips a populated reportHistory losslessly', t => {
  const f = fixture(t);
  const original = ledger({z: entry('z', 'EXCLUDED'), a: entry('a', 'EXCLUDED'), p: entry('p', 'PRESENT', {primaryId: 'V2I-P'})});
  original.reportHistory = {schema: 'forge.discovery-report-history.v2', commits: ['c1', 'c2', 'c3'],
    versions: [{sha: 'c1', at: '2026-11-03T22:00:00-05:00', records: 2}, {sha: 'c3', at: '2026-11-04T09:00:00-05:00', records: 5, note: 'α'}], incomplete: false};
  f.put('state/PIPELINE_WAITING_QUEUES.json', {ids: {enrichment: ['V2I-P'], decision: []}});
  Store.writeLedger(f.root, original);
  assert.equal(JSON.stringify(Store.readLedger(f.root)), JSON.stringify(original));
  const manifest = JSON.parse(f.read(Store.LEDGER_ARCHIVE + '/manifest.json'));
  const archived = manifest.shards.reduce((n, s) => n + s.count, 0);
  const live = JSON.parse(f.read(Store.LEDGER_PATH));
  assert.equal(Object.keys(live.entries).length + archived >= Object.keys(original.entries).length, true);
  assert.deepEqual(Store.readLedger(f.root).reportHistory, original.reportHistory);
});

test('drain preserves fenced items and moves reopened detail fully back to live', t => {
  const f = fixture(t);
  const card = {company: 'Factory', title: 'Plant Manager', url: 'https://example.test/job', description: 'Captured text'};
  const original = {items: {
    z: entry('z', 'ACCOUNTED_UPSTREAM', {aliases: ['z'], card}),
    a: entry('a', 'ACCOUNTED_UPSTREAM', {fence: {requestIds: ['request']}, card})
  }};
  Coordinator.save(f.root, Store.DRAIN_PATH, original);
  const live = JSON.parse(f.read(Store.DRAIN_PATH));
  assert.equal(live.items.z.card.description, undefined);
  assert.equal(live.items.z.card.url, card.url);
  assert.deepEqual(live.items.a, original.items.a);
  assert.deepEqual(QueueState.read(f.root, Store.DRAIN_PATH), original);

  const reopened = Store.readDrain(f.root);
  reopened.items.z.status = 'ACTION_REQUIRED';
  Store.writeDrain(f.root, reopened);
  assert.deepEqual(JSON.parse(f.read(Store.DRAIN_PATH)), reopened);
  assert.deepEqual(fs.readdirSync(f.locate(Store.DRAIN_ARCHIVE)), []);
});

test('drain peels fence.record and bulky discoveryReview from the live file and hydrates them back', t => {
  const f = fixture(t);
  const card = {company: 'Factory', title: 'Plant Manager', location: 'Austin, TX', url: 'https://example.test/job'};
  const fence = {requestIds: ['ORIGINAL-1'], proof: 'state/EMAIL_RECOVERY_QUEUE.json#job', record: {
    COMPANY: 'Factory', TITLE: 'Plant Manager', evidence: {quotes: ['x'.repeat(200)]}, ROLE_TEXT: 'y'.repeat(200)
  }};
  const discoveryReview = {
    schema: 'forge.discovery-review.v1', observedAt: firstSeen, sourceUrl: card.url, source: 'JOBSPY:linkedin',
    decision: 'PROGRESS_TO_INTAKE', preliminaryScreen: {schema: 'forge.preliminary-screen.v1', notes: 'z'.repeat(400)},
    resumeMatch: {schema: 'forge.resume-match.v1', matches: [{term: 'manufacturing'}]},
    evidenceQuotes: ['exact quote'], basis: 'PROVISIONAL_TITLE_FAMILY_LEVEL_AND_LOCATION', sourceSha256: 'a'.repeat(64)
  };
  const pending = entry('p', 'ACTION_REQUIRED', {
    aliases: ['p'], card, fence, discoveryReview, action: 'RECONCILE_WRITER',
    taskKey: 'FORGE_INTAKE_HELD_RECONCILIATION', nextAction: 'Reconcile the original Writer request'
  });
  const settled = entry('s', 'ACCOUNTED_UPSTREAM', {aliases: ['s'], card, discoveryReview});
  const original = {schema: 'forge.intake-drain.v1', items: {p: pending, s: settled}};
  Store.writeDrain(f.root, original);
  const live = JSON.parse(f.read(Store.DRAIN_PATH));
  assert.equal(live.items.p.fence.record, undefined);
  assert.deepEqual(live.items.p.fence.requestIds, fence.requestIds);
  assert.equal(live.items.p.fence.proof, fence.proof);
  assert.equal(live.items.p.discoveryReview.preliminaryScreen, undefined);
  assert.equal(live.items.p.discoveryReview.resumeMatch, undefined);
  assert.equal(live.items.p.discoveryReview.evidenceQuotes, undefined);
  assert.equal(live.items.p.discoveryReview.decision, 'PROGRESS_TO_INTAKE');
  assert.equal(live.items.p.discoveryReview.sourceSha256, discoveryReview.sourceSha256);
  assert.equal(live.items.p.status, 'ACTION_REQUIRED');
  assert.equal(live.items.s.discoveryReview, undefined);
  assert.ok(Buffer.byteLength(f.read(Store.DRAIN_PATH)) < Buffer.byteLength(JSON.stringify(original) + '\n'));
  assert.deepEqual(Store.readDrain(f.root), original);
  assert.deepEqual(QueueState.read(f.root, Store.DRAIN_PATH), original);
  assert.deepEqual(Coordinator.read(f.root, Store.DRAIN_PATH), original);
  Store.writeDrain(f.root, Store.readDrain(f.root));
  assert.deepEqual(Store.readDrain(f.root), original);
  assert.equal(JSON.parse(f.read(Store.DRAIN_PATH)).items.p.fence.record, undefined);
});

test('ledger peels preliminaryScreen and bulky discoveryReview from pending live entries and hydrates them back', t => {
  const f = fixture(t);
  const discoveryReview = {
    schema: 'forge.discovery-review.v1', observedAt: firstSeen, sourceUrl: 'https://example.test/job',
    decision: 'PROGRESS_TO_INTAKE', preliminaryScreen: {schema: 'forge.preliminary-screen.v1', notes: 'z'.repeat(200)},
    resumeMatch: {schema: 'forge.resume-match.v1', matches: [{term: 'manufacturing'}]},
    evidenceQuotes: ['exact quote'], sourceSha256: 'a'.repeat(64)
  };
  const waiting = entry('w', 'WAITING', {
    preliminaryScreen: {schema: 'forge.preliminary-screen.v1', ats: {hits: 2}, notes: 'p'.repeat(200)},
    discoveryReview
  });
  const settled = entry('s', 'EXCLUDED', {discoveryReview, preliminaryScreen: {schema: 'forge.preliminary-screen.v1'}});
  const original = ledger({w: waiting, s: settled});
  Store.writeLedger(f.root, original, {activePrimaryIds: new Set()});
  const live = JSON.parse(f.read(Store.LEDGER_PATH));
  assert.equal(live.entries.w.preliminaryScreen, undefined);
  assert.equal(live.entries.w.discoveryReview.preliminaryScreen, undefined);
  assert.equal(live.entries.w.discoveryReview.resumeMatch, undefined);
  assert.equal(live.entries.w.discoveryReview.evidenceQuotes, undefined);
  assert.equal(live.entries.w.discoveryReview.sourceSha256, discoveryReview.sourceSha256);
  assert.equal(live.entries.w.status, 'WAITING');
  assert.equal(live.entries.s.discoveryReview, undefined);
  assert.equal(live.entries.s.preliminaryScreen, undefined);
  assert.deepEqual(Store.readLedger(f.root), original);
  assert.deepEqual(Coordinator.read(f.root, Store.LEDGER_PATH), original);
  Store.writeLedger(f.root, Store.readLedger(f.root), {activePrimaryIds: new Set()});
  assert.deepEqual(Store.readLedger(f.root), original);
  assert.equal(JSON.parse(f.read(Store.LEDGER_PATH)).entries.w.preliminaryScreen, undefined);
});

test('recovery peels bulky job fields into a new archive and hydrates them back', t => {
  const f = fixture(t);
  const evidence = [{gmailId: 'ab'.repeat(8), at: firstSeen, page: 'https://www.linkedin.com/jobs/search/?start=0', cardHash: 'c'.repeat(64), paragraphs: ['VP Manufacturing', 'Factory', 'Austin, TX', 'x'.repeat(400)]}];
  const pending = {
    key: 'linkedin:1', jobId: '1', title: 'Plant Manager', company: 'Factory', location: 'Austin, TX',
    url: 'https://www.linkedin.com/jobs/view/1/', observedAt: firstSeen, status: 'UNSCREENED',
    sourceEmails: ['ab'.repeat(8)], evidence, preliminaryScreen: {schema: 'forge.preliminary-screen.v1', notes: 'n'.repeat(200)},
    description: 'd'.repeat(200), claudeHelperEvidence: {notes: 'h'.repeat(100)}, sourcePayEvidence: [{quote: '$120,000'}],
    discoveryReview: {schema: 'forge.discovery-review.v1', decision: 'PROGRESS_TO_INTAKE', resumeMatch: {matches: [1]}, sourceSha256: 'a'.repeat(64)},
    submissions: [{requestId: 'ORIGINAL-1'}]
  };
  const original = {schema: 'forge.email-recovery.v1', at: '2026-11-23T23:15:00.407Z', sources: {}, jobs: {['linkedin:1']: pending}};
  Store.writeRecovery(f.root, original);
  const live = JSON.parse(f.read(Store.RECOVERY_PATH));
  assert.equal(live.jobs['linkedin:1'].evidence, undefined);
  assert.equal(live.jobs['linkedin:1'].preliminaryScreen, undefined);
  assert.equal(live.jobs['linkedin:1'].description, undefined);
  assert.equal(live.jobs['linkedin:1'].claudeHelperEvidence, undefined);
  assert.equal(live.jobs['linkedin:1'].sourcePayEvidence, undefined);
  assert.equal(live.jobs['linkedin:1'].discoveryReview.resumeMatch, undefined);
  assert.equal(live.jobs['linkedin:1'].discoveryReview.decision, 'PROGRESS_TO_INTAKE');
  assert.deepEqual(live.jobs['linkedin:1'].submissions, pending.submissions);
  assert.equal(live.jobs['linkedin:1'].status, 'UNSCREENED');
  assert.ok(fs.existsSync(f.locate(Store.RECOVERY_ARCHIVE + '/manifest.json')));
  assert.deepEqual(Store.readRecovery(f.root), original);
  assert.deepEqual(Coordinator.read(f.root, Store.RECOVERY_PATH), original);
  Store.writeRecovery(f.root, Store.readRecovery(f.root));
  assert.deepEqual(Store.readRecovery(f.root), original);
  assert.equal(JSON.parse(f.read(Store.RECOVERY_PATH)).jobs['linkedin:1'].evidence, undefined);
});

test('uses UTF-8 bytes to limit shards, and removes stale parts', t => {
  const f = fixture(t);
  const entries = Object.fromEntries(['c', 'b', 'a'].map(id => [id, entry(id, 'EXCLUDED', {body: 'é'.repeat(130)})]));
  const value = ledger(entries);
  const targetBytes = 600;
  Store.writeLedger(f.root, value, {targetBytes});
  const first = Store.loadLedger(f.read);
  assert.deepEqual(first.value, value);
  assert.deepEqual(first.shards.map(s => s.name), ['2026-11-04.json', '2026-11-04-02.json', '2026-11-04-03.json']);
  for (const shard of first.shards) assert.ok(shard.bytes <= targetBytes);
  const bodies = first.shards.map(s => f.read(s.file));
  Store.writeLedger(f.root, Store.readLedger(f.root), {targetBytes});
  assert.deepEqual(first.shards.map(s => f.read(s.file)), bodies);
  delete entries.b;
  Store.writeLedger(f.root, value, {targetBytes});
  assert.equal(fs.existsSync(f.locate(first.shards[2].file)), false);
  assert.deepEqual(Store.readLedger(f.root), value);
});

test('settled entries omit undefined properties just as the legacy writer did', t => {
  const f = fixture(t);
  const original = ledger({z: entry('z', 'EXCLUDED', {primaryId: undefined, evidenceRefs: undefined})});
  Store.writeLedger(f.root, original);
  assert.deepEqual(Store.readLedger(f.root), JSON.parse(JSON.stringify(original)));
});

test('missing or corrupt parts fail loudly through both local and generic readers', t => {
  const f = fixture(t);
  Store.writeDrain(f.root, {items: {z: entry('z', 'ACCOUNTED_UPSTREAM')}});
  const shard = f.locate(Store.DRAIN_ARCHIVE + '/2026-11-04.json');
  fs.appendFileSync(shard, ' ');
  assert.throws(() => Store.readDrain(f.root), /sha256 mismatch/);
  fs.unlinkSync(shard);
  assert.throws(() => QueueState.read(f.root, Store.DRAIN_PATH, {items: {}}), /archive file unavailable/);
  fs.unlinkSync(f.locate(Store.DRAIN_ARCHIVE + '/manifest.json'));
  assert.throws(() => Coordinator.read(f.root, Store.DRAIN_PATH, {items: {}}), /archive file unavailable/);
});

test('live inventory around 60 MB saves and validates, and HARD_BYTES is enforced', t => {
  const f = fixture(t);
  const liveBody = 'x'.repeat(60 * 1024 * 1024);
  const value = ledger({z: entry('z', 'WAITING', {body: liveBody})});
  Store.writeLedger(f.root, value);
  assert.deepEqual(Store.readLedger(f.root), value);
  assert.doesNotThrow(() => Store.loadLedger(f.read));

  const oversized = ledger({z: entry('z', 'EXCLUDED', {body: 'x'.repeat(Store.HARD_BYTES)})});
  assert.throws(() => Store.writeLedger(f.root, oversized), /single record exceeds/);
  assert.deepEqual(Store.readLedger(f.root), value);
});

test('a failed replacement rolls back changed shards and the manifest', t => {
  const f = fixture(t);
  const original = ledger({z: entry('z', 'EXCLUDED')});
  Store.writeLedger(f.root, original);
  const rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === f.locate(Store.LEDGER_PATH)) throw Error('injected rename failure');
    return rename(from, to);
  });
  const changed = ledger({z: entry('z', 'EXCLUDED', {evidenceRefs: [{proof: 'new'}]})});
  assert.throws(() => Store.writeLedger(f.root, changed), /injected rename failure/);
  mock.mock.restore();
  assert.deepEqual(Store.readLedger(f.root), original);
  Store.writeLedger(f.root, changed);
  assert.deepEqual(Store.readLedger(f.root), changed);
});

test('CLI compacts both files and check reads without rewriting', t => {
  const f = fixture(t);
  f.put(Store.LEDGER_PATH, ledger({z: entry('z', 'EXCLUDED')}));
  f.put(Store.DRAIN_PATH, {items: {z: entry('z', 'ACCOUNTED_UPSTREAM')}});
  const run = (...args) => {
    const fd = fs.openSync(f.locate('cli.log'), 'w');
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'compact.cjs'), '--root', f.root, ...args], {stdio: ['ignore', fd, 'pipe']});
    } finally {
      fs.closeSync(fd);
    }
    return f.read('cli.log');
  };
  const result = run();
  const file = f.locate(Store.LEDGER_PATH);
  const before = fs.statSync(file).mtimeMs;
  assert.equal(run('--check'), result);
  assert.equal(fs.statSync(file).mtimeMs, before);
  assert.match(result, /1 entries, 1 archived/);
  assert.match(result, /1 items, 1 archived/);
});
