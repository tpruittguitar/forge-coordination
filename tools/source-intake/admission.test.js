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
 const transport=async u=>{const action=new URL(u).searchParams.get('action');called.push(action);return {ok:true,json:async()=>action==='master'?{ok:true,text:'1 | V2S-A1 | Acme | Director Quality | DISCOVERY_LEAD | OPEN | P1 | R1 | Memphis, TN | NEW\nEND V2_CURRENT_POPULATION_MASTER',modifiedTime:new Date().toISOString()}:{ok:true,freeze:null,level:'OK',errors:[],build:'test'}}};
 const out=await fetchAuthenticatedMaster({key:'test-secret',transport,clock:()=>tick++});
 assert.deepEqual(called.sort(),['master','ping','writer_status']);
 assert.equal(out.rows[0].DISPOSITION,'OPEN');
 assert.equal(out.rows.length,1);
});
test('Writer reader fails closed on incomplete, unauthorized and frozen responses',async()=>{
 const {fetchAuthenticatedMaster}=require('./writer-reader');
 const mock=fn=>async u=>({ok:true,json:async()=>{const a=new URL(u).searchParams.get('action');return a==='writer_status'?{ok:true,freeze:null,level:'OK',errors:[],...fn(a)}:fn(a)}});
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='master'?{ok:true,text:'incomplete'}:{ok:true})}),/completeness/);
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='ping'?{ok:false}:{ok:true,text:'END'})}),/authorized/);
 await assert.rejects(()=>fetchAuthenticatedMaster({key:'k',transport:mock(a=>a==='writer_status'?{ok:true,freeze:{reason:'QA freeze'},level:'WARN',errors:[]}:a==='master'?{ok:true,text:'1 | V2S-A1 | Acme | Director | NEW | OPEN | P1 | A | TX | NEW\nEND V2_CURRENT_POPULATION_MASTER',modifiedTime:new Date().toISOString()}:{ok:true})}),/status not healthy/);
});

test('archive RESTORED markers prevent obsolete terminal history from resurfacing',()=>{
 const {parseArchive}=require('./writer-reader');
 const row='1 | V2S-A1 | Acme | Director Quality | REJECTED_BY_EMPLOYER | REJECTED_BY_EMPLOYER | P1 | R1 | Austin, TX | DONE';
 assert.equal(parseArchive(row+'\nRESTORED|V2S-A1|1|2026-10-22|RUN').length,0);
 assert.equal(parseArchive(row).length,1);
});
test('actual authenticated Writer master+archive audit holds archive rejection',async()=>{
 const {auditLiveWriter}=require('./writer-reader');
 const row='1 | V2S-A1 | Acme | Director Quality | REJECTED_BY_EMPLOYER | REJECTED_BY_EMPLOYER | P1 | R1 | Austin, TX | DONE';
 const transport=async u=>{const action=new URL(u).searchParams.get('action');
  const data=action==='master'?{ok:true,text:'2 | V2S-B1 | Other | Production Manager | DISCOVERY_LEAD | OPEN | P1 | R2 | Toledo, OH | LIVE\nEND V2_CURRENT_POPULATION_MASTER',modifiedTime:new Date().toISOString()}
    :action==='archive'?{ok:true,archiveId:'archive-file-id',text:'V2_TERMINAL_ARCHIVE (read-only terminal history)\n'+row,degraded:false,mode:'COMPLETE'}
    :{ok:true,freeze:null,level:'OK',errors:[]};
  return {ok:true,json:async()=>data};
 };
 const preview={rows:[item('Acme','Director Quality','Austin, TX','https://example.com/a')]};
 const out=await auditLiveWriter(preview,{key:'mock-key',transport});
 assert.equal(out.rows[0].gate,'PROTECTED_HOLD');
 assert.equal(out.acquisition.archiveCount,1);
 assert.equal(out.writer_submissions,0);
});
test('authenticated Writer archive failure blocks every candidate',async()=>{
 const {auditLiveWriter}=require('./writer-reader');
 const transport=async u=>({ok:true,json:async()=>new URL(u).searchParams.get('action')==='archive'?{ok:true,degraded:true,text:'',archiveId:'id'}:{ok:true,text:'1 | V2S-A1 | Acme | Director | OPEN | OPEN | P1 | R1 | Austin, TX | LIVE\nEND V2_CURRENT_POPULATION_MASTER',modifiedTime:new Date().toISOString(),freeze:null,level:'OK',errors:[]}});
 await assert.rejects(()=>auditLiveWriter({rows:[]},{key:'mock',transport}),/archive degraded/);
});

test('real terminal archive dispositions and protection evidence are held',()=>{
 const L=require('../source-trial/lib');
 for(const disposition of ['REJECTED_CONFIRMED','RESOLVED','REJECTED_BY_EMPLOYER','DECLINED_BY_TIM','CLOSED_DEAD','NOT_GOOD_FIT','OFF_TARGET_LOCATION']){
  const rows=[{COMPANY:'Acme',TITLE:'Director Quality',LOCATION:'Austin, TX',DISPOSITION:disposition,ARCHIVED_TERMINAL:true}];
  assert.equal(L.novelty(L.masterIndex(rows),'Acme','Director Quality','','Austin, TX'),'EXISTING_PROTECTED',disposition);
 }
 const {parseArchive}=require('./writer-reader');
 const a=parseArchive('1 | V2S-X1 | Acme | Director | REJECTED_BY_EMPLOYER | REJECTED_CONFIRMED | P1 | R1 | Austin, TX | NOTES; ANTI_RESURRECTION=YES; DO_NOT_REWORK=YES');
 assert.equal(a[0].ANTI_RESURRECTION,'YES');assert.equal(a[0].DO_NOT_REWORK,'YES');
});
test('Writer health and master age gates block bad data',async()=>{
 const {fetchAuthenticatedMaster}=require('./writer-reader');
 const raw='1 | V2S-X1 | Acme | Director | DISCOVERY_LEAD | OPEN | P1 | R1 | Austin, TX | NOTES\nEND V2_CURRENT_POPULATION_MASTER';
 const run=(st,modifiedTime)=>fetchAuthenticatedMaster({key:'mock',transport:async u=>({ok:true,json:async()=>new URL(u).searchParams.get('action')==='master'?{ok:true,text:raw,modifiedTime}:new URL(u).searchParams.get('action')==='writer_status'?{ok:true,...st}:{ok:true}})});
 await assert.rejects(()=>run({freeze:null,level:'ERROR',errors:[]},new Date().toISOString()),/status not healthy/);
 await assert.rejects(()=>run({freeze:null,level:'OK',errors:[]},'2026-01-01T00:00:00Z'),/stale/);
 await assert.rejects(()=>run({freeze:null,level:'OK',errors:['failure']},new Date().toISOString()),/status not healthy/);
});
