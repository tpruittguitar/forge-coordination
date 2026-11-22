'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const W=require('./worker.cjs'),{fixture}=require('./fixture.cjs'),{response}=require('./responses.cjs');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-grant-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('31 synthetic jobs use resumable 15-job batches, exact counts and no Writer calls',async t=>{
 const f=fixture(31),dir=temp(t);let calls=0;
 f.adapter.simulate=async()=>{calls++;return f.result;};
 const first=await W.run({dir,adapter:f.adapter,now:f.now});
 a.equal(first.batches,3);a.equal(first.preparedJobs,31);a.equal(first.preparedFields,62);a.equal(first.writerSubmittedJobs,0);a.equal(first.writerVerifiedFields,0);
 a.equal(first.actualSpendMicrousd,0);a.equal(first.simulatedReservedMicrousd,31*2048);
 a.deepEqual(await W.run({dir,adapter:f.adapter,now:f.now}),first);a.equal(calls,31);
});
test('sufficient existing evidence consumes zero model budget',async t=>{
 const f=fixture(1);f.adapter.reuse=async()=>f.result;f.adapter.simulate=async()=>a.fail('API called');
 const r=await W.run({dir:temp(t),adapter:f.adapter,now:f.now});a.equal(r.preparedFields,2);a.equal(r.modelAttempts,0);a.equal(r.simulatedReservedMicrousd,0);
});
test('listed required degree does not require invented equivalence',()=>{
 const f=fixture(1),c=f.current('V2I-SYNTHETIC-0');const p=W.proposal(f.result,c.evidence,['DEGREE'],c.row);
 a.equal(p.fields.DEGREE_REQ,'REQUIRED');a.equal(p.degree.equivalence,'UNKNOWN');
 const bad=structuredClone(f.result);bad.degree.equivalence='EXPLICIT';a.throws(()=>W.proposal(bad,c.evidence,['DEGREE'],c.row),/EQUIVALENCE_NOT_QUOTED/);
});
test('owner conflict, missing full allocation, outside IDs and Hermes overlap block',()=>{
 for(const mutate of [v=>v.registryOwner='Claude',v=>v.allocationComplete=false,v=>v.allocations.push({primaryId:'V2I-SYNTHETIC-0',worker:'Hermes'}),v=>v.allocations.push({primaryId:'V2I-NOT_ASSIGNED',worker:W.NAME})]){
  const f=fixture(1);mutate(f.view);a.throws(()=>W.allocation(f.view,f.now()));
 }
});
test('per-job current protection, fences, Never Consider and no missing fields hold independently',async t=>{
 const f=fixture(5);f.adapter.current=async id=>{const c=f.current(id),n=Number(id.split('-').at(-1));
 if(n===0)c.row.p.TIM_DECISION='DECLINE';if(n===1)c.writerFenced=true;if(n===2)c.neverConsider='REVIEW';if(n===3)c.missingGroups=[];return c;};
 const r=await W.run({dir:temp(t),adapter:f.adapter,now:f.now});a.equal(r.preparedJobs,1);a.equal(r.heldJobs,4);a.equal(r.modelAttempts,1);
});
test('allocation is rechecked per job',async t=>{
 const f=fixture(1);f.adapter.current=async id=>{const c=f.current(id);c.authority.allocations[0].worker='Hermes';return c;};
 const r=await W.run({dir:temp(t),adapter:f.adapter,now:f.now});a.equal(r.modelAttempts,0);a.equal(r.statuses.ALLOCATION_CHANGED,1);
});
test('timeout reserves worst case and never replays; late adapter cannot mark prepared',async t=>{
 const f=fixture(2),dir=temp(t);let calls=0;f.adapter.simulate=async()=>{calls++;await new Promise(r=>setTimeout(r,25));return f.result;};
 const r=await W.run({dir,adapter:f.adapter,now:f.now,jobMs:5});a.equal(r.statuses.MODEL_OUTCOME_UNKNOWN,2);a.equal(r.simulatedReservedMicrousd,4096);
 await new Promise(r=>setTimeout(r,40));a.equal((await W.run({dir,adapter:f.adapter,now:f.now})).preparedJobs,0);a.equal(calls,2);
});
test('batch timeout records remaining jobs and continues to next batch',async t=>{
 const f=fixture(16);f.adapter.current=async()=>new Promise(()=>{});
 const r=await W.run({dir:temp(t),adapter:f.adapter,now:f.now,jobMs:10,batchMs:2});a.equal(r.jobs,16);a.equal(r.batches,2);a.ok(r.statuses.BATCH_TIMEOUT>=13);
});
test('auth or credit refusal halts globally without a retry or fallback',async t=>{
 const f=fixture(5);let calls=0;f.adapter.simulate=async()=>{calls++;throw Error('API_AUTH_OR_CREDIT_FAILURE');};
 const dir=temp(t),r=await W.run({dir,adapter:f.adapter,now:f.now});a.equal(calls,1);a.equal(r.jobs,1);a.equal(r.statuses.MODEL_OUTCOME_UNKNOWN,1);
 await W.run({dir,adapter:f.adapter,now:f.now});a.equal(calls,1);
});
test('built-in evidence reuse uses the existing degree parser without conflating equivalence',()=>{
 const {reuseDegree}=require('./reuse.cjs'),f=fixture(1),c=f.current('V2I-SYNTHETIC-0');
 a.equal(reuseDegree(c).degree.requirement,'REQUIRED');
 c.evidence.text='Bachelor degree or equivalent experience.';a.equal(reuseDegree(c),null);
});
test('checkpoint durability failure stops before any model call',async t=>{
 const f=fixture(1),dir=temp(t);let calls=0,failReplace=false,failedReplacements=0;
 f.adapter.simulate=async()=>{calls++;return f.result;};
 // Inject at the existing checkpoint seam in an isolated worker import. Exercise
 // the Win32 branch on every platform, without loading the real credential addon.
 const checkpointPath=require.resolve('./checkpoint.cjs'),workerPath=require.resolve('./worker.cjs');
 const checkpointModule=require.cache[checkpointPath],originalCheckpoint=checkpointModule.exports,originalWorker=require.cache[workerPath];
 const native={replaceCheckpoint(from,to){
  if(failReplace){
   const pending=JSON.parse(fs.readFileSync(from,'utf8'));
   a.equal(pending.jobs['V2I-SYNTHETIC-0'].status,'MODEL_IN_FLIGHT');
   a.equal(pending.reservedMicrousd,W.LIMITS.reservationMicrousd);
   failedReplacements++;throw Error('synthetic native replacement failure');
  }
  fs.renameSync(from,to); // Mock successful setup writes only.
 }};
 let worker;
 try {
  checkpointModule.exports={...originalCheckpoint,save:(file,value)=>originalCheckpoint.save(file,value,{platform:'win32',native})};
  delete require.cache[workerPath];worker=require(workerPath);
 } finally {checkpointModule.exports=originalCheckpoint;require.cache[workerPath]=originalWorker;}
 f.adapter.current=async id=>{failReplace=true;return f.current(id);};
 await a.rejects(worker.run({dir,adapter:f.adapter,now:f.now}),/^Error: CHECKPOINT_DURABILITY_FAILURE$/);
 a.equal(failedReplacements,1);a.equal(calls,0);
 const retained=JSON.parse(fs.readFileSync(path.join(dir,'checkpoint.json'),'utf8'));
 a.equal(retained.jobs['V2I-SYNTHETIC-0'].status,'CHECKING');a.equal(retained.reservedMicrousd,0);
 a.equal(fs.readdirSync(dir).filter(name=>name.startsWith('checkpoint.json.tmp-')).length,1);
});
test('one dollar lifetime reservation stops before exceeding cap',async t=>{
 const f=fixture(500);const r=await W.run({dir:temp(t),adapter:f.adapter,now:f.now});
 a.equal(r.modelAttempts,488);a.equal(r.simulatedReservedMicrousd,999424);a.ok(r.simulatedReservedMicrousd<W.LIMITS.totalMicrousd);a.equal(r.statuses.BUDGET_STOP,1);
});
test('expiry stops before any source or model work',async t=>{
 const f=fixture(1);f.view.readAt=W.LIMITS.stopAt;const r=await W.run({dir:temp(t),adapter:f.adapter,now:()=>Date.parse(W.LIMITS.stopAt)});a.equal(r.jobs,0);
});
test('single-instance lock and corrupt checkpoints fail closed',async t=>{
 const f=fixture(1),dir=temp(t);fs.writeFileSync(path.join(dir,W.NAME+'.lock'),'{}');
 await a.rejects(W.run({dir,adapter:f.adapter,now:f.now}),/SINGLE_INSTANCE_LOCK/);
 fs.unlinkSync(path.join(dir,W.NAME+'.lock'));fs.writeFileSync(path.join(dir,'checkpoint.json'),'{}');
 await a.rejects(W.run({dir,adapter:f.adapter,now:f.now}),/INVALID_CHECKPOINT/);
});
test('interrupted in-flight checkpoint is fenced on resume',async t=>{
 const f=fixture(1),dir=temp(t);W.save(path.join(dir,'checkpoint.json'),{schema:'forge.grant-worker-checkpoint.v1',worker:W.NAME,mode:'dry',reservedMicrousd:2048,batches:1,jobs:{'V2I-SYNTHETIC-0':{status:'MODEL_IN_FLIGHT',modelAttempted:true}}});
 const r=await W.run({dir,adapter:f.adapter,now:f.now});a.equal(r.statuses.MODEL_OUTCOME_UNKNOWN,1);a.equal(r.preparedJobs,0);
});
test('private keys or unreviewed text cannot enter model input',()=>{
 const f=fixture(1),c=f.current('V2I-SYNTHETIC-0');
 for(const mutate of [e=>e.resume='private',e=>e.publicReviewed=false,e=>e.url='https://example.com/job?token=abc',e=>e.sha256='0'.repeat(64),e=>e.company='Different']){
  const e=structuredClone(c.evidence);mutate(e);a.throws(()=>W.publicEvidence(e,c.row));
 }
 const body=W.request(c.evidence,['DEGREE']);a.ok(!JSON.stringify(body).includes('PRIMARY_ID'));a.equal(body.max_output_tokens,1024);a.equal(body.service_tier,'default');
 a.throws(()=>W.request({...c.evidence,text:'x'.repeat(9000)},['DEGREE']),/INPUT_CAP/);
});
test('protected fields, absent quotes, conflicts and fabricated absence cannot become proposals',()=>{
 const f=fixture(1),c=f.current('V2I-SYNTHETIC-0');
 for(const mutate of [r=>r.fields.TIM_DECISION='YES',r=>r.quotes.DEGREE='Not in source',r=>r.fields.DEGREE_REQ='NOT_STATED',r=>r.degree.confidence='LOW']){
  const r=structuredClone(f.result);mutate(r);a.throws(()=>W.proposal(r,c.evidence,['DEGREE'],c.row));
 }
 c.row.p.DEGREE_REQ='PREFERRED';c.row.p.DEGREE_TEXT='Existing degree';a.equal(Object.keys(W.proposal(f.result,c.evidence,['DEGREE'],c.row).fields).length,0);
});
test('live entry remains disabled regardless of claimed attestations',async t=>{
 const f=fixture(1);a.ok(W.liveBlockers({},f.now()).includes('LIVE_RELEASE_DISABLED'));
 await a.rejects(W.run({dir:temp(t),adapter:f.adapter,mode:'live'}),/LIVE_RELEASE_DISABLED/);
});
test('Responses transport uses fixed endpoint/project, no tools or retries and validates usage',async()=>{
 const f=fixture(1),body=W.request(f.current('V2I-SYNTHETIC-0').evidence,['DEGREE']);let calls=0;
 const opts={projectId:'proj_SYNTHETIC',signal:new AbortController().signal,secureRuntime:async use=>use('SYNTHETIC_NOT_A_SECRET'),transport:async(url,init)=>{
  calls++;a.equal(url,'https://api.openai.com/v1/responses');a.equal(init.redirect,'error');a.equal(init.headers['OpenAI-Project'],'proj_SYNTHETIC');
  return new Response(JSON.stringify({id:'synthetic',model:'gpt-6-luna',service_tier:'default',status:'completed',usage:{input_tokens:400,output_tokens:315},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(f.result)}]}]}));}};
 a.deepEqual((await response(body,opts)).result,f.result);a.equal(calls,1);
 for(const status of [401,402,403,429]) await a.rejects(response(body,{...opts,transport:async()=>new Response('',{status})}),/API_AUTH_OR_CREDIT_FAILURE/);
 await a.rejects(response({...body,model:'other'},opts),/API_REQUEST_CAP/);
 await a.rejects(response(body,{...opts,transport:async()=>new Response('x'.repeat(70000))}),/API_RESPONSE_CAP/);
});
