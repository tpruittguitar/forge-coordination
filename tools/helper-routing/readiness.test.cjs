'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const S=require('../programmed-coordinator/store.cjs'),H=require('./shared.cjs'),C=require('../programmed-coordinator/collect.cjs'),R=require('./readiness.cjs'),Reports=require('../routine-handoffs/reports.cjs');
const taskKey='FORGE_GROK_SHARED_HELPER',commit='a'.repeat(40);
function fixture(t,provider='Grok',returnTransport='GITHUB_PR'){
 const taskKey='FORGE_'+provider.toUpperCase()+'_SHARED_HELPER';
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'shared-readiness-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const work={schema:'forge.shared-helper-work.v1',assignmentId:'SHARED-TEST',enabled:true,routingActive:true,providers:{FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:false},FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:false}},items:[]};
 const batch={schema:'forge.shared-helper-batch.v1',provider,taskKey,assignmentId:work.assignmentId,runId:'FORGE-'+provider.toUpperCase()+'-SETUP-TEST',instructionCommit:commit,mode:'READINESS_ONLY',returnTransport,researchPerformed:false,writerSubmitted:false,items:[]};
 S.save(root,H.FILE,work);S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:{owner:provider,workAssignments:H.FILE}}});
 return{root,work,batch,file:'receipts/'+provider.toUpperCase()+'_HELPERS/'+taskKey+'/'+batch.runId+'.json'};
}
test('zero-job readiness probe validates while provider unavailable without enabling or assigning anything',t=>{
 const f=fixture(t),before=JSON.stringify(f.work);a.deepEqual(H.validateBatch(f.batch,f.work),{valid:true,items:0,readinessOnly:true,productionAuthorized:false});a.equal(JSON.stringify(f.work),before);a.equal(H.next(f.work,taskKey).items.length,0);
 const noMode={...f.batch};delete noMode.mode;a.throws(()=>H.validateBatch(noMode,f.work),/ENVELOPE/);
 for(const change of [{items:[{}]},{writerSubmitted:true},{researchPerformed:true},{returnTransport:'CHAT'},{fields:{BUCKET:'READY'}},{mode:'PRODUCTION'}])a.throws(()=>H.validateBatch({...f.batch,...change},f.work));
});
test('normal transport and collector record readiness but produce no research items or transactions',t=>{
 const f=fixture(t),state=C.empty();
 a.equal(Reports.batches(JSON.stringify(f.batch)).length,1);S.save(f.root,f.file,f.batch);
 const result=C.collect({root:f.root,state,commit,routing:()=>({instructionCommit:commit,checkedAgainst:commit})});
 a.equal(result.validated,1);a.equal(result.newItems,0);a.deepEqual(state.items,{});a.deepEqual(state.transactions,{});a.equal(state.batches[f.file].readinessOnly,true);
 S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);
 const ready=R.verified({root:f.root,taskKey,commit,routing:()=>({})});a.equal(ready.artifactValidated,true);a.equal(ready.returnTransportVerified,false);a.equal(ready.canonicalWrites,0);a.equal(ready.activationChanged,false);a.equal(H.load(f.root).providers[taskKey].available,false);
});
test('claimed, uncollected, changed, stale, or quarantined readiness never activates a provider',t=>{
 const f=fixture(t),state=C.empty();S.save(f.root,f.file,f.batch);a.equal(R.verified({root:f.root,taskKey,commit,routing:()=>({})}).returnTransportVerified,false);
 C.collect({root:f.root,state,commit,routing:()=>({})});S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);
 a.equal(R.verified({root:f.root,taskKey,commit,routing:()=>{throw Error('STALE_TASK_ROUTING');}}).returnTransportVerified,false);
 state.batches[f.file].status='QUARANTINED';S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);a.equal(R.verified({root:f.root,taskKey,commit,routing:()=>({})}).returnTransportVerified,false);
 state.batches[f.file].status='VALIDATED';S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);fs.appendFileSync(path.join(f.root,f.file),' ');a.equal(R.verified({root:f.root,taskKey,commit,routing:()=>({})}).returnTransportVerified,false);
});

test('Claude unavailable slot can verify a complete private Drive zero-job return with no research or Writer effect',t=>{
 const f=fixture(t,'Claude','DRIVE'),D=require('../routine-handoffs/direct-handoffs.cjs'),privateDir=path.join(f.root,'private'),text=JSON.stringify(f.batch),id='fixture-claude-probe';
 S.save(privateDir,'direct-handoffs/incoming/packet.json',{schema:'forge.direct-handoff-packet.v1',metadata:{id,title:'forge-helper-'+f.batch.runId+'.json',mime_type:'text/plain',parent_ids:[D.folder],size:String(Buffer.byteLength(text)),modified_time:'2026-11-09T00:00:00Z',url:'https://drive.google.com/file/d/'+id+'/view'},text});
 a.equal(D.consume(privateDir).captured,1);
 const inbox=S.files(path.join(privateDir,'helper-inbox'));a.equal(inbox.length,1);
 const result=Reports.ingest({root:f.root,privateDir,state:Reports.empty(),text:fs.readFileSync(inbox[0],'utf8'),source:{provider:'Claude',taskKey:f.batch.taskKey,id,complete:true},commit,routing:()=>({})});a.equal(result.imported,1);
 const state=C.empty();C.collect({root:f.root,state,commit,routing:()=>({})});S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);
 const ready=R.verified({root:f.root,privateDir,taskKey:f.batch.taskKey,commit,routing:()=>({})});a.equal(ready.returnTransportVerified,true);a.equal(ready.proofs[0].observedTransport[0].transport,'DRIVE');a.equal(ready.researchCompleted,false);a.equal(ready.activationChanged,false);a.deepEqual(state.items,{});a.deepEqual(state.transactions,{});a.equal(H.load(f.root).providers[f.batch.taskKey].available,false);
});

test('PR verification requires matching captured PR bytes, not declared transport or a bare receipt',async t=>{
 const f=fixture(t),privateDir=path.join(f.root,'private'),state=C.empty();S.save(f.root,f.file,f.batch);C.collect({root:f.root,state,commit,routing:()=>({})});S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);
 const verify=()=>R.verified({root:f.root,privateDir,taskKey,commit,routing:()=>({})});a.equal(verify().artifactValidated,true);a.equal(verify().returnTransportVerified,false);
 const raw=JSON.stringify(f.batch),D=require('../routine-handoffs/delivery.cjs'),pr={number:123,base:{ref:'main'},head:{sha:commit,ref:'fixture-probe',repo:{full_name:'tpruittguitar/forge-coordination'}}};
 const api={pages:async()=>[{filename:f.file,status:'added'}],content:async()=>raw,head:async()=>commit};a.equal((await D.harvest({root:f.root,privateDir,commit,pr,api,routing:()=>({})})).captured,1);a.equal(verify().returnTransportVerified,true);
 const capture=S.files(path.join(privateDir,'helper-delivery'))[0];fs.appendFileSync(capture,'bad');a.equal(verify().returnTransportVerified,false);
});
test('cross-transport claims and unconsumed Drive packets are never verified',t=>{
 for(const declared of ['DRIVE','GITHUB_PR']){
  const f=fixture(t,'Grok',declared),privateDir=path.join(f.root,'private'),state=C.empty();S.save(f.root,f.file,f.batch);C.collect({root:f.root,state,commit,routing:()=>({})});S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);
  const raw=JSON.stringify(f.batch),D=require('../routine-handoffs/direct-handoffs.cjs'),verify=()=>R.verified({root:f.root,privateDir,taskKey,commit,routing:()=>({})});
  if(declared==='DRIVE')S.save(privateDir,'helper-delivery/'+S.hash(raw)+'.json',{pullRequest:123,commit,path:f.file,raw});
  else{const id='fixture-mislabelled';S.save(privateDir,'direct-handoffs/incoming/packet.json',{schema:'forge.direct-handoff-packet.v1',metadata:{id,title:'forge-helper-'+f.batch.runId+'.json',mime_type:'text/plain',parent_ids:[D.folder],size:String(Buffer.byteLength(raw)),modified_time:'2026-11-09T00:00:00Z',url:'https://drive.google.com/file/d/'+id+'/view'},text:raw});a.equal(verify().returnTransportVerified,false);a.equal(D.consume(privateDir).captured,1);}
  a.equal(verify().artifactValidated,true);a.equal(verify().returnTransportVerified,false);
 }
});
