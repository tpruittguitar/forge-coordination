'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decide, parseDepth, DEPTH_CAP } = require('./decide');

test('parseDepth treats empty and invalid as 0', () => {
  assert.equal(parseDepth(undefined), 0);
  assert.equal(parseDepth(''), 0);
  assert.equal(parseDepth('nope'), 0);
  assert.equal(parseDepth(-1), 0);
  assert.equal(parseDepth('3'), 3);
  assert.equal(DEPTH_CAP, 6);
});

test('intake wrote rows and waiting is 0: dispatch enrich next only', () => {
  assert.deepEqual(
    decide({ lane: 'source-intake-auto', wroteRows: 15, waiting: 0, depth: 0 }),
    { dispatch: [{ workflow: 'enrich-ats-pay.yml', reason: 'next' }], depth: 0, nextDepth: 1 }
  );
});

test('intake wrote rows and waiting > 0: dispatch enrich next and intake self', () => {
  assert.deepEqual(
    decide({ lane: 'source-intake-auto', wroteRows: 15, waiting: 922, depth: 2 }),
    {
      dispatch: [
        { workflow: 'enrich-ats-pay.yml', reason: 'next' },
        { workflow: 'source-intake-auto.yml', reason: 'self' }
      ],
      depth: 2,
      nextDepth: 3
    }
  );
});

test('intake waiting > 0 but this run wrote no rows: dispatch nothing', () => {
  // Stale UPSTREAM_FLOW.waiting would otherwise loop until the depth cap.
  assert.deepEqual(
    decide({ lane: 'source-intake-auto', wroteRows: 0, waiting: 922, depth: 0 }),
    { dispatch: [], depth: 0, nextDepth: 1 }
  );
});

test('intake wrote nothing and waiting is 0: dispatch nothing', () => {
  assert.deepEqual(
    decide({ lane: 'source-intake-auto', wroteRows: 0, waiting: 0 }),
    { dispatch: [], depth: 0, nextDepth: 1 }
  );
});

test('enrich not_attempted > 0 and budget open: dispatch enrich self', () => {
  assert.deepEqual(
    decide({ lane: 'enrich-ats-pay', notAttempted: 528, researchBudgetExhausted: false, depth: 1 }),
    { dispatch: [{ workflow: 'enrich-ats-pay.yml', reason: 'self' }], depth: 1, nextDepth: 2 }
  );
});

test('enrich not_attempted > 0 but research budget exhausted: dispatch nothing', () => {
  assert.deepEqual(
    decide({ lane: 'enrich-ats-pay', notAttempted: 528, researchBudgetExhausted: true, depth: 1 }),
    { dispatch: [], depth: 1, nextDepth: 2 }
  );
});

test('enrich not_attempted is 0: dispatch nothing', () => {
  assert.deepEqual(
    decide({ lane: 'enrich-ats-pay', notAttempted: 0, researchBudgetExhausted: false }),
    { dispatch: [], depth: 0, nextDepth: 1 }
  );
});

test('depth 5 still dispatches with nextDepth 6', () => {
  const d = decide({ lane: 'enrich-ats-pay', notAttempted: 1, researchBudgetExhausted: false, depth: 5 });
  assert.deepEqual(d.dispatch, [{ workflow: 'enrich-ats-pay.yml', reason: 'self' }]);
  assert.equal(d.nextDepth, 6);
});

test('depth at cap 6 dispatches nothing even when work remains', () => {
  assert.deepEqual(
    decide({ lane: 'source-intake-auto', wroteRows: 15, waiting: 922, depth: 6 }),
    { dispatch: [], stopReason: 'depth-cap', depth: 6, nextDepth: 6 }
  );
  assert.deepEqual(
    decide({ lane: 'enrich-ats-pay', notAttempted: 10, researchBudgetExhausted: false, depth: '7' }),
    { dispatch: [], stopReason: 'depth-cap', depth: 7, nextDepth: 7 }
  );
});
