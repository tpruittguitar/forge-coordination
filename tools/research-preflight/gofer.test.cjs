'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const G=require('./gofer.cjs'),S=require('../programmed-coordinator/store.cjs'),W=require('../routine-handoffs/exception-work.cjs');
const now=Date.parse('2026-11-10T01:00:00Z'),at=new Date(now).toISOString(),TASK=G.TASK,ENRICH='FORGE_CHATGPT_ENRICHMENT_RESEARCH';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'gofer-gate-')),privateDir=path.join(root,'private');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(privateDir);
 S.save(root,'control/AI_AUTOMATION_TASKS.json',{schema:'forge.ai-automation-tasks.v1',tasks:{[TASK]:{owner:'ChatGPT',route:'runtime'}}});
 S.save(root,W.FILE,{schema:'forge.ai-exception-work.v1',at,cases:{},reviewErrors:{}});
 S.save(root,'state/PROGRAMMED_COORDINATOR.json',{items:{},batches:{},transactions:{}});
 S.save(root,'state/enrich-ats-pay-recovery.json',{schema:'forge.enrichment-recovery.v1',at,run:'code',rows:[]});
 S.save(root,'control/ENRICHMENT_HELPER_WORK.json',{schema:'forge.enrichment-helper-work.v1',enabled:true,routingActive:true,assignmentId:'gofer-test',provider:'ChatGPT',taskKey:ENRICH,at,items:[]});
 const snapshot={source:{kind:'CANONICAL_WRITER_MASTER',readAt:at},rows:[],archiveRows:[],needsById:{}};
 return {root,privateDir,snapshot};
}
function waiting(root,extra={}){
 const binding={requestId:'FORGE-ORIGINAL-ONE',sourceVersion:'a'.repeat(64)},exceptionId=S.hash(binding),item={exceptionId,binding,requestId:binding.requestId,kind:'WRITER',taskKey:W.OWNER,alsoAssignedTo:TASK,status:'ACTION_REQUIRED'};
 const work=S.read(root,W.FILE);work.cases[exceptionId]=item;S.save(root,W.FILE,work);
 W.publishReview(root,{schema:'forge.ai-exception-review.v1',exceptionId,sourceVersion:binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:TASK,reviewedAt:at,runId:'FORGE-EXCEPTION-CHATGPT-TEST',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_WRITER_EVIDENCE_INCOMPLETE',retryCondition:'ORIGINAL_WRITER_EVIDENCE_CHANGED',evidenceSha256:'b'.repeat(64),...extra},now);
 return S.read(root,W.FILE).cases[exceptionId];
}
function inspect(f,extra={}){return G.check(f.root,{now,privateDir:f.privateDir,snapshot:f.snapshot,...extra});}
test('two unchanged real code invocations retain waits and execute zero investigation or Writer calls',t=>{
 const f=fixture(t);waiting(f.root);const before=fs.readFileSync(path.join(f.root,W.FILE));
 const first=G.run(f.root,{now,snapshot:f.snapshot,privateDir:f.privateDir,stateDir:f.privateDir,runId:'FORGE-GOFER-CHATGPT-TEST1'}),second=G.run(f.root,{now:now+1000,snapshot:f.snapshot,privateDir:f.privateDir,stateDir:f.privateDir,runId:'FORGE-GOFER-CHATGPT-TEST2'});
 for(const r of [first,second]){a.equal(r.decision,'IDLE');a.equal(r.skipInvestigation,true);a.equal(r.notify,false);a.equal(r.aiInvestigations,0);a.equal(r.writerCalls,0);a.equal(r.rolesResearched,0);a.equal(r.independentlyVerified,0);}
 a.equal(first.fingerprint,second.fingerprint);a.deepEqual(fs.readFileSync(path.join(f.root,W.FILE)),before);a.equal(fs.readdirSync(f.privateDir).filter(x=>x.endsWith('_PREFLIGHT.json')).length,2);
});
test('unchanged actionable work is never suppressed by a fingerprint',t=>{
 const f=fixture(t),item=waiting(f.root,{retryAfter:new Date(now+1000).toISOString()});
 a.equal(inspect(f).decision,'IDLE');a.equal(inspect(f,{now:now+1000}).actionableExceptions,1);a.equal(inspect(f,{now:now+2000}).skipInvestigation,false);
});
test('only evidence for the original request reopens a bound wait and it remains actionable until reviewed',t=>{
 const f=fixture(t),item=waiting(f.root),first=inspect(f);const previous={observations:first.observations};
 S.save(f.privateDir,'UNRELATED-acceptance.json',{result:'new'});a.equal(inspect(f,{previous}).decision,'IDLE');
 S.save(f.privateDir,item.requestId+'-acceptance.json',{results:[{requestId:item.requestId,ok:true}]});const changed=inspect(f,{previous});a.equal(changed.actionableExceptions,1);a.equal(changed.exceptionItems[0].trigger,'ORIGINAL_WRITER_EVIDENCE_CHANGED');
 a.equal(inspect(f,{previous:{observations:changed.observations}}).actionableExceptions,1);
 // A review can acknowledge exactly these watched bytes without claiming the write completed.
 waiting(f.root,{reviewedAt:new Date(now+1000).toISOString(),runId:'FORGE-EXCEPTION-CHATGPT-TEST2',retryEvidenceSha256:changed.exceptionItems[0].retryEvidenceSha256});
 a.equal(inspect(f,{now:now+1000,previous:{observations:changed.observations}}).decision,'IDLE');
});
test('available original evidence on first bootstrap is not silently hidden by a stale wait',t=>{
 const f=fixture(t),item=waiting(f.root);S.save(f.privateDir,item.requestId+'-acceptance.json',{ok:true});a.equal(inspect(f).actionableExceptions,1);
});
test('stale or missing input is a code refresh blocker, not zero work or repeated AI investigation',t=>{
 const f=fixture(t);waiting(f.root);const first=inspect(f,{now:now+25*3600000});a.equal(first.decision,'INPUT_REFRESH_REQUIRED');a.equal(first.skipInvestigation,true);a.equal(first.notify,true);
 const second=inspect(f,{now:now+25*3600000,previous:{failureFingerprint:first.failureFingerprint}});a.equal(second.notify,false);
 fs.unlinkSync(path.join(f.root,W.FILE));a.equal(inspect(f).decision,'INPUT_REFRESH_REQUIRED');
});
test('a corrupt immutable review never proves idle',t=>{
 const f=fixture(t),item=waiting(f.root);S.save(f.root,item.review.proof,{bad:true});a.equal(inspect(f).decision,'INPUT_REFRESH_REQUIRED');
});
test('an unrepresented unresolved original remains a visible fence, never idle or replayed',t=>{
 const f=fixture(t);S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',{transactions:{one:{requestId:'one',status:'HELD',ids:[]}}});const r=inspect(f);a.equal(r.decision,'INPUT_REFRESH_REQUIRED');a.equal(r.errors[0].reason,'PENDING_ORIGINAL_NOT_IN_EXCEPTION_QUEUE');a.equal(r.noReplay,true);
});
test('outcome tracker work is not claimed by Gofer and not deleted',t=>{
 const f=fixture(t),work=S.read(f.root,W.FILE);work.cases.mail={exceptionId:'mail',status:'ACTION_REQUIRED',taskKey:W.OWNER,kind:'MAIL'};S.save(f.root,W.FILE,work);a.equal(inspect(f).decision,'IDLE');a.equal(S.read(f.root,W.FILE).cases.mail.status,'ACTION_REQUIRED');
});
test('fresh salary work stays eligible under a production lock and no canonical effects are claimed',t=>{
 const f=fixture(t),id='V2I-SALARY';f.snapshot.rows=[{PRIMARY_ID:id,COMPANY:'Example',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:'https://example.com/jobs/1'},line:'1 | V2I-SALARY | Example | Plant Manager | SCOUT_INTAKE | - | - | - | Austin, TX | SOURCE_URL=https://example.com/jobs/1'}];f.snapshot.needsById[id]=['SALARY'];
 S.save(f.root,'state/enrich-ats-pay-recovery.json',{schema:'forge.enrichment-recovery.v1',at,run:'code',rows:[{id,company:'Example',title:'Plant Manager',needs:['SALARY'],status:'NOT_YET_ATTEMPTED'}]});
 S.save(f.root,'forge-ai-production.lock.json',{runId:'ACTIVE-WRITER'});
 a.equal(inspect(f,{snapshot:undefined}).decision,'INPUT_REFRESH_REQUIRED');const r=inspect(f,{snapshot:f.snapshot});a.equal(r.decision,'WORK_AVAILABLE');a.equal(r.eligibleSalaryRoles,1);a.equal(r.skipInvestigation,false);a.equal(r.requiresPublishedMembership,true);a.equal(r.writerCalls,0);a.equal(r.salaryEstimatesPrepared,0);
 a.equal(S.read(f.root,'forge-ai-production.lock.json').runId,'ACTIVE-WRITER');a.equal(S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json').items.length,0);
});

test('an empty static assignment and recovery report cannot prove no canonical salary gaps',t=>{const f=fixture(t);const r=inspect(f,{snapshot:undefined});a.equal(r.decision,'INPUT_REFRESH_REQUIRED');a.equal(r.skipInvestigation,true);a.ok(r.errors.some(e=>e.reason==='FRESH_CANONICAL_RESEARCH_PLAN_REQUIRED'));});

test('nonexistent private evidence directory never claims original evidence was checked',t=>{const f=fixture(t);waiting(f.root);const r=inspect(f,{privateDir:path.join(f.root,'missing')});a.equal(r.decision,'INPUT_REFRESH_REQUIRED');a.equal(r.originalPrivateEvidenceChecked,false);a.ok(r.errors.some(e=>e.reason==='PRIVATE_ORIGINAL_EVIDENCE_UNAVAILABLE'));});
