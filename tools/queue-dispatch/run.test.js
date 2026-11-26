'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isDisabledError } = require('./run');

test('a disabled target is recognised so the chain keeps going', () => {
  assert.equal(isDisabledError("HTTP 422: Cannot trigger a 'workflow_dispatch' on a disabled workflow"), true);
  assert.equal(isDisabledError('HTTP 500: server error'), false);
});

const { otherActiveRuns, skipSelfDispatch } = require('./run');
const self = { workflow: 'source-intake-auto.yml', reason: 'self' };

test('self-dispatch is skipped while another source-intake-auto run is queued or running', () => {
  const runs = [{ databaseId: 1, status: 'in_progress' }, { databaseId: 2, status: 'queued' }, { databaseId: 3, status: 'completed' }];
  assert.deepEqual(otherActiveRuns(runs, '1').map((r) => r.databaseId), [2]);
  assert.equal(skipSelfDispatch(self, 'o/r', '1', () => runs), true);
});

test('self-dispatch goes ahead when only this run is active', () => {
  const runs = [{ databaseId: 1, status: 'in_progress' }, { databaseId: 3, status: 'completed' }];
  assert.equal(skipSelfDispatch(self, 'o/r', '1', () => runs), false);
});

test('next dispatches and other workflows are never skipped, and a failed run list dispatches as before', () => {
  const busy = () => [{ databaseId: 2, status: 'queued' }];
  assert.equal(skipSelfDispatch({ workflow: 'enrich-ats-pay.yml', reason: 'next' }, 'o/r', '1', busy), false);
  assert.equal(skipSelfDispatch({ workflow: 'enrich-ats-pay.yml', reason: 'self' }, 'o/r', '1', busy), false);
  assert.equal(skipSelfDispatch(self, 'o/r', '1', () => { throw Error('gh failed'); }), false);
});
