'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const N=require('./native-five.cjs'),W=require('./worker.cjs'),{fixture}=require('./fixture.cjs'),{save}=require('./checkpoint.cjs');
function setup(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-five-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const f=fixture(5),at=new Date(f.now()).toISOString(),ids=f.view.work.items.map(i=>i.primaryId);
 const g={release:'AUTHORIZED',purpose:'FIVE_JOB_LOCAL_EVIDENCE_ONLY',provider:'OpenAI',workIdentity:'SYNTHETIC-ONLY-PILOT',receiptId:'SYNTHETIC-GRANT',revision:'a'.repeat(40),readAt:at,expiresAt:'2026-11-22T05:00:00Z',checkpointDir:dir,ids,
 project:{id:'proj_SYNTHETIC',name:'Default',responsesOnly:true,grantOnly:true,noPaidFallback:true},credit:{verifiedAt:at,balanceMicrousd:37470000,expiresAt:'2026-11-30T00:00:00Z'},expectedSid:'S-1-5-21-1-2-3-4'};
 let calls=0,opens=0,closed=0;
 const current=id=>{const c=f.current(id),row=c.row;row.p={DEGREE_TEXT:'',DEGREE_REQ:''};row.line=`1 | ${id} | ${row.COMPANY} | ${row.TITLE} | ${row.BUCKET} | OPEN | - | - | ${row.LOCATION} | DEGREE_TEXT=; DEGREE_REQ=`;
 const snapshot={source:{kind:'CANONICAL_WRITER_MASTER',readAt:at},rows:[row],needsById:{[id]:['DEGREE']},policyProof:{rawSha256:'b'.repeat(64),commit:'c'.repeat(40)}};
 const admission={schema:'forge.early-research-admission.v1',status:'RESEARCH_ADMITTED',scope:'MISSING_PUBLIC_FACTS_ONLY',canonicalEligibility:false,writerAuthorized:false,primaryId:id,rowSha256:require('../programmed-coordinator/store.cjs').hash(row.line),readAt:at,policySha256:snapshot.policyProof.rawSha256,policyCommit:snapshot.policyProof.commit,evidenceSha256:'d'.repeat(64),sourceSha256:c.evidence.sha256,sourceUrl:c.evidence.url,screenStatus:'NO_CONFIRMED_EXCLUSION',writerClassification:'ALLOW'};
 return {receiptId:g.receiptId,revision:g.revision,exclusive:true,returned:false,originalRequestsReconciled:true,priorEvidenceReviewed:true,snapshot,row,admission,evidence:c.evidence,missingGroups:['DEGREE']};};
 const authority={verifyGrant:async()=>structuredClone(g),readCurrent:async(ref,id)=>current(id)};
 const deps={now:f.now,startup:()=>{opens++;return {secureRuntime:()=>a.fail('No real secret use'),close(){closed++;}};},response:async body=>{calls++;a.equal(body.model,'gpt-6-luna');return {result:structuredClone(f.result),usage:{input_tokens:100,output_tokens:100},responseId:'synthetic-'+calls};},save};
 return {dir,g,ids,current,authority,deps,result:f.result,args:{grantRef:'synthetic-ref',dir,authority},counts:()=>({calls,opens,closed})};
}
test('missing host capability and JSON release assertions cannot launch',async()=>{
 await a.rejects(N.main(['--grant','x','--output','/tmp/x']),/CAPABILITY_REQUIRED/);
 await a.rejects(N.run({grantRef:'x',dir:'/tmp/x',authority:{release:'AUTHORIZED'}}),/CAPABILITY_REQUIRED/);
});
test('exact five use existing response shape, local proposals and real usage accounting; resume never replays',async t=>{
 const f=setup(t),r=await N.run(f.args,f.deps);a.equal(r.preparedJobs,5,fs.readFileSync(path.join(f.dir,'native-five-checkpoint.json'),'utf8'));a.equal(r.preparedFields,10);a.equal(r.modelAttempts,5);a.equal(r.reservedMicrousd,10240);a.equal(r.confirmedUsageMicrousd,300);a.equal(r.writerRequests,0);
 const again=await N.run(f.args,f.deps);a.deepEqual(again,r);a.deepEqual(f.counts(),{calls:5,opens:1,closed:1});
 const state=JSON.parse(fs.readFileSync(path.join(f.dir,'native-five-checkpoint.json')));a.equal(state.jobs[f.ids[0]].evidence.proposedRawFields.DEGREE_REQ,'REQUIRED');a.equal(state.jobs[f.ids[0]].degree.equivalence,'UNKNOWN');a.ok(!JSON.stringify(state).includes('forge.enrichment-helper-batch'));
});
for(const [label,edit] of Object.entries({disabled:g=>g.release='DISABLED',legacy:g=>g.workIdentity='FORGE_CHATGPT_ENRICHMENT_RESEARCH',provider:g=>g.provider='Claude',duplicate:g=>g.ids[4]=g.ids[0],four:g=>g.ids.pop(),stale:g=>g.readAt='2020-01-01',paid:g=>g.project.grantOnly=false,floor:g=>g.credit.balanceMicrousd=10000000,expired:g=>g.credit.expiresAt='2020-01-01'}))test('grant gate: '+label,async t=>{const f=setup(t);edit(f.g);await a.rejects(N.run(f.args,f.deps));a.equal(f.counts().opens,0);a.equal(f.counts().calls,0);});
test('durability failure precedes native startup and API',async t=>{
 const f=setup(t);f.deps.save=(file,s)=>{if(Object.values(s.jobs).some(j=>j.status==='RESERVED'))throw Error('CHECKPOINT_DURABILITY_FAILURE');save(file,s);};
 await a.rejects(N.run(f.args,f.deps),/DURABILITY/);a.equal(f.counts().opens,0);a.equal(f.counts().calls,0);
});
test('per-ID returned, claimed, protected, source-changed and prior-evidence-unchecked jobs all hold without calls',async t=>{
 const f=setup(t);f.authority.readCurrent=async(ref,id)=>{const c=f.current(id),n=f.ids.indexOf(id);if(n===0)c.returned=true;if(n===1)c.exclusive=false;if(n===2){c.row.p.TIM_DECISION='DECLINE';}if(n===3)c.admission.sourceSha256='e'.repeat(64);if(n===4)c.priorEvidenceReviewed=false;return c;};
 const r=await N.run(f.args,f.deps);a.equal(r.modelAttempts,0);a.equal(f.counts().opens,0);
});
test('changed authority stops before first credential read',async t=>{
 const f=setup(t);let n=0;f.authority.verifyGrant=async()=>({...f.g,revision:++n>1?'changed':f.g.revision});const r=await N.run(f.args,f.deps);a.equal(r.stop,'AUTHORITY_CHANGED');a.equal(f.counts().calls,0);
});
test('auth failure stops batch and does not replay on resume',async t=>{
 const f=setup(t);let calls=0;f.deps.response=async()=>{calls++;throw Error('API_AUTH_OR_CREDIT_FAILURE');};const r=await N.run(f.args,f.deps);a.equal(r.modelAttempts,1);a.equal(r.stop,'API_AUTH_OR_CREDIT_FAILURE');a.equal(r.unknownOutcomeJobs,1);await N.run(f.args,f.deps);a.equal(calls,1);
});
test('timeout holds ambiguous request and late result cannot change checkpoint',async t=>{
 const f=setup(t);f.deps.jobMs=15;f.deps.response=async()=>{await new Promise(r=>setTimeout(r,40));return {result:f.result,usage:{input_tokens:1,output_tokens:1}};};const r=await N.run(f.args,f.deps);a.equal(r.unknownOutcomeJobs,1);await new Promise(r=>setTimeout(r,60));a.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'native-five-checkpoint.json'))).jobs[f.ids[0]].status,'OUTCOME_UNKNOWN');
});
test('sufficient reusable evidence avoids credential and model access',async t=>{
 const f=setup(t);f.authority.readCurrent=async(ref,id)=>({...f.current(id),reusableResult:f.result});const r=await N.run(f.args,f.deps);a.equal(r.preparedJobs,5,fs.readFileSync(path.join(f.dir,'native-five-checkpoint.json'),'utf8'));a.equal(r.modelAttempts,0);a.equal(f.counts().opens,0);
});
test('concurrent local invocation is excluded',async t=>{
 const f=setup(t);fs.writeFileSync(path.join(f.dir,'native-five.lock'),'held');await a.rejects(N.run(f.args,f.deps),/SINGLE_INSTANCE/);a.equal(f.counts().opens,0);
});

test('absent credential reports zero model attempts and stops without leaking an error body',async t=>{
 const f=setup(t);f.deps.startup=()=>{throw Error('CREDENTIAL_ABSENT');};const r=await N.run(f.args,f.deps);a.equal(r.modelAttempts,0);a.equal(r.stop,'CREDENTIAL_ABSENT');a.equal(f.counts().calls,0);a.equal(r.reservedMicrousd,2048);
});
test('credit revoked during evidence read prevents HTTP dispatch',async t=>{
 const f=setup(t);f.authority.readCurrent=async(ref,id)=>{const c=f.current(id);f.g.project.grantOnly=false;return c;};const r=await N.run(f.args,f.deps);a.equal(f.counts().calls,0);a.equal(r.stop,'GRANT_ONLY_BUDGET_REQUIRED');
});
test('grant revoked after native startup is rechecked before HTTP',async t=>{
 const f=setup(t),open=f.deps.startup;f.deps.startup=()=>{const c=open();f.g.release='DISABLED';return c;};const r=await N.run(f.args,f.deps);a.equal(f.counts().calls,0);a.equal(r.stop,'AUTHORITATIVE_EXACT_FIVE_RELEASE_REQUIRED');
});
test('request aborts at earlier credit observation deadline, then stays unknown without replay',async t=>{
 const f=setup(t);let calls=0,start=Date.now();const base=f.deps.now();f.deps.now=()=>base+Date.now()-start;f.g.credit.verifiedAt=new Date(base-900000+80).toISOString();
 f.deps.response=async(body,{signal})=>{calls++;await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('API_OUTCOME_UNKNOWN')),{once:true});});};
 const r=await N.run(f.args,f.deps);a.equal(calls,1);a.equal(r.unknownOutcomeJobs,1);a.ok(Date.now()-start<2000);f.g.credit.verifiedAt=new Date(f.deps.now()).toISOString();await N.run(f.args,f.deps);a.equal(calls,1);
});
