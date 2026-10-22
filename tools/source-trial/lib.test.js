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
