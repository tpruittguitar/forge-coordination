'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Q=require('./queue.cjs'),S=require('../programmed-coordinator/store.cjs'),Screen=require('../relevance-screen/screen.cjs'),U=require('../pipeline-observability/upstream-flow');
const now=Date.parse('2026-11-05T06:00:00Z'),at=new Date(now).toISOString();
function fixture(t,cards=[{company:'Acme',title:'General Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'intake-drain-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const entries={},groups={};
 for(const card of cards){const key=U.key(card.url);entries[key]={key,company:card.company,title:card.title,location:card.location,sourceUrl:card.url,sources:['saved-report.json']};groups[key]={status:'WAITING',aliases:[key],firstSeen:at};}
 S.save(root,'state/UPSTREAM_LEDGER.json',{schema:'forge.upstream-ledger.v1',at,entries,groups});return{root,key:Object.keys(entries)[0],cards};
}
function proposal(item){return{schema:'forge.intake-drain-review.v1',key:item.key,sourceVersion:item.sourceVersion,provider:'ChatGPT',taskKey:item.taskKey,runId:'FORGE-DRAIN-20261105-A',observedAt:at,outcome:'SOURCE_READY',reason:'Employer describes actual manufacturing leadership',nextAction:'Independent source verification then Writer',writerSubmitted:false,attempts:[{source:'https://example.com/jobs/123',result:'READABLE_POSTING'}],sourceEvidence:{...item.card,location:item.card.location||'Austin, TX',quote:'Lead manufacturing production and quality across this plant and manage all assembly operations.'},scope:{resumeTextSha256:require('../source-trial/resume-match').load().source.textSha256,resumeCompetencyIds:['manufacturing_leadership'],verdict:'PLAUSIBLE_TARGET_FUNCTION',reason:'Direct responsibility for factory production',quote:'Lead manufacturing production and quality across this plant'}};}
test('the full upstream backlog has one owner, action and original discovery basis; holds are AI work',t=>{
 const f=fixture(t,[{company:'A',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/1'},{company:'B',title:'General Manager',location:'Austin, TX',url:'https://example.com/2'},{company:'C',title:'Director of Quality',location:'',url:'https://example.com/3'}]);
 const w=Q.sync(f.root,{now});a.equal(Object.keys(w.items).length,3);a.deepEqual(w.actions,{INTAKE:1,REVIEW_SCOPE:1,RECOVER_SOURCE:1});for(const i of Object.values(w.items)){a.ok(i.taskKey&&i.nextAction&&i.selectionReason);a.equal(i.canonicalCompletion,false);}
});
test('AI return is immutable and never itself a canonical completion',t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true}),r=proposal(work.items[key]);Q.publish(root,r,now);a.equal(Q.sync(root,{now}).items[key].status,'PENDING_INDEPENDENT_VALIDATION');a.equal(Q.approved(root,now).roles.length,0);a.throws(()=>Q.publish(root,{...r,writerSubmitted:true},now));
});
test('source-bound positive scope evidence reaches the existing intake path only after independent verification',async t=>{
 const {root,key}=fixture(t),work=Q.sync(root,{now,apply:true}),r=proposal(work.items[key]);Q.publish(root,r,now);
 await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async({expected})=>{a.equal(expected.company,'Acme');return{description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url};}});
 const approved=Q.approved(root,now);a.equal(approved.roles.length,1);a.match(approved.roles[0].scopeReason,/Direct responsibility/);a.equal(Q.approved(root,now+86400000).roles.length,0);
 a.equal(Q.sync(root,{now,apply:true}).items[key].status,'READY_FOR_CONTROLLED_INTAKE');
});
test('missing fields can be recovered; conflicting known identity cannot be changed by an AI return',t=>{
 const {root,key}=fixture(t,[{company:'Acme',title:'Plant Manager',location:'',url:'https://example.com/jobs/123'}]),item=Q.sync(root,{now}).items[key],r=proposal(item);a.equal(item.action,'RECOVER_SOURCE');a.equal(Q.validate(r,item,now),true);a.throws(()=>Q.validate({...r,sourceEvidence:{...r.sourceEvidence,company:'Other Employer'}},item,now),/CONFLICTING_ORIGINAL/);
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
test('the same 5418 candidate population stays fully accounted, including unclear and held identities',t=>{
 const f=fixture(t,Array.from({length:5418},(_,n)=>({company:'Employer '+n,title:n%2?'Plant Manager':'General Manager',location:n%3?'Austin, TX':'',url:'https://example.com/jobs/'+n})));const w=Q.sync(f.root,{now});a.equal(w.counts.ACTION_REQUIRED,5418);a.equal(Object.values(w.actions).reduce((a,b)=>a+b,0),5418);
});
test('an expired independent validation returns to source verification rather than stranding a ready candidate',async t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now,apply:true}).items[key],r=proposal(item);Q.publish(root,r,now);await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceSha256:'a'.repeat(64),sourceUrl:r.sourceEvidence.url})});
 const up=S.read(root,'state/UPSTREAM_LEDGER.json');up.at=new Date(now+86400000).toISOString();S.save(root,'state/UPSTREAM_LEDGER.json',up);a.equal(Q.sync(root,{now:now+86400000}).items[key].status,'PENDING_INDEPENDENT_VALIDATION');
});
test('resume-backed scope and identity are necessary even with an AI positive verdict',t=>{
 const {root,key}=fixture(t),item=Q.sync(root,{now}).items[key],r=proposal(item);a.throws(()=>Q.validate({...r,scope:{...r.scope,resumeTextSha256:'0'.repeat(64)}},item,now),/CURRENT_RESUME/);a.throws(()=>Q.validate({...r,scope:{...r.scope,resumeCompetencyIds:['invented_clearance']}},item,now),/CURRENT_RESUME/);
});
test('repeated code source failures get an AI recovery owner rather than retrying forever in intake',t=>{
 const {root,key,cards}=fixture(t,[{company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/123'}]);S.save(root,'receipts/auto-intake/catch-up/state.json',{roles:{one:{role:cards[0],status:'WAITING_SOURCE_RETRY',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2,lastAttempt:at}}});const item=Q.sync(root,{now}).items[key];a.equal(item.action,'RECOVER_SOURCE');a.equal(item.taskKey,'FORGE_INTAKE_SOURCE_RECOVERY');a.equal(item.sourceFailure.attempts,2);
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
test('drain URL routing cleanup retains original bound salary citation without another pay fetch',async t=>{for(const url of ['https://example.com/jobs/123?utm_source=email','https://www.linkedin.com/jobs/view/director-123?trk=email']){const c={company:'Acme',title:'General Manager',location:'Austin, TX',url,payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'}},P=require('../source-trial/posted-pay');c.postedPay=P.capture(c,{observedAt:at});const {root,key}=fixture(t,[c]),up=S.read(root,'state/UPSTREAM_LEDGER.json');Object.assign(up.entries[key],{postedPay:c.postedPay,payFacts:c.payFacts});S.save(root,'state/UPSTREAM_LEDGER.json',up);const w=Q.sync(root,{now,apply:true});a.equal(P.eligible(w.items[key].card).low,180125);const r=proposal(w.items[key]);Q.publish(root,r,now);await Q.verify(root,{now,privateDir:os.tmpdir(),apply:true,verifySource:async()=>({description:r.sourceEvidence.quote,sourceUrl:r.sourceEvidence.url,sourceSha256:'a'.repeat(64)})});const role=Q.approved(root,now).roles[0];a.equal(P.fields(role).SALARY_SOURCE,url);a.equal(P.fields(role).SALARY_BASE_LOW,180125);}});

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
