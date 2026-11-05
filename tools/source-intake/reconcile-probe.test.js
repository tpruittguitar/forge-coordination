'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{targets}=require('./reconcile-probe');
test('Gofer probe includes every deferred or quarantined original request',()=>{
 const state={results:{A:{ok:false},B:{status:'POST_IN_FLIGHT_UNKNOWN'}},requestIds:['A','B'],continuation:{pending:[{requestId:'A'},{requestId:'B'}]},quarantine:{requestId:'A'}};
 assert.deepEqual(targets(state),['A','B']);
});
