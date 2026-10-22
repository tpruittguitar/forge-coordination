'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {snapshot,run,finalize}=require('./canary-cli');
const {requestId}=require('./production-executor');
const RULES_RAW='RULES v1',RULES_HASH=crypto.createHash('sha256').update(RULES_RAW).digest('hex');
const norm=x=>String(x??'').trim().toLowerCase();
// Stateful fake following the foreman-cockpit intake contract: dedupe against live master AND terminal archive,
// inserts open a receipt_index transaction (PENDING -> COMPLETE on verification), no-ops only log a receipt.
function fakeWriter({dedupeArchive=true}={}){
 const master=[{PRIMARY_ID:'V2I-EXIST1',COMPANY:'Existing Co',TITLE:'Director Manufacturing',REQ_ID:'R-E',LOCATION:'Dayton, OH'}];
 const archive=[{PRIMARY_ID:'V2F-ARCH1',COMPANY:'Archived Co',TITLE:'VP Operations',REQ_ID:'R-A',LOCATION:'Austin, TX'}];
 const index={},receipts=new Set(),log=[];let seq=0;
 const line=(r,n,b='SCOUT_INTAKE')=>`${n} | ${r.PRIMARY_ID} | ${r.COMPANY} | ${r.TITLE} | ${b} | OPEN | P1 | ${r.REQ_ID||'NONE'} | ${r.LOCATION} | NOTES`;
 const same=(r,x)=>norm(r.COMPANY)===norm(x.COMPANY)&&norm(r.TITLE)===norm(x.TITLE)&&norm(r.LOCATION)===norm(x.LOCATION)&&norm(r.REQ_ID)===norm(x.REQ_ID);
 const reply=d=>({ok:true,json:async()=>({ok:true,...d})});
 const transport=async(url,o)=>{
  if(o.method==='POST'){
   const req=JSON.parse(o.body),rec=req.records[0],rid=req.requestId;log.push('POST');
   const pool=dedupeArchive?master.concat(archive):master,hit=pool.find(r=>same(r,rec));
   if(hit){receipts.add(rid);return reply({COMPLETION_STATUS:'COMPLETE',RUN_ACCOUNTING:'RECONCILED',results:[{result:'EXISTING_MATCH',PRIMARY_ID:hit.PRIMARY_ID,matchedBy:'REQ_ID',NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[],COMPLETION_STATUS:'COMPLETE'}})}
   const pid='V2I-NEW'+(++seq);master.push({PRIMARY_ID:pid,COMPANY:rec.COMPANY,TITLE:rec.TITLE,REQ_ID:rec.REQ_ID,LOCATION:rec.LOCATION});
   index[rid]={s:'PENDING',w:'W'+seq,pid};
   return reply({WRITE_ACCEPTED:true,writeId:'W'+seq,COMPLETION_STATUS:'PENDING_VERIFICATION',RUN_ACCOUNTING:'RECONCILED',results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:pid,NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[pid]}});
  }
  const u=new URL(url),a=u.searchParams.get('action'),rid=u.searchParams.get('requestId');log.push(a);
  if(a==='ping')return reply({build:'fake'});
  if(a==='writer_status')return reply({freeze:null,level:'ok',errors:[]});
  if(a==='rules')return reply({rules:{status:'ACTIVE',rules:[{RULE_ID:'NC-001'}],raw:RULES_RAW,id:'doc'}});
  if(a==='receipt_index')return reply({source:'GITHUB',exists:true,sha:'sha'+seq,request:index[rid]?{s:index[rid].s,w:index[rid].w,...(index[rid].items?{items:index[rid].items}:{})}:null});
  if(a==='request_result'){
   if(index[rid]){assert.notEqual(index[rid].s,'PENDING','request_result must never be called while pending');return reply({found:true,source:'index',requestId:rid,status:index[rid].s,durable:index[rid].s==='COMPLETE',entry:{s:index[rid].s,items:index[rid].items}})}
   return reply(receipts.has(rid)?{found:true,source:'receipts',requestId:rid}:{found:false});
  }
  if(a==='row_readback'){
   const ids=u.searchParams.get('ids').split(','),rows=ids.map(id=>{const i=master.findIndex(r=>r.PRIMARY_ID===id);return i<0?{primaryId:id,found:false,matches:0}:{primaryId:id,found:true,matches:1,line:line(master[i],i+1)}});
   return reply({rows,master:{endMarkerPresent:true},requested:ids.length,found:rows.filter(r=>r.found).length});
  }
  if(a==='master')return reply({text:master.map((r,i)=>line(r,i+1)).join('\n')+'\nEND V2_CURRENT_POPULATION_MASTER',fetchedAt:new Date().toISOString()});
  if(a==='archive')return reply({archiveId:'ARCH',mode:'MIGRATED',text:'V2_TERMINAL_ARCHIVE\n'+archive.map((r,i)=>line(r,i+1,'ARCHIVE')).join('\n')});
  throw Error('unapproved Writer action '+a);
 };
 const verifyPending=()=>{for(const e of Object.values(index))if(e.s==='PENDING'){e.s='COMPLETE';e.items=[{pid:e.pid,op:'INSERT'}]}};
 return {transport,verifyPending,master,log};
}
const ENABLED=async()=>({ok:true,json:async()=>({enabled:true,mode:'CANARY',maxBatch:5,revision:'SOURCE_INTAKE_CANARY_V1'})});
const candidate=(record,expectedOutcome,extra={})=>({record:{SOURCE_URL:'https://jobs.example.com/'+record.COMPANY.replace(/\W/g,''),...record},expectedOutcome,
 evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',
 reviewedNeverConsider:false,rulesHash:RULES_HASH,businessEvidenceApproved:true,...extra});
const CANDIDATES=[
 candidate({COMPANY:'New Robotics',TITLE:'Director Manufacturing Engineering',LOCATION:'Huntsville, AL',REQ_ID:'R-N1'},'NEW'),
 candidate({COMPANY:'Existing Co',TITLE:'Director Manufacturing',LOCATION:'Dayton, OH',REQ_ID:'R-E'},'EXISTING_MATCH'),
 candidate({COMPANY:'Archived Co',TITLE:'VP Operations',LOCATION:'Austin, TX',REQ_ID:'R-A'},'PROTECTED_NOOP',{protectedPrimaryId:'V2F-ARCH1'}),
 candidate({COMPANY:'Second New',TITLE:'Plant Manager',LOCATION:'Greenville, SC',REQ_ID:'R-N2'},'NEW'),
 candidate({COMPANY:'Third New',TITLE:'Head of NPI',LOCATION:'Columbus, OH',REQ_ID:'R-N3'},'NEW')
];
const tmpState=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'canary-')),'state.json');

test('full five-case canary: halts after each insert, resumes only after verification, reconciles exactly',async()=>{
 const w=fakeWriter(),statePath=tmpState(),opts={statePath,candidates:CANDIDATES,key:'fixture',transport:w.transport,switchTransport:ENABLED};
 await snapshot('before',{...opts,sourceRunId:'FORGE-CANARY-TEST'});
 const r1=await run(opts);assert.equal(r1.status,'HALTED');assert.match(r1.message,/HOLD: Writer accepted/);
 // Re-running before Writer verification must not POST again: the request is PENDING in the receipt index.
 const posts=w.log.filter(x=>x==='POST').length;
 const early=await run(opts);assert.equal(early.status,'HALTED');assert.match(early.message,/existing or uncertain request/);
 assert.equal(w.log.filter(x=>x==='POST').length,posts,'no POST while pending');
 w.verifyPending();
 const r2=await run(opts);assert.equal(r2.status,'HALTED');
 assert.deepEqual(r2.outcomes.map(o=>o.status),['RESUMED_ACCOUNTED','NOOP_ACCOUNTED','NOOP_ACCOUNTED','PENDING_VERIFICATION']);
 w.verifyPending();
 const r3=await run(opts);assert.equal(r3.status,'HALTED');w.verifyPending();
 const r4=await run(opts);assert.equal(r4.status,'ALL_CASES_ACCOUNTED');
 assert.ok(r4.outcomes.every(o=>o.status==='RESUMED_ACCOUNTED'),'no case re-posted on the final pass');
 assert.equal(w.log.filter(x=>x==='POST').length,5,'exactly one POST per case across all runs');
 assert.throws(()=>finalize(opts),/after snapshot/);
 await snapshot('after',opts);
 const rec=finalize(opts);
 assert.equal(rec.status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');
 assert.equal(rec.afterCount-rec.beforeCount,3);assert.equal(rec.insertedIds.length,3);
 assert.equal(rec.verified,false);assert.equal(rec.scaleUpAllowed,false);
 const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
 assert.ok(!JSON.stringify(state).includes('fixture'),'Writer key never persisted');
 assert.equal(Object.keys(state.results).length,5,'every Writer response persisted');
});
test('a Writer that resurrects the archived role halts the canary at the protected case',async()=>{
 const w=fakeWriter({dedupeArchive:false}),statePath=tmpState(),opts={statePath,candidates:CANDIDATES,key:'fixture',transport:w.transport,switchTransport:ENABLED};
 await snapshot('before',{...opts,sourceRunId:'FORGE-CANARY-TEST'});
 await run(opts);w.verifyPending();
 const r=await run(opts);
 assert.equal(r.status,'HALTED');assert.match(r.message,/Writer inserted a row for a PROTECTED_NOOP canary case/);
 for(let i=0;i<3;i++){w.verifyPending();const again=await run(opts);assert.equal(again.status,'HALTED');assert.match(again.message,/PROTECTED_ROLE_OPENED_MASTER_TRANSACTION/)}
 assert.equal(w.log.filter(x=>x==='POST').length,3,'canary never proceeds past the protected case');
});
test('state is bound to the exact candidates and the before snapshot is taken once',async()=>{
 const w=fakeWriter(),statePath=tmpState(),opts={statePath,candidates:CANDIDATES,key:'fixture',transport:w.transport,switchTransport:ENABLED};
 await snapshot('before',{...opts,sourceRunId:'FORGE-CANARY-TEST'});
 await assert.rejects(()=>snapshot('before',{...opts,sourceRunId:'FORGE-CANARY-TEST'}),/taken once/);
 const swapped=CANDIDATES.map((c,i)=>i===0?candidate({...c.record,TITLE:'Other'},'NEW'):c);
 await assert.rejects(()=>run({...opts,candidates:swapped}),/candidates changed/);
 await assert.rejects(()=>snapshot('after',opts),/all five cases accounted/);
});
test('a disabled kill switch halts before any Writer write and records the halt',async()=>{
 const w=fakeWriter(),statePath=tmpState(),opts={statePath,candidates:CANDIDATES,key:'fixture',transport:w.transport,switchTransport:async()=>({ok:true,json:async()=>({enabled:false})})};
 await snapshot('before',{...opts,sourceRunId:'FORGE-CANARY-TEST'});
 const r=await run(opts);
 assert.equal(r.status,'HALTED');assert.match(r.message,/release switch not enabled/);
 assert.ok(!w.log.includes('POST'));
 assert.equal(JSON.parse(fs.readFileSync(statePath,'utf8')).halts.length,1);
});
test('file recorder: probe and every recorded response are on disk before they are reported', async () => {
 const {fileRecorder} = require('./canary-cli');
 const statePath = tmpState(), state = {results: {}};
 fs.writeFileSync(statePath, JSON.stringify(state));
 const rec = fileRecorder(statePath, state);
 assert.equal(await rec.check(), true);
 assert.ok(JSON.parse(fs.readFileSync(statePath, 'utf8')).recorderProbe.probe, 'probe persisted');
 await rec.record('FORGE-SOURCE-X', {ok: true, receipt: {REQUEST_ID: 'FORGE-SOURCE-X'}});
 assert.deepEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')).results['FORGE-SOURCE-X'], {ok: true, receipt: {REQUEST_ID: 'FORGE-SOURCE-X'}});
 assert.deepEqual(await rec.read('FORGE-SOURCE-X'), {ok: true, receipt: {REQUEST_ID: 'FORGE-SOURCE-X'}});
 assert.ok(!fs.existsSync(statePath + '.tmp'), 'atomic rename leaves no temp file');
});
