'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Q=require('./queue.cjs'),S=require('../programmed-coordinator/store.cjs'),Screen=require('../relevance-screen/screen.cjs'),U=require('../pipeline-observability/upstream-flow');
const now=Date.parse('2026-11-05T06:00:00Z'),at=new Date(now).toISOString();
function fixture(t,cards){
 const list=cards||[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}];
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'intake-drain-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const entries={},groups={};
 for(const card of list){const key=U.key(card.url);entries[key]={key,company:card.company,title:card.title,location:card.location,sourceUrl:card.url,sources:['saved-report.json']};groups[key]={status:cards?'WAITING':'HELD',aliases:[key],firstSeen:at};}
 S.save(root,'state/UPSTREAM_LEDGER.json',{schema:'forge.upstream-ledger.v1',at,entries,groups});return{root,key:Object.keys(entries)[0],cards:list};
}
function proposal(item){return{schema:'forge.intake-drain-review.v1',key:item.key,sourceVersion:item.sourceVersion,provider:'ChatGPT',taskKey:item.taskKey,runId:'FORGE-DRAIN-20261105-A',observedAt:at,outcome:'SOURCE_READY',reason:'Employer describes actual manufacturing leadership',nextAction:'Independent source verification then Writer',writerSubmitted:false,attempts:[{source:'https://example.com/jobs/123',result:'READABLE_POSTING'}],sourceEvidence:{...item.card,location:item.card.location||'Austin, TX',quote:'Lead manufacturing production and quality across this plant and manage all assembly operations.'},scope:{resumeTextSha256:require('../source-trial/resume-match').load().source.textSha256,resumeCompetencyIds:['manufacturing_leadership'],verdict:'PLAUSIBLE_TARGET_FUNCTION',reason:'Direct responsibility for factory production',quote:'Lead manufacturing production and quality across this plant'}};}
test('the full upstream backlog has one owner, action and original discovery basis; a missing location is excluded',t=>{
 const f=fixture(t,[{company:'A',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/1'},{company:'B',title:'General Manager',location:'Austin, TX',url:'https://example.com/2'},{company:'C',title:'Director of Quality',location:'',url:'https://example.com/3'}]);
 const w=Q.sync(f.root,{now});a.equal(Object.keys(w.items).length,3);a.deepEqual(w.actions,{INTAKE:2});a.equal(w.items[U.key('https://example.com/3')].status,'ACCOUNTED_UPSTREAM');a.equal(w.items[U.key('https://example.com/3')].outcome.status,'EXCLUDED');for(const i of Object.values(w.items))if(i.status!=='ACCOUNTED_UPSTREAM'){a.ok(i.taskKey&&i.nextAction&&i.selectionReason);a.equal(i.canonicalCompletion,false);}
});
test('AI return is immutable and never itself a canonical completion',t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true}),r=proposal(work.items[key]);Q.publish(root,r,now);a.equal(Q.sync(root,{now}).items[key].status,'PENDING_INDEPENDENT_VALIDATION');a.equal(Q.approved(root,now).roles.length,0);a.throws(()=>Q.publish(root,{...r,writerSubmitted:true},now));
});
test('source-bound positive scope evidence reaches the existing intake path only after independent verification',async t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true}),r=proposal(work.items[key]);Q.publish(root,r,now);
 await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async({expected})=>{a.equal(expected.company,'Acme');return{description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url};}});
 const approved=Q.approved(root,now);a.equal(approved.roles.length,1);a.match(approved.roles[0].scopeReason,/Direct responsibility/);a.equal(Q.approved(root,now+30*86400000).roles.length,1);
 a.equal(Q.sync(root,{now,apply:true}).items[key].status,'READY_FOR_CONTROLLED_INTAKE');
});
test('a placeholder location is excluded; conflicting known identity cannot be changed by an AI return',t=>{
 const blank=fixture(t,[{company:'Acme',title:'Plant Manager',location:'NOT_STATED',url:'https://example.com/jobs/123'}]),excluded=Q.sync(blank.root,{now}).items[blank.key];a.equal(excluded.status,'ACCOUNTED_UPSTREAM');a.equal(excluded.outcome.status,'EXCLUDED');a.equal(Q.seeds(blank.root).length,0);
 const {root,key}=fixture(t),item=Q.sync(root,{now}).items[key],r=proposal(item);a.equal(item.action,'RESOLVE_IDENTITY');a.throws(()=>Q.validate({...r,sourceEvidence:{...r.sourceEvidence,company:'Other Employer'}},item,now),/CONFLICTING_ORIGINAL/);
});
test('an original Writer fence forbids SOURCE_READY and remains independent of other jobs',t=>{
 const {root,key}=fixture(t);S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL-123'}]}}});const work=Q.sync(root,{now});a.equal(work.items[key].action,'RECONCILE_WRITER');a.throws(()=>Q.validate(proposal(work.items[key]),work.items[key],now),/ORIGINAL_WRITER/);a.equal(Q.seeds(root).length,0);
});
test('failed verification stays actionable after its retry boundary and does not admit the job',async t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now,apply:true}).items[key];Q.publish(root,proposal(item),now);await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>{throw Error('SOURCE_HTTP_429');}});a.equal(Q.approved(root,now).roles.length,0);a.equal(Q.next(root,item.taskKey,{now}).items.length,0);a.equal(Q.next(root,item.taskKey,{now:now+6*3600000}).items.length,1);
});
test('changed source versions invalidate old research; disappearance is never completion',async t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now,apply:true}).items[key];Q.publish(root,proposal(item),now);const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].location='Dallas, TX';S.save(root,'state/UPSTREAM_LEDGER.json',up);a.equal(Q.sync(root,{now,apply:true}).items[key].status,'ACTION_REQUIRED');delete up.groups[key];S.save(root,'state/UPSTREAM_LEDGER.json',up);a.equal(Q.sync(root,{now}).items[key].status,'INVENTORY_RECONCILIATION_REQUIRED');
});
test('the same 5418 candidate population stays fully accounted, and placeholder locations leave the actionable backlog',t=>{
 const f=fixture(t,Array.from({length:5418},(_,n)=>({company:'Employer '+n,title:n%2?'Plant Manager':'General Manager',location:n%3?'Austin, TX':'',url:'https://example.com/jobs/'+n})));const w=Q.sync(f.root,{now});a.equal(Object.keys(w.items).length,5418);a.equal(w.counts.ACTION_REQUIRED,3612);a.equal(w.counts.ACCOUNTED_UPSTREAM,1806);a.equal(Object.values(w.actions).reduce((a,b)=>a+b,0),3612);
});
test('an unchanged positive review remains usable without an age-only source revalidation',async t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now,apply:true}).items[key],r=proposal(item);Q.publish(root,r,now);await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url})});
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.at=new Date(now+86400000).toISOString();S.save(root,'state/UPSTREAM_LEDGER.json',up);a.equal(Q.sync(root,{now:now+86400000}).items[key].status,'READY_FOR_CONTROLLED_INTAKE');
});
test('resume-backed scope and identity are necessary even with an AI positive verdict',t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now}).items[key],r=proposal(item);a.throws(()=>Q.validate({...r,scope:{...r.scope,resumeTextSha256:'0'.repeat(64)}},item,now),/CURRENT_RESUME/);a.throws(()=>Q.validate({...r,scope:{...r.scope,resumeCompetencyIds:['invented_clearance']}},item,now),/CURRENT_RESUME/);
});
test('repeated source fetch failures no longer block an exact saved lead',t=>{
 const {root,key,cards}=fixture(t,[{company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:cards[0],status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2,lastAttempt:at}}});const item=Q.sync(root,{now}).items[key];a.equal(item.action,'INTAKE');a.equal(item.taskKey,'CODE');a.equal(item.sourceFailureHistory.attempts,2);
});

test('a source key replaced by its canonical group is accounted without re-queuing a positive review',t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true});Q.publish(root,proposal(work.items[key]),now);
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].status='PRESENT';up.entries[key].primaryId='V2I-ALREADY';delete up.groups[key];up.groups['pid:V2I-ALREADY']={status:'PRESENT',aliases:[key],firstSeen:at};S.save(root,'state/UPSTREAM_LEDGER.json',up);
 const w=Q.sync(root,{now});a.equal(w.items[key].status,'ACCOUNTED_UPSTREAM');a.equal(w.items[key].outcome.primaryId,'V2I-ALREADY');a.equal(w.items[key].canonicalCompletion,false);a.equal(w.actions.INTAKE,undefined);
});
test('represented jobs with uncertain original writes retain receipt reconciliation and cannot replay',t=>{
 const {root,key}=fixture(t),w=Q.sync(root,{now,apply:true});Q.publish(root,proposal(w.items[key]),now);S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{...w.items[key].card,key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL-UNCERTAIN'}],evidence:[]}}});
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');delete up.groups[key];up.groups['pid:V2I-ALREADY']={status:'PRESENT',aliases:[key],firstSeen:at};S.save(root,'state/UPSTREAM_LEDGER.json',up);
 const item=Q.sync(root,{now}).items[key];a.equal(item.status,'ACTION_REQUIRED');a.equal(item.action,'RECONCILE_WRITER');a.deepEqual(item.fence.requestIds,['ORIGINAL-UNCERTAIN']);a.equal(item.canonicalCompletion,false);a.match(item.nextAction,/Never replay/);
});
test('an old valid positive review cannot reactivate a group missing from current inventory',t=>{
 const {root,key}=fixture(t),w=Q.sync(root,{now,apply:true});Q.publish(root,proposal(w.items[key]),now);
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');delete up.groups[key];S.save(root,'state/UPSTREAM_LEDGER.json',up);
 a.equal(Q.sync(root,{now}).items[key].status,'INVENTORY_RECONCILIATION_REQUIRED');
});
test('worksheet deletion hides the card but preserves outstanding request reconciliation',t=>{
 const {root,key}=fixture(t),up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].status='EXCLUDED';up.entries[key].worksheetDeletion={schema:'forge.worksheet-deletion.v1',key,receiptId:'a'.repeat(64),currentStatus:'HELD'};up.groups[key].status='EXCLUDED';S.save(root,'state/UPSTREAM_LEDGER.json',up);
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL-123'}]}}});
 const work=Q.sync(root,{now});a.equal(work.items[key].action,'RECONCILE_WRITER');a.equal(work.items[key].status,'ACTION_REQUIRED');a.equal(work.items[key].canonicalCompletion,false);a.equal(Q.seeds(root).length,0);
});
test('independent posting salary survives drain validation and helper salary is not trusted',async t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true}),r=proposal(work.items[key]);r.sourceEvidence.payFacts={low:999999,high:999999,currency:'USD',period:'YEAR',basis:'BASE',source:'HELPER'};r.sourceEvidence.postedPay=require('../source-trial/posted-pay').capture({...r.sourceEvidence,source:'HELPER'},{observedAt:at});Q.publish(root,r,now);
 const payFacts={low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'};
 await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url,observedAt:at,payFacts})});
 const role=Q.approved(root,now).roles[0];a.equal(role.payFacts.low,180125);a.equal(role.postedPay.observedAt,at);a.equal(require('../source-trial/posted-pay').fields(role).SALARY_BASE_HIGH,220875);
});
test('drain URL routing cleanup retains original bound salary citation without another pay fetch',async t=>{for(const url of ['https://example.com/jobs/123?utm_source=email','https://www.linkedin.com/jobs/view/director-123?trk=email']){const c={company:'Acme',title:'General Manager',location:'Austin, TX',url,payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'}},P=require('../source-trial/posted-pay');c.postedPay=P.capture(c,{observedAt:at});const {root,key}=fixture(t,[c]),up=S.read(root,'state/UPSTREAM_LEDGER.json');Object.assign(up.entries[key],{postedPay:c.postedPay,payFacts:c.payFacts});S.save(root,'state/UPSTREAM_LEDGER.json',up);S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:c,status:'WAITING_SOURCE_RETRY',attempts:2,lastAttempt:at}}});const w=Q.sync(root,{now,apply:true});a.equal(P.eligible(w.items[key].card).low,180125);const r=proposal(w.items[key]);Q.publish(root,r,now);await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceUrl:r.sourceEvidence.url,sourceSha256:'a'.repeat(64)})});const role=Q.approved(root,now).roles[0];a.equal(P.fields(role).SALARY_SOURCE,url);a.equal(P.fields(role).SALARY_BASE_LOW,180125);}});

test('normalized master presence retires held inventory, research reviews, seeds and worksheet work',t=>{
 const {root,key}=fixture(t,[{company:'AESC',title:'Sr. Manager Operations',location:'Florence, SC, USA',url:'https://example.com/jobs/1129'}]),prior=S.read(root,'state/UPSTREAM_LEDGER.json');
 prior.entries[key].status='HELD';prior.entries[key].evidenceStatus='EXISTING';prior.groups[key].status='HELD';S.save(root,'state/UPSTREAM_LEDGER.json',prior);Q.sync(root,{now,apply:true});
 const up=U.build({records:[],rows:[{PRIMARY_ID:'V2I-PRESENT',COMPANY:'AESC Group',TITLE:'Senior Manager Operations',LOCATION:'Florence, SC'}],prior,now});S.save(root,'state/UPSTREAM_LEDGER.json',up.ledger);
 const work=Q.sync(root,{now,apply:true});a.equal(work.items[key].status,'ACCOUNTED_UPSTREAM');a.equal(work.items[key].outcome.primaryId,'V2I-PRESENT');a.equal(work.items[key].canonicalCompletion,false);a.equal(Q.seeds(root).length,0);a.equal(Q.approved(root,now).roles.length,0);a.equal(Q.next(root,Q.TASKS.RESOLVE_IDENTITY,{now}).items.length,0);a.deepEqual(work.actions,{});
});
test('newly discovered unresolved writes remain actionable even with a PRESENT group and no old drain item',t=>{
 const {root,key}=fixture(t),up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].status='PRESENT';up.entries[key].primaryId='V2I-PRESENT';delete up.groups[key];up.groups['pid:V2I-PRESENT']={status:'PRESENT',aliases:[key],firstSeen:at};S.save(root,'state/UPSTREAM_LEDGER.json',up);
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'UNCERTAIN-ORIGINAL'}]}}});
 const work=Q.sync(root,{now});a.equal(work.items['pid:V2I-PRESENT'].status,'ACTION_REQUIRED');a.equal(work.items['pid:V2I-PRESENT'].action,'RECONCILE_WRITER');a.equal(work.items['pid:V2I-PRESENT'].canonicalCompletion,false);
});
test('an already-accounted alias cannot hide a subsequently discovered Writer fence',t=>{
 const {root,key}=fixture(t);Q.sync(root,{now,apply:true});const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].status='PRESENT';up.entries[key].primaryId='V2I-PRESENT';delete up.groups[key];up.groups['pid:V2I-PRESENT']={status:'PRESENT',aliases:[key],firstSeen:at};S.save(root,'state/UPSTREAM_LEDGER.json',up);a.equal(Q.sync(root,{now,apply:true}).items[key].status,'ACCOUNTED_UPSTREAM');
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'SUBMITTED',submissions:[{requestId:'LATE-ORIGINAL'}]}}});const work=Q.sync(root,{now});a.equal(work.items[key].status,'ACTION_REQUIRED');a.equal(work.items[key].action,'RECONCILE_WRITER');a.equal(work.items[key].canonicalCompletion,false);a.equal(Object.values(work.items).filter(i=>i.status!=='ACCOUNTED_UPSTREAM').length,1);
});
test('upstream source card and saved-card recovery preserve operating scope through sync',t=>{
 const {root,key}=fixture(t),up=S.read(root,'state/UPSTREAM_LEDGER.json');up.entries[key].p={REMOTE_HYBRID:'REMOTE',OPERATING_SCOPE:'MULTI_SITE',OPERATING_SCOPE_EVIDENCE:'Leads across facilities',ATS_POSTING_URL:'https://ats.example.com/1',REQ_ID:'REQ-1'};S.save(root,'state/UPSTREAM_LEDGER.json',up);
 const card=Q.sync(root,{now}).items[key].card;a.equal(card.REMOTE_HYBRID,'REMOTE');a.equal(card.OPERATING_SCOPE,'MULTI_SITE');a.equal(card.REQ_ID,'REQ-1');a.equal(card.ATS_POSTING_URL,'https://ats.example.com/1');
});
test('shared reservation blocks later drain assignment and stale approved research while original Writer fences survive',async t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now,apply:true}).items[key],r=proposal(item);Q.publish(root,r,now);
 await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url})});a.equal(Q.approved(root,now).roles.length,1);
 const H=require('../helper-routing/shared.cjs'),taskKey='FORGE_CLAUDE_SHARED_HELPER',shared={schema:'forge.shared-helper-work.v1',assignmentId:'SHARED',enabled:true,routingActive:true,providers:{[taskKey]:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:true}},items:[{key,kind:'INTAKE',provider:'Claude',taskKey,assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'}]};S.save(root,H.FILE,shared);
 a.equal(Q.approved(root,now).roles.length,0);a.equal(Q.next(root,item.taskKey,{now}).items.length,0);a.equal(Q.seeds(root).length,0);a.throws(()=>Q.publish(root,r,now),/SHARED_HELPER_OWNS/);
 S.save(root,Q.FILE,Q.empty());a.equal(Object.keys(Q.sync(root,{now}).items).length,0);
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL'}]}}});a.equal(Q.sync(root,{now}).items[key].action,'RECONCILE_WRITER');
});


test('complete cards enter intake without scope review, while a missing location is excluded',t=>{
 const cards=[{company:'A',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/1'},{company:'B',title:'Production Engineer',location:'Boston, MA',url:'https://example.com/jobs/2'},{company:'C',title:'Director, Data Center Operations',location:'',url:'https://example.com/jobs/3'}];
 const {root}=fixture(t,cards),work=Q.sync(root,{now,apply:true});a.equal(work.actions.INTAKE,2);a.equal(work.actions.RECOVER_SOURCE,undefined);a.equal(work.items[U.key(cards[2].url)].status,'ACCOUNTED_UPSTREAM');a.equal(Q.seeds(root).length,2);a.equal(Q.next(root,Q.TASKS.REVIEW_SCOPE,{now}).items.length,0);
});
test('historical scope-only waits reopen without clearing original request or identity holds',t=>{
 for(const status of ['ACTION_REQUIRED','WAITING_EVIDENCE_CHANGE','SOURCE_VALIDATION_REQUIRED','PENDING_INDEPENDENT_VALIDATION']){
  const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);
  const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT',status});const review=proposal(item);S.immutable(root,Q.reviewPath(review),review);item.review={path:Q.reviewPath(review),sha256:S.hash(review),observedAt:at};item.validation={reason:'SCOPE_QUOTE_NOT_IN_INDEPENDENT_POSTING',retryAfter:'9999-01-01T00:00:00Z'};S.save(root,Q.FILE,work);
  const reopened=Q.sync(root,{now,apply:true});a.equal(reopened.items[key].action,'INTAKE');a.equal(reopened.items[key].status,'ACTION_REQUIRED');a.equal(reopened.items[key].review,undefined);a.equal(Q.seeds(root).length,1);a.deepEqual(reopened.reviewErrors,{});a.ok(fs.existsSync(path.join(root,Q.reviewPath(review))));
  S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL'}]}}});const fenced=Q.sync(root,{now,apply:true});a.equal(fenced.items[key].action,'RECONCILE_WRITER');a.equal(Q.seeds(root).length,0);
 }
});


test('scope-task identity and explicit reconciliation holds cannot be released as speculative fit',t=>{
 for(const reason of ['SOURCE_IDENTITY_AMBIGUOUS','CONFLICTING_SOURCE_IDENTITY','RECONCILIATION_REQUIRED']){
  const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);
  const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT',status:'SOURCE_VALIDATION_REQUIRED'});
  const review=proposal(item);if(reason==='RECONCILIATION_REQUIRED')Object.assign(review,{outcome:reason,retryCondition:'Resolve conflicting employer/site facts',reason:'Captured worksite differs from exact posting'});
  S.immutable(root,Q.reviewPath(review),review);item.review={path:Q.reviewPath(review),sha256:S.hash(review),observedAt:at,outcome:review.outcome};item.validation={reason,reviewSha256:S.hash(review),status:'SOURCE_VALIDATION_REQUIRED',retryAfter:'9999-01-01T00:00:00Z'};S.save(root,Q.FILE,work);
  let held=Q.sync(root,{now,apply:true});a.equal(held.items[key].action,'REVIEW_SCOPE');a.equal(held.items[key].scopeReviewHold.reason,reason);a.equal(Q.seeds(root).length,0);
  // Publishing a replacement positive review alone is not an identity check.
  held.items[key].review={path:'new-source-review',sha256:'new-sha',outcome:'SOURCE_READY'};delete held.items[key].validation;S.save(root,Q.FILE,held);held=Q.sync(root,{now,apply:true});a.equal(held.items[key].action,'REVIEW_SCOPE');a.equal(Q.seeds(root).length,0);
 }
});

test('a retained scope identity case enters reviewed intake only after the replacement source review passes verification',async t=>{
 const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);
 const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT',status:'SOURCE_VALIDATION_REQUIRED'});
 const prior=proposal(item);S.immutable(root,Q.reviewPath(prior),prior);item.review={path:Q.reviewPath(prior),sha256:S.hash(prior),observedAt:at,outcome:'SOURCE_READY'};item.validation={status:'SOURCE_VALIDATION_REQUIRED',reason:'SOURCE_IDENTITY_AMBIGUOUS',reviewSha256:S.hash(prior)};S.save(root,Q.FILE,work);
 const held=Q.sync(root,{now,apply:true}),replacement={...proposal(held.items[key]),runId:'FORGE-DRAIN-IDENTITY-RESOLVED',observedAt:new Date(now+1000).toISOString()};Q.publish(root,replacement,now+1000);a.equal(Q.sync(root,{now:now+1000,apply:true}).items[key].action,'REVIEW_SCOPE');a.equal(Q.seeds(root).length,0);
 const result=await Q.verify(root,{privateDir:os.tmpdir(),now:now+1000,apply:true,verifySource:async()=>({description:replacement.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:replacement.sourceEvidence.url})});a.equal(result.verified,1);
 const resolved=Q.sync(root,{now:now+1000,apply:true});a.equal(resolved.items[key].action,'REVIEW_SCOPE');a.equal(resolved.items[key].status,'READY_FOR_CONTROLLED_INTAKE');a.equal(Q.seeds(root).length,0);a.equal(Q.approved(root,now+1000).roles.length,1);
});


test('an unconsumed immutable identity reconciliation review wins over scope-release migration',t=>{
 const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);
 const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT',status:'ACTION_REQUIRED'});S.save(root,Q.FILE,work);
 const review={...proposal(item),outcome:'RECONCILIATION_REQUIRED',reason:'Captured worksite differs from the exact source posting',retryCondition:'Resolve the conflicting original worksite'};S.immutable(root,Q.reviewPath(review),review);
 const result=Q.sync(root,{now,apply:true});a.equal(result.items[key].action,'REVIEW_SCOPE');a.equal(result.items[key].scopeReviewHold.reason,'RECONCILIATION_REQUIRED');a.equal(result.items[key].review.path,Q.reviewPath(review));a.equal(Q.seeds(root).length,0);a.deepEqual(result.reviewErrors,{});
});


test('stale, malformed or misnamed pending scope receipts cannot create persistent holds',t=>{
 for(const kind of ['stale','invalid','misnamed']){
  const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT'});S.save(root,Q.FILE,work);
  const review={...proposal(item),outcome:'RECONCILIATION_REQUIRED',retryCondition:'Resolve worksite conflict'};if(kind==='stale')review.sourceVersion='obsolete';if(kind==='invalid')review.writerSubmitted=true;S.immutable(root,kind==='misnamed'?Q.REVIEWS+'/wrong-name.json':Q.reviewPath(review),review);
  const out=Q.sync(root,{now,apply:true});a.equal(out.items[key].action,'INTAKE',kind);a.equal(out.items[key].scopeReviewHold,null,kind);a.equal(Q.seeds(root).length,1,kind);
 }
});
test('older reconciliation receipts do not resurrect after a newer independently validated positive review',t=>{
 const {root,key}=fixture(t,[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);const work=Q.sync(root,{now,apply:true}),item=work.items[key];Object.assign(item,{action:'REVIEW_SCOPE',taskKey:Q.TASKS.REVIEW_SCOPE,owner:'ChatGPT',status:'READY_FOR_CONTROLLED_INTAKE'});
 const old={...proposal(item),outcome:'RECONCILIATION_REQUIRED',retryCondition:'Resolve original worksite conflict'},current={...proposal(item),runId:'FORGE-DRAIN-NEWER-VERIFIED',observedAt:new Date(now+1000).toISOString()};S.immutable(root,Q.reviewPath(old),old);S.immutable(root,Q.reviewPath(current),current);item.review={path:Q.reviewPath(current),sha256:S.hash(current),observedAt:current.observedAt,outcome:'SOURCE_READY'};item.validation={status:'READY_FOR_CONTROLLED_INTAKE',reviewSha256:S.hash(current),observedAt:current.observedAt};S.save(root,Q.FILE,work);
 for(let n=0;n<2;n++){const out=Q.sync(root,{now:now+1000,apply:true});a.equal(out.items[key].action,'INTAKE');a.equal(Q.seeds(root).length,1);a.deepEqual(out.reviewErrors,{});}
});

test('available captured metadata removes only obsolete source recovery and keeps its audit history',t=>{
 const card={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123',source:'JOBSPY:indeed'}, {root,key}=fixture(t,[card]);
 S.save(root,'state/source-trial-report.json',{new_roles:[card]});
 S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:card,status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:3,lastAttempt:at,retryAfter:'2999-01-01T00:00:00Z'}}});
 const w=Q.sync(root,{now,apply:true}),item=w.items[key];a.equal(item.action,'INTAKE');a.equal(item.sourceFailure,null);a.equal(item.sourceFailureHistory.attempts,3);a.equal(item.canonicalCompletion,false);a.equal(Q.seeds(root).length,1);
});
test('captured source does not erase other failure reasons or identity and Writer holds',t=>{
 for(const kind of ['other-failure','identity','missing-present','held','conflict','writer']){
  const card={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123',source:'HIRINGCAFE'}, {root,key}=fixture(t,[card]),up=S.read(root,'state/UPSTREAM_LEDGER.json');
  if(kind==='identity')up.groups[key].status='IDENTITY_HOLD';if(kind==='missing-present')up.groups[key].status='MISSING_PREVIOUSLY_PRESENT';if(kind==='held')up.groups[key].status='HELD';
  if(kind==='conflict'){up.entries[key].REQ_ID='ONE';card.REQ_ID='TWO';}
  S.save(root,'state/UPSTREAM_LEDGER.json',up);S.save(root,'state/source-trial-report.json',{new_roles:[card]});
  S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:card,status:'WAITING_SOURCE_RETRY',reason:kind==='other-failure'?'ORIGINAL_SOURCE_IDENTITY_CONFLICT':'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2,lastAttempt:at}}});
  if(kind==='writer')S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL'}]}}});
  const item=Q.sync(root,{now,apply:true}).items[key];a.equal(item.action,kind==='writer'?'RECONCILE_WRITER':kind==='other-failure'?'RECOVER_SOURCE':'RESOLVE_IDENTITY',kind);a.equal(item.canonicalCompletion,false);a.equal(Q.seeds(root).length,0,kind);
 }
});
test('a different-worksite provider card cannot replace exact saved lead facts',t=>{
 const card={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}, {root,key}=fixture(t,[card]);
 S.save(root,'state/source-trial-report.json',{new_roles:[{...card,location:'Dallas, TX',source:'JOBSPY:linkedin'}]});
 S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:card,status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2,lastAttempt:at}}});
 const item=Q.sync(root,{now}).items[key];a.equal(item.action,'INTAKE');a.equal(item.card.location,'Austin, TX');a.equal(item.sourceFailureHistory.attempts,2);const e=require('../source-intake/discovery-inputs').index(root).find(item.card,{now});a.equal(e.card.source,'URL:example.com');a.equal(e.card.location,'Austin, TX');
});
test('captured-source availability does not bypass active shared helper reservations',t=>{
 const card={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123',source:'JOBSPY:indeed'}, {root,key}=fixture(t,[card]);
 S.save(root,'state/source-trial-report.json',{new_roles:[card]});S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:card,status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2}}});
 const taskKey='FORGE_CLAUDE_SHARED_HELPER';S.save(root,'control/SHARED_HELPER_WORK.json',{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,providers:{[taskKey]:{provider:'Claude',available:true}},items:[{key,kind:'INTAKE',provider:'Claude',taskKey,status:'ASSIGNED'}]});
 a.equal(Q.sync(root,{now,apply:true}).items[key],undefined);a.equal(Q.seeds(root).length,0);
});

test('catch-up cannot bypass drain identity obligations, accounted cards or shared ownership',t=>{
 const {root,key}=fixture(t,[{company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);
 for(const item of [{action:'REVIEW_SCOPE',scopeReviewHold:{reason:'RECONCILIATION_REQUIRED'}},{action:'RESOLVE_IDENTITY'},{action:'INTAKE',sourceConflict:'CONFLICTING_SAVED_IDENTITY'},{action:'INTAKE',status:'ACCOUNTED_UPSTREAM'},{action:'INTAKE',status:'INVENTORY_RECONCILIATION_REQUIRED'},{action:'INTAKE',fence:{requestId:'original'}}]){const work={items:{[key]:{key,aliases:[key,'alias'],status:'ACTION_REQUIRED',...item}}};const held=Q.admissionHolds(root,{work,now});a.equal(held.has(key),true);a.equal(held.has('alias'),true);}
 a.equal(Q.admissionHolds(root,{work:{items:{[key]:{key,action:'INTAKE',status:'ACTION_REQUIRED'}}},now}).size,0);
 S.save(root,'control/SHARED_HELPER_WORK.json',{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,providers:{},items:[{key,kind:'INTAKE',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',status:'ASSIGNED'}]});a.equal(Q.admissionHolds(root,{work:{items:{}},now}).get(key),'SHARED_HELPER_RESERVED');
});
test('one malformed capture cannot abort source-hold release for an unrelated healthy queue item',t=>{
 const cards=[{company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/bad'},{company:'Good Factory',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/good'}],f=fixture(t,cards);
 S.save(f.root,'state/source-trial-report.json',{summary:{at},new_roles:cards.map((c,n)=>({...c,source:'HIRINGCAFE',description:'',...(n===0?{validThrough:'malformed'}:{})}))});
 S.save(f.root,'receipts/auto-intake/catch-up/state.json',{roles:Object.fromEntries(cards.map((role,n)=>[n,{role,status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2,lastAttempt:at}]))});
 const work=Q.sync(f.root,{now}),bad=work.items[U.key(cards[0].url)],good=work.items[U.key(cards[1].url)];a.equal(bad.sourceCaptureHold.reason,'POSTING_EXPIRY_INVALID');a.equal(bad.sourceFailure.attempts,2);a.equal(bad.sourceFailureHistory,undefined);a.equal(good.action,'INTAKE');a.equal(good.sourceFailure,null);a.equal(good.sourceFailureHistory.attempts,2);
});
