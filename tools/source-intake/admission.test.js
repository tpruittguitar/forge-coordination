'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {plan}=require('./admission');
const item=(company,title,location,url)=>({index:1,verdict:'CANDIDATE_REQUIRES_WRITER_CHECK',record:{COMPANY:company,TITLE:title,LOCATION:location,SOURCE_URL:url,REQ_ID:'',EMPLOYER_PRIMARY_BUSINESS:''}});
test('fails closed without canonical snapshot and timestamp',()=>{
 const p={rows:[item('Acme','Director Manufacturing','Austin, TX','https://example.com/job1')]};
 assert.throws(()=>plan(p,undefined),/BLOCKED/);
 assert.throws(()=>plan(p,[]),/timestamped/);
});
test('protects applied master rows and keeps unknown business in review',()=>{
 const p={rows:[item('Acme','Director Manufacturing','Austin TX','https://example.com/job1'),item('Other','Director Quality','Memphis, TN','https://example.com/job2')]};
 const master=[{COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin, TX',DISPOSITION:'APPLIED'}];
 const out=plan(p,master,{snapshotAsOf:'2026-10-22T12:00:00Z'});
 assert.equal(out.rows[0].gate,'PROTECTED_HOLD');
 assert.equal(out.rows[1].gate,'EMPLOYER_BUSINESS_REVIEW');
 assert.deepEqual(out.writer_payloads,[]);
 assert.equal(out.writer_submissions,0);
});
test('cannot call a Writer and never produces submit-ready payload',()=>{
 const out=plan({rows:[item('Acme','VP Quality','Chattanooga, TN','https://example.com/a')]},[],{snapshotAsOf:'2026-10-22T12:00:00Z'});
 assert.equal(out.mode,'NON_SUBMITTABLE_REVIEW_ONLY');
 assert.equal(out.rows[0].gate,'EMPLOYER_BUSINESS_REVIEW');
});

test('end-to-end Source Trial -> preview -> admission stays review-only',()=>{
 const {adapt}=require('./preview');
 const report={summary:{run:'TRIAL-TEST'},new_roles:[
  {company:'Shield AI',title:'Director Manufacturing',location:'Dallas, TX',url:'https://jobs.lever.co/shieldai/8b747653-dba8-4133-9056-eeedc162dbcd',source:'JobSpy',status:'NEW'},
  {company:'Acme',title:'Director Quality',location:'Dayton, OH',url:'https://example.com/acme/77',source:'BOARD',status:'NEW'}
 ]};
 const preview=adapt(report,{runId:'FORGE-DRYRUN',discoveredAt:'2026-10-22T12:00:00Z'});
 const master=[{COMPANY:'Shield AI',TITLE:'Director Manufacturing',LOCATION:'Dallas, TX',DISPOSITION:'APPLIED'}];
 const gated=plan(preview,master,{snapshotAsOf:'2026-10-22T12:01:00Z'});
 assert.equal(gated.rows[0].gate,'PROTECTED_HOLD');
 assert.equal(gated.rows[1].gate,'EMPLOYER_BUSINESS_REVIEW');
 assert.equal(gated.writer_submissions,0);
 assert.deepEqual(gated.writer_payloads,[]);
});
