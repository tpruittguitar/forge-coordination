'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { discoveryHealth } = require('./discovery-health');
const at = '2026-11-07T00:00:00Z';

test('health sidecar is a minimal projection, with raw candidate counts and unique fragment-free HTTPS URLs', () => {
  const report = {
    summary: { at, boards: { failed: 2 }, privateDetails: 'omit' },
    new_roles: [null, {}, { url: null }, { url: 12 },
      { url: 'http://example.test/job' }, { url: 'invalid' },
      { url: 'https://example.test/job#a', description: 'full posting', company: 'omit' },
      { url: 'https://example.test/job#b' }, { url: 'https://example.test/job' },
      { url: 'https://example.test/other?x=1#fragment' }],
    existing_roles: [{ url: 'https://example.test/existing' }],
  };
  assert.deepEqual(discoveryHealth(report), {
    schema: 'forge.discovery-health.v1', at, failedBoards: 2, candidates: 10,
    urls: ['https://example.test/job', 'https://example.test/other?x=1'],
  });
});

test('empty reports and missing or null board failure counts preserve fallback defaults', () => {
  for (const boards of [undefined, null, {}, { failed: null }, { failed: 0 }]) {
    assert.deepEqual(discoveryHealth({ summary: { at, boards }, new_roles: [] }), {
      schema: 'forge.discovery-health.v1', at, failedBoards: 0, candidates: 0, urls: [],
    });
  }
});

test('per-report candidates remain distinct from the cross-report URL union', () => {
  const source = discoveryHealth({ summary: { at }, new_roles: [
    { url: 'https://example.test/shared#a' }, { url: 'https://example.test/shared#b' }, null,
  ] });
  const boards = discoveryHealth({ summary: { at }, new_roles: [
    { url: 'https://example.test/shared' }, { url: 'https://example.test/board' },
  ] });
  assert.equal(source.candidates + boards.candidates, 5);
  assert.equal(new Set([...source.urls, ...boards.urls]).size, 2);
});

test('unsupported reports fail instead of publishing misleading healthy summaries', () => {
  for (const report of [null, {}, { summary: null }, { summary: { at } },
    { summary: { at }, new_roles: null }, { summary: {}, new_roles: [] }]) {
    assert.throws(() => discoveryHealth(report), /Unsupported discovery report/);
  }
});
