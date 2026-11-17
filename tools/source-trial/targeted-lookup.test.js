'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const T = require('./targeted-lookup'), D = require('../source-intake/discovery-inputs');

const helperUrl = 'https://www.linkedin.com/jobs/view/4300000001/', text = 'Lead the plant operations team across three shifts. '.repeat(10) + 'Own safety, quality and delivery for the site.';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'targeted-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const w = (f, v) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), JSON.stringify(v)); };
  const ev = { company: 'Quikrete', title: 'Plant Manager', location: 'Peachland, NC', url: helperUrl, quote: 'Own safety, quality and delivery for the site.' };
  w('receipts/B.json', { items: [{ primaryId: 'V2I-A', recommendation: 'ENRICHMENT_EVIDENCE_READY', sourceEvidence: ev },
    { primaryId: 'V2I-B', recommendation: 'NEEDS_SOURCE_EVIDENCE', sourceEvidence: ev }, { primaryId: 'V2I-C', recommendation: 'ENRICHMENT_EVIDENCE_READY', sourceEvidence: ev }] });
  w('state/PROGRAMMED_COORDINATOR.json', { items: { 'K:V2I-A': { itemKey: 'V2I-A', batch: 'receipts/B.json', status: 'EXCEPTION' }, 'K:V2I-B': { itemKey: 'V2I-B', batch: 'receipts/B.json', status: 'EXCEPTION' },
    'K:V2I-C': { itemKey: 'V2I-C', batch: 'receipts/B.json', status: 'EXCEPTION' } },
    exceptions: { 'K:V2I-A': { reason: 'SOURCE_ROUTE_BACKOFF' }, 'K:V2I-B': { reason: 'WORKING_SOURCE_ROUTE_REQUIRED' }, 'K:V2I-C': { reason: 'HELPER_QUOTE_NOT_IN_POSTING' } } });
  return root;
}

test('targets are ready returns stuck on a source route; a looked-up item waits retryHours', t => {
  const root = fixture(t), now = Date.parse('2026-11-17T17:00:00Z');
  const list = T.targets(root, { now });
  assert.deepEqual(list.map(x => x.key), ['K:V2I-A']);
  T.merge(root, list, [], { now });
  assert.equal(T.targets(root, { now: now + 3600000 }).length, 0);
  assert.equal(T.targets(root, { now: now + 25 * 3600000 }).length, 1);
});

test('only an exact-identity match with posting text is kept, and the coordinator finds it under the helper URL', t => {
  const root = fixture(t), now = Date.parse('2026-11-17T17:00:00Z'), list = T.targets(root, { now });
  const hc = { site: 'hiringcafe', company: 'Quikrete', title: 'Plant Manager', location: 'Peachland, NC', job_url: 'https://hiringcafe.com/job/abc', description: text, targetKey: 'K:V2I-A' };
  const wrong = { ...hc, title: 'Assistant Plant Manager', job_url: 'https://hiringcafe.com/job/zzz' }, short = { ...hc, description: 'Plant Manager role.', job_url: 'https://hiringcafe.com/job/s' };
  const doc = T.merge(root, list, [wrong, short, hc], { now });
  assert.deepEqual(doc.summary, { targets: 1, matched: 1, quoteFound: 1 });
  assert.equal(doc.roles[0].url, 'https://hiringcafe.com/job/abc'); assert.deepEqual(doc.roles[0].aliasUrls, [helperUrl]); assert.equal(doc.roles[0].source, 'HIRINGCAFE');
  const env = D.index(root).find({ company: 'Quikrete', title: 'Plant Manager', location: 'Peachland, NC', url: helperUrl }, { now });
  assert.ok(env, 'found by the helper URL'); assert.ok(env.card.description.includes('Own safety, quality and delivery'));
  assert.equal(D.index(root).find({ company: 'Other Co', title: 'Plant Manager', location: 'Peachland, NC', url: helperUrl }, { now }), null, 'identity still required');
});
