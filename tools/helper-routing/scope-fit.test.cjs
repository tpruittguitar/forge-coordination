'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('./scope-fit.cjs');

const posting = [
  'Plant Quality Manager',
  'Acme Castings, Cleveland, TN',
  'Lead plant quality for a 400-person automotive casting facility and own IATF 16949 certification.',
  'Direct a team of 25 quality engineers and inspectors across three shifts.',
  'Drive launch readiness for a new production line, PPAP and APQP deliverables for tier-1 customers.',
  'Partner with manufacturing leadership on scrap reduction, containment and corrective action.',
  'Bachelor degree in engineering or equivalent experience. 10+ years of manufacturing quality leadership.',
].join('\n');
const base = () => ({
  primaryId: 'V2I-ABCDEF123456', title: 'Plant Quality Manager', postingText: posting, fullPosting: true,
  sourceUrl: 'https://careers.example.com/jobs/123', observedAt: '2026-11-16', anchor: 'SAME_FUNCTION_LEVEL',
  score: 88, confidence: 'HIGH', basis: 'Plant-wide quality leadership at a tier-1 automotive supplier; casting product differs',
  quotes: ['Lead plant quality for a 400-person automotive casting facility', 'Direct a team of 25 quality engineers'],
  runId: 'FORGE-CLAUDE-20261116-1512ET',
});

test('builds SCOPE_FIT_RAW and FIT_* from grounded evidence', () => {
  const out = build(base());
  assert.equal(out.ok, true);
  assert.equal(out.fields.SCOPE_FIT_RAW, '88');
  assert.equal(out.fields.FIT_CONF, 'HIGH');
  assert.equal(out.fields.FIT_ASOF, '2026-11-16');
  assert.match(out.fields.FIT_BASIS, /^SAME_FUNCTION_LEVEL 85-94: /);
  assert.match(out.fields.FIT_EVIDENCE, /25 quality engineers/);
  assert.equal(out.fields.ANALYSIS_BY, 'CLAUDE_FORGE-CLAUDE-20261116-1512ET');
  assert.match(out.evidence.sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(out.evidence.observedCompetencies.length > 0);
  for (const k of Object.keys(out.fields)) assert.doesNotMatch(k, /^(OVERALL_|EXPERIENCE_FIT|SCORE_)/);
});

test('never invents a score: missing or ungrounded evidence leaves it unset', () => {
  const cases = [
    [{ fullPosting: false }, 'FULL_POSTING_TEXT_REQUIRED'],
    [{ postingText: 'Plant Quality Manager, Cleveland TN' }, 'FULL_POSTING_TEXT_REQUIRED'],
    [{ anchor: 'VIBES' }, 'KNOWN_ANCHOR_REQUIRED'],
    [{ score: 96 }, 'SCORE_OUTSIDE_ANCHOR_BAND'],
    [{ score: 88.5 }, 'SCORE_OUTSIDE_ANCHOR_BAND'],
    [{ score: undefined }, 'SCORE_OUTSIDE_ANCHOR_BAND'],
    [{ quotes: [] }, 'POSTING_QUOTE_REQUIRED'],
    [{ quotes: ['Owns a $2B P&L and global supply chain'] }, 'QUOTE_NOT_IN_POSTING'],
    [{ sourceUrl: 'http://x' }, 'SOURCE_URL_REQUIRED'],
    [{ observedAt: 'today' }, 'OBSERVED_DATE_REQUIRED'],
    [{ confidence: 'SURE' }, 'FIT_CONF_REQUIRED'],
    [{ existingScopeFitRaw: '72' }, 'SCOPE_FIT_RAW_ALREADY_PRESENT'],
    [{ primaryId: 'Acme' }, 'EXACT_PRIMARY_ID_REQUIRED'],
  ];
  for (const [patch, reason] of cases) assert.deepEqual(build({ ...base(), ...patch }), { ok: false, reason }, reason);
});

test('high anchors need observed resume overlap', () => {
  const unrelated = 'Senior Pastry Chef\n' + 'Create seasonal dessert menus, laminate croissant dough, plate desserts for banquets and manage the pastry station. '.repeat(5);
  const out = build({ ...base(), title: 'Senior Pastry Chef', postingText: unrelated, quotes: ['laminate croissant dough'], score: 75, anchor: 'STRONG_OVERLAP' });
  assert.deepEqual(out, { ok: false, reason: 'NO_OBSERVED_RESUME_OVERLAP_FOR_HIGH_ANCHOR' });
  const low = build({ ...base(), title: 'Senior Pastry Chef', postingText: unrelated, quotes: ['laminate croissant dough'], score: 5, anchor: 'DIFFERENT_FUNCTION', confidence: 'MED' });
  assert.equal(low.ok, true);
  assert.equal(low.fields.SCOPE_FIT_RAW, '5');
});

test('hidden recruiter client caps the rating at 84 and confidence at MED', () => {
  const out = build({ ...base(), hiddenClient: true });
  assert.equal(out.fields.SCOPE_FIT_RAW, '84');
  assert.equal(out.fields.FIT_CONF, 'MED');
  assert.match(out.fields.FIT_BASIS, /capped at 84/);
});
