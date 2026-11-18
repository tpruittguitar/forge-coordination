'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {previous,latch}=require('./auto-latch');
test('previous() drops Writer snapshots but keeps latch fields',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'latch-slim-')),dir=path.join(root,'receipts/auto-intake');fs.mkdirSync(dir,{recursive:true});
 const state={sourceRunId:'R1',candidatesHash:'h',requestIds:['a'],snapshots:{before:{rows:[1,2,3]}},results:{},outcomes:[],halts:[{at:'2026-11-18T00:00:00Z',message:'HOLD: x',outcomes:[{requestId:'a',status:'HOLD'}]}]};
 fs.writeFileSync(path.join(dir,'FORGE-AUTO-1.json'),JSON.stringify(state));
 const prior=previous(root);
 assert.strictEqual(prior.length,1);assert.strictEqual(prior[0].state.snapshots,undefined);
 assert.deepStrictEqual(prior[0].state.halts,state.halts);
 assert.strictEqual(latch(prior).blocking.length,1);
 assert.ok(JSON.parse(fs.readFileSync(path.join(dir,'FORGE-AUTO-1.json'))).snapshots,'file on disk is untouched');
});
