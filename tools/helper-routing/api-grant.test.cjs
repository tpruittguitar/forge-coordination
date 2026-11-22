'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const API=require('./api-grant.cjs'),H=require('./shared.cjs'),S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs'),T=require('../programmed-coordinator/transactions.cjs');
const partner='FORGE_CLAUDE_SHARED_HELPER',at='2026-11-22T04:00:00Z';
const {fixture,prepared}=require('./api-grant-fixture.cjs');
test('explicit API reservations reuse shared work without changing input, claims, owner or disk',t=>{
 const f=fixture(t),before=fs.readFileSync(path.join(f.root,H.FILE)),p=API.plan(f);
 a.equal(p.assignmentWrites,0);a.equal(p.canonicalWrites,0);a.equal(p.work.items.length,3);a.deepEqual(p.work.items[0],f.work.items[0]);a.deepEqual(fs.readFileSync(path.join(f.root,H.FILE)),before);
 a.equal(H.TASKS[API.TASK],undefined);a.equal(H.providerFor(API.TASK),'ChatGPT');a.throws(()=>API.plan({...f,apply:true}),/ACTUATION_DISABLED/);
});
test('coordinator-only reserve uses the existing work/pages and never publishes or changes other owners',t=>{
 const f=fixture(t);a.throws(()=>API.reserve(f),/COORDINATOR_LOCK/);let checks=0;
 const r=API.reserve({...f,checkLock(){checks++;}});a.ok(checks>=2);a.equal(r.assignmentWrites,2);a.equal(r.published,false);a.equal(r.canonicalWrites,0);
 const current=S.read(f.root,H.FILE);a.deepEqual(current.items[0],f.work.items[0]);a.deepEqual(current.providers,f.work.providers);a.equal(current.items.length,3);
 a.throws(()=>API.reserve({...f,checkLock(){}}),/EXISTING_CLAIM/);
 a.equal(H.next(current,partner,null,f.now).total,1);a.equal(H.next(current,partner,null,f.now).backlogCounts.ENRICHMENT,1);
});
test('concurrent reservation change prevents save without undoing the other owner',t=>{
 const f=fixture(t);let checks=0;
 a.throws(()=>API.reserve({...f,checkLock(){if(++checks===2){const w=S.read(f.root,H.FILE);w.items[0].sourceVersion='new-version';S.save(f.root,H.FILE,w);}}}),/STATE_CHANGED/);
 const current=S.read(f.root,H.FILE);a.equal(current.items.length,1);a.equal(current.items[0].sourceVersion,'new-version');
});
test('absent/disabled binding or unknown/unacknowledged Hermes identity fails closed',t=>{
 for(const change of [f=>delete f.work.apiGrantBinding,f=>f.work.apiGrantBinding.enabled=false,f=>f.registry.tasks[API.TASK].enabled=false,
  f=>f.work.apiGrantBinding.hermes.taskKey='UNSUPPORTED_HERMES',f=>f.registry.tasks[partner].executionIdentity='Other',
  f=>f.work.apiGrantBinding.hermes.acknowledgmentSha256='0'.repeat(64)]){
  const f=fixture(t);change(f);S.save(f.root,H.FILE,f.work);S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.registry);a.throws(()=>API.plan(f));
 }
});
test('disjoint IDs are explicit and must equal the acknowledged smaller partner allocation',t=>{
 const f=fixture(t);
 for(const override of [{ids:['V2I-API1','V2I-API1']},{hermesIds:['V2I-API1']},{hermesIds:['V2I-UNKNOWN']},{hermesIds:[]},{ids:['V2I-API1']}])a.throws(()=>API.plan({...f,...override}));
});
test('disabled schedules do not release legacy claims; pending originals and stale snapshots block',t=>{
 const f=fixture(t),legacy=S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json');legacy.enabled=false;legacy.items=[{primaryId:f.ids[0],owner:'ChatGPT',taskKey:legacy.taskKey,status:'ASSIGNED'}];S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',legacy);
 a.throws(()=>API.plan(f),/EXISTING_CLAIM/);legacy.items=[];S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',legacy);
 f.state.transactions.ORIGINAL={status:'POST_IN_FLIGHT_UNKNOWN',ids:[f.ids[0]]};a.throws(()=>API.plan(f),/UNRESOLVED_ORIGINAL/);
 f.state.transactions={};a.throws(()=>API.plan({...f,now:f.now+900001}),/FRESH_CANONICAL/);
});
test('protected rows, incomplete canonical data and absent Never Consider proof block',t=>{
 for(const change of [f=>{f.snapshot.rows[0].BUCKET='APPLIED';f.snapshot.rows[0].line=f.snapshot.rows[0].line.replace('SCOUT_INTAKE','APPLIED');f.snapshot.neverConsiderById[f.ids[0]].rowSha256=S.hash(f.snapshot.rows[0].line);},f=>delete f.snapshot.rows[0].line,f=>delete f.snapshot.neverConsiderById[f.ids[0]]]){
  const f=fixture(t);change(f);a.throws(()=>API.plan(f));
 }
});
test('live Writer freeze, missing index and pending/unbound receipt identities block planning',t=>{
 for(const change of [f=>f.snapshot.status.freeze='FREEZE',f=>delete f.snapshot.writerReceiptIndex,
  f=>f.snapshot.writerReceiptIndex.pending.push({items:[{pid:f.ids[0]}]}),f=>f.snapshot.writerReceiptIndex.pending.push({items:[]})]){
  const f=fixture(t);change(f);a.throws(()=>API.plan(f));
 }
});
test('historical identity proof and binding must match at the instruction revision',t=>{
 const f=fixture(t),e=prepared(f);
 const old=(_r,_c,file)=>file===f.work.apiGrantBinding.hermes.acknowledgmentRef?'{}':fs.readFileSync(path.join(f.root,file),'utf8');
 a.throws(()=>C.routingProof(f.root,e.batch,'b'.repeat(40),old),/PROOF_NOT_AT_INSTRUCTION/);
 const drift=(_r,_c,file)=>{const value=fs.readFileSync(path.join(f.root,file),'utf8');if(file!==H.FILE)return value;const w=JSON.parse(value);w.apiGrantBinding.project='Other';return JSON.stringify(w);};
 a.throws(()=>C.routingProof(f.root,e.batch,'b'.repeat(40),drift),/STALE_API_BINDING/);
});
test('supported shared evidence is collected once with historical proof and no Writer calls',t=>{
 const f=fixture(t),e=prepared(f);S.save(f.root,e.path,e.batch);const original=fs.readFileSync(path.join(f.root,e.path));
 const historical=(_root,_commit,file)=>fs.readFileSync(path.join(f.root,file),'utf8');
 const routing=(root,batch,commit)=>C.routingProof(root,batch,commit,historical);
 const result=C.collect({root:f.root,state:f.state,commit:'b'.repeat(40),routing});
 a.equal(result.newItems,2);a.equal(result.quarantined,0);a.equal(Object.keys(f.state.transactions).length,0);a.deepEqual(fs.readFileSync(path.join(f.root,e.path)),original);
 a.equal(C.collect({root:f.root,state:f.state,commit:'b'.repeat(40),routing}).newItems,0);
});
test('unbound route, wrong return path, field scope and version drift quarantine or reject',t=>{
 const f=fixture(t),e=prepared(f),work=S.read(f.root,H.FILE);
 const bad=structuredClone(e.batch);bad.items[0].assignmentVersion++;a.throws(()=>H.validateBatch(bad,work),/STALE/);
 const fields=structuredClone(e.batch);fields.items[0].sourceEvidence.proposedRawFields.WORK_ARRANGEMENT='ONSITE';a.throws(()=>H.validateBatch(fields,work),/FIELD_OUTSIDE/);
 S.save(f.root,e.path.replace(e.batch.runId,'WRONG'),e.batch);
 C.collect({root:f.root,state:f.state,commit:'b'.repeat(40),routing:()=>({})});a.equal(Object.values(f.state.batches)[0].status,'QUARANTINED');
 work.apiGrantBinding.enabled=false;S.save(f.root,H.FILE,work);a.throws(()=>C.validateEnvelope(f.root,e.batch),/DISABLED/);
});
test('claims appearing after preparation block admission and unknown writes are never replayed',t=>{
 const f=fixture(t),e=prepared(f);S.save(f.root,e.path,e.batch);const key=API.TASK+':'+f.ids[0];
 f.state.items[key]={key,itemKey:f.ids[0],taskKey:API.TASK,version:'previous',status:'SUBMITTED',transactionId:'ORIGINAL'};
 f.state.transactions.ORIGINAL={status:'POST_IN_FLIGHT_UNKNOWN',ids:[f.ids[0]]};
 C.collect({root:f.root,state:f.state,commit:'b'.repeat(40),routing:()=>({})});
 a.equal(f.state.items[key].transactionId,'ORIGINAL');a.equal(f.state.items[key].deferredReturns.length,1);
 const legacy=S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json');legacy.items=[{primaryId:f.ids[0],owner:'ChatGPT',taskKey:legacy.taskKey,status:'ASSIGNED'}];S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',legacy);
 a.throws(()=>H.assertCurrent(f.root,e.batch.items[0],e.batch),/CURRENT_CLAIM_CONFLICT/);
});
test('existing transaction guard rechecks API binding before the one possible POST',async t=>{
 const f=fixture(t),e=prepared(f);S.save(f.root,e.path,e.batch);const key=API.TASK+':'+f.ids[0];
 f.state.items[key]={key,itemKey:f.ids[0],taskKey:API.TASK,batch:e.path};
 const work=S.read(f.root,H.FILE);work.apiGrantBinding.enabled=false;S.save(f.root,H.FILE,work);let posts=0;
 await a.rejects(T.submit({root:f.root,privateDir:f.root,state:f.state,runId:'SYNTHETIC',jobs:[{primaryId:f.ids[0],itemKey:key,identity:T.identity(f.snapshot.rows[0]),fields:{DEGREE_REQ:'PREFERRED'}}],
  deps:{checkLock(){},snapshot:async()=>f.snapshot,post:async()=>{posts++;a.fail('POST forbidden');}}}),/DISABLED/);
 a.equal(posts,0);a.equal(Object.keys(f.state.transactions).length,0);
});
