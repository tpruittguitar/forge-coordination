'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),O=require('./writer-outcome.cjs'),S=require('./programmed-coordinator/store.cjs');
const contract=require('../reference/WRITER_OUTCOME_CONTRACT.json');
test('versioned Writer outcome contract rejects ambiguous, contradictory and foreign responses',()=>{
 for(const c of contract.cases)a.equal(O.classify(c.response,contract).kind==='NOT_ACCEPTED',c.notAccepted,c.name);
});
test('legacy ruling lock refusal needs deployed source plus absent original aliases, never absence alone',async()=>{
 const source='function applyRulingBatchToMaster_(requests) {\n var started = Date.now(), t = { TOTAL_MS: 0 };\n var lock = LockService.getScriptLock(), lockStart = Date.now();\n lock.waitLock(30000);\n try { return MUTATION(); } finally { lock.releaseLock(); }}';
 const response={ok:false,error:'Lock timeout: another process was holding the lock for too long.',errorStack:'Exception: Lock timeout: another process was holding the lock for too long. | at applyRulingBatchToMaster_ (Code:4:8) | at dispatchWrite_ (Code:22:28) | at doPost (Code:17:17)',docAccess:{status:'INITIAL_SUCCESS',retries:0,ops:[]}};
 const deps={status:async()=>({build:{commit:'a'.repeat(40)}}),source:async()=>source,index:async()=>({sha:'b'.repeat(40),index:{requests:{}}}),result:async id=>({ok:true,requestId:id,found:false})};
 a.equal((await O.prove({response,...contract,deps})).kind,'NOT_ACCEPTED');
 a.equal(await O.prove({response,...contract,deps:{...deps,source:async()=>source.replace('lock.waitLock','MUTATION(); lock.waitLock')}}),null);
 a.equal(await O.prove({response,...contract,deps:{...deps,index:async()=>({sha:'b'.repeat(40),index:{requests:{'TEST-R1':{s:'PENDING'}}}})}}),null);
 a.equal(await O.prove({response:{ok:false,error:'fetch failed'},...contract,deps}),null);
});
test('fence release binds the original payload, acceptance, every job and every child ID',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'writer-outcome-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const response=contract.cases[0].response,outcome=O.classify(response,contract),tx={requestId:'TEST',payloadSha256:'a'.repeat(64),acceptanceSha256:S.hash(response),ids:['V2I-ONE'],requests:[{requestId:'TEST-R1',primaryId:'V2I-ONE'}]};
 O.record(root,{...tx,response,childRequestIds:['TEST-R1'],outcome});a.equal(O.released(root,tx),true);
 for(const changed of [{payloadSha256:'b'.repeat(64)},{acceptanceSha256:'c'.repeat(64)},{ids:['V2I-OTHER']},{requests:[{requestId:'OTHER',primaryId:'V2I-ONE'}]}])a.equal(O.released(root,{...tx,...changed}),false);
 const file=path.join(root,'receipts/TEST_NOT_ACCEPTED.json'),proof=JSON.parse(fs.readFileSync(file));proof.responseProjection.outcome.phase='AFTER_MUTATION';fs.writeFileSync(file,JSON.stringify(proof));a.equal(O.released(root,tx),false);
});

test('retained deployed-source witness survives a Writer upgrade while absence checks remain fresh',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'writer-witness-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source='function applyRulingBatchToMaster_(requests) {\nvar started = Date.now(), t = { TOTAL_MS: 0 };\nvar lock = LockService.getScriptLock(), lockStart = Date.now();\nlock.waitLock(30000);\n}';const response={ok:false,error:'Lock timeout: another process was holding the lock for too long.',errorStack:'Exception: Lock timeout: another process was holding the lock for too long. | at applyRulingBatchToMaster_ (Code:4:8) | at dispatchWrite_ (Code:22:28) | at doPost (Code:17:17)'};
 const captured=await require('./writer-outcome-witness.cjs').capture({privateDir:dir,requestId:'TEST',response,deps:{status:async()=>({build:{commit:'a'.repeat(40)}}),source:async()=>source}}),witness=S.read(dir,captured.file);
 const deps={status:async()=>({build:{commit:'c'.repeat(40)}}),source:async()=>{throw Error('new source no longer has old stack location');},witness:async()=>witness,index:async()=>({sha:'b'.repeat(40),index:{requests:{}}}),result:async id=>({ok:true,requestId:id,found:false})};
 a.equal((await O.prove({response,...contract,deps})).kind,'NOT_ACCEPTED');
 a.equal(await O.prove({response,...contract,deps:{...deps,result:async id=>({ok:true,requestId:id,found:true,status:'PENDING'})}}),null);
 await a.rejects(O.prove({response,...contract,deps:{...deps,witness:async()=>({...witness,source:'tampered'})}}),/WITNESS_BINDING/);
});
test('pay refusal proofs survive workflow artifacts and every publication retry without immutable overwrites',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/enrich-ats-pay.yml'),'utf8');a.match(workflow,/receipts\/FORGE-ENRICH_ATS-ATSBOT-\*_NOT_ACCEPTED\.json/);a.match(workflow,/for i in 1 2 3 4 5 6; do[\s\S]*for proof in \/tmp\/pay-refusals/);a.match(workflow,/! cmp -s/);a.match(workflow,/xargs -0 -r git add --/);
});

test('public refusal proofs keep only safe projection and separate hashes, never private planned rows or diagnostics',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'writer-proof-privacy-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const secret='PRIVATE_RECRUITER_BODY_SENTINEL recruiter-private@example.invalid',response=structuredClone(contract.cases.find(c=>c.name==='fresh planned optimistic conflict').response);Object.assign(response,{before:secret,after:secret,error:secret,docAccess:{notes:secret}});response.results.forEach(r=>Object.assign(r,{before:secret,after:secret,body:secret}));response.outcome.privateBody=secret;
 const tx={requestId:'TEST',payloadSha256:'a'.repeat(64),acceptanceSha256:S.hash(response),ids:['V2I-ONE'],requests:[{requestId:'TEST-R1',primaryId:'V2I-ONE'}]},outcome=O.classify(response,contract),saved=O.record(root,{...tx,response,childRequestIds:contract.childRequestIds,outcome});
 const publicText=fs.readFileSync(path.join(root,saved.file),'utf8');a.equal(publicText.includes(secret),false);a.equal(saved.proof.response,undefined);a.equal(saved.proof.acceptanceSha256,S.hash(response));a.equal(saved.proof.responseProjectionSha256,S.hash(saved.proof.responseProjection));a.notEqual(saved.proof.acceptanceSha256,saved.proof.responseProjectionSha256);a.equal(O.released(root,tx),true);
 response.results[0].writeId='W-ALREADY-SAVED';const projection=O.project(response,contract);a.equal(O.classify(response,contract).kind,'UNKNOWN');a.equal(O.classify(projection,contract).kind,'UNKNOWN');a.throws(()=>O.record(root,{...tx,requestId:'OTHER',response,acceptanceSha256:S.hash(response),childRequestIds:contract.childRequestIds,outcome}),/NONACCEPTANCE/);
});
test('safe legacy diagnostic can retry source proof after private runner loss without publishing raw stack or private body',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'legacy-projected-record-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source='function applyRulingBatchToMaster_(requests) {\nvar started = Date.now(), t = { TOTAL_MS: 0 };\nvar lock = LockService.getScriptLock(), lockStart = Date.now();\nlock.waitLock(30000);\n}',secret='PRIVATE_STACK_BODY_SENTINEL private@example.invalid';
 const response={ok:false,error:'Lock timeout: another process was holding the lock for too long.',errorStack:'Exception: Lock timeout: another process was holding the lock for too long. | at applyRulingBatchToMaster_ (Code:4:8) | at dispatchWrite_ (Code:22:28) | at doPost (Code:17:17) | '+secret,docAccess:{body:secret}};
 const projected=O.project(response,contract),input={responseProjection:projected,responseProjectionSha256:S.hash(projected),acceptanceSha256:S.hash(response),...contract},deps={status:async()=>({build:{commit:'a'.repeat(40)}}),source:async()=>source,index:async()=>({sha:'b'.repeat(40),index:{requests:{}}}),result:async id=>({ok:true,requestId:id,found:false})};
 a.equal(JSON.stringify(projected).includes(secret),false);await a.rejects(O.prove({...input,deps:{...deps,index:async()=>{throw Error('temporary read failure');}}}),/temporary/);const outcome=await O.prove({...input,deps});a.equal(outcome.kind,'NOT_ACCEPTED');
 const tx={requestId:'TEST',payloadSha256:'a'.repeat(64),acceptanceSha256:input.acceptanceSha256,ids:['V2I-ONE'],requests:[{requestId:'TEST-R1',primaryId:'V2I-ONE'}]},saved=O.record(root,{...input,...tx,outcome});a.equal(saved.proof.acceptanceSha256,input.acceptanceSha256);a.equal(O.released(root,tx),true);a.equal(JSON.stringify(saved.proof).includes(secret),false);
 const unsafe=O.project({...response,writeId:'W-EXISTS'},contract);a.equal(await O.prove({...input,responseProjection:unsafe,responseProjectionSha256:S.hash(unsafe),deps}),null);
});
