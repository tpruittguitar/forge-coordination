'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requestId,fetchRelease,runCanary}=require('./production-executor');
test('deterministic request IDs survive a replay',()=>{
 const r={COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/role'};
 assert.equal(requestId(r),requestId({...r}));
 assert.notEqual(requestId(r),requestId({...r,REQ_ID:'R2'}));
});
test('release switch defaults closed',async()=>{
 await assert.rejects(()=>fetchRelease(async()=>({ok:true,json:async()=>({enabled:false})})),/switch/);
});
test('no writes when batch is not exactly five reviewed records',async()=>{
 let called=0;await assert.rejects(()=>runCanary([],{transport:async()=>{called++;}}),/exactly 5/);assert.equal(called,0);
});
test('an unavailable live kill switch fails before any Writer call',async()=>{
 const records=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme'+i,TITLE:'Director',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},evidenceVerified:true}));
 let writerCalls=0;
 await assert.rejects(()=>runCanary(records,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>({ok:false}),transport:async()=>{writerCalls++}}),/switch unavailable/);
 assert.equal(writerCalls,0);
});
