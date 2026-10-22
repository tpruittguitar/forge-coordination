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
 const out=plan(p,master,{snapshotAsOf:new Date().toISOString()});
 assert.equal(out.rows[0].gate,'PROTECTED_HOLD');
 assert.equal(out.rows[1].gate,'EMPLOYER_BUSINESS_REVIEW');
 assert.deepEqual(out.writer_payloads,[]);
 assert.equal(out.writer_submissions,0);
});
test('cannot call a Writer and never produces submit-ready payload',()=>{
 const out=plan({rows:[item('Acme','VP Quality','Chattanooga, TN','https://example.com/a')]},[],{snapshotAsOf:new Date().toISOString()});
 assert.equal(out.mode,'NON_SUBMITTABLE_REVIEW_ONLY');
 assert.equal(out.rows[0].gate,'EMPLOYER_BUSINESS_REVIEW');
});

test('end-to-end Source Trial -> preview -> admission stays review-only',()=>{
 const {adapt}=require('./preview');
 const report={summary:{run:'TRIAL-TEST'},new_roles:[
  {company:'Shield AI',title:'Director Manufacturing',location:'Dallas, TX',url:'https://jobs.lever.co/shieldai/8b747653-dba8-4133-9056-eeedc162dbcd',source:'JobSpy',status:'NEW'},
  {company:'Acme',title:'Director Quality',location:'Dayton, OH',url:'https://example.com/acme/77',source:'BOARD',status:'NEW'}
 ]};
 const preview=adapt(report,{runId:'FORGE-DRYRUN',discoveredAt:new Date().toISOString()});
 const master=[{COMPANY:'Shield AI',TITLE:'Director Manufacturing',LOCATION:'Dallas, TX',DISPOSITION:'APPLIED'}];
 const gated=plan(preview,master,{snapshotAsOf:new Date().toISOString()});
 assert.equal(gated.rows[0].gate,'PROTECTED_HOLD');
 assert.equal(gated.rows[1].gate,'EMPLOYER_BUSINESS_REVIEW');
 assert.equal(gated.writer_submissions,0);
 assert.deepEqual(gated.writer_payloads,[]);
});

test('stale and future snapshots fail closed',()=>{
 const p={rows:[item('Acme','Director Quality','Dayton, OH','https://example.com/job')]};
 assert.throws(()=>plan(p,[],{snapshotAsOf:new Date(Date.now()-3600000).toISOString()}),/freshness/);
 assert.throws(()=>plan(p,[],{snapshotAsOf:new Date(Date.now()+3600000).toISOString()}),/freshness/);
});

test('authenticated audit requires both Writer reads and preserves flags',async()=>{
 const {auditAuthenticated}=require('./admission');
 const preview={rows:[{...item('Acme','Director Quality','Memphis, TN','https://example.com/one'),tier:'P1',flags:['MEMPHIS_STRONG_NEGATIVE']}]};
 const read={source:'WRITER',authenticated:true,rows:[]};
 const out=await auditAuthenticated(preview,{fetchMaster:async()=>read,fetchArchive:async()=>read});
 assert.equal(out.rows[0].tier,'P1');
 assert.equal(out.rows[0].memphisStrongNegative,true);
 assert.equal(out.productionAdmission,'BLOCKED_UNTIL_READER_CONTRACT_QA');
 assert.equal(out.writer_submissions,0);
});
test('archived rejected identity gets protected hold',async()=>{
 const {auditAuthenticated}=require('./admission');
 const preview={rows:[item('Acme','Director Manufacturing','Austin, TX','https://example.com/one')]};
 const good=rows=>({source:'WRITER',authenticated:true,rows});
 const x=await auditAuthenticated(preview,{fetchMaster:async()=>good([]),fetchArchive:async()=>good([{COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin, TX',DISPOSITION:'REJECTED'}])});
 assert.equal(x.rows[0].gate,'PROTECTED_HOLD');
});
test('missing archive, unauthenticated responses, and overlong reads block',async()=>{
 const {auditAuthenticated}=require('./admission');
 const p={rows:[]},good={source:'WRITER',authenticated:true,rows:[]};
 await assert.rejects(()=>auditAuthenticated(p,{fetchMaster:async()=>good}),/readers required/);
 await assert.rejects(()=>auditAuthenticated(p,{fetchMaster:async()=>good,fetchArchive:async()=>({source:'WRITER',authenticated:false,rows:[]})}),/archive acquisition failed/);
 let at=0;
 await assert.rejects(()=>auditAuthenticated(p,{fetchMaster:async()=>good,fetchArchive:async()=>good,clock:()=>{at+=901000;return at}}),/expired/);
});

test('Writer reader authenticates through ping/status/master and parses canonical rows',async()=>{
 const {fetchAuthenticatedMaster}=require('./writer-reader');
 let tick=Date.now(),called=[];
 const transport=async u=>{const action=new URL(u).searchParams.get('action');called.push(action);return {ok:true,json:async()=>action==='master'?{ok:true,text:'1 | V2S-A1 | Acme | Director Quality | DISCOVERY_LEAD | OPEN | P1 | R1 | Memphis, TN | NEW\nEND',modifiedTime:'2026-10-22T18:00:00Z'}:{ok:true,frozen:false,build:'test'}}};
 const out=await fetchAuthenticatedMaster({key:'test-secret',transport,clock:()=>tick++});
 assert.deepEqual(called.sort(),['master','ping','writer_status']);
 assert.equal(out.rows[0].DISPOSITION,'OPEN');
 assert.equal(out.rows.length,1);
});
test('Writer reader fails closed on incomplete, unauthorized and frozen responses',async()=>{
 const {fetchAuthenticatedMaster}=require('./writer-reader');
 const mock=fn=>async u=>({ok:true,json:async()=>fn(new URL(u).searchParams.get('action'))});
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='master'?{ok:true,text:'incomplete'}:{ok:true})}),/completeness/);
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='ping'?{ok:false}:{ok:true,text:'END'})}),/authorized/);
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='writer_status'?{ok:true,frozen:true}:a==='master'?{ok:true,text:'1 | V2S-A1 | Acme | Director | NEW | OPEN | P1 | A | TX | NEW\nEND'}:{ok:true})}),/frozen/);
});
