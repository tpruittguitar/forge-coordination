'use strict';
const test=require('node:test'),a=require('node:assert/strict'),{select}=require('./direct-progress.cjs');
const TASK='FORGE_GROK_SHARED_HELPER',now=Date.parse('2026-11-10T20:00:00Z');
function work(n=30){return{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,assignmentId:'A',providers:{[TASK]:{provider:'Grok',available:true},FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:false}},items:Array.from({length:n},(_,i)=>({primaryId:`V2I-${String(i).padStart(3,'0')}`,taskKey:TASK,provider:'Grok',kind:'ENRICHMENT',status:'ASSIGNED',sourceVersion:'source',assignmentVersion:1}))};}
let sequence=0;
const record=(id,phase,extra={})=>({recordId:`record-${id}-${phase}-${++sequence}`,observedAt:new Date(now-100000+sequence).toISOString(),primaryId:id,phase,sourceVersion:'source',assignmentVersion:1,...extra});
test('scan beyond first page already completed, never repeat first stale assignments',()=>{
 const w=work(),p=w.items.slice(0,20).map(i=>record(i.primaryId,'VERIFIED',{requestId:`req-${i.primaryId}`}));
 const r=select(w,p,now);a.equal(r.items.length,10);a.equal(r.items[0].primaryId,'V2I-020');a.equal(r.skipped.length,20);a.equal(r.canonicalCompletion,false);
});
test('uncertain writes and existing fallback deliveries remain fenced despite changed source',()=>{
 for(const phase of ['SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN','QUEUED','RESULT_RECEIVED','COMPLETE_PENDING_READBACK','RECONCILIATION_REQUIRED','HELPER_RETURN_DELIVERED']){
 const w=work(1),p=[record('V2I-000',phase)];w.items[0].sourceVersion='new';a.equal(select(w,p,now).items.length,0,phase);}
});
test('readback mismatch does not reopen research; no-op and ready artifacts advance selection',()=>{
 const w=work(4),p=[record('V2I-000','RECONCILIATION_REQUIRED'),record('V2I-001','NO_CHANGE'),record('V2I-002','RESEARCH_READY')];
 const r=select(w,p,now);a.deepEqual(r.items.map(x=>x.primaryId),['V2I-003']);
});
test('blocked research only wakes on condition or changed evidence, not run timestamp',()=>{
 const w=work(1),p=[record('V2I-000','RESEARCH_BLOCKED')];a.equal(select(w,p,now).items.length,0);
 p[0].retryAfter='2026-11-11T00:00:00Z';a.equal(select(w,p,now).items.length,0);
 p[0].retryAfter='2026-11-10T19:00:00Z';a.equal(select(w,p,now).items.length,1);
 delete p[0].retryAfter;w.items[0].sourceVersion='new';a.equal(select(w,p,now).items.length,1);
});
test('verified original transaction resolves only exact ID, never another pending request',()=>{
 const w=work(1),p=[record('V2I-000','QUEUED',{requestId:'first'}),record('V2I-000','VERIFIED',{requestId:'first'})];
 w.items[0].sourceVersion='new';a.equal(select(w,p,now).items.length,1);
 p.push(record('V2I-000','QUEUED',{requestId:'second'}));a.equal(select(w,p,now).items.length,0);
});
test('does not grant ownership, revive closed assignments or availability',()=>{
 const w=work(2);w.items[0].status='CONSUMED';a.equal(select(w,[],now).items.length,1);w.providers[TASK].available=false;a.equal(select(w,[],now).items.length,0);
});
test('malformed/missing history rejected, input not mutated',()=>{
 const w=work(),before=JSON.stringify(w);a.throws(()=>select(w,null),/PROGRESS_REQUIRED/);a.throws(()=>select(w,[{}]),/INVALID_DIRECT_PROGRESS/);select(w,[],now);a.equal(JSON.stringify(w),before);
});

test('latest blocked retry wins and older verified proof cannot clear later uncertainty',()=>{
 const w=work(1),id='V2I-000';
 a.equal(select(w,[record(id,'RESEARCH_BLOCKED',{retryAfter:'2026-11-10T19:00:00Z'}),record(id,'RESEARCH_BLOCKED',{retryAfter:'2026-11-11T00:00:00Z'})],now).items.length,0);
 a.equal(select(w,[record(id,'VERIFIED',{requestId:'q'}),record(id,'QUEUED',{requestId:'q'})],now).items.length,0);
});

test('verified partial fields do not suppress remaining gaps',()=>{const w=work(1);a.equal(select(w,[record('V2I-000','SUBMISSION_NOT_ATTEMPTED',{requestId:'q'}),record('V2I-000','VERIFIED',{requestId:'q',remainingFields:['DEGREE_TEXT']})],now).items.length,1);});
