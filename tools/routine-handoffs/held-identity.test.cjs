'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const W=require('./exception-work.cjs'),S=require('../programmed-coordinator/store.cjs');
const now=Date.parse('2026-01-01T12:00:00Z');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'held-identity-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const item={key:'synthetic-held-key',requestId:'original-synthetic-request',sourceProof:'receipts/synthetic-source.json',status:'HELD_WRITER_IDENTITY',reason:'AMBIGUOUS_MATCH: EMPLOYER_TITLE_NEEDS_LOCATION'};
 const state={items:{},transactions:{[item.requestId]:{status:'VERIFIED',submitted:4,verifiedInserted:3,held:1}}},report={runId:'synthetic-report'};
 S.save(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[item]});S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);S.save(root,'receipts/original-synthetic-request_VERIFIED.json',{requestId:item.requestId,submitted:4,verifiedInserted:3,held:1});
 const sync=()=>W.sync({root,state,report,now,apply:true});return{root,item,state,sync};}
test('held identity remains a source-bound obligation despite aggregate verification; incomplete-evidence wait survives sync',t=>{
 const f=fixture(t),stateBefore=structuredClone(f.state),files=['state/RELEVANCE_INTAKE_PLAN.json','state/PROGRAMMED_COORDINATOR.json','receipts/original-synthetic-request_VERIFIED.json'],before=files.map(p=>fs.readFileSync(path.join(f.root,p),'utf8'));
 const work=f.sync(),c=Object.values(work.cases)[0];a.equal(Object.keys(work.cases).length,1);a.equal(c.binding.key,f.item.key);a.equal(c.binding.requestId,f.item.requestId);a.equal(c.binding.sourceVersion,S.hash({key:f.item.key,requestId:f.item.requestId,sourceProof:f.item.sourceProof}));a.equal(c.reason,f.item.reason);a.equal(c.canonicalCompletion,false);
 const record={schema:'forge.ai-exception-review.v1',exceptionId:c.exceptionId,sourceVersion:c.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now).toISOString(),runId:'FORGE-EXCEPTION-CHATGPT-HELDTEST',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_WRITER_EVIDENCE_INCOMPLETE',retryCondition:'ORIGINAL_WRITER_EVIDENCE_CHANGED',evidenceSha256:S.hash('original-incomplete-evidence')};W.publishReview(f.root,record,now);
 for(let n=0;n<3;n++){const next=f.sync();a.equal(next.cases[c.exceptionId].status,'WAITING_SOURCE_CHANGE');a.equal(next.cases[c.exceptionId].review.sha256,S.hash(record));a.equal(next.cases[c.exceptionId].canonicalCompletion,false);}
 a.deepEqual(f.state,stateBefore);a.deepEqual(files.map(p=>fs.readFileSync(path.join(f.root,p),'utf8')),before);a.equal(S.files(path.join(f.root,'receipts')).filter(p=>!p.includes('AI_EXCEPTION_REVIEWS')).length,1);
 // An uncertain original remains fenced in place; discovery never submits/replays it.
 f.state.transactions[f.item.requestId].status='POST_IN_FLIGHT_UNKNOWN';const uncertain=structuredClone(f.state);f.sync();a.deepEqual(f.state,uncertain);
});
for(const status of ['VERIFIED','PROTECTED_SKIP','EXISTING','NO_MISSING'])test('terminal coordinator item is not reopened: '+status,t=>{const f=fixture(t);f.state.items[f.item.key]={status};a.equal(Object.keys(f.sync().cases).length,0);});
for(const status of ['VERIFIED','HELD_WRITER_IDENTITY_SUFFIX','DONE'])test('non-held plan status is not newly admitted: '+status,t=>{const f=fixture(t);S.save(f.root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[{...f.item,status}]});a.equal(Object.keys(f.sync().cases).length,0);});
test('drain-owned held identity remains suppressed',t=>{const f=fixture(t);S.save(f.root,'state/INTAKE_DRAIN.json',{items:{held:{key:f.item.key,status:'HELD',fence:{requestIds:[f.item.requestId]}}}});a.equal(Object.keys(f.sync().cases).length,0);});
test('HELD_CARD to held identity without a reason preserves the default binding and existing wait',t=>{
 const f=fixture(t);delete f.item.reason;f.item.status='HELD_CARD';S.save(f.root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[f.item]});const c=Object.values(f.sync().cases)[0];a.equal(c.binding.reason,'WRITER_RECONCILIATION_REQUIRED');
 const r={schema:'forge.ai-exception-review.v1',exceptionId:c.exceptionId,sourceVersion:c.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now).toISOString(),runId:'FORGE-EXCEPTION-CHATGPT-TRANSITION',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_WRITER_EVIDENCE_INCOMPLETE',retryCondition:'ORIGINAL_WRITER_EVIDENCE_CHANGED',evidenceSha256:S.hash('saved review')};W.publishReview(f.root,r,now);
 f.item.status='HELD_WRITER_IDENTITY';S.save(f.root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[f.item]});const work=f.sync();a.equal(Object.keys(work.cases).length,1);a.deepEqual(work.cases[c.exceptionId].binding,c.binding);a.equal(work.cases[c.exceptionId].status,'WAITING_SOURCE_CHANGE');a.equal(work.cases[c.exceptionId].review.sha256,S.hash(r));
});
