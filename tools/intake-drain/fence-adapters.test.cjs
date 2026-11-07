'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Q=require('./queue.cjs'),S=require('../programmed-coordinator/store.cjs'),I=require('../source-trial/job-identity');
const original={company:'Acme',title:'Director Manufacturing',location:'Austin, TX',url:'https://example.com/1'},candidate={company:'Acme',title:'Director Manufacturing',location:'Portland, OR',url:'https://example.com/2'};
function root(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fence-adapters-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function mailFence(t,extra){const dir=root(t),job={...original,...extra,key:'source-key',status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL'}]};S.save(dir,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{[job.key]:job}});return{dir,job,fence:Q.writerFences(dir).get(job.key)};}
test('email adapter keeps full original metadata and remote/multi-site fences across different states',t=>{
 for(const extra of [{REMOTE_HYBRID:'REMOTE'},{workArrangement:'Hybrid'},{OPERATING_SCOPE:'MULTI_SITE'},{OPERATING_SCOPE_EVIDENCE:'Responsible across facilities'},{worksiteScope:'regional'},{p:{REMOTE_HYBRID:'REMOTE',DIRECT_JOB_URL:'https://ats.example.com/req/123'}}]){
  const {dir,job,fence}=mailFence(t,extra);for(const [key,value]of Object.entries(job))a.deepEqual(fence.record[key],value);
  a.equal(I.fenceApplies(candidate,fence.record),true);
  S.save(dir,Q.FILE,{...Q.empty(),items:{one:{card:original,fence}}});const record=Q.fences(dir)[0];a.equal(I.fenceApplies(candidate,record),true);for(const [key,value]of Object.entries(extra))a.deepEqual(record[key],value);
 }
});
test('drain fallback preserves the entire original card and never replaces fence source with a newer card',t=>{
 const dir=root(t),card={...original,workMode:'Remote',reqId:'REQ-ONE',ATS_POSTING_URL:'https://ats.example.com/post/1',scopeEvidence:'multi site responsibility',payload:{LOCATION_SCOPE:'regional'}};
 S.save(dir,Q.FILE,{...Q.empty(),items:{one:{card,fence:{requestIds:['ORIGINAL']}}}});a.deepEqual(Q.fences(dir)[0],{...card,COMPANY:card.company,TITLE:card.title,LOCATION:card.location,SOURCE_URL:card.url});
 const fence={record:{...card,location:'Boston, MA'}};S.save(dir,Q.FILE,{...Q.empty(),items:{one:{card:{...original,workMode:'On-site'},fence}}});a.equal(Q.fences(dir)[0].LOCATION,'Boston, MA');a.equal(Q.fences(dir)[0].workMode,'Remote');
});
test('different-state single-site relief survives adapters, but shared req/additional URL keep original fence',t=>{
 const plain=mailFence(t,{});a.equal(I.fenceApplies(candidate,plain.fence.record),false);
 const req=mailFence(t,{REQ_ID:'SAME'});a.equal(I.fenceApplies({...candidate,reqId:'SAME'},req.fence.record),true);
 const url=mailFence(t,{ATS_POSTING_URL:candidate.url});a.equal(I.fenceApplies(candidate,url.fence.record),true);
});
