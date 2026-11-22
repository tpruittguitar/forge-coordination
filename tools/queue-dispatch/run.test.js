'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isDisabledError } = require('./run');

test('a disabled target is recognised so the chain keeps going', () => {
  assert.equal(isDisabledError("HTTP 422: Cannot trigger a 'workflow_dispatch' on a disabled workflow"), true);
  assert.equal(isDisabledError('HTTP 500: server error'), false);
});
