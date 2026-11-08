'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const P=require('./check.cjs'),S=require('../programmed-coordinator/store.cjs'),D=require('../intake-drain/queue.cjs'),X=require('../routine-handoffs/exceptions.cjs');
const now=Date.parse('2026-11-08T08:00:00Z'),at=new Date(now).toISOString(),scope='FORGE_INTAKE_SCOPE_REVIEW',outcome='FORGE_APPLICATION_OUTCOME_TRACKER',enrich='FORGE_CHATGPT_ENRICHMENT_RESEARCH';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-research-check-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 S.save(root,'control/AI_AUTOMATION_TASKS.json',{schema:'forge.ai-automation-tasks.v1',tasks:{[scope]:{owner:'ChatGPT',procedure:'lanes/CHATGPT_INTAKE_DRAIN.txt'},[outcome]:{owner:'ChatGPT',procedure:'lanes/CHATGPT_APPLICATION_OUTCOME_TRACKER.txt'},[enrich]:{owner:'ChatGPT',procedure:'lanes/CHATGPT_ENRICHMENT_RESEARCH.txt'}}});return root;
}
function drain(root){
 const key='url:research-test';S.save(root,'state/UPSTREAM_LEDGER.json',{schema:'forge.upstream-ledger.v1',at,entries:{[key]:{company:'Factory',title:'General Manager',location:'Austin, TX',sourceUrl:'https://example.com/jobs/123',sources:['saved.json']}},groups:{[key]:{status:'WAITING',aliases:[key],firstSeen:at}}});
 return D.sync(root,{now,apply:true}).items[key];
}
function wait(root,item,extra={}){
 D.publish(root,{schema:'forge.intake-drain-review.v1',key:item.key,sourceVersion:item.sourceVersion,provider:'ChatGPT',taskKey:scope,runId:'FORGE-DRAIN-PREFLIGHT-TEST',observedAt:at,outcome:'WAITING_SOURCE_CHANGE',reason:'Exact posting is unavailable',nextAction:'Retry when exact source changes',writerSubmitted:false,attempts:[{url:item.card.url,result:'UNAVAILABLE'}],retryCondition:'NEW_SOURCE_EVIDENCE',...extra},now);
}
test('unchanged actionable queues always retain productive research; fingerprint is diagnostic only',t=>{
 const root=fixture(t);drain(root);const first=P.check(root,scope,{now}),second=P.check(root,scope,{now:now+1000});
 a.equal(first.decision,'RESEARCH_REQUIRED');a.equal(first.eligible,1);a.equal(second.skipResearch,false);a.equal(first.researchFingerprint,second.researchFingerprint);
});
test('source-bound unchanged waits skip research, due retries reopen without any file change',t=>{
 const root=fixture(t),item=drain(root),retryAfter=new Date(now+3600000).toISOString();wait(root,item,{retryAfter});
 const before=P.check(root,scope,{now});a.equal(before.decision,'IDLE');a.equal(before.nextRetryAt,retryAfter);a.equal(before.canonicalCompletion,false);a.equal(before.canonicalWrites,0);
 a.equal(P.check(root,scope,{now:now+3600000}).decision,'RESEARCH_REQUIRED');
 a.equal(D.next(root,scope,{now:now+3600000}).items.length,1);
});
test('changed source reopens held research and no-timer waits are not treated as periodic retries',t=>{
 const root=fixture(t),item=drain(root);wait(root,item);a.equal(P.check(root,scope,{now:now+3600000}).decision,'IDLE');
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[item.key].location='Dallas, TX';S.save(root,'state/UPSTREAM_LEDGER.json',up);
 a.equal(P.check(root,scope,{now}).decision,'RESEARCH_REQUIRED');
});
test('invalid reviews and missing or stale inputs never yield an idle decision',t=>{
 const root=fixture(t),item=drain(root);wait(root,item);S.save(root,D.REVIEWS+'/broken.json',{schema:'unknown',key:item.key,sourceVersion:item.sourceVersion});
 a.equal(P.check(root,scope,{now}).decision,'INSPECT_QUEUE');a.equal(P.check(root,'UNKNOWN',{now}).skipResearch,false);
 a.equal(P.check(root,scope,{now:now+25*3600000}).decision,'INSPECT_QUEUE');
 fs.unlinkSync(path.join(root,'state/UPSTREAM_LEDGER.json'));a.equal(P.check(root,scope,{now}).decision,'INSPECT_QUEUE');
});
test('pending independent validation is idle only for research, not completion or Writer permission',()=>{
 const r=P.summary({taskKey:scope,items:[{key:'one',status:'PENDING_INDEPENDENT_VALIDATION'}],eligible:[],at,now});
 a.equal(r.decision,'IDLE');a.equal(r.researchOnly,true);a.equal(r.canonicalCompletion,false);a.equal(r.noProcessingCap,true);
});
test('future and stale empty state never prove idle',()=>{
 for(const stamp of [undefined,'bad',new Date(now+300000).toISOString(),new Date(now-25*3600000).toISOString()])a.equal(P.summary({taskKey:scope,items:[],eligible:[],at:stamp,now}).decision,'INSPECT_QUEUE');
});
test('failed source validation retries stay eligible at their exact due boundary',()=>{
 const item={status:'SOURCE_VALIDATION_REQUIRED',validation:{retryAfter:new Date(now+1000).toISOString()}};
 a.equal(D.researchEligible(item,now),false);a.equal(D.researchEligible(item,now+1000),true);a.equal(D.researchEligible({status:'SOURCE_VALIDATION_REQUIRED'},now),false);
});
function exceptions(root,cases){S.save(root,'state/AI_EXCEPTION_WORK.json',{schema:'forge.ai-exception-work.v1',at,cases,reviewErrors:{}});}
test('exception timers reopen in actual queue before coordinator refresh, without writes',t=>{
 const root=fixture(t),item={exceptionId:'one',taskKey:outcome,binding:{sourceVersion:'unchanged'},status:'WAITING_SOURCE_CHANGE',review:{disposition:'WAITING_SOURCE_CHANGE',retryAfter:new Date(now+1000).toISOString()}};
 exceptions(root,{one:item});const file=path.join(root,'state/AI_EXCEPTION_WORK.json'),before=fs.readFileSync(file,'utf8');
 a.equal(X.queue(root,{now}).actionable,0);
 const q=X.queue(root,{now:now+1000});a.equal(q.actionable,1);a.equal(q.counts.ACTION_REQUIRED,1);a.equal(q.waiting.length,0);a.equal(fs.readFileSync(file,'utf8'),before);
});
test('Tim waits, no-timer source waits, and closed cases do not reopen from elapsed time',t=>{
 const root=fixture(t);exceptions(root,{a:{status:'AWAITING_TIM',review:{retryAfter:at}},b:{status:'WAITING_SOURCE_CHANGE',review:{disposition:'WAITING_SOURCE_CHANGE'}},c:{status:'NO_LONGER_OPEN',review:{disposition:'WAITING_SOURCE_CHANGE',retryAfter:at}}});
 a.equal(X.queue(root,{now:now+3600000}).actionable,0);
});
test('outcome tracker is deliberately outside idle suppression even for an empty ledger',t=>{
 const root=fixture(t);exceptions(root,{one:{exceptionId:'one',status:'UNRECOGNIZED'}});a.equal(P.check(root,outcome,{now}).skipResearch,false);
 exceptions(root,{});const w=S.read(root,'state/AI_EXCEPTION_WORK.json');w.reviewErrors.bad={reason:'INVALID_REVIEW'};S.save(root,'state/AI_EXCEPTION_WORK.json',w);a.equal(P.check(root,outcome,{now}).decision,'INSPECT_QUEUE');
});
test('enrichment uses current ownership and preserves assigned jobs while returned work is not repeated',t=>{
 const root=fixture(t),w={schema:'forge.enrichment-helper-work.v1',assignmentId:'preflight-test',provider:'ChatGPT',taskKey:enrich,enabled:true,at,items:[{primaryId:'V2I-ONE',owner:'ChatGPT',taskKey:enrich,status:'RETURNED_PENDING_REVIEW'}]};
 S.save(root,'control/ENRICHMENT_HELPER_WORK.json',w);a.equal(P.check(root,enrich,{now}).decision,'IDLE');
 w.items.push({...w.items[0],primaryId:'V2I-TWO',status:'ASSIGNED'});S.save(root,'control/ENRICHMENT_HELPER_WORK.json',w);a.equal(P.check(root,enrich,{now}).eligible,1);
 w.enabled=false;S.save(root,'control/ENRICHMENT_HELPER_WORK.json',w);a.equal(P.check(root,enrich,{now}).skipResearch,false);
});
test('read-only preflight neither writes queue state nor opens source transport',t=>{
 const root=fixture(t);drain(root);const before=S.files(root).map(f=>[f,fs.readFileSync(f,'utf8')]);P.check(root,scope,{now});a.deepEqual(S.files(root).map(f=>[f,fs.readFileSync(f,'utf8')]),before);
});
test('due retry progress stays actionable with no attempt or an attempt lacking a new disposition',t=>{
 const root=fixture(t),E=require('../routine-handoffs/exception-progress.cjs'),sourceVersion='a'.repeat(64),retryAfter=new Date(now).toISOString();
 exceptions(root,{one:{exceptionId:'one',taskKey:outcome,binding:{sourceVersion},kind:'SOURCE',status:'WAITING_SOURCE_CHANGE',review:{disposition:'WAITING_SOURCE_CHANGE',retryAfter}}});
 for(const [index,attempt]of [false,true].entries()){
  const runId='FORGE-EXCEPTION-CHATGPT-PREFLIGHT'+index,manifest=E.start(root,runId,20,now);a.equal(manifest.selected.length,1);
  const receipt=E.checkpoint(root,{runId,completedAt:at,attempts:attempt?[{exceptionId:'one',sourceVersion,observedAt:at,evidenceSha256:'b'.repeat(64),reason:'Source remains unavailable',nextAction:'Record a new bound disposition'}]:[]},now);
  a.equal(receipt.status,'NO_REVIEW_PROGRESS');a.equal(receipt.stillActionable,1);a.equal(receipt.waiting,0);a.equal(receipt.nextCase.exceptionId,'one');a.equal(receipt.consecutiveNoReviewProgress,index+1);
 }
});
