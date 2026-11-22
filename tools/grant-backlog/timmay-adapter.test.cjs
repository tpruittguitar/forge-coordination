'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../helper-routing/api-grant-fixture.cjs');
const API=require('../helper-routing/api-grant.cjs'),S=require('../programmed-coordinator/store.cjs');
const H=require('../helper-routing/shared.cjs'),Host=require('./timmay-adapter.cjs');
const {fixture:workerFixture}=require('./fixture.cjs');
function setup(t){
 const f=fixture(t);
 for(const row of f.snapshot.rows){row.line+='; DEGREE_TEXT=; DEGREE_REQ=';row.p.DEGREE_TEXT='';row.p.DEGREE_REQ='';f.snapshot.neverConsiderById[row.PRIMARY_ID].rowSha256=S.hash(row.line);}
 const p=API.plan(f);S.save(f.root,H.FILE,p.work);
 // Unknown canonical fields must explicitly exist for evidence proposal checking.
 for(const row of f.snapshot.rows){row.p.DEGREE_TEXT='';row.p.DEGREE_REQ='';}
 const view={readAt:f.snapshot.source.readAt,instructionCommit:'a'.repeat(40),publishedInstructionCommit:'a'.repeat(40),publishedWorkSha256:S.hash(p.work),state:f.state,snapshot:f.snapshot};
 const wf=workerFixture(),e=wf.current('V2I-SYNTHETIC-0').evidence;Object.assign(e,{company:'Factory',title:'Manager',location:'Ohio'});e.text+=' Manufacturing leadership and operational quality.'.repeat(8);e.sha256=S.hash(e.text);
 let calls=0;
 const host=Host.create({root:f.root,now:()=>f.now,readView:async()=>structuredClone(view),readPublicEvidence:async()=>structuredClone(e),reuse:async()=>null,simulate:async()=>{calls++;return wf.result;}});
 return {...f,view,host,calls:()=>calls,dir:path.join(f.root,'private')};
}
test('TIMMAY offline bridge produces supported evidence batches, resumes without replay, never publishes',async t=>{
 const f=setup(t),before=fs.readFileSync(path.join(f.root,H.FILE));
 const r=await f.host.runDry(f.dir);a.equal(r.preparedJobs,2,fs.readFileSync(path.join(f.dir,'checkpoint.json'),'utf8'));a.equal(r.preparedFields,4);a.equal(f.calls(),2);a.equal(r.writerSubmittedJobs,0);a.equal(r.actualSpendMicrousd,0);
 const state=JSON.parse(fs.readFileSync(path.join(f.dir,'checkpoint.json')));
 for(const job of Object.values(state.jobs)){a.equal(job.batch.taskKey,API.TASK);H.validateBatch(job.batch,H.load(f.root));a.equal(job.batch.writerSubmitted,false);}
 a.deepEqual(await f.host.runDry(f.dir),r);a.equal(f.calls(),2);a.deepEqual(fs.readFileSync(path.join(f.root,H.FILE)),before);
 a.equal(fs.existsSync(path.join(f.root,API.PREFIX)),false);
 a.throws(()=>f.host.launch(),/LIVE_RELEASE_DISABLED/);
});
test('disabled route, stale publication, absent identity ACK and exact-assignment drift stop before simulation',async t=>{
 for(const mutate of [f=>{const w=H.load(f.root);w.apiGrantBinding.enabled=false;S.save(f.root,H.FILE,w);},
  f=>f.view.publishedWorkSha256='0'.repeat(64),f=>{const w=H.load(f.root);fs.unlinkSync(path.join(f.root,w.apiGrantBinding.hermes.acknowledgmentRef));},
  f=>{const w=H.load(f.root);w.items[0].assignmentVersion++;S.save(f.root,H.FILE,w);f.view.publishedWorkSha256=S.hash(w);}]){
  const f=setup(t);mutate(f);await a.rejects(f.host.runDry(f.dir));a.equal(f.calls(),0);
 }
});
test('fresh snapshot, original-request fence and unresolved claims remain mandatory before simulation',async t=>{
 for(const mutate of [f=>f.view.snapshot.source.readAt='2020-01-01',f=>delete f.view.snapshot.writerReceiptIndex,
  f=>f.view.snapshot.writerReceiptIndex.pending.push({items:[{pid:f.ids[0]}]}),
  f=>f.view.state.transactions.X={status:'POST_IN_FLIGHT_UNKNOWN',ids:f.ids},
  f=>delete f.view.snapshot.neverConsiderById[f.ids[0]],f=>f.view.snapshot.rows[0].line+=' stale']){
  const f=setup(t);mutate(f);const r=await f.host.runDry(f.dir);a.ok(r.heldJobs>=1);a.ok(f.calls()<2);
 }
});
test('model boundary receives only bounded public excerpt, never canonical or host metadata',async t=>{
 const f=setup(t);let calls=0;
 const e=workerFixture().current('x').evidence;Object.assign(e,{company:'Factory',title:'Manager',location:'Ohio',resume:'private'});
 const host=Host.create({root:f.root,now:()=>f.now,readView:async()=>f.view,readPublicEvidence:async()=>e,reuse:async()=>null,simulate:async()=>{calls++;}});
 const r=await host.runDry(f.dir);a.equal(r.preparedJobs,0);a.equal(calls,0);
});
test('dry checkpoint cannot be reused across legacy and API routes',async t=>{
 const f=setup(t);await f.host.runDry(f.dir);
 const wf=workerFixture();await a.rejects(require('./worker.cjs').run({dir:f.dir,adapter:wf.adapter,now:wf.now}),/CHECKPOINT_ROUTE_MISMATCH/);
});
test('same assignment name with changed Hermes IDs invalidates its exact ACK',t=>{
 const f=setup(t),work=H.load(f.root);work.items[0].primaryId='V2I-CHANGED';S.save(f.root,H.FILE,work);
 a.throws(()=>API.assertBound(f.root,work),/EXACT_ASSIGNMENT_ACK_REQUIRED/);
});
