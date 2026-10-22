'use strict';
const test = require('node:test'), assert = require('node:assert');
const T = require('./lib.js');

test('REV-156 families: Tim\'s three leadership families only', () => {
  const cases = {
    'Director of Quality': 'QUALITY', 'Head of Quality': 'QUALITY', 'Senior Director, Supplier Quality': 'QUALITY',
    'Director of Manufacturing': 'MFG_PROD', 'Plant Manager': 'MFG_PROD', 'Director, Production Operations': 'MFG_PROD', 'VP Operations': 'MFG_PROD', 'Site Director': null,
    'Director of Manufacturing Engineering': 'MFG_ENG', 'Head of Process Engineering': 'MFG_ENG',
    'Quality Engineer': null, 'Software Quality Director': null, 'Associate Director, Quality': null, 'Director of Sales Operations': null, 'General Manager, Retail Store': null,
    'Director of Flight Operations': null, 'Manufacturing Manager': null,
  };
  Object.keys(cases).forEach(t => assert.strictEqual(T.family(t), cases[t], t));
});

test('REV-160 senior leadership title and level cases', () => {
  assert.strictEqual(T.family('Senior Manager, Manufacturing Operations'), 'MFG_PROD');
  assert.strictEqual(T.family('Sr. Manager Quality'), 'QUALITY');
  assert.strictEqual(T.family('Senior Staff Manufacturing Engineer'), 'MFG_ENG');
  assert.strictEqual(T.family('Principal Production Engineer'), 'MFG_ENG');
  assert.strictEqual(T.family('Principal Manufacturing Engineer'), 'MFG_ENG');
  assert.strictEqual(T.family('Principal Software Engineer'), null);
  assert.strictEqual(T.level('Principal Production Engineer'), 'SR_STAFF');
  assert.strictEqual(T.family('Senior Staff Software Engineer'), null);
  assert.strictEqual(T.level('Senior Staff Manufacturing Engineer'), 'SR_STAFF');
  assert.strictEqual(T.level('Senior Manager, Quality'), 'SR_MANAGER');
  assert.strictEqual(T.level('Director of Manufacturing'), 'DIRECTOR_PLUS');
});

test('REV-163 NPI, continuous improvement and launch leadership', () => {
  for (const title of [
    'Director of NPI',
    'Senior Manager, Continuous Improvement',
    'Senior Staff Industrialization Engineer',
    'Director, Manufacturing Launch',
    'VP Operational Excellence',
    'Senior Manager, Production Ramp'
  ]) assert.strictEqual(T.family(title), 'MFG_PROD', title);
  assert.strictEqual(T.family('Director, Launch Operations'), null);
  assert.strictEqual(T.family('Launch Operations Coordinator'), null);
  assert.strictEqual(T.family('Senior Manager Software Launch'), null);
});

test('REV-156 US places, novelty against the master, board roots, slug probes, priority digest', () => {
  assert.strictEqual(T.usPlace('Tampa, FL'), 'FL'); assert.strictEqual(T.usPlace('Remote'), 'REMOTE_US'); assert.strictEqual(T.usPlace('Munich, Germany'), ''); assert.strictEqual(T.usPlace('United States'), 'US');
  const idx = T.masterIndex([{ COMPANY: 'Acme Inc', TITLE: 'Sr. Director of Quality', p: { SOURCE_URL: 'https://job-boards.greenhouse.io/acme/jobs/111?gh_src=x' } }]);
  assert.strictEqual(T.novelty(idx, 'Acme', 'Other', 'https://JOB-BOARDS.greenhouse.io/acme/jobs/111'), 'EXISTING', 'same URL');
  assert.strictEqual(T.novelty(idx, 'ACME, LLC', 'Senior Director of Quality', ''), 'EXISTING', 'same company + title');
  assert.strictEqual(T.novelty(idx, 'Acme', 'Plant Manager', 'https://x/1'), 'NEW');
  assert.deepStrictEqual(T.boardFromCareers('https://job-boards.greenhouse.io/aevexaerospace'), { kind: 'greenhouse', key: 'greenhouse:aevexaerospace', board: 'aevexaerospace' });
  assert.strictEqual(T.boardFromCareers('https://jobs.lever.co/hermeus').key, 'lever:hermeus');
  assert.strictEqual(T.boardFromCareers('https://shield.ai/careers'), null);
  assert.deepStrictEqual(T.slugGuesses('Shield AI'), ['shieldai', 'shield-ai', 'shield']);
  const p = T.parsePriority('DREAM (x): 1\n- Shield AI | careers: https://shield.ai/careers | Dallas\nP1 (y): 1\n- Path Robotics | careers: UNKNOWN | Columbus, OH\n');
  assert.deepStrictEqual(p, [{ tier: 'DREAM', name: 'Shield AI', careers: 'https://shield.ai/careers' }, { tier: 'P1', name: 'Path Robotics', careers: '' }]);
});

test('REV-164 Grok QA title recognition and exclusions', () => {
  const yes = {
    'GM, Plant': 'MFG_PROD',
    'Principal Quality Engineer': 'QUALITY',
    'Staff Manufacturing Engineer': 'MFG_ENG',
    'Senior Manager, Customer Quality': 'QUALITY',
    'Director NPI': 'MFG_PROD',
    'Senior Manager NPI': 'MFG_PROD',
    'Director Continuous Improvement': 'MFG_PROD',
    'Operational Excellence Director': 'MFG_PROD',
    'Director Commissioning': 'MFG_PROD',
    'Director Manufacturing Product Launch': 'MFG_PROD',
    'Director Manufacturing Launch': 'MFG_PROD',
    'Senior Manager Production Ramp': 'MFG_PROD'
  };
  for (const [title, fam] of Object.entries(yes)) assert.strictEqual(T.family(title), fam, title);
  for (const title of [
    'Director Launch Operations', 'Director Launch Vehicle Manufacturing',
    'Director Launch Site Production', 'Director Launch Control',
    'Director Mission Production', 'Director Launch',
    'Senior Manager Ramp', 'Senior Manager Software Launch'
  ]) assert.strictEqual(T.family(title), null, title);
  assert.strictEqual(T.level('Principal Quality Engineer'), 'SR_STAFF');
  assert.strictEqual(T.level('Staff Manufacturing Engineer'), 'SR_STAFF');
});
test('REV-164 req ID, identity and protection precedence', () => {
  const idx = T.masterIndex([
    {COMPANY:'Acme',TITLE:'Director NPI',LOCATION:'Austin, TX',STATUS:'APPLIED',
      p:{SOURCE_URL:'https://job-boards.greenhouse.io/acme/jobs/12345'}},
    {COMPANY:'Beta',TITLE:'Director Quality',LOCATION:'Dallas, TX',
      p:{REQ_ID:'ABCD-123'}}
  ]);
  assert.strictEqual(T.atsId('https://job-boards.greenhouse.io/acme/jobs/12345?gh_src=xx'),'12345');
  assert.strictEqual(T.novelty(idx,'Acme','Director NPI','https://job-boards.greenhouse.io/acme/jobs/12345','Austin, TX'),'EXISTING_PROTECTED');
  assert.strictEqual(T.novelty(idx,'Acme','Director NPI','https://job-boards.greenhouse.io/acme/jobs/12345?source=linkedin','Austin, TX'),'EXISTING_PROTECTED');
  assert.strictEqual(T.novelty(idx,'Beta','Director Quality','https://elsewhere.example/j','Dallas, TX','ABCD-123'),'EXISTING');
  assert.notStrictEqual(T.identityKey('Acme','Sr Manager Manufacturing','Austin, TX'),T.identityKey('Acme','Senior Manager Manufacturing','Dallas, TX'));
  assert.strictEqual(T.novelty(idx,'Gamma','Director NPI','https://example.com/new','Austin, TX'),'NEW');
});

test('City/state identity and state-only fallback', () => {
  assert.notStrictEqual(T.identityKey('Acme','Director NPI','Austin, TX'), T.identityKey('Acme','Director NPI','Dallas, TX'));
  assert.strictEqual(T.identityKey('Acme','Director NPI','Austin, TX'), T.identityKey('ACME, LLC','Director NPI','austin, TX'));
  const idx = T.masterIndex([{ COMPANY:'Acme', TITLE:'Director NPI', LOCATION:'Austin, TX' }]);
  assert.strictEqual(T.novelty(idx,'Acme','Director NPI','','Dallas, TX'), 'NEW');
  assert.strictEqual(T.novelty(idx,'Acme','Director NPI','','Austin, TX'), 'EXISTING');
  assert.strictEqual(T.identityKey('Acme','Director NPI','Texas'), T.identityKey('Acme','Director NPI','TX'), 'state-only fallback');
});
test('Real master-shaped REQ BUCKET DISPOSITION ANTI_RESURRECTION DO_NOT_REWORK protection and precedence', () => {
  const rows = [
    {COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dallas, TX',REQ:'R-9',BUCKET:'APPLIED',DISPOSITION:'APPLIED',ANTI_RESURRECTION:'YES',DO_NOT_REWORK:'TRUE',p:{SOURCE_URL:'https://jobs.example/1'}},
    {COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dallas, TX',REQ:'R-9',BUCKET:'RESEARCH',DISPOSITION:'',p:{SOURCE_URL:'https://jobs.example/2'}},
    {COMPANY:'Other',TITLE:'Plant Manager',LOCATION:'Atlanta, GA',REQ:'P-1',DO_NOT_REWORK:'YES',p:{}}
  ];
  const idx = T.masterIndex(rows);
  assert.strictEqual(T.novelty(idx,'Acme','Director of Quality','https://jobs.example/2','Dallas, TX','R-9'),'EXISTING_PROTECTED');
  assert.strictEqual(T.novelty(idx,'Other','Plant Manager','','Atlanta, GA'),'EXISTING_PROTECTED');
});
test('Mission Assurance allowed; mission operations/director/control excluded; Product Launch needs manufacturing context', () => {
  assert.strictEqual(T.family('Director Mission Assurance Quality'),'QUALITY');
  assert.strictEqual(T.family('Director, Mission Operations'),null);
  assert.strictEqual(T.family('Director, Mission Control'),null);
  assert.strictEqual(T.family('Mission Director, Production'),null);
  assert.strictEqual(T.family('Director Product Launch'),null);
  assert.strictEqual(T.family('Director Manufacturing Product Launch'),'MFG_PROD');
});

test('Re-QA unpunctuated and long-form city normalization plus city-less fallback', () => {
 const a=T.identityKey('Acme','Director NPI','Austin, TX');
 assert.strictEqual(T.identityKey('Acme','Director NPI','Austin TX'),a);
 assert.strictEqual(T.identityKey('Acme','Director NPI','Austin, Texas'),a);
 const idx=T.masterIndex([{COMPANY:'Acme',TITLE:'Director NPI',LOCATION:'Austin, TX',ANTI_RESURRECTION:'YES'}]);
 assert.strictEqual(T.novelty(idx,'Acme','Director NPI','','TX'),'EXISTING_PROTECTED');
 assert.strictEqual(T.novelty(idx,'Acme','Director NPI','',''),'EXISTING_PROTECTED');
 assert.strictEqual(T.novelty(idx,'Acme','Director NPI','','Dallas, TX'),'NEW');
 assert.strictEqual(T.family('Director, Mission Production'),'MFG_PROD');
});
