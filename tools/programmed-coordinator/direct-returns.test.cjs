'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('./direct-returns.cjs'),S=require('./store.cjs'),C=require('./collect.cjs'),Run=require('./run.cjs'),T=require('./transactions.cjs');
function dir(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'direct-returns-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const task='FORGE_CLAUDE_SHARED_HELPER',rel='receipts/CLAUDE_HELPERS/'+task+'/FORGE-CLAUDE-DIRECT.json';
test('explicit batch scopes are narrow and provider-neutral; malformed/unknown CLI fails',()=>{
 a.deepEqual(D.arguments(['--returns-only','--batch',rel,'--batch',rel]),{returnsOnly:true,batches:[rel]});
 a.deepEqual(D.arguments([]),{returnsOnly:false,batches:[]});
 for(const args of [['--batch',rel],['--returns-only','--batch','../secret'],['--returns-only','--batch'],['--bogus']])a.throws(()=>D.arguments(args));
});
test('all registered supported evidence schemas select without admitting private outcomes or unknown batches',t=>{
 const root=dir(t),state=C.empty();let n=0;
 for(const schema of [...D.SCHEMAS,'forge.outcome-helper-batch.v1','unknown']){
  const batch='receipts/test-'+(++n)+'.json',taskKey='REGISTERED-'+n,itemKey='key-'+n,item={key:'item-'+n,itemKey,taskKey,batch};
  S.save(root,batch,{schema,taskKey,items:[{key:itemKey,kind:'INTAKE'}]});state.items[item.key]=item;state.batches[batch]={status:'VALIDATED'};
 }
 const select=D.selector(root);a.equal(Object.values(state.items).filter(select).length,D.SCHEMAS.size);
 a.equal(D.intakeKeys(root,state,select).size,D.SCHEMAS.size);
 a.equal(D.selector(root,['receipts/test-2.json'])(state.items['item-2']),true);a.equal(D.selector(root,['receipts/test-2.json'])(state.items['item-1']),false);
 a.equal(select({batch:'missing',taskKey:'missing'}),false);
});
function fixture(t){
 const root=dir(t),privateDir=dir(t),id='V2I-ONE',taskKey=task,row={PRIMARY_ID:id,COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{},line:'row'},at=new Date().toISOString();
 const sourceEvidence={company:row.COMPANY,title:row.TITLE,location:row.LOCATION,url:'https://careers.factory.example/jobs/1',observedAt:at,sourceSha256:'a'.repeat(64),quote:'Bachelor degree preferred.'};
 const item={primaryId:id,kind:'ENRICHMENT',provider:'Claude',taskKey,assignmentVersion:1,sourceVersion:'b'.repeat(64),writerSubmitted:false,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence};
 const batch={schema:'forge.shared-helper-batch.v1',provider:'Claude',taskKey,assignmentId:'TEST',runId:'FORGE-CLAUDE-DIRECT',instructionCommit:'c'.repeat(40),items:[item]};
 S.save(root,rel,batch);S.save(root,'control/SHARED_HELPER_WORK.json',{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,assignmentId:'TEST',providers:{[taskKey]:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:true}},items:[{...item,status:'ASSIGNED'}]});
 S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:{owner:'Claude',workAssignments:'control/SHARED_HELPER_WORK.json'}}});
 const key=taskKey+':'+id,state=C.empty();state.batches[rel]={status:'VALIDATED'};state.items[key]={key,itemKey:id,taskKey,batch:rel,version:S.hash(item),status:'RETURNED',attempts:0};state.items.unrelated={key:'unrelated',status:'RETURNED',batch:'receipts/unrelated.json',attempts:0};
 const select=D.selector(root,[rel]),snapshot={rows:[row],archiveRows:[],status:{freeze:null,level:'OK',errors:[],unverified:{count:0}}};
 return{root,privateDir,key,state,select,row,snapshot,apply:true,runId:'FORGE-CODE-CHATGPT-DIRECT',sourceVerify:async()=>({degree:{req:'PREFERRED',text:'Bachelor degree preferred.'},sourceUrl:sourceEvidence.url,observedAt:at,sourceSha256:'a'.repeat(64)})};
}
test('direct inspection and Writer submission preserve the full ledger and verify only exact returned effects',async t=>{
 const f=fixture(t),untouched=structuredClone(f.state.items.unrelated);await Run.inspectReturns(f);a.equal(f.state.items[f.key].status,'READY_ENRICHMENT');a.deepEqual(S.read(f.root,'state/PROGRAMMED_COORDINATOR.json').items.unrelated,untouched);
 let posts=0;f.deps={checkLock(){},snapshot:async()=>f.snapshot,exists:async()=>false,post:async payload=>{posts++;return{mode:'BATCH_RULING_NO_WRITE',results:payload.requests.map(r=>({requestId:r.ruling.requestId,ok:true}))};},original:async()=>null,rows:async()=>({startedAt:new Date().toISOString(),rows:[{...f.row,p:f.state.items[f.key].prepared.fields}]})};
 await Run.submitEnrichment(f);a.equal(posts,1);a.equal(f.state.items[f.key].status,'VERIFIED');a.deepEqual(f.state.items.unrelated,untouched);
 await Run.submitEnrichment(f);a.equal(posts,1);a.deepEqual(S.read(f.root,'state/PROGRAMMED_COORDINATOR.json').items.unrelated,untouched);
});
test('direct path retains protected and original fences and rechecks ownership immediately before POST',async t=>{
 for(const why of ['protected','pending','ownership']){
  const f=fixture(t);if(why==='protected')f.snapshot.rows[0].p.TIM_DECISION='DECLINE';if(why==='pending')f.state.transactions.ORIGINAL={requestId:'ORIGINAL',status:'POST_IN_FLIGHT_UNKNOWN',ids:['V2I-ONE']};
  await Run.inspectReturns(f);let posts=0;f.deps={checkLock(){},snapshot:async()=>f.snapshot,exists:async()=>false,post:async()=>{posts++;}};
  if(why==='ownership'){const work=S.read(f.root,'control/SHARED_HELPER_WORK.json');work.items[0].assignmentVersion++;S.save(f.root,'control/SHARED_HELPER_WORK.json',work);}
  await Run.submitEnrichment(f);a.equal(posts,0,why);a.notEqual(f.state.items[f.key].status,'VERIFIED');
  if(why==='pending')a.equal(T.fenced(f.root,f.state,'V2I-ONE'),true);
 }
});
test('capture imports existing evidence through validator/routing without browser/mail or outcome imports',t=>{
 const f=fixture(t),batch=S.read(f.root,rel);fs.unlinkSync(path.join(f.root,rel));S.save(f.privateDir,'helper-inbox/forge-helper-test.json',batch);
 S.save(f.privateDir,'helper-inbox/forge-helper-outcome.json',{schema:'forge.outcome-helper-batch.v1',taskKey:'PRIVATE_OUTCOME',items:[]});
 let routing=0;t.mock.method(C,'routingProof',()=>{routing++;return{currentPolicyRecheckRequired:true};});
 const report=D.capture({...f,commit:'c'.repeat(40),config:{inboxes:[]}});a.equal(report.imported,1);a.deepEqual(report.exceptions,[]);a.equal(routing,1);a.equal(report.browserPolling,false);a.equal(report.mailProcessing,false);a.equal(report.writerSubmissions,0);a.deepEqual(S.read(f.root,rel),batch);
 a.equal(D.capture({...f,commit:'c'.repeat(40),config:{inboxes:[]}}).imported,0);
 const before=fs.readFileSync(path.join(f.root,D.FILE),'utf8');D.capture({...f,apply:false});a.equal(fs.readFileSync(path.join(f.root,D.FILE),'utf8'),before);
});
test('an explicitly missing or quarantined batch is an actionable exception, never a successful no-op',()=>{
 const state=C.empty();D.checkSelected(state,[rel]);a.equal(state.exceptions['direct-return:'+rel].reason,'SELECTED_RETURN_NOT_CAPTURED');
 state.batches[rel]={status:'QUARANTINED'};D.checkSelected(state,[rel]);a.equal(state.exceptions['direct-return:'+rel].reason,'SELECTED_RETURN_NOT_VALIDATED');
 state.batches[rel].status='VALIDATED';D.checkSelected(state,[rel]);a.equal(state.exceptions['direct-return:'+rel],undefined);
});
test('direct completion settles only its current shared reservation without new assignments or repeated research',t=>{
 const f=fixture(t),file='control/SHARED_HELPER_WORK.json',work=S.read(f.root,file);work.items[0].missingFields=['DEGREE','SALARY'];work.items.push({...work.items[0],primaryId:'V2I-OTHER'});S.save(f.root,file,work);
 f.state.items[f.key].status='VERIFIED';f.state.items[f.key].proof='receipts/verified.json';f.snapshot.rows[0].p.DEGREE_REQ='PREFERRED';let checks=0;
 let out=D.settleShared({...f,checkLock(){checks++;}}),saved=S.read(f.root,file);a.equal(out.newAssignments,0);a.equal(checks,1);a.equal(saved.items[0].status,'RETURNED_PARTIALLY_CONSUMED');a.deepEqual(saved.items[0].remainingFields,['SALARY']);a.deepEqual(saved.items[1],work.items[1]);
 f.snapshot.rows[0].p.SALARY_BASE_LOW='100000';D.settleShared({...f,checkLock(){}});a.equal(S.read(f.root,file).items[0].status,'CONSUMED');
});
test('ordinary scheduled apply processes returned enrichment before unrelated mail/intake and refreshes its canonical snapshot',async t=>{
 const f=fixture(t),events=[];f.sourceVerify=async()=>{events.push('source');return{degree:{req:'PREFERRED',text:'Bachelor degree preferred.'},sourceUrl:'https://careers.factory.example/jobs/1',observedAt:new Date().toISOString(),sourceSha256:'a'.repeat(64)};};
 const refreshed={...f.snapshot,source:{readAt:new Date().toISOString()},rows:[{...f.row,p:{DEGREE_REQ:'PREFERRED'}}]};
 f.deps={checkLock(){events.push('lock');},snapshot:async()=>{events.push('snapshot');return refreshed;},exists:async()=>false,post:async p=>{events.push('post');return{mode:'BATCH_RULING_NO_WRITE',results:p.requests.map(r=>({requestId:r.ruling.requestId,ok:true}))};},original:async()=>null,rows:async()=>{events.push('verify');return{startedAt:new Date().toISOString(),rows:[{...f.row,p:f.state.items[f.key].prepared.fields}]};}};
 const snapshot=await Run.processReturnedEvidence(f);events.push('downstream');a.equal(snapshot,refreshed);a.equal(f.state.items[f.key].status,'VERIFIED');a.ok(events.indexOf('source')<events.indexOf('post'));a.ok(events.indexOf('post')<events.indexOf('verify'));a.ok(events.lastIndexOf('snapshot')<events.indexOf('downstream'));
 const main=Run.main.toString();a.ok(main.indexOf('await processReturnedEvidence(')<main.indexOf("mail-pipeline.cjs"));a.ok(main.indexOf('await processReturnedEvidence(')<main.indexOf("['prepare','--apply']"));a.equal((main.match(/await processReturnedEvidence\(/g)||[]).length,1);
});
test('new source parser retries only corrected failure classes once while transaction and protected fences remain intact',async t=>{
 const Source=require('./source.cjs');
 for(const reason of ['SOURCE_ROUTE_BACKOFF','FIT_RESUME_MAPPING_REQUIRED','STRUCTURED_POSTING_UNAVAILABLE']){
  const f=fixture(t),item=f.state.items[f.key];let reads=0;
  item.status='EXCEPTION';item.sourceParserVersion='old';item.retryAfter='9999-01-01T00:00:00Z';f.state.exceptions[f.key]={reason};
  f.sourceVerify=async()=>{reads++;throw Error(reason);};await Run.inspectReturns(f);a.equal(reads,1,reason);a.equal(item.sourceParserVersion,Source.PARSER_VERSION);
  await Run.inspectReturns(f);a.equal(reads,1,reason+' must not loop on unchanged failure');
 }
 for(const mode of ['verified','transaction','protected','uncorrected']){
  const f=fixture(t),item=f.state.items[f.key];let reads=0;item.status='EXCEPTION';item.sourceParserVersion='old';item.retryAfter='9999-01-01T00:00:00Z';f.state.exceptions[f.key]={reason:'SOURCE_ROUTE_BACKOFF'};
  if(mode==='verified')item.status='VERIFIED';if(mode==='transaction')item.transactionId='ORIGINAL';if(mode==='protected')f.row.p.TIM_DECISION='DECLINE';if(mode==='uncorrected')f.state.exceptions[f.key].reason='FIT_QUOTE_NOT_IN_POSTING';
  f.sourceVerify=async()=>{reads++;throw Error('should not run');};await Run.inspectReturns(f);a.equal(reads,0,mode);
 }
});
