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
