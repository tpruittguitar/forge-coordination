'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {fixture}=require('../helper-routing/api-grant-fixture.cjs'),S=require('../programmed-coordinator/store.cjs'),H=require('../helper-routing/shared.cjs');
const API=require('../helper-routing/api-grant.cjs'),Five=require('./five-job-preflight.cjs');
function five(t){const f=fixture(t);for(let n=3;n<=5;n++){
 const id='V2I-API'+n,row=structuredClone(f.snapshot.rows[0]);row.PRIMARY_ID=id;row.line=row.line.replace(f.ids[0],id);f.ids.push(id);f.snapshot.rows.push(row);f.snapshot.needsById[id]=['DEGREE'];f.snapshot.neverConsiderById[id]={...f.snapshot.neverConsiderById[f.ids[0]],rowSha256:S.hash(row.line)};
 }f.snapshot.policyProof={repo:'tpruittguitar/forge-policy',path:'rules/TIM_PIPELINE_RULES_CANONICAL.txt',branch:'main',commit:'a'.repeat(40),blob:'b'.repeat(40),rawSha256:'f'.repeat(64),readAt:f.snapshot.source.readAt};return f;}
test('exactly five source-bound disjoint synthetic jobs preview and compare without claims',t=>{
 const f=five(t),before=S.read(f.root,H.FILE),r=Five.preview(f);a.equal(r.ids.length,5);a.equal(r.prepared.work.items.length,6);a.equal(r.assignmentWrites,0);a.equal(r.productionAuthorized,false);a.deepEqual(Five.compare(r,f),r);a.deepEqual(S.read(f.root,H.FILE),before);
});
test('not exactly five, overlap, stale policy clearance and changed source require review',t=>{
 const f=five(t),r=Five.preview(f);
 for(const ids of [f.ids.slice(0,4),[...f.ids,f.ids[0]],[...f.ids.slice(0,4),f.hermesIds[0]]])a.throws(()=>Five.preview({...f,ids}));
 f.snapshot.policyProof.rawSha256='e'.repeat(64);a.throws(()=>Five.preview(f),/POLICY_VERSION/);f.snapshot.policyProof.rawSha256='f'.repeat(64);
 f.snapshot.neverConsiderById[f.ids[0]].readAt='2020-01-01';a.throws(()=>Five.compare(r,f),/NEVER_CONSIDER/);
});
test('same reviewed IDs with changed receipt state cannot silently claim',t=>{
 const f=five(t),r=Five.preview(f);f.state.transactions.NEW={status:'VERIFIED',ids:['V2I-OTHER']};a.throws(()=>Five.compare(r,f),/INPUTS_CHANGED/);
});
test('legacy claim arriving after lock check prevents existing coordinator reserve',t=>{
 const f=five(t),before=S.read(f.root,H.FILE);let checks=0;
 a.throws(()=>API.reserve({...f,checkLock(){if(++checks===2){const file='control/ENRICHMENT_HELPER_WORK.json',w=S.read(f.root,file);w.items.push({primaryId:f.ids[0],owner:'ChatGPT',taskKey:w.taskKey,status:'ASSIGNED'});S.save(f.root,file,w);}}}),/EXISTING_CLAIM/);
 a.deepEqual(S.read(f.root,H.FILE),before);
});

test('fresh reread of identical versions can compare without reusing stale observation times',t=>{
 const f=five(t),r=Five.preview(f);f.now+=1000;const at=new Date(f.now).toISOString();f.snapshot.source.readAt=at;f.snapshot.policyProof.readAt=at;
 for(const proof of Object.values(f.snapshot.neverConsiderById))proof.readAt=at;
 a.equal(Five.compare(r,f).inputSha256,r.inputSha256);
});
test('additional active API worker assignment prevents an exact-five preview',t=>{
 const f=five(t),p=API.plan(f),work=S.read(f.root,H.FILE),extra=structuredClone(p.work.items.find(i=>i.taskKey===API.TASK));extra.primaryId='V2I-EXTRA';work.items.push(extra);S.save(f.root,H.FILE,work);
 a.throws(()=>Five.preview(f),/EXACT_FIVE_WORKER_PARTITION_REQUIRED/);
});
