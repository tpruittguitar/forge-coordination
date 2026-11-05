'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path'),C=require('./catch-up.cjs'),S=require('./store.cjs');
test('catch-up separates ready work, fenced writes, unresolved alerts and verified identities',()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'coord-catch-up-'));try{
 S.save(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[{status:'READY'},{status:'POST_IN_FLIGHT_UNKNOWN',requestId:'R'},{status:'POST_IN_FLIGHT_UNKNOWN',requestId:'R'},{status:'VERIFIED_INSERTED',primaryId:'V2I-1'}]});
 S.save(root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{a:{classification:'JOB_ALERT',status:'PENDING_SOURCE_ACCOUNTING'}}});
 let r=C.summarize(root,'run1',1000);a.equal(r.status,'ACTIVE');a.equal(r.intake.pendingOriginalRequests,1);a.equal(r.intake.pendingCards,2);a.equal(r.intake.verifiedDistinctJobs,1);S.save(root,C.FILE,r);
 S.save(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[{status:'VERIFIED_INSERTED',primaryId:'V2I-2'},{status:'POST_IN_FLIGHT_UNKNOWN',requestId:'R'}]});
 r=C.summarize(root,'run2',2000);a.equal(r.status,'WAITING_RECONCILIATION');a.equal(r.intake.verifiedDistinctJobs,2);a.equal(r.intake.newVerifiedSincePrevious,1);a.equal(r.alerts.awaitingCapture,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
