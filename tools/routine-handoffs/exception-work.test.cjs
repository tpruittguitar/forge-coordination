'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const W=require('./exception-work.cjs'),S=require('../programmed-coordinator/store.cjs'),Run=require('../programmed-coordinator/run.cjs'),Source=require('../programmed-coordinator/source.cjs'),I=require('./intake-state.cjs');
const now=Date.parse('2026-11-02T12:00:00Z'),at=new Date(now).toISOString();
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-exception-'));
 t.after(()=>{a.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const original={key:'linkedin:123',recommendation:'SOURCE_BLOCKED',sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://careers.factory.com/old',quote:'Old source evidence is inaccessible.'}};
 const key='FORGE_GROK_INTAKE_HELPER:'+original.key,batch='receipts/GROK_HELPERS/FORGE_GROK_INTAKE_HELPER/TEST.json';
 S.save(root,batch,{runId:'GROK-TEST',items:[original]});
 const item={key,itemKey:original.key,taskKey:'FORGE_GROK_INTAKE_HELPER',batch,version:S.hash(original),status:'EXCEPTION',attempts:0};
 const state={items:{[key]:item},batches:{[batch]:{status:'VALIDATED'}},exceptions:{[key]:{key,reason:'WORKING_SOURCE_ROUTE_REQUIRED',owner:'CODE',itemVersion:item.version}},transactions:{}};
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[original.key]:{...original.sourceEvidence}},sources:{history:{status:'HISTORICAL_RESULTS_UNAVAILABLE',advertisedUnseen:24,historicalCoverage:'INCOMPLETE_ORIGINAL_IDENTITIES'}}});
 const report=()=>({runId:'FORGE-CODE-TEST',aiExceptions:Object.values(state.exceptions).filter(e=>e.owner==='AI'),codeExceptions:Object.values(state.exceptions).filter(e=>e.owner==='CODE')});
 const sync=(time=now)=>W.sync({root,state,report:report(),now:time,apply:true});
 const review=(job,extra={})=>({schema:'forge.ai-exception-review.v1',exceptionId:job.exceptionId,sourceVersion:job.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:at,runId:'FORGE-EXCEPTION-CHATGPT-TEST',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_IDENTITIES_UNAVAILABLE',retryCondition:'NEW_ORIGINAL_SOURCE_EVIDENCE',evidenceSha256:'a'.repeat(64),...extra});
 return{root,state,item,original,key,batch,report,sync,review};
}
function sourceReview(f,extra={}){const job=Object.values(f.sync().cases).find(c=>c.kind==='SOURCE');return f.review(job,{disposition:'SOURCE_EVIDENCE',reason:undefined,retryCondition:undefined,sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://careers.factory.com/job/123',quote:'Lead the production team.',observedAt:at},...extra});}

test('persistent code failures escalate without changing retry clocks, jobs or historical coverage',t=>{
 const f=fixture(t),before=S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json');let work=f.sync();
 a.equal(work.counts.ACTION_REQUIRED,2);a.equal(Object.values(work.cases).find(c=>c.kind==='SOURCE').identity.company,'Factory');
 const e=f.state.exceptions[f.key];e.reason='SOURCE_HTTP_429';f.item.attempts=1;f.item.retryAfter=new Date(now+3600000).toISOString();
 work=f.sync();a.equal(Object.values(work.cases).filter(c=>c.status==='ACTION_REQUIRED').length,1);
 f.item.attempts=2;work=f.sync();const id=Object.values(work.cases).find(c=>c.status==='ACTION_REQUIRED'&&c.kind==='SOURCE').exceptionId;
 e.reason='SOURCE_ROUTE_BACKOFF';f.item.attempts=3;work=f.sync();a.equal(work.cases[id].status,'ACTION_REQUIRED');
 a.equal(f.item.retryAfter,new Date(now+3600000).toISOString());a.deepEqual(S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),before);
 f.item.transactionId='pending';a.equal(f.sync().cases[id].status,'NO_LONGER_OPEN');delete f.item.transactionId;
 f.item.status='PROTECTED_SKIP';a.equal(f.sync().cases[id].status,'NO_LONGER_OPEN');f.item.status='EXCEPTION';f.state.batches[f.batch].status='QUARANTINED';a.equal(f.sync().cases[id].status,'NO_LONGER_OPEN');
});

test('historical holds remain open, survive retries, and reopen for changed original evidence or explicit retry time',t=>{
 const f=fixture(t),history=Object.values(f.sync().cases).find(c=>c.kind==='HISTORICAL'),record=f.review(history);
 W.publishReview(f.root,record,now);let work=f.sync(now+1000);a.equal(work.cases[history.exceptionId].status,'WAITING_SOURCE_CHANGE');
 a.equal(work.cases[history.exceptionId].canonicalCompletion,false);a.equal(require('./exceptions.cjs').queue(f.root).waiting.length,1);
 W.publishReview(f.root,{...record,reviewedAt:new Date(now+2000).toISOString(),retryAfter:new Date(now+4000).toISOString()},now+2000);
 a.equal(f.sync(now+3000).cases[history.exceptionId].status,'WAITING_SOURCE_CHANGE');a.equal(f.sync(now+5000).cases[history.exceptionId].status,'ACTION_REQUIRED');
 const jobs=S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json');jobs.sources.history.originalAlertRecovery={newSourceSha256:'b'.repeat(64)};S.save(f.root,'state/EMAIL_RECOVERY_QUEUE.json',jobs);
 work=f.sync(now+6000);a.equal(work.cases[history.exceptionId].status,'NO_LONGER_OPEN');a.equal(Object.values(work.cases).filter(c=>c.kind==='HISTORICAL'&&c.status==='ACTION_REQUIRED').length,1);
 a.equal(S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json').sources.history.status,'HISTORICAL_RESULTS_UNAVAILABLE');
});

test('stale reviews, invented completion, missing user questions and modified receipts cannot disposition cases',t=>{
 const f=fixture(t),job=Object.values(f.sync().cases)[0],record=f.review(job);
 for(const patch of [{sourceVersion:'b'.repeat(64)},{reviewedBy:'GROK'},{disposition:'VERIFIED'},{masterWritten:true},{disposition:'AWAITING_TIM',askPath:'asks/open/missing.json'},{reviewedAt:'bad'}])a.throws(()=>W.publishReview(f.root,{...record,...patch},now));
 const result=W.publishReview(f.root,record,now);S.save(f.root,result.path,{...record,evidenceSha256:'c'.repeat(64)});
 const work=f.sync();a.equal(work.cases[job.exceptionId].status,'ACTION_REQUIRED');a.equal(Object.values(work.reviewErrors)[0].reason,'IMMUTABLE_REVIEW_FILENAME_REQUIRED');
});

test('only the latest review applies; unchanged source reviews never reset retryAfter twice',t=>{
 const f=fixture(t),record=sourceReview(f);W.publishReview(f.root,record,now);
 const changed={...record,reviewedAt:new Date(now+1000).toISOString(),sourceEvidence:{...record.sourceEvidence,url:'https://careers.factory.com/job/124'}};W.publishReview(f.root,changed,now+1000);
 a.equal(W.applySourceReviews({root:f.root,state:f.state,now:now+2000}).applied,1);a.equal(f.item.sourceRecoveryEvidence.url,changed.sourceEvidence.url);
 f.item.retryAfter=new Date(now+3600000).toISOString();a.equal(W.applySourceReviews({root:f.root,state:f.state,now:now+3000}).applied,0);a.ok(f.item.retryAfter);
 const hold=f.review(Object.values(f.sync(now+4000).cases).find(c=>c.status==='ACTION_REQUIRED'&&c.kind==='SOURCE'),{reviewedAt:new Date(now+5000).toISOString()});W.publishReview(f.root,hold,now+5000);
 a.equal(W.applySourceReviews({root:f.root,state:f.state,now:now+6000}).applied,0);
});

test('a proposed replacement source must pass independent verification and retain immutable intake provenance',async t=>{
 const f=fixture(t),record=sourceReview(f);W.publishReview(f.root,record,now);W.applySourceReviews({root:f.root,state:f.state,now});
 S.save(f.root,'control/AI_AUTOMATION_TASKS.json',{tasks:{FORGE_GROK_INTAKE_HELPER:{workAssignments:'control/work.json'}}});
 S.save(f.root,'control/work.json',{pages:[{path:'control/page.json'}]});S.save(f.root,'control/page.json',{items:[f.original]});
 let calls=0;const raw='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Plant Manager',hiringOrganization:{name:'Factory'},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description:'Lead the production team. '.repeat(20)})+'</script>';
 await Run.inspectReturns({root:f.root,privateDir:f.root,state:f.state,snapshot:{rows:[],archiveRows:[]},apply:true,now,sourceVerify:args=>Source.verify({...args,fetchPage:async()=>{calls++;return{url:record.sourceEvidence.url,raw};}})});
 a.equal(calls,1);a.equal(f.item.status,'SOURCE_VERIFIED');a.equal(f.item.sourceEvidence.independentlyVerified,true);a.equal(f.item.sourceEvidence.url,record.sourceEvidence.url);
 a.equal(S.read(f.root,f.batch).items[0].recommendation,'SOURCE_BLOCKED');a.deepEqual(f.state.transactions,{});
 a.equal(I.seedVerified(f.root,f.state,true).seeded,1);const intake=I.find(f.root,f.original.key);a.equal(I.original(f.root,intake).sourceEvidence.url,record.sourceEvidence.url);
 f.sync();a.equal(I.original(f.root,intake).sourceEvidence.url,record.sourceEvidence.url);
 a.throws(()=>W.evidence(f.root,{...f.item,key:'another-job'},f.original),/CASE_REQUIRED/);
 a.throws(()=>W.evidence(f.root,f.item,{...f.original,recommendation:'INTAKE_READY'}),/IMMUTABLE/);
 const proof=S.read(f.root,f.item.sourceRecoveryProof);S.save(f.root,f.item.sourceRecoveryProof,{...proof,sourceEvidence:{...proof.sourceEvidence,title:'Different role'}});a.throws(()=>I.original(f.root,intake),/IMMUTABLE/);
});

test('changed source evidence cannot resume a protected, pending, stale or invalid original item',t=>{
 const f=fixture(t),record=sourceReview(f);W.publishReview(f.root,record,now);
 f.item.transactionId='uncertain-write';a.equal(W.applySourceReviews({root:f.root,state:f.state,now}).applied,0);delete f.item.transactionId;
 f.item.status='VERIFIED';a.equal(W.applySourceReviews({root:f.root,state:f.state,now}).applied,0);f.item.status='EXCEPTION';
 f.state.batches[f.batch].status='QUARANTINED';a.equal(W.applySourceReviews({root:f.root,state:f.state,now}).applied,0);f.state.batches[f.batch].status='VALIDATED';
 f.item.version='b'.repeat(64);a.equal(W.applySourceReviews({root:f.root,state:f.state,now}).applied,0);f.item.version=S.hash(f.original);
 S.save(f.root,f.batch,{items:[{...f.original,recommendation:'OUT_OF_SCOPE'}]});a.equal(W.applySourceReviews({root:f.root,state:f.state,now}).applied,0);
});

test('replacement evidence cannot bypass a live protected row or contradictory posting identity',async t=>{
 const f=fixture(t);f.item.taskKey='FORGE_GROK_ENRICHMENT';f.item.itemKey='V2I-ONE';f.original.primaryId='V2I-ONE';delete f.original.key;f.item.version=S.hash(f.original);f.state.exceptions[f.key].itemVersion=f.item.version;S.save(f.root,f.batch,{items:[f.original]});
 const record=sourceReview(f);W.publishReview(f.root,record,now);W.applySourceReviews({root:f.root,state:f.state,now});
 const row={PRIMARY_ID:'V2I-ONE',COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'DECLINED_BY_TIM',p:{}};let calls=0;
 await Run.inspectReturns({root:f.root,privateDir:f.root,state:f.state,snapshot:{rows:[row]},apply:true,now,sourceVerify:async()=>{calls++;throw Error('SOURCE_IDENTITY_AMBIGUOUS');}});
 a.equal(calls,0);a.equal(f.item.status,'PROTECTED_SKIP');f.item.status='EXCEPTION';row.BUCKET='SCOUT_INTAKE';
 await Run.inspectReturns({root:f.root,privateDir:f.root,state:f.state,snapshot:{rows:[row]},apply:true,now,sourceVerify:async()=>{calls++;throw Error('SOURCE_IDENTITY_AMBIGUOUS');}});
 a.equal(calls,1);a.equal(f.item.status,'EXCEPTION');a.equal(f.state.exceptions[f.key].owner,'AI');a.deepEqual(f.state.transactions,{});
});
test('drain-owned intake exceptions are not assigned twice while unrelated historical work remains open',t=>{
 const f=fixture(t);S.save(f.root,'state/INTAKE_DRAIN.json',{schema:'forge.intake-drain.v1',items:{[f.original.key]:{key:f.original.key,aliases:[f.original.key],status:'ACTION_REQUIRED',taskKey:'FORGE_INTAKE_SOURCE_RECOVERY'}}});const work=f.sync();a.equal(Object.values(work.cases).some(c=>c.kind==='SOURCE'),false);a.equal(Object.values(work.cases).some(c=>c.kind==='HISTORICAL'),true);
});
