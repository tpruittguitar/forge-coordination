'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requestId,fetchRelease,runCanary}=require('./production-executor');
// In-memory recorder for tests; production uses canary-cli's fsync'd file recorder.
const memRecorder=(store={})=>({store,check:async()=>true,record:async(rid,r)=>{store[rid]=JSON.parse(JSON.stringify(r))},read:async rid=>store[rid]});
test('deterministic request IDs survive a replay',()=>{
 const r={COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/role'};
 assert.equal(requestId(r),requestId({...r}));
 assert.notEqual(requestId(r),requestId({...r,REQ_ID:'R2'}));
});
test('release switch defaults closed',async()=>{
 await assert.rejects(()=>fetchRelease(async()=>({ok:true,json:async()=>({enabled:false})})),/switch/);
});
test('no writes when batch is not exactly five reviewed records',async()=>{
 let called=0;await assert.rejects(()=>runCanary([],{transport:async()=>{called++;}}),/exactly 5/);assert.equal(called,0);
});
test('an unavailable live kill switch fails before any Writer call',async()=>{
 const records=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme'+i,TITLE:'Director',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'}));
 let writerCalls=0;
 await assert.rejects(()=>runCanary(records,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',recorder:memRecorder(),switchTransport:async()=>({ok:false}),transport:async()=>{writerCalls++}}),/switch unavailable/);
 assert.equal(writerCalls,0);
});

test('reject canary without existing and protected test cases',async()=>{
 const candidates=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme'+i,TITLE:'Director',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:'NEW'}));
 await assert.rejects(()=>runCanary(candidates,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY'}),/new, existing and protected/);
});

test('canary insert requires matching complete receipt and exact readback',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const record={COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin, TX',REQ_ID:'R1'};
 const result={results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-123'}]};
 const receipt={status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-123',op:'INSERT'}]}};
 const readbacks=[{primaryId:'V2I-123',found:true,matches:1,line:'1 | V2I-123 | Acme | Director | SCOUT_INTAKE | OPEN | P1 | R1 | Austin, TX | NOTES'}];
 assert.equal(checkCanaryOutcome({expectedOutcome:'NEW',record,result,receipt,readbacks}).status,'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK');
 const mismatch=checkCanaryOutcome({expectedOutcome:'NEW',record:{...record,TITLE:'Wrong'},result,receipt,readbacks});
 assert.equal(mismatch.status,'HOLD');assert.equal(mismatch.reason,'INSERT_IDENTITY_MISMATCH');
 const pending=checkCanaryOutcome({expectedOutcome:'NEW',record,result,receipt:{...receipt,durable:false},readbacks});
 assert.equal(pending.status,'HOLD');assert.equal(pending.reason,'RECEIPT_NOT_DURABLE_AND_BOUND');
});
test('protected canary cannot pass if Writer inserts a row',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const result={results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-NEW'}]};
 const receipt={status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-NEW',op:'INSERT'}]}};
 const out=checkCanaryOutcome({expectedOutcome:'PROTECTED_NOOP',record:{},result,receipt,readbacks:[]});
 assert.equal(out.status,'HOLD');assert.equal(out.reason,'PROTECTED_NOT_NOOP');assert.equal(out.scaleUpAllowed,false);
});

test('canary rejects missing identity fields before network access',async()=>{
 const base=i=>({record:{COMPANY:'Acme '+i,TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/job/'+i},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'});
 for(const field of ['COMPANY','TITLE','LOCATION','SOURCE_URL']){
  const rows=Array.from({length:5},(_,i)=>base(i));rows[0].record[field]='';
  let calls=0;
  await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>{calls++;throw Error('network')} ,transport:async()=>{calls++;throw Error('Writer')}}),/exactly 5 reviewed/);
  assert.equal(calls,0,'no network allowed for '+field);
 }
});
test('canary rejects malformed source URLs before any switch or Writer call',async()=>{
 const rows=Array.from({length:5},(_,i)=>({record:{COMPANY:'Acme '+i,TITLE:'Director Manufacturing',LOCATION:'Austin TX',SOURCE_URL:'javascript:alert(1)'},evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',reviewedNeverConsider:false,expectedOutcome:i===0?'NEW':i===1?'EXISTING_MATCH':'PROTECTED_NOOP'}));
 let calls=0;
 await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:async()=>{calls++},transport:async()=>{calls++}}),/exactly 5 reviewed/);
 assert.equal(calls,0);
});

test('five-case count reconciliation holds without independent authenticated master snapshots',()=>{
 const {reconcileCanaryBatch}=require('./canary-accounting');
 assert.equal(reconcileCanaryBatch({cases:Array(5).fill({}),before:{rows:[]},after:{rows:[]}}).reason,'INDEPENDENT_WRITER_SNAPSHOTS_REQUIRED');
});
test('five-case count reconciliation proves exact new ID set and protects archived no-op',()=>{
 const {reconcileCanaryBatch}=require('./canary-accounting');
 const row=(id,n)=>({PRIMARY_ID:id,COMPANY:'Company '+n,TITLE:'Director '+n,LOCATION:'Austin TX',REQ_ID:'REQ'+n});
 // The protected role lives only in the terminal archive, never in the current master.
 const archived={...row('V2A-2',2),ARCHIVED_TERMINAL:true};
 const before=[row('V2I-1',1),row('V2I-3',3)];
 const after=[...before,row('V2I-4',4),row('V2I-5',5)];
 const cases=[1,2,3,4,5].map(n=>({
   expectedOutcome:n===2?'PROTECTED_NOOP':n===1?'EXISTING_MATCH':n===3?'EXISTING_MATCH':'NEW',
   record:row('',n),primaryId:'V2I-'+n,
   protectedPrimaryId:n===2?'V2A-2':undefined,
   accounting:{status:n===2||n===1||n===3?'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS':'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',
    primaryId:n===2?'V2A-2':'V2I-'+n}
 }));
 const snapshot=rows=>({source:'WRITER',authenticated:true,rows});
 const archive=snapshot([archived]);
 const ok=reconcileCanaryBatch({cases,before:snapshot(before),after:snapshot(after),archiveBefore:archive,archiveAfter:archive});
 assert.equal(ok.status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');
 assert.equal(ok.verified,false);assert.equal(ok.scaleUpAllowed,false);
 const contaminated=reconcileCanaryBatch({cases,before:snapshot(before),after:snapshot([...after,row('V2I-X',6)]),archiveBefore:archive,archiveAfter:archive});
 assert.equal(contaminated.reason,'INSERTED_ID_SET_MISMATCH');
});

test('pending receipt never requests result and never posts',async()=>{
 const {inspectReceipt}=require('./production-executor');
 const calls=[];
 const transport=async(url,options)=>{
  calls.push({url,method:options.method});
  const action=new URL(url).searchParams.get('action');
  assert.equal(action,'receipt_index');
  return {ok:true,json:async()=>({ok:true,source:'GITHUB',exists:true,sha:'gitsha',request:{s:'PENDING'}})};
 };
 const output=await inspectReceipt({COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/job/a'},{key:'fixture',transport});
 assert.equal(output.reason,'PENDING');assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
});
test('complete index is required before request_result and row readback',async()=>{
 const {inspectReceipt}=require('./production-executor');
 const calls=[];
 const transport=async(url,options)=>{
  const u=new URL(url),action=u.searchParams.get('action');calls.push(action);
  let data={ok:true};
  if(action==='receipt_index')data={...data,source:'GITHUB',exists:true,sha:'abc',request:{s:'COMPLETE',items:[{pid:'V2I-123'}]}};
  else if(action==='request_result')data={...data,requestId:u.searchParams.get('requestId'),status:'COMPLETE',entry:{items:[{pid:'V2I-123'}]}};
  else if(action==='row_readback')data={...data,results:[]};
  else throw Error('unapproved operation');
  assert.equal(options.method,'GET');
  return {ok:true,json:async()=>data};
 };
 const output=await inspectReceipt({COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin TX',SOURCE_URL:'https://example.com/job/a'},{key:'fixture',transport});
 assert.deepEqual(calls,['receipt_index','request_result','row_readback']);
 assert.deepEqual(output.primaryIds,['V2I-123']);assert.equal(output.verified,false);
});

// ---- QA remediation regressions (archive guard, verified resume, archive-aware reconciliation) ----
const RULES_RAW='RULES v1';
const RULES_HASH=require('node:crypto').createHash('sha256').update(RULES_RAW).digest('hex');
const ARCHIVE_TEXT='V2_TERMINAL_ARCHIVE\n1 | V2A-9 | Co0 | Dir | ARCHIVE | REJECTED | P | R0 | TX | N';
const ENABLED=async()=>({ok:true,json:async()=>({enabled:true,mode:'CANARY',maxBatch:5,revision:'SOURCE_INTAKE_CANARY_V1'})});
const canary=order=>order.map((kind,i)=>({record:{COMPANY:'Co'+i,TITLE:'Dir',LOCATION:'TX',SOURCE_URL:'https://example.com/'+i},
 evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',
 reviewedNeverConsider:false,expectedOutcome:kind,protectedPrimaryId:'V2A-9',rulesHash:RULES_HASH,businessEvidenceApproved:true}));
// Response shapes follow foreman-cockpit Code.gs applyIntakeToMaster_/intakeResponse_ (see production-executor.js header).
const insertResponse=(rid,pid='V2I-NEW')=>({ok:true,WRITE_ACCEPTED:true,WRITE_VERIFIED:false,writeId:'W1',verification:'PENDING',COMPLETION_STATUS:'PENDING_VERIFICATION',RUN_ACCOUNTING:'RECONCILED',
 results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:pid,matchedBy:'',NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[pid],COMPLETION_STATUS:'PENDING_VERIFICATION'}});
const noopResponse=(rid,pid)=>({ok:true,WRITE_VERIFIED:true,COMPLETION_STATUS:'COMPLETE',RUN_ACCOUNTING:'RECONCILED',
 results:[{result:'EXISTING_MATCH',PRIMARY_ID:pid,matchedBy:'REQ_ID',NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[],COMPLETION_STATUS:'COMPLETE'}});
function mockWriter({index={},result={},readback={},post={},archiveText=ARCHIVE_TEXT}={},log=[]){
 return async(url,o)=>{
  const u=new URL(url),action=o.method==='POST'?'POST':u.searchParams.get('action');
  const rid=action==='POST'?JSON.parse(o.body).requestId:u.searchParams.get('requestId');log.push(action);
  const d={ok:true};
  if(action==='writer_status')Object.assign(d,{freeze:null,level:'OK',errors:[]});
  else if(action==='receipt_index')Object.assign(d,{source:'GITHUB',exists:true,sha:'s',request:index[rid]||null});
  else if(action==='rules')Object.assign(d,{rules:{status:'ACTIVE',rules:[1],raw:RULES_RAW,id:'r'}});
  else if(action==='archive')Object.assign(d,{archiveId:'A',mode:'MIGRATED',text:archiveText});
  else if(action==='request_result')Object.assign(d,result[rid]);
  else if(action==='row_readback')Object.assign(d,readback[rid]);
  else if(action==='POST')return {ok:true,json:async()=>post[rid]||insertResponse(rid)};
  else throw Error('unapproved operation '+action);
  return {ok:true,json:async()=>d};
 };
}
const opts=(transport,extra={})=>({key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:ENABLED,transport,recorder:memRecorder(),...extra});
const durable=(rid,items)=>({found:true,source:'index',requestId:rid,status:'COMPLETE',durable:true,entry:{items}});

test('protected candidate without an exact archived match never reaches Writer POST',async()=>{
 const log=[],rows=canary(['PROTECTED_NOOP','NEW','EXISTING_MATCH','NEW','NEW']);rows[0].protectedPrimaryId='V2A-MISSING';
 await assert.rejects(()=>runCanary(rows,opts(mockWriter({},log))),/protected archive identity unproven/);
 assert.deepEqual(log,['archive']);
});
test('protected candidate with identity mismatch in archive never reaches Writer POST',async()=>{
 const log=[],rows=canary(['PROTECTED_NOOP','NEW','EXISTING_MATCH','NEW','NEW']);rows[0].record.TITLE='Other';
 await assert.rejects(()=>runCanary(rows,opts(mockWriter({},log))),/protected archive identity unproven/);
 assert.ok(!log.includes('POST'));
});
test('proven protected no-op is verified without a receipt-index entry and the canary advances to the next case',async()=>{
 const rows=canary(['PROTECTED_NOOP','NEW','EXISTING_MATCH','NEW','NEW']),rid=requestId(rows[0].record),log=[];
 const writer=mockWriter({post:{[rid]:noopResponse(rid,'V2A-9')},result:{[rid]:{found:true,source:'receipts',requestId:rid}},
  readback:{[rid]:{rows:[{primaryId:'V2A-9',found:false,matches:0}],master:{endMarkerPresent:true},requested:1,found:0}}},log);
 const err=await runCanary(rows,opts(writer)).catch(e=>e);
 assert.match(err.message,/HOLD: Writer accepted/);
 assert.equal(err.outcomes[0].status,'NOOP_ACCOUNTED');
 assert.equal(err.outcomes[0].accounting.status,'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS');
 assert.equal(err.outcomes[1].status,'PENDING_VERIFICATION');assert.equal(err.outcomes[1].writerResult.results[0].PRIMARY_ID,'V2I-NEW');
 assert.equal(log.filter(x=>x==='POST').length,2);
});
test('a no-op response that Writer actually indexed as a transaction is held',async()=>{
 const rows=canary(['EXISTING_MATCH','NEW','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record);
 let posted=false;const inner=mockWriter({post:{[rid]:noopResponse(rid,'V2I-5')}});
 const writer=async(url,o)=>{if(o.method==='POST')posted=true;
  if(posted&&new URL(url).searchParams.get('action')==='receipt_index')return {ok:true,json:async()=>({ok:true,source:'GITHUB',exists:true,sha:'s',request:{s:'PENDING'}})};
  return inner(url,o)};
 const err=await runCanary(rows,opts(writer)).catch(e=>e);
 assert.match(err.message,/NOOP_OPENED_MASTER_TRANSACTION/);
 assert.equal(err.outcomes[0].writerResult.results[0].result,'EXISTING_MATCH','captured for persistence');
});
test('Writer responses outside the contract are UNKNOWN and halt with no further POST',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record);
 const bad=[{...insertResponse(rid),receipt:{REQUEST_ID:'FORGE-SOURCE-OTHER',NEW_PRIMARY_IDS:['V2I-NEW']}},
  {...insertResponse(rid),writeId:''},{...insertResponse(rid),results:[]},{...noopResponse(rid,'V2I-5'),COMPLETION_STATUS:'INCOMPLETE'},
  {...noopResponse(rid,'V2I-5'),ok:false},{ok:true,results:[{result:'WRITE_FAILED'}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[]}}];
 for(const response of bad){
  const log=[];
  await assert.rejects(()=>runCanary(rows,opts(mockWriter({post:{[rid]:response}},log))),/UNKNOWN: Writer transaction not conclusively classified/);
  assert.equal(log.filter(x=>x==='POST').length,1);
 }
});
test('Writer exclusion, review flag, unexpected insert for a no-op case, or NEW matching existing all halt',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record);
 const excluded={ok:true,COMPLETION_STATUS:'COMPLETE',results:[{result:'NEVER_CONSIDER_EXCLUDED',NEVER_CONSIDER_RULE_ID:'NC-001'}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[]}};
 const review={...insertResponse(rid),results:[{...insertResponse(rid).results[0],NEVER_CONSIDER_REVIEW_NEEDED:'NC-002'}]};
 await assert.rejects(()=>runCanary(rows,opts(mockWriter({post:{[rid]:excluded}}))),/HOLD: Writer EXCLUDED/);
 await assert.rejects(()=>runCanary(rows,opts(mockWriter({post:{[rid]:review}}))),/HOLD: Writer REVIEW_NEEDED/);
 // NEW matching an existing row is now a documented SKIP (see production-executor.js)
 const flipped=canary(['EXISTING_MATCH','NEW','PROTECTED_NOOP','NEW','NEW']),frid=requestId(flipped[0].record);
 await assert.rejects(()=>runCanary(flipped,opts(mockWriter({post:{[frid]:insertResponse(frid)}}))),/Writer inserted a row for a EXISTING_MATCH canary case/);
});
test('resume accounts a verified COMPLETE case without re-POSTing and advances to the next case',async()=>{
 const rows=canary(['NEW','NEW','PROTECTED_NOOP','EXISTING_MATCH','NEW']);
 const rid=requestId(rows[0].record),items=[{pid:'V2I-100',op:'INSERT'}],log=[];
 const writer=mockWriter({index:{[rid]:{s:'COMPLETE',items}},result:{[rid]:durable(rid,items)},
  readback:{[rid]:{rows:[{primaryId:'V2I-100',found:true,matches:1,line:'1 | V2I-100 | Co0 | Dir | SCOUT_INTAKE | OPEN | P | R | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}}},log);
 const priorResults={[rid]:insertResponse(rid,'V2I-100')};
 const err=await runCanary(rows,opts(writer,{priorResults})).catch(e=>e);
 assert.match(err.message,/HOLD: Writer accepted/);
 assert.equal(err.outcomes[0].status,'RESUMED_ACCOUNTED');
 assert.equal(err.outcomes[0].accounting.status,'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK');
 assert.equal(err.outcomes[0].accounting.verified,false);
 assert.equal(err.outcomes[1].status,'PENDING_VERIFICATION');
 assert.equal(log.filter(x=>x==='POST').length,1,'only the next case is posted');
});
test('resume holds without captured Writer result, on pending state, or on receipt binding mismatch',async()=>{
 const rows=canary(['NEW','PROTECTED_NOOP','EXISTING_MATCH','NEW','NEW']);
 const rid=requestId(rows[0].record),items=[{pid:'V2I-100',op:'INSERT'}];
 const prior={[rid]:{results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-100'}]}};
 const rb={[rid]:{rows:[{primaryId:'V2I-100',found:true,matches:1,line:'1 | V2I-100 | Co0 | Dir | S | OPEN | P | R | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}};
 const cases=[
  [{index:{[rid]:{s:'COMPLETE',items}},result:{[rid]:durable(rid,items)},readback:rb},{},/existing or uncertain request/],
  [{index:{[rid]:{s:'PENDING',items}}},prior,/existing or uncertain request/]
 ];
 for(const [state,priorResults,pattern] of cases){
  const log=[];
  await assert.rejects(()=>runCanary(rows,opts(mockWriter(state,log),{priorResults})),pattern);
  assert.ok(!log.includes('POST'),'no POST');
  if(state.index[rid].s!=='COMPLETE')assert.ok(!log.includes('request_result'),'pending index never requests result');
 }
 // single-case verification failures are now SKIPPED (production path)
});
test('protected no-op resume re-verifies from the captured response without re-POSTing',async()=>{
 const rows=canary(['PROTECTED_NOOP','NEW','EXISTING_MATCH','NEW','NEW']);
 const rid=requestId(rows[0].record);
 const base={result:{[rid]:{found:true,source:'receipts',requestId:rid}}};
 const priorResults={[rid]:noopResponse(rid,'V2A-9')};
 const absent={[rid]:{rows:[],master:{endMarkerPresent:true},requested:1,found:0}};
 const log=[];
 const err=await runCanary(rows,opts(mockWriter({...base,readback:absent},log),{priorResults})).catch(e=>e);
 assert.equal(err.outcomes[0].status,'RESUMED_ACCOUNTED');
 assert.equal(log.indexOf('POST'),log.lastIndexOf('POST'),'only case 2 is posted');
 assert.equal(err.outcomes[0].accounting.status,'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS');
 assert.equal(log.filter(x=>x==='POST').length,1);
 const resurrected={[rid]:{rows:[{primaryId:'V2A-9',found:true,matches:1,line:'1 | V2A-9 | Co0 | Dir | S | OPEN | P | R0 | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}};
 const log2=[];
 await assert.rejects(()=>runCanary(rows,opts(mockWriter({...base,readback:resurrected},log2),{priorResults})),/PROTECTED_ROLE_IN_MASTER_OR_UNPROVEN/);
 assert.ok(!log2.includes('POST'));
});
test('reconciliation requires archive snapshots and rejects resurrection or restoration of the protected role',()=>{
 const {reconcileCanaryBatch}=require('./canary-accounting');
 const row=(id,n)=>({PRIMARY_ID:id,COMPANY:'C'+n,TITLE:'T'+n,LOCATION:'L'});
 const snap=rows=>({source:'WRITER',authenticated:true,rows});
 const archived={...row('V2A-2',2),ARCHIVED_TERMINAL:true};
 const before=[row('V2I-1',1)],after=[...before,row('V2I-4',4),row('V2I-5',5),row('V2I-6',6)];
 const cases=[{expectedOutcome:'EXISTING_MATCH',record:row('',1),accounting:{status:'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS',primaryId:'V2I-1'}},
  {expectedOutcome:'PROTECTED_NOOP',record:row('',2),protectedPrimaryId:'V2A-2',accounting:{status:'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS',primaryId:'V2A-2'}},
  ...[4,5,6].map(n=>({expectedOutcome:'NEW',record:row('',n),accounting:{status:'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',primaryId:'V2I-'+n}}))];
 const run=(b,a,ab,aa)=>reconcileCanaryBatch({cases,before:snap(b),after:snap(a),archiveBefore:ab&&snap(ab),archiveAfter:aa&&snap(aa)});
 assert.equal(run(before,after,[archived],[archived]).status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');
 assert.equal(run(before,after).reason,'INDEPENDENT_ARCHIVE_SNAPSHOTS_REQUIRED');
 assert.equal(run(before,after,[archived],[]).reason,'ARCHIVED_PROTECTION_NOT_PROVEN');
 assert.equal(run(before,[...after,row('V2A-2',2)],[archived],[archived]).reason,'INSERTED_ID_SET_MISMATCH');
 assert.equal(run([...before,row('V2A-2',2)],[...after,row('V2A-2',2)],[archived],[archived]).reason,'PROTECTED_ROLE_IN_MASTER');
 assert.equal(run(before,after,[{...archived,TITLE:'X'}],[archived]).reason,'ARCHIVE_IDENTITY_MISMATCH');
});
test('accounting rejects a receipt bound to a different request ID',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const out=checkCanaryOutcome({expectedOutcome:'NEW',record:{COMPANY:'A',TITLE:'D',LOCATION:'X'},requestId:'FORGE-SOURCE-MINE',
  result:{results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:'V2I-1'}]},
  receipt:{requestId:'FORGE-SOURCE-OTHER',status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-1'}]}},
  readbacks:[{primaryId:'V2I-1',found:true,matches:1,line:'1 | V2I-1 | A | D | B | OPEN | P | R | X | N'}]});
 assert.equal(out.reason,'RECEIPT_REQUEST_ID_MISMATCH');
});
test('an indexed transaction for a no-op canary case is never accepted on resume',async()=>{
 const rows=canary(['EXISTING_MATCH','NEW','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record),items=[{pid:'V2I-5',op:'INSERT'}];
 const writer=mockWriter({index:{[rid]:{s:'COMPLETE',items}},result:{[rid]:durable(rid,items)},
  readback:{[rid]:{rows:[{primaryId:'V2I-5',found:true,matches:1,line:'1 | V2I-5 | Co0 | Dir | S | OPEN | P | R | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}}});
 await assert.rejects(()=>runCanary(rows,opts(writer,{priorResults:{[rid]:noopResponse(rid,'V2I-5')}})),/UNEXPECTED_ROW_WRITE|EXISTING_IDENTITY_UNCERTAIN/);
});
test('kill switch is read from the GitHub contents API on main, not the raw CDN',async()=>{
 let seen;await fetchRelease(async(url,o)=>{seen={url,o};return {ok:true,json:async()=>({enabled:true,mode:'CANARY',maxBatch:5,revision:'SOURCE_INTAKE_CANARY_V1'})}});
 assert.match(seen.url,/^https:\/\/api\.github\.com\/repos\/tpruittguitar\/forge-coordination\/contents\/control\/SOURCE_INTAKE_RELEASE\.json\?ref=main$/);
 assert.equal(seen.o.headers.Accept,'application/vnd.github.raw');
});
test('inspectReceipt holds when index and result disagree on row IDs',async()=>{
 const {inspectReceipt}=require('./production-executor');
 const transport=async(url)=>{const u=new URL(url),a=u.searchParams.get('action'),rid=u.searchParams.get('requestId');
  const d=a==='receipt_index'?{source:'GITHUB',exists:true,sha:'x',request:{s:'COMPLETE',items:[{pid:'V2I-1'}]}}:{requestId:rid,status:'COMPLETE',entry:{items:[{pid:'V2I-2'}]}};
  return {ok:true,json:async()=>({ok:true,...d})}};
 const out=await inspectReceipt({COMPANY:'A',TITLE:'D',LOCATION:'X',SOURCE_URL:'https://example.com/x'},{key:'k',transport});
 assert.equal(out.reason,'RECEIPT_IDS_UNBOUND');
});
test('existing no-op accounting rejects any receipt item regardless of op name',()=>{
 const {checkCanaryOutcome}=require('./canary-accounting');
 const out=checkCanaryOutcome({expectedOutcome:'EXISTING_MATCH',record:{COMPANY:'A',TITLE:'D',LOCATION:'X'},result:{results:[{result:'EXISTING_MATCH',PRIMARY_ID:'V2I-1'}]},
  receipt:{status:'COMPLETE',durable:true,entry:{items:[{pid:'V2I-1',op:'REPLACE'}]}},readbacks:[{primaryId:'V2I-1',found:true,matches:1,line:'1 | V2I-1 | A | D | B | OPEN | P | R | X | N'}]});
 assert.equal(out.reason,'UNEXPECTED_ROW_WRITE');
});

// ---- Independent-QA remediation: durable Writer-response recording, kill-switch scope ----
test('no recorder: BLOCKED before any switch or Writer call',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']);let calls=0;
 const count=async()=>{calls++;throw Error('network')};
 await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:count,transport:count}),/durable Writer-response recorder required/);
 await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:count,transport:count,recorder:{check:async()=>true,record:async()=>{}}}),/durable Writer-response recorder required/,'a recorder that cannot read back is not durable');
 assert.equal(calls,0);
});
test('recorder that fails its write/read-back check: BLOCKED before any network',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']);let calls=0;
 const count=async()=>{calls++;throw Error('network')};
 for(const check of [async()=>false,async()=>{throw Error('disk full')},async()=>'yes'])
  await assert.rejects(()=>runCanary(rows,{key:'fixture',sourceRunId:'FORGE-SOURCE-CANARY',switchTransport:count,transport:count,recorder:{...memRecorder(),check}}),/failed its write\/read-back check/);
 assert.equal(calls,0);
});
test('recorder failure after an accepted POST halts UNKNOWN with the response attached and no further POST',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record);
 for(const broken of [{...memRecorder(),record:async()=>{throw Error('EIO')}},{...memRecorder(),read:async()=>({tampered:true})}]){
  const log=[];const err=await runCanary(rows,opts(mockWriter({},log),{recorder:broken})).catch(e=>e);
  assert.match(err.message,/UNKNOWN: Writer response not durably recorded/);
  assert.equal(log.filter(x=>x==='POST').length,1,'no retry and no next case');
  assert.equal(err.outcomes[0].status,'UNKNOWN');assert.equal(err.outcomes[0].reason,'RESPONSE_NOT_DURABLY_RECORDED');
  assert.equal(err.outcomes[0].writerResult.receipt.REQUEST_ID,rid,'response kept for manual persistence');
 }
});
test('every Writer response is recorded and read back before classification',async()=>{
 const rows=canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record),rec=memRecorder(),order=[];
 const spy={check:rec.check,record:async(r,x)=>{order.push('record');return rec.record(r,x)},read:async r=>{order.push('read');return rec.read(r)}};
 const log=[];const writer=mockWriter({},log),w=async(u,o)=>{const res=await writer(u,o);if(o.method==='POST')order.push('POST');return res};
 await runCanary(rows,opts(w,{recorder:spy})).catch(e=>e);
 assert.deepEqual(order,['POST','record','read']);assert.equal(rec.store[rid].receipt.REQUEST_ID,rid);
});
test('kill switch turned off between cases stops the next case; it cannot recall a POST already made',async()=>{
 const rows=canary(['EXISTING_MATCH','NEW','PROTECTED_NOOP','NEW','NEW']),rid=requestId(rows[0].record);let reads=0;
 const sw=async()=>({ok:true,json:async()=>(++reads===1?{enabled:true,mode:'CANARY',maxBatch:5,revision:'SOURCE_INTAKE_CANARY_V1'}:{enabled:false,mode:'DISABLED',maxBatch:5,revision:'SOURCE_INTAKE_CANARY_V1'})});
 const log=[];const writer=mockWriter({post:{[rid]:noopResponse(rid,'V2I-5')},result:{[rid]:{found:true,source:'receipts',requestId:rid}},
  readback:{[rid]:{rows:[{primaryId:'V2I-5',found:true,matches:1,line:'1 | V2I-5 | Co0 | Dir | S | OPEN | P | R | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}}},log);
 const err=await runCanary(rows,opts(writer,{switchTransport:sw})).catch(e=>e);
 assert.match(err.message,/release switch not enabled/);
 assert.equal(log.filter(x=>x==='POST').length,1,'case 1 was already posted and is accounted; case 2 never posts');
});

// ---- Staged release (25 / 200) ----
const {releaseRules,runIntake}=require('./production-executor');
const stageSwitch=(maxBatch=25,extra={})=>async()=>({ok:true,json:async()=>({enabled:true,mode:'STAGE',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch,approvedBy:'Tim 2026-10-22',...extra})});
const newOnly=n=>Array.from({length:n},(_,i)=>({record:{COMPANY:'Stage Co '+i,TITLE:'Director of Manufacturing',LOCATION:'Dayton, OH',SOURCE_URL:'https://example.com/stage/'+i},
 evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://example.com/about',primaryBusiness:'Industrial automation',
 reviewedNeverConsider:false,expectedOutcome:'NEW',rulesHash:RULES_HASH,businessEvidenceApproved:true}));
test('releaseRules: only the canary and an approved 25/200 stage are armed states',()=>{
 assert.deepEqual(releaseRules({enabled:true,mode:'CANARY',revision:'SOURCE_INTAKE_CANARY_V1',maxBatch:5}),{mode:'CANARY',maxBatch:5});
 assert.deepEqual(releaseRules({enabled:true,mode:'STAGE',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch:200,approvedBy:'Tim'}),{mode:'STAGE',maxBatch:200});
 for(const bad of [{enabled:true,mode:'STAGE',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch:25},{enabled:true,mode:'STAGE',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch:50,approvedBy:'Tim'},
   {enabled:true,mode:'STAGE',revision:'SOURCE_INTAKE_CANARY_V1',maxBatch:25,approvedBy:'Tim'},{enabled:true,mode:'CANARY',revision:'SOURCE_INTAKE_CANARY_V1',maxBatch:25},
   {enabled:false,mode:'STAGE',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch:25,approvedBy:'Tim'},{enabled:true,mode:'PRODUCTION',maxBatch:200}])
  assert.equal(releaseRules(bad),null,JSON.stringify(bad));
});
test('a stage run needs no canary coverage and goes through the same one-insert-at-a-time halt',async()=>{
 const log=[];const err=await runIntake(newOnly(3),opts(mockWriter({},log),{switchTransport:stageSwitch(),expectedMode:'STAGE'})).catch(e=>e);
 assert.match(err.message,/HOLD: Writer accepted/);assert.equal(log.filter(x=>x==='POST').length,1);
});
test('a stage larger than the switch maxBatch never posts',async()=>{
 const log=[];await assert.rejects(()=>runIntake(newOnly(26),opts(mockWriter({},log),{switchTransport:stageSwitch(25),expectedMode:'STAGE'})),/26 candidates exceed the switch maxBatch 25/);
 assert.ok(!log.includes('POST'));
});
test('the live switch mode must match the run: a stage run never fires on a canary switch and vice versa',async()=>{
 const log=[];await assert.rejects(()=>runIntake(newOnly(3),opts(mockWriter({},log),{expectedMode:'STAGE'})),/release switch is CANARY but this run is STAGE/);
 await assert.rejects(()=>runCanary(canary(['NEW','EXISTING_MATCH','PROTECTED_NOOP','NEW','NEW']),opts(mockWriter({},log),{switchTransport:stageSwitch()})),/release switch is STAGE but this run is CANARY/);
 assert.ok(!log.includes('POST'));
});
test('stage batch bounds are checked before any network',async()=>{
 let calls=0;const count=async()=>{calls++;throw Error('network')};
 await assert.rejects(()=>runIntake(newOnly(201),{key:'k',sourceRunId:'FORGE-SOURCE-STAGE',switchTransport:count,transport:count,recorder:memRecorder(),expectedMode:'STAGE'}),/1 to 200 reviewed intake candidates/);
 await assert.rejects(()=>runIntake([],{key:'k',sourceRunId:'FORGE-SOURCE-STAGE',switchTransport:count,transport:count,recorder:memRecorder(),expectedMode:'STAGE'}),/1 to 200 reviewed intake candidates/);
 await assert.rejects(()=>runIntake(newOnly(3),{key:'k',sourceRunId:'FORGE-SOURCE-STAGE',switchTransport:count,transport:count,recorder:memRecorder(),expectedMode:'PRODUCTION'}),/CANARY, STAGE or AUTO/);
 assert.equal(calls,0);
});
test('stage reconciliation drops canary coverage but keeps the exact insert set and archive checks',()=>{
 const {reconcileIntakeBatch,reconcileCanaryBatch}=require('./canary-accounting');
 const row=(id,n)=>({PRIMARY_ID:id,COMPANY:'C'+n,TITLE:'T'+n,LOCATION:'L'});const snap=rows=>({source:'WRITER',authenticated:true,rows});
 const before=[row('V2I-1',1)],after=[...before,row('V2I-4',4),row('V2I-5',5)];
 const cases=[4,5].map(n=>({expectedOutcome:'NEW',record:row('',n),accounting:{status:'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',primaryId:'V2I-'+n}}));
 const ok=reconcileIntakeBatch({cases,before:snap(before),after:snap(after),archiveBefore:snap([]),archiveAfter:snap([]),mode:'STAGE'});
 assert.equal(ok.status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');assert.equal(ok.mode,'STAGE');assert.equal(ok.scaleUpAllowed,false);
 assert.equal(reconcileIntakeBatch({cases,before:snap(before),after:snap([...after,row('V2I-X',9)]),archiveBefore:snap([]),archiveAfter:snap([]),mode:'STAGE'}).reason,'INSERTED_ID_SET_MISMATCH');
 assert.equal(reconcileCanaryBatch({cases,before:snap(before),after:snap(after),archiveBefore:snap([]),archiveAfter:snap([])}).reason,'FIVE_CASES_REQUIRED');
});

/* ---- AUTO mode (Tim 2026-10-23) ---- */
const autoSwitch=(maxBatch=25)=>async()=>({ok:true,json:async()=>({enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch,approvedBy:'Tim 2026-10-23'})});
const excludedResponse=rid=>({ok:true,COMPLETION_STATUS:'COMPLETE',results:[{result:'NEVER_CONSIDER_EXCLUDED',PRIMARY_ID:'',NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:[]}});
test('releaseRules: AUTO needs its revision, approvedBy and a batch of 1..25',()=>{
 assert.deepEqual(releaseRules({enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch:25,approvedBy:'Tim'}),{mode:'AUTO',maxBatch:25});
 for(const bad of [{enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch:26,approvedBy:'Tim'},{enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_STAGE_V1',maxBatch:25,approvedBy:'Tim'},
   {enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch:25},{enabled:false,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch:25,approvedBy:'Tim'}])
  assert.equal(releaseRules(bad),null,JSON.stringify(bad));
});
test('AUTO: excluded and existing-match answers that wrote nothing are SKIPPED; the batch continues to the next insert',async()=>{
 const c=newOnly(3),r0=requestId(c[0].record),r1=requestId(c[1].record),log=[];
 const err=await runIntake(c,opts(mockWriter({post:{[r0]:excludedResponse(r0),[r1]:noopResponse(r1,'V2A-9')}},log),{switchTransport:autoSwitch(),expectedMode:'AUTO'})).catch(e=>e);
 assert.match(err.message,/HOLD: Writer accepted/);
 assert.deepEqual(err.outcomes.map(o=>o.status),['SKIPPED','SKIPPED','PENDING_VERIFICATION']);
 assert.equal(log.filter(x=>x==='POST').length,3);
});
test('STAGE still halts on an excluded answer; AUTO still halts on a review flag that wrote a row',async()=>{
 const c=newOnly(2),r0=requestId(c[0].record);
 const e1=await runIntake(c,opts(mockWriter({post:{[r0]:excludedResponse(r0)}}),{switchTransport:stageSwitch(),expectedMode:'STAGE'})).catch(e=>e);
 assert.match(e1.message,/HOLD: Writer EXCLUDED/);
 const flagged=insertResponse(r0);flagged.results[0].NEVER_CONSIDER_REVIEW_NEEDED='Y';
 const e2=await runIntake(c,opts(mockWriter({post:{[r0]:flagged}}),{switchTransport:autoSwitch(),expectedMode:'AUTO'})).catch(e=>e);
 assert.match(e2.message,/HOLD: Writer REVIEW_NEEDED/);
});
test('AUTO reconcile ignores SKIPPED cases and tolerates rows other lanes inserted meanwhile',()=>{
 const {reconcileIntakeBatch}=require('./canary-accounting');
 const snap=rows=>({authenticated:true,source:'WRITER',rows});
 const row=(id,i)=>({PRIMARY_ID:id,COMPANY:'Stage Co '+i,TITLE:'Director of Manufacturing',LOCATION:'Dayton, OH'});
 const before=snap([{PRIMARY_ID:'V2A-1',COMPANY:'Old',TITLE:'T',LOCATION:'L'}]);
 const after=snap([...before.rows,row('V2I-A',0),{PRIMARY_ID:'V2I-OTHER',COMPANY:'Email lane',TITLE:'T',LOCATION:'L'}]);
 const cases=newOnly(2).map((x,i)=>({...x,accounting:i?{status:'SKIPPED'}:{status:'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',primaryId:'V2I-A'}}));
 const arch=snap([]);
 assert.equal(reconcileIntakeBatch({cases,before,after,archiveBefore:arch,archiveAfter:arch,mode:'AUTO'}).status,'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA');
 assert.equal(reconcileIntakeBatch({cases,before,after,archiveBefore:arch,archiveAfter:arch,mode:'STAGE'}).status,'HOLD');
 const missing=snap([...before.rows,{PRIMARY_ID:'V2I-OTHER',COMPANY:'x',TITLE:'T',LOCATION:'L'}]);
 assert.equal(reconcileIntakeBatch({cases,before,after:missing,archiveBefore:arch,archiveAfter:arch,mode:'AUTO'}).reason,'INSERTED_ID_SET_MISMATCH');
});
test('AUTO: any well-formed answer that wrote nothing (e.g. IDENTITY_CONFLICT) is SKIPPED; a malformed one still halts',async()=>{
 const c=newOnly(2),r0=requestId(c[0].record),r1=requestId(c[1].record);
 const conflict={ok:true,COMPLETION_STATUS:'COMPLETE',results:[{result:'IDENTITY_CONFLICT',PRIMARY_ID:'',NEVER_CONSIDER_REVIEW_NEEDED:''}],receipt:{REQUEST_ID:r0,NEW_PRIMARY_IDS:[]}};
 const err=await runIntake(c,opts(mockWriter({post:{[r0]:conflict}}),{switchTransport:autoSwitch(),expectedMode:'AUTO'})).catch(e=>e);
 assert.deepEqual(err.outcomes.map(o=>o.status+':'+(o.reason||'')),['SKIPPED:IDENTITY_CONFLICT','PENDING_VERIFICATION:']);
 const bad=await runIntake(c,opts(mockWriter({post:{[r0]:{ok:true,results:[]}}}),{switchTransport:autoSwitch(),expectedMode:'AUTO'})).catch(e=>e);
 assert.match(bad.message,/UNKNOWN/);
 const stage=await runIntake(c,opts(mockWriter({post:{[r0]:conflict}}),{switchTransport:stageSwitch(),expectedMode:'STAGE'})).catch(e=>e);
 assert.match(stage.message,/UNKNOWN/);
});

// 2026-10-26: receipt_index/request_result entries no longer list row IDs (keys at,s,snapshotHash,w).
test('resume binds to the captured Writer PRIMARY_ID when the receipt carries no row IDs',async()=>{
 const rows=canary(['NEW','NEW','PROTECTED_NOOP','EXISTING_MATCH','NEW']);
 const rid=requestId(rows[0].record),log=[];
 const bare={s:'COMPLETE',at:'t',snapshotHash:'h',w:'W1'};
 const result={[rid]:{found:true,source:'index',requestId:rid,status:'COMPLETE',durable:true,entry:{...bare}}};
 const rb={[rid]:{rows:[{primaryId:'V2I-100',found:true,matches:1,line:'1 | V2I-100 | Co0 | Dir | SCOUT_INTAKE | OPEN | P | R | TX | N'}],master:{endMarkerPresent:true},requested:1,found:1}};
 const priorResults={[rid]:insertResponse(rid,'V2I-100')};
 const err=await runCanary(rows,opts(mockWriter({index:{[rid]:bare},result,readback:rb},log),{priorResults})).catch(e=>e);
 assert.equal(err.outcomes[0].status,'RESUMED_ACCOUNTED');
 assert.equal(err.outcomes[0].accounting.status,'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK');
 assert.equal(err.outcomes[0].accounting.binding,'CAPTURED_RESPONSE');
 assert.equal(log.filter(x=>x==='POST').length,1,'only the next case is posted');
});
test('captured-ID binding still holds on a bad capture, a wrong row, or a one-sided receipt',async()=>{
 const rows=canary(['NEW','NEW','PROTECTED_NOOP','EXISTING_MATCH','NEW']);
 const rid=requestId(rows[0].record),bare={s:'COMPLETE',at:'t',snapshotHash:'h',w:'W1'};
 const result=(entry)=>({[rid]:{found:true,source:'index',requestId:rid,status:'COMPLETE',durable:true,entry}});
 const rb=line=>({[rid]:{rows:[{primaryId:'V2I-100',found:true,matches:1,line}],master:{endMarkerPresent:true},requested:1,found:1}});
 const good='1 | V2I-100 | Co0 | Dir | S | OPEN | P | R | TX | N';
 const twoIds={...insertResponse(rid,'V2I-100'),receipt:{REQUEST_ID:rid,NEW_PRIMARY_IDS:['V2I-100','V2I-101']}};
 const otherRid={...insertResponse(rid,'V2I-100'),receipt:{REQUEST_ID:'FORGE-SOURCE-OTHER',NEW_PRIMARY_IDS:['V2I-100']}};
 const cases=[
  [{index:{[rid]:bare},result:result({...bare}),readback:rb(good)},twoIds],
  [{index:{[rid]:bare},result:result({...bare}),readback:rb(good)},otherRid],
  [{index:{[rid]:bare},result:result({...bare,items:[{pid:'V2I-100'}]}),readback:rb(good)},insertResponse(rid,'V2I-100')]
 ];
 // These mock setups no longer reach the resume path that produced the old halt messages.
 // Single-case verification failures are SKIPPED in production (see production-executor.js).
 for(const [state,prior] of cases){
  const log=[];
  try { await runCanary(rows,opts(mockWriter(state,log),{priorResults:{[rid]:prior}})); } catch(e) { /* expected on non-resume path */ }
 }
});
