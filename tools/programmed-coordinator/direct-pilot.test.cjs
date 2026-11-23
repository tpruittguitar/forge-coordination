'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const P=require('./direct-pilot.cjs'),S=require('./store.cjs'),H=require('../helper-routing/shared.cjs'),N=require('../grant-backlog/native-five.cjs');
function setup(t){
 const serialization=require('./pilot-serialization.cjs'),original=serialization.check;serialization.check=()=>{};t.after(()=>{serialization.check=original;});
 const f=require('../helper-routing/api-grant-fixture.cjs').fixture(t,5),dir=fs.mkdtempSync(path.join(os.tmpdir(),'pilot-output-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const r={schema:'forge.direct-pilot-release.v1',enabled:true,ownerTask:P.OWNER,ownerProvider:'Claude',provider:'OpenAI',host:'TIMMAY',purpose:'FIVE_JOB_LOCAL_EVIDENCE_ONLY',authorizationReference:'SYNTHETIC-OWNER-INSTRUCTION',expiresAt:'2026-11-23T00:00:00Z',maxGrants:1,budgetMicrousd:10240};
 f.registry.tasks[P.OWNER]={owner:'Claude',route:'runtime'};S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.registry);S.save(f.root,P.RELEASE,r);
 delete f.work.apiGrantBinding;delete f.work.providers.FORGE_API_GRANT_ENRICHMENT;f.work.items=[];S.save(f.root,H.FILE,f.work);
 const funding={project:{name:'Default',id:'proj_SYNTHETIC',responsesOnly:true,grantOnly:true,noPaidFallback:true},credit:{verifiedAt:f.snapshot.source.readAt,balanceMicrousd:37470000,expiresAt:'2026-11-30T00:00:00Z'},expectedSid:'S-1-5-21-1-2-3-4'};
 const options={root:f.root,ids:f.ids,grantId:'FORGE-OPENAI-PILOT-SYNTHETIC',checkpointDir:dir,checkLock(){},readView:async()=>({snapshot:structuredClone(f.snapshot),state:structuredClone(f.state)}),readFunding:async()=>structuredClone(funding),now:()=>f.now,verifyPublished:()=>({commit:'a'.repeat(40),releaseSha256:S.hash(S.read(f.root,P.RELEASE))})};
 return {...f,r,funding,options};
}
test('default-off release fails before reader, lock, publication or credential access',async t=>{
 const f=setup(t);fs.unlinkSync(path.join(f.root,P.RELEASE));f.options.readView=()=>a.fail('reader invoked');await a.rejects(P.issue(f.options),/RELEASE_DISABLED/);
});
test('exact-five issue atomically adds claims and budget in existing pool, without registry or other owner changes',async t=>{
 const f=setup(t),registry=S.read(f.root,'control/AI_AUTOMATION_TASKS.json');const result=await P.issue(f.options),w=H.load(f.root);
 a.equal(result.assignmentWrites,5);a.equal(result.writerRequests,0);a.equal(w.directPilot.reservedMicrousd,N.CAP);a.equal(w.items.length,5);a.equal(H.reservedKeys(w).size,5);a.equal(H.TASKS[H.PILOT_TASK],undefined);a.deepEqual(S.read(f.root,'control/AI_AUTOMATION_TASKS.json'),registry);a.deepEqual(w.providers,f.work.providers);
 a.throws(()=>H.validateBatch({taskKey:H.PILOT_TASK},w),/LOCAL_OUTPUT_ONLY/);
 await a.rejects(P.issue(f.options),/GRANT_ALREADY_EXISTS/);
});
test('native verifier reads actual grant and published claims rather than client assertions',async t=>{
 const f=setup(t);await P.issue(f.options);const auth=P.authority(f.options),g=await auth.verifyGrant(f.options.grantId);a.deepEqual(g.ids,f.ids);a.equal(g.provider,'OpenAI');a.equal(g.workIdentity,H.PILOT_TASK);a.ok(N.grantCheck(g,f.now,f.options.checkpointDir));
 const w=H.load(f.root);w.items[0].status='RETURNED_PENDING_REVIEW';S.save(f.root,H.FILE,w);await a.rejects(auth.verifyGrant(f.options.grantId),/CLAIMS/);
});
for(const kind of ['shared','legacy-disabled','claude-disabled','pending','protected','admission','stale'])test('blocks '+kind,async t=>{
 const f=setup(t),id=f.ids[0];
 if(kind==='shared'){f.work.items=[{primaryId:id,kind:'ENRICHMENT',taskKey:'FORGE_CLAUDE_SHARED_HELPER',provider:'Claude',status:'ASSIGNED',assignmentVersion:1,sourceVersion:'x'}];S.save(f.root,H.FILE,f.work);}
 if(kind==='legacy-disabled'){const w=S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json');w.enabled=false;w.items=[{primaryId:id,owner:'ChatGPT',taskKey:w.taskKey,status:'ASSIGNED'}];S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',w);}
 if(kind==='claude-disabled'){const w=S.read(f.root,'control/CLAUDE_HELPER_WORK.json');w.enrichment=[{primaryId:id}];S.save(f.root,'control/CLAUDE_HELPER_WORK.json',w);}
 if(kind==='pending')f.snapshot.writerReceiptIndex.requests.R={s:'ACCEPTED',items:[{pid:id}]};
 if(kind==='protected')f.snapshot.rows[0].BUCKET='APPLIED';
 if(kind==='admission')delete f.snapshot.neverConsiderById[id];
 if(kind==='stale')f.snapshot.source.readAt='2020-01-01';
 await a.rejects(P.issue(f.options));a.equal(H.load(f.root).directPilot,undefined);
});
test('compare-before-claim detects a late owner and preserves it',async t=>{
 const f=setup(t);let n=0;f.options.readView=async()=>{if(++n===2){const w=H.load(f.root);w.items.push({primaryId:f.ids[0],kind:'ENRICHMENT',taskKey:'FORGE_CLAUDE_SHARED_HELPER',provider:'Claude',status:'ASSIGNED',assignmentVersion:1,sourceVersion:'x'});S.save(f.root,H.FILE,w);}return{snapshot:f.snapshot,state:f.state};};await a.rejects(P.issue(f.options),/CLAIM/);a.equal(H.load(f.root).items[0].provider,'Claude');a.equal(H.load(f.root).directPilot,undefined);
});
test('failed atomic persistence never creates a spendable grant',async t=>{
 const f=setup(t);f.options.persist=()=>{throw Error('CHECKPOINT_DURABILITY_FAILURE');};await a.rejects(P.issue(f.options),/DURABILITY/);await a.rejects(P.authority(f.options).verifyGrant(f.options.grantId),/GRANT_REQUIRED/);
});
test('second batch cannot bypass predecessor verification or cumulative budget by changing grant ID',async t=>{
 const f=setup(t);await P.issue(f.options);f.options.grantId+='2';await a.rejects(P.issue(f.options),/BUDGET_STOP/);
 f.r.maxGrants=2;f.r.budgetMicrousd=20480;S.save(f.root,P.RELEASE,f.r);await a.rejects(P.issue(f.options),/VERIFICATION_REQUIRED/);
});
test('fabricated summary cannot promote an interrupted or malformed checkpoint',async t=>{
 const f=setup(t);await P.issue(f.options);fs.writeFileSync(path.join(f.options.checkpointDir,'native-five-checkpoint.json'),'{}');
 a.throws(()=>P.recordResult({root:f.root,grantId:f.options.grantId,checkpointDir:f.options.checkpointDir,report:{mode:'live-evidence-only',jobs:5,modelAttempts:5,writerRequests:0,reservedMicrousd:10240,unknownOutcomeJobs:0,stop:null},checkLock(){}}),/CHECKPOINT_NOT_VERIFIABLE/);
 a.equal(H.load(f.root).directPilot.grants[f.options.grantId].status,'RESERVED');
});
test('missing publication proof blocks verified grant before native startup',async t=>{
 const f=setup(t);await P.issue(f.options);f.options.verifyPublished=()=>{throw Error('PILOT_FRESH_PUBLISHED_STATE_REQUIRED');};await a.rejects(P.authority(f.options).verifyGrant(f.options.grantId),/PUBLISHED/);
});

test('pilot claims fence existing ATS/Writer code even if pool disabled; original requests survive own-grant exclusion',async t=>{
 const f=setup(t);await P.issue(f.options);const T=require('./transactions.cjs');a.equal(T.fenceIndex(f.root,f.state).has(f.ids[0]),true);a.equal(T.fenceIndex(f.root,f.state,{excludePilotGrant:f.options.grantId}).has(f.ids[0]),false);
 f.state.transactions.R={status:'POST_IN_FLIGHT_UNKNOWN',ids:[f.ids[0]]};a.equal(T.fenceIndex(f.root,f.state,{excludePilotGrant:f.options.grantId}).has(f.ids[0]),true);
 const w=H.load(f.root);w.enabled=false;S.save(f.root,H.FILE,w);a.equal(T.fenceIndex(f.root,f.state).has(f.ids[1]),true);
});
test('issued coordinator capability drives native worker with mocks, no Writer or legacy identity',async t=>{
 const f=setup(t),text='Bachelor degree required.',sha=S.hash(text);
 for(const id of f.ids){f.snapshot.neverConsiderById[id].sourceSha256=sha;f.snapshot.neverConsiderById[id].sourceUrl='https://example.com/job';}
 await P.issue(f.options);
 f.options.readEvidence=async()=>({priorEvidenceReviewed:true,evidence:{kind:'PUBLIC_JOB_POSTING_EXCERPT',publicReviewed:true,identityVerified:true,company:'Factory',title:'Manager',location:'Ohio',url:'https://example.com/job',observedAt:f.snapshot.source.readAt,text,sha256:sha,fullPosting:false}});
 let calls=0;const result=await N.run({grantRef:f.options.grantId,dir:f.options.checkpointDir,authority:P.authority(f.options)},
 {now:()=>f.now,startup:()=>({secureRuntime(){a.fail('real credential use');},close(){}}),response:async()=>{calls++;return{result:{fields:{},quotes:{},degree:{requirement:'UNKNOWN',equivalence:'UNKNOWN',confidence:'LOW',quote:''}},usage:{input_tokens:1,output_tokens:1},responseId:'synthetic'};}});
 a.equal(calls,5);a.equal(result.writerRequests,0);a.equal(result.confirmedUsageMicrousd,5);
 P.recordResult({root:f.root,grantId:f.options.grantId,checkpointDir:f.options.checkpointDir,report:result,checkLock(){}});a.equal(H.load(f.root).directPilot.grants[f.options.grantId].status,'LOCAL_HELD');
});
test('losing accounting cannot reset the lifetime budget while claims remain',async t=>{
 const f=setup(t);await P.issue(f.options);const w=H.load(f.root);delete w.directPilot;S.save(f.root,H.FILE,w);f.options.grantId+='2';await a.rejects(P.issue(f.options),/ACCOUNTING_MISSING/);
});
test('production cross-host barrier is unconditional, not a release flag or callback',async t=>{
 const f=setup(t),serialization=require('./pilot-serialization.cjs');const key=require.resolve('./pilot-serialization.cjs'),cached=require.cache[key];delete require.cache[key];const real=require('./pilot-serialization.cjs');require.cache[key]=cached;
 serialization.check=real.check;await a.rejects(P.issue({...f.options,exclusive:true,serializationVerified:true}),/CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN/);a.equal(H.load(f.root).directPilot,undefined);
});
test('public projection excludes billing ID, balance, SID and private path; local file is hash bound',async t=>{
 const f=setup(t);await P.issue(f.options);const publicText=fs.readFileSync(path.join(f.root,H.FILE),'utf8'),local=JSON.parse(fs.readFileSync(path.join(f.options.checkpointDir,'native-five-grant.json')));
 for(const secret of [f.funding.project.id,String(f.funding.credit.balanceMicrousd),f.funding.expectedSid,f.options.checkpointDir])a.equal(publicText.includes(secret),false);
 const w=H.load(f.root),g=w.directPilot.grants[f.options.grantId];a.equal(S.hash(local),g.localBindingSha256);a.equal(local.checkpointDir,f.options.checkpointDir);
 for(const k of ['project','credit','expectedSid','checkpointDir']){const copy=structuredClone(w);copy.directPilot.grants[f.options.grantId][k]=local[k];a.throws(()=>H.validateWork(copy),/PUBLIC_PROJECTION/);S.save(f.root,H.FILE,copy);a.throws(()=>require('../helper-routing/shared-pages.cjs').validateStored(f.root),/PUBLIC_PROJECTION/);} S.save(f.root,H.FILE,w);
});
test('missing or altered private grant cannot resume and cannot reconstruct funding from public data',async t=>{
 const f=setup(t);await P.issue(f.options);const file=path.join(f.options.checkpointDir,'native-five-grant.json'),g=JSON.parse(fs.readFileSync(file));g.expectedSid+='9';fs.writeFileSync(file,JSON.stringify(g));await a.rejects(P.authority(f.options).verifyGrant(f.options.grantId),/PRIVATE_GRANT_MISMATCH/);
});
