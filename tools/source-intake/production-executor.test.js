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
 const records=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme'+i,TITLE:'Director',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'}));
 let writerCalls=0;
 await assert.rejects(()=>runCanary(records,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>({ok:false}),transport:async()=>{writerCalls++}}),/switch unavailable/);
 assert.equal(writerCalls,0);
});

test('reject canary without existing and protected test cases',async()=>{
 const candidates=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme'+i,TITLE:'Director',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:'NEW'}));
 await assert.rejects(()=>runCanary(candidates,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY'}),/new, existing and protected/);
});

test('canary insert requires matching complete receipt and exact readback',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const record={COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin, TX',REQ_ID:'R1'};
 const result={results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-123'}]};
 const receipt={status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-123',op:'INSERT'}]}};
 const readbacks=[{primaryId:'V2I-123',found:true,matches:1,line:'1 | V2I-123 | Acme | Director | SCOUT_INTAKE | OPEN | P1 | R1 | Austin, TX | NOTES'}];
 assert.equal(checkCanaryOutcome({expectedOutcome:'NEW',record,result,receipt,readbacks}).status,'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK');
 const mismatch=checkCanaryOutcome({expectedOutcome:'NEW',record:{...record,TITLE:'Wrong'},result,receipt,readbacks});
 assert.equal(mismatch.status,'HOLD');assert.equal(mismatch.reason,'INSERT_IDENTITY_MISMATCH');
 const pending=checkCanaryOutcome({expectedOutcome:'NEW',record,result,receipt:{...receipt,durable:false},readbacks});
 assert.equal(pending.status,'HOLD');assert.equal(pending.reason,'RECEIPT_NOT_DURABLE_AND_BOUND');
});
test('protected canary cannot pass if Writer inserts a row',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const result={results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-NEW'}]};
 const receipt={status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-NEW',op:'INSERT'}]}};
 const out=checkCanaryOutcome({expectedOutcome:'PROTECTED_NOOP',record:{},result,receipt,readbacks:[]});
 assert.equal(out.status,'HOLD');assert.equal(out.reason,'PROTECTED_NOT_NOOP');assert.equal(out.scaleUpAllowed,false);
});

test('canary rejects missing identity fields before network access',async()=>{
 const base=i=>({record:{COMPANY:'Acme '+i,TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/job/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'});
 for(const field of ['COMPANY','TITLE','LOCATION','SOURCE_URL']){
  const rows=Array.from({length:5},(_,i)=>base(i));rows[0].record[field]='';
  let calls=0;
  await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>{calls++;throw Error('network')} ,transport:async()=>{calls++;throw Error('Writer')}}),/exactly 5 reviewed/);
  assert.equal(calls,0,'no network allowed for '+field);
 }
});
test('canary rejects malformed source URLs before any switch or Writer call',async()=>{
 const rows=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme '+i,TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'javascript:alert(1)'},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'}));
 let calls=0;
 await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>{calls++},transport:async()=>{calls++}}),/exactly 5 reviewed/);
 assert.equal(calls,0);
});

test('five-case count reconciliation holds without independent authenticated master snapshots',()=>{
 const {reconcileCanaryBatch}=require('./canary-accounting');
 assert.equal(reconcileCanaryBatch({cases:Array(5).fill({}),before:{rows:[]},after:{rows:[]}}).reason,'INDEPENDENT_WRITER_SNAPSHOTS_REQUIRED');
});
test('five-case count reconciliation proves exact new ID set and protects archived no-op',()=>{
 const {reconcileCanaryBatch}=require('./canary-accounting');
 const row=(id,n)=>({PRIMARY_ID:id,COMPANY:'Company '+n,TITLE:'Director '+n,LOCATION:'Austin TX',REQ_ID:'REQ'+n});
 const before=[row('V2I-1',1),row('V2A-2',2),row('V2I-3',3)];
 const after=[...before,row('V2I-4',4),row('V2I-5',5)];
 const cases=[1,2,3,4,5].map(n=>({
   expectedOutcome:n===2?'PROTECTED_NOOP':n===1?'EXISTING_MATCH':n===3?'EXISTING_MATCH':'NEW',
   record:row('',n),primaryId:'V2I-'+n,
   protectedBefore:n===2?before[1]:undefined,
   accounting:{status:n===2||n===1||n===3?'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS':'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',
    primaryId:n===2?'V2A-2':'V2I-'+n}
 }));
 const snapshot=rows=>({source:'WRITER',authenticated:true,rows});
 const ok=reconcileCanaryBatch({cases,before:snapshot(before),after:snapshot(after)});
 assert.equal(ok.status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');
 assert.equal(ok.verified,false);assert.equal(ok.scaleUpAllowed,false);
 const contaminated=reconcileCanaryBatch({cases,before:snapshot(before),after:snapshot([...after,row('V2I-X',6)])});
 assert.equal(contaminated.reason,'INSERTED_ID_SET_MISMATCH');
});
