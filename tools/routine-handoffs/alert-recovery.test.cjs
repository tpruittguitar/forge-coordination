'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),S=require('../programmed-coordinator/store.cjs'),L=require('../email-recovery/ledger.cjs'),R=require('./alert-recovery.cjs');
const message={id:'abc',fullBody:true,sender:'jobalerts-noreply@linkedin.com',at:'2026-10-19T23:53:05Z',sourceSha256:'a'.repeat(64),body:'Your job alert for quality\n30+ new jobs match your preferences.\nDirector of Quality\nFactory\nAustin, TX\nView job: https://www.linkedin.com/comm/jobs/view/123/?trackingId=secret\n---------------------\nPlant Manager\nCompany\nDallas, TX\nView job: https://www.linkedin.com/jobs/view/456/'};
test('full original cards recover without changing live pagination, protected dispositions or claiming unseen history',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-alert-'));t.after(()=>{a.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const l=L.empty();L.seed(l,[{gmailId:'abc',advertisedUnseen:24,url:'https://www.linkedin.com/jobs/search-results/?keywords=quality'}]);Object.assign(l.sources.abc,{status:'HISTORICAL_RESULTS_UNAVAILABLE',nextPageRequired:false,exhausted:false,resumeUrl:l.sources.abc.url+'&start=525'});S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',l);
 a.equal(R.recover(root,message).recovered,2);const after=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json');a.equal(after.sources.abc.pages.length,0);a.equal(after.sources.abc.resumeUrl,l.sources.abc.resumeUrl);a.equal(after.sources.abc.nextPageRequired,false);a.equal(after.sources.abc.historicalCoverage,'UNPROVEN');a.equal(after.jobs['linkedin:123'].observedAt,message.at);a.equal(after.jobs['linkedin:123'].url,'https://www.linkedin.com/jobs/view/123/');a.equal(R.recover(root,message).duplicate,true);
 after.jobs['linkedin:123'].status='VERIFIED_EXISTING';after.jobs['linkedin:123'].disposition={proof:'original'};delete after.sources.abc.originalAlertRecovery;S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',after);R.recover(root,message);a.equal(S.read(root,'state/EMAIL_RECOVERY_QUEUE.json').jobs['linkedin:123'].status,'VERIFIED_EXISTING');
 const conflict={...message,sourceSha256:'b'.repeat(64),body:message.body.replace('Factory','Different')};a.throws(()=>R.recover(root,conflict),/CONFLICTING_ORIGINAL/);a.equal(S.read(root,'state/EMAIL_RECOVERY_QUEUE.json').jobs['linkedin:123'].company,'Factory');
});
test('snippets, foreign URLs and incomplete original identities cannot become recovered cards',()=>{a.deepEqual(R.cards({...message,fullBody:false}),[]);a.deepEqual(R.cards({...message,sender:'recruiter@example.com'}),[]);a.throws(()=>R.cards({...message,body:message.body.replace('www.linkedin.com/comm','example.com/comm')}),/AMBIGUOUS/);a.throws(()=>R.cards({...message,body:message.body.replace('Director of Quality\nFactory\nAustin, TX','Director of Quality')}),/INCOMPLETE/);});
test('a newly captured alert reaches the existing candidate queue before handoff acknowledgment',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'new-alert-'));
 S.save(root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{abc:{classification:'JOB_ALERT',status:'PENDING_SOURCE_ACCOUNTING'}}});
 a.equal(R.recover(root,message).recovered,2);R.handoff(root,message);
 const ledger=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),h=S.read(root,'state/MAIL_SOURCE_HANDOFFS.json').messages.abc;
 a.equal(Object.keys(ledger.jobs).length,2);a.equal(h.status,'CANDIDATES_AWAITING_EVALUATION');a.equal(h.unseenCoverageComplete,false);
 const Cursor=require('./mail-pipeline.cjs');S.save(root,'state/APPLICATION_TRACKER_CURSOR.json',{processedMessageIds:['abc'],pendingMessageIds:[],enumeratedThrough:message.at,fullyReadThrough:'2026-10-01T00:00:00Z'});
 Cursor.updateCursor(root,{messages:{abc:{status:'HANDED_TO_DISCOVERY'}}});
 a.deepEqual(S.read(root,'state/APPLICATION_TRACKER_CURSOR.json').pendingMessageIds,['abc']);a.deepEqual(S.read(root,'state/APPLICATION_TRACKER_CURSOR.json').processedMessageIds,[]);
});
test('unsupported alerts remain actionable AI work instead of becoming processed mail',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'unsupported-alert-'));
 S.save(root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{abc:{classification:'JOB_ALERT',status:'PENDING_SOURCE_ACCOUNTING'}}});
 a.equal(R.recover(root,{...message,sender:'alerts@ziprecruiter.com'}).recovered,0);
 a.throws(()=>R.handoff(root,message),/ALERT_FORMAT_RESEARCH_REQUIRED/);
});
