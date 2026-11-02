'use strict';
const {test}=require('node:test'), a=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const S=require('./store.cjs'), C=require('./collect.cjs'), T=require('./transactions.cjs'), Source=require('./source.cjs'), Run=require('./run.cjs');
function dir(t) { const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-code-test-'));t.after(()=>{a.ok(path.resolve(p).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(p,{recursive:true,force:true});});return p; }
const itemKey='FORGE_GROK_ENRICHMENT:V2I-ONE';
const row=()=>({PRIMARY_ID:'V2I-ONE',COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{},line:'canonical line'});
const status=()=>({freeze:null,level:'ok',errors:[],unverified:{count:0}});
function transaction(t,post=async()=>{throw Error('network timeout');}) {
  const root=dir(t),privateDir=dir(t),state=C.empty();state.items[itemKey]={key:itemKey,status:'READY_ENRICHMENT'};
  const job={itemKey,primaryId:'V2I-ONE',identity:T.identity(row()),fields:{DEGREE_REQ:'PREFERRED'},sourceSha256:'a'.repeat(64)};
  const deps={checkLock:()=>{},snapshot:async()=>({rows:[row()],status:status()}),exists:async()=>false,post,original:async()=>null,
    index:async()=>({sha:'b'.repeat(40),index:{requests:{}}}),rows:async()=>({startedAt:new Date().toISOString(),rows:[{...row(),p:job.fields}]})};
  return {root,privateDir,state,jobs:[job],runId:'FORGE-CODE-TEST',deps};
}
test('pre-POST checkpoint survives uncertain send and excludes a replay after restart',async t=>{
  const f=transaction(t);let posts=0;
  f.deps.post=async()=>{posts++;a.equal(S.read(f.root,'state/PROGRAMMED_COORDINATOR.json').items[itemKey].status,'POST_IN_FLIGHT_UNKNOWN');throw Error('timeout');};
  const tx=await T.submit(f);a.equal(tx.status,'POST_IN_FLIGHT_UNKNOWN');
  const restarted=S.read(f.root,'state/PROGRAMMED_COORDINATOR.json');
  await a.rejects(T.submit({...f,state:restarted}),/FENCE/);a.equal(posts,1);
  a.equal(await T.reconcile({...f,state:restarted,tx:restarted.transactions[tx.requestId]}),'POST_IN_FLIGHT_UNKNOWN');a.equal(posts,1);
});
test('independent COMPLETE plus exact later effects is required; acceptance flag alone is insufficient',async t=>{
  const f=transaction(t),rid='FORGE-CODE-TEST-E00001',child=rid+'-R1';
  f.deps.post=async()=>({WRITE_ACCEPTED:false,writeId:'W-1',results:[{requestId:child,primaryId:'V2I-ONE',ok:true}]});
  const tx=await T.submit(f);
  a.equal(await T.reconcile({...f,tx}),'AWAITING_VERIFICATION');
  f.deps.index=async()=>({sha:'b'.repeat(40),index:{requests:{[child]:{s:'COMPLETE',w:'W-1',items:[{pid:'V2I-ONE'}]}}}});
  a.equal(await T.reconcile({...f,tx}),'VERIFIED');a.equal(f.state.items[itemKey].status,'VERIFIED');
  a.equal(S.read(f.root,'receipts/'+rid+'_VERIFIED.json').claimedCompletedJobs,0);
  tx.status='AWAITING_VERIFICATION';await new Promise(r=>setTimeout(r,2));a.equal(await T.reconcile({...f,tx}),'VERIFIED');
});
test('verified field effects release only fully satisfied helper assignments',async t=>{
 const f=transaction(t),rid='FORGE-CODE-TEST-E00001',child=rid+'-R1';
 S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',{items:[{primaryId:'V2I-ONE',taskKey:'FORGE_GROK_ENRICHMENT',missingFields:['DEGREE','SALARY'],status:'RETURNED_PENDING_REVIEW'}]});
 f.deps.post=async()=>({writeId:'W-1',results:[{requestId:child,ok:true}]});
 f.deps.index=async()=>({sha:'b'.repeat(40),index:{requests:{[child]:{s:'COMPLETE',w:'W-1',items:[{pid:'V2I-ONE'}]}}}});
 const tx=await T.submit(f);await T.reconcile({...f,tx});
 a.equal(S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json').items[0].status,'RETURNED_PARTIALLY_CONSUMED');
 tx.status='AWAITING_VERIFICATION';f.deps.rows=async()=>({startedAt:new Date().toISOString(),rows:[{...row(),p:{...f.jobs[0].fields,SALARY_BASE_LOW:'100000'}}]});
 await T.reconcile({...f,tx});a.equal(S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json').items[0].status,'CONSUMED');
});
test('wrong receipt write ID, early readback or wrong row fields never verify',async t=>{
  const f=transaction(t),rid='FORGE-CODE-TEST-E00001',child=rid+'-R1';
  f.deps.post=async()=>({writeId:'W-1',results:[{requestId:child,ok:true}]});const tx=await T.submit(f);
  f.deps.index=async()=>({sha:'b'.repeat(40),index:{requests:{[child]:{s:'COMPLETE',w:'W-2',items:[{pid:'V2I-ONE'}]}}}});
  a.equal(await T.reconcile({...f,tx}),'AWAITING_VERIFICATION');
  f.deps.index=async()=>({sha:'b'.repeat(40),index:{requests:{[child]:{s:'COMPLETE',w:'W-1',items:[{pid:'V2I-ONE'}]}}}});
  f.deps.rows=async()=>({startedAt:'2020-01-01T00:00:00Z',rows:[]});await a.rejects(T.reconcile({...f,tx}),/EARLY/);
  f.deps.rows=async()=>({startedAt:new Date().toISOString(),rows:[row()]});await a.rejects(T.reconcile({...f,tx}),/EXACT_ROW/);
});
test('protected decisions, conflicting evidence and global Writer gates reject before POST',async t=>{
  const f=transaction(t);let posts=0;f.deps.post=async()=>{posts++;};
  f.deps.snapshot=async()=>({rows:[{...row(),BUCKET:'DECLINED_BY_TIM'}],status:status()});await a.rejects(T.submit(f),/FENCE/);
  f.deps.snapshot=async()=>({rows:[{...row(),p:{DEGREE_REQ:'REQUIRED'}}],status:status()});await a.rejects(T.submit(f),/CONFLICT/);
  f.deps.snapshot=async()=>({rows:[row()],status:{...status(),unverified:{count:1}}});await a.rejects(T.submit(f),/GATE/);a.equal(posts,0);
});
test('unresolved checkpoints from earlier coordinators fence exact IDs across the cutover',async t=>{
 const f=transaction(t);S.immutable(f.root,'receipts/OLD-RUN_CHECKPOINT.json',{requests:[{primaryId:'V2I-ONE',requestId:'OLD-1'}]});
 a.equal(T.fenced(f.root,f.state,'V2I-ONE'),true);await a.rejects(T.submit(f),/FENCE/);
 S.immutable(f.root,'receipts/OLD-RUN_VERIFIED.json',{proofs:[{primaryId:'V2I-ONE'}]});a.equal(T.fenced(f.root,f.state,'V2I-ONE'),false);
});
test('partial/rejected child results remain held even with an otherwise COMPLETE receipt',async t=>{
  const f=transaction(t);f.deps.post=async()=>({writeId:'W',results:[{requestId:'FORGE-CODE-TEST-E00001-R1',ok:false}]});
  const tx=await T.submit(f);a.equal(await T.reconcile({...f,tx}),'HELD');a.notEqual(f.state.items[itemKey].status,'VERIFIED');
});
test('zero-write result requires exact current effects and never claims a new write',async t=>{
  const f=transaction(t);f.deps.post=async()=>({mode:'BATCH_RULING_NO_WRITE',results:[{requestId:'FORGE-CODE-TEST-E00001-R1',ok:true}]});
  const tx=await T.submit(f);a.equal(await T.reconcile({...f,tx}),'VERIFIED');
  a.equal(S.read(f.root,'receipts/'+tx.requestId+'_VERIFIED.json').noWrite,true);
});
const description='We run a precision manufacturing facility. '.repeat(10)+'Bachelor degree preferred. Lead the production team.';
function html(job={}) {return '<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Plant Manager',hiringOrganization:{name:'Factory'},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description,...job})+'</script>';}
test('structured source inspection binds exact identity and quote without inferring absent degree',()=>{
  const expected=T.identity(row());a.equal(Source.inspect(html(),expected,'Bachelor degree preferred.').degree.req,'PREFERRED');
  a.throws(()=>Source.inspect(html(),{...expected,title:'Senior Plant Manager'}),/IDENTITY/);
  a.throws(()=>Source.inspect(html(),expected,'MBA required'),/QUOTE/);
  a.throws(()=>Source.inspect(html()+html(),expected),/AMBIGUOUS/);
  a.throws(()=>Source.inspect(html({description:'short'}),expected),/INCOMPLETE/);
  a.equal(Source.inspect(html({description:'Production facility leadership and operational work. '.repeat(12)}),expected).degree,null);
});
test('pay must be explicitly structured annual USD base and source cache avoids repeated fetches',async t=>{
  const expected=T.identity(row()),privateDir=dir(t);let calls=0;
  const item={sourceEvidence:{url:'https://careers.factory.com/job/123',quote:'Bachelor degree preferred.'}};
  const fetchPage=async()=>{calls++;return{url:item.sourceEvidence.url,raw:html({baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:100000,maxValue:150000}}})};};
  const source=await Source.verify({item,expected,privateDir,fetchPage});a.equal(source.pay.low,100000);
  await Source.verify({item,expected,privateDir,fetchPage});a.equal(calls,1);
  a.equal(Source.inspect(html({baseSalary:{currency:'USD',value:{unitText:'HOUR',minValue:100000,maxValue:150000}}}),expected).pay,null);
  a.throws(()=>Source.publicUrl('https://careers.factory.com/job/123 (matching copy)'),/Invalid|URL/);
  for(const u of ['http://example.com','https://user:pass@example.com','https://127.0.0.1/a','https://private.local/a'])a.throws(()=>Source.publicUrl(u));
});
test('public HTTP transport allows public IPv4 and blocks private and mapped loopback addresses',async()=>{
 const transport=async()=>new Response('posting',{status:200});
 a.equal((await Source.page('https://example.com/job',{transport,lookup:async()=>[{address:'44.215.137.5',family:4}]})).raw,'posting');
 for(const address of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','::ffff:127.0.0.1','::1']) {
   await a.rejects(Source.page('https://example.com/job',{transport,lookup:async()=>[{address,family:address.includes(':')?6:4}]}),/NON_PUBLIC/);
 }
});
test('a throttled source route backs off in code without stopping a different host',async t=>{
 const privateDir=dir(t),expected=T.identity(row());let calls=0;
 const verify=url=>Source.verify({privateDir,expected,item:{sourceEvidence:{url}},fetchPage:async()=>{calls++;throw Error('SOURCE_HTTP_429');}});
 await a.rejects(verify('https://one.example.com/job/1'),/429/);
 await a.rejects(verify('https://one.example.com/job/2'),/BACKOFF/);a.equal(calls,1);
 await a.rejects(verify('https://two.example.com/job/1'),/429/);a.equal(calls,2);
});
test('successive transactions drain the entire eligible backlog with no run-count cap',async()=>{
  let remaining=2301,steps=0,reconciled=false;
  const result=await Run.drain({ready:async()=>remaining,reconcile:async()=>{reconciled=true;},step:async()=>{a.ok(reconciled);steps++;remaining=Math.max(0,remaining-100);}});
  a.equal(steps,24);a.equal(remaining,0);a.equal(result.exhausted,true);
  await a.rejects(Run.drain({ready:async()=>1,reconcile:async()=>{},step:async()=>{}}),/NO_DURABLE_PROGRESS/);
});
function collection(t) {
  const root=dir(t),taskKey='FORGE_GROK_INTAKE_HELPER',assignmentId='INTAKE-1',commit='a'.repeat(40);
  const task={owner:'Grok',route:'utility',procedure:'lanes/intake.txt',workAssignments:'control/work.json',executionMode:'EVIDENCE_ONLY'};
  const work={schema:'forge.intake-helper-work.v1',owner:'Grok',taskKey,enabled:true,routingActive:true,assignmentId,keys:['a','b']};
  const batch={schema:'forge.intake-helper-batch.v1',provider:'Grok',taskKey,assignmentId,runId:'GROK-INTAKE-TEST',instructionCommit:commit,observedAt:new Date().toISOString(),items:[{key:'a',writerSubmitted:false,targetedLookups:1,recommendation:'INTAKE_READY',sourceEvidence:{url:'https://example.com/a'}}]};
  const rel='receipts/GROK_HELPERS/'+taskKey+'/batch.json';
  S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:task}});S.save(root,'control/work.json',work);S.save(root,rel,batch);
  fs.mkdirSync(path.join(root,'lanes'),{recursive:true});fs.mkdirSync(path.join(root,'policy/current'),{recursive:true});
  fs.writeFileSync(path.join(root,task.procedure),'procedure\n');fs.writeFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'common\n');
  const historical=(_r,_c,file)=>file==='control/work.json'?JSON.stringify(work):fs.readFileSync(path.join(root,file),'utf8');
  return {root,task,work,batch,rel,commit,historical,state:C.empty()};
}
test('fresh routing accepts unchanged snapshots across bot commits, but rejects an inactive stale partition',t=>{
  const f=collection(t);a.equal(C.routingProof(f.root,f.batch,'b'.repeat(40),f.historical).checkedAgainst,'b'.repeat(40));
  const old={...f.work,routingActive:false};
  a.throws(()=>C.routingProof(f.root,f.batch,f.commit,(_r,_c,file)=>file==='control/work.json'?JSON.stringify(old):f.historical(_r,_c,file)),/STALE_ASSIGNMENT_ROUTING/);
});
test('collector is idempotent, lists invalid URLs and preserves immutable collisions',t=>{
  const f=collection(t),routing=()=>({});C.collect({...f,routing});a.equal(Object.keys(f.state.items).length,1);
  a.equal(C.collect({...f,routing}).newItems,0);
  S.save(f.root,f.rel,{...f.batch,items:[...f.batch.items,{...f.batch.items[0],key:'b',sourceEvidence:{url:''}}]});
  C.collect({...f,routing});a.equal(f.state.exceptions['batch:'+f.rel].reason,'IMMUTABLE_BATCH_CHANGED');
  const g=collection(t);g.batch.items[0].sourceEvidence.url='';S.save(g.root,g.rel,g.batch);C.collect({...g,routing});
  a.equal(g.state.batches[g.rel].status,'QUARANTINED');a.deepEqual(g.state.exceptions['batch:'+g.rel].invalidUrlKeys,['a']);a.equal(Object.keys(g.state.items).length,0);
});
test('per-item source ambiguity stays an exception while independent items continue',async t=>{
  const f=collection(t);f.batch.schema='forge.enrichment-helper-batch.v1';f.batch.taskKey='FORGE_GROK_ENRICHMENT';
  const make=(id)=>({primaryId:id,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{...T.identity(row()),url:'https://example.com/'+id}});
  f.batch.items=[make('V2I-ONE'),make('V2I-TWO')];S.save(f.root,f.rel,f.batch);
  for(const e of f.batch.items){const key=f.batch.taskKey+':'+e.primaryId;f.state.items[key]={key,taskKey:f.batch.taskKey,itemKey:e.primaryId,batch:f.rel,version:S.hash(e),status:'RETURNED',attempts:0};}
  f.state.batches[f.rel]={status:'VALIDATED'};const snapshot={rows:[row(),{...row(),PRIMARY_ID:'V2I-TWO'}]};
  const sourceVerify=async({item})=>{if(item.primaryId==='V2I-ONE')throw Error('SOURCE_IDENTITY_AMBIGUOUS');return{degree:{text:'Bachelor degree preferred.',req:'PREFERRED'},observedAt:new Date().toISOString(),sourceUrl:item.sourceEvidence.url,sourceSha256:'b'.repeat(64)};};
  await Run.inspectReturns({...f,privateDir:dir(t),snapshot,sourceVerify});
  a.equal(f.state.items['FORGE_GROK_ENRICHMENT:V2I-ONE'].status,'EXCEPTION');a.equal(f.state.items['FORGE_GROK_ENRICHMENT:V2I-TWO'].status,'READY_ENRICHMENT');
  a.equal(Run.publicReport(f.state,{coverageComplete:false},new Date().toISOString()).aiExceptions.length,1);
});
test('standard full-message templates use code; recruiter language and mixed notices need AI',()=>{
  const O=require('./outcome.cjs');
  a.equal(O.classify({body:'We have received your application.',fullBody:true}).type,'APPLICATION_CONFIRMED');
  a.equal(O.classify({body:'We will not be moving forward with your application.',fullBody:true}).type,'REJECTED_BY_EMPLOYER');
  a.equal(O.classify({body:'We have received your application. Please send your interview availability.',fullBody:true}).owner,'AI');
  a.equal(O.classify({body:'We have received your application.'}).reason,'FULL_MESSAGE_REQUIRED');
});
test('routing revalidation on a later bot commit does not reset item exceptions or lookup attempts',t=>{
  const f=collection(t),routing=()=>({});C.collect({...f,routing});const key=Object.keys(f.state.items)[0];
  Object.assign(f.state.items[key],{status:'EXCEPTION',attempts:1,retryAfter:'9999-01-01T00:00:00Z'});
  C.collect({...f,commit:'c'.repeat(40),routing});a.equal(f.state.items[key].attempts,1);a.equal(f.state.items[key].status,'EXCEPTION');
});
test('new helper facts survive an uncertain original and resume after its verification',t=>{
 const f=collection(t),routing=()=>({});C.collect({...f,routing});const key=Object.keys(f.state.items)[0];
 Object.assign(f.state.items[key],{status:'POST_IN_FLIGHT_UNKNOWN',transactionId:'OLD'});f.state.transactions.OLD={status:'POST_IN_FLIGHT_UNKNOWN'};
 const next={...f.batch,runId:'GROK-INTAKE-NEW',items:[{...f.batch.items[0],reason:'new fact'}]},rel=f.rel.replace('batch.json','new.json');S.save(f.root,rel,next);
 C.collect({...f,routing});a.equal(f.state.items[key].transactionId,'OLD');a.equal(f.state.items[key].deferredReturns.length,1);
 f.state.transactions.OLD.status='VERIFIED';C.collect({...f,routing});a.equal(f.state.items[key].status,'RETURNED');a.equal(f.state.items[key].batch,rel);a.equal(f.state.items[key].history[0].transactionId,'OLD');
});
test('externalized evidence verifies only against its exact stable canonical reference',async()=>{
 const Readback=require('./readback.cjs'),W={parseRows:line=>[{...row(),p:{EVIDENCE_REF:'EVC1:1'},line}]};let reads=0;
 const reader=async action=>action==='evidence'?{data:{active:true,primaryId:'V2I-ONE',evidenceRef:'EVC1:1',fields:{DEGREE_TEXT:'Bachelor preferred.'}}}:
  {data:{master:{endMarkerPresent:true},rows:[{primaryId:'V2I-ONE',found:true,matches:1,line:++reads>2?'changed':'canonical'}]}};
 const result=await Readback.rows({requestId:'REQ',ids:['V2I-ONE'],W,reader});
 a.equal(result.rows[0].p.DEGREE_TEXT,'Bachelor preferred.');a.equal(result.rows[0].evidenceProof.reference,'EVC1:1');
 reads=1;await a.rejects(Readback.rows({requestId:'REQ',ids:['V2I-ONE'],W,reader}),/ROW_CHANGED/);
 const bad=async(action,args)=>action==='evidence'?{data:{active:true,primaryId:'V2I-ONE',evidenceRef:'EVC1:2',fields:{}}}:reader(action,args);
 await a.rejects(Readback.rows({requestId:'REQ',ids:['V2I-ONE'],W,reader:bad}),/COMPANION/);
});
