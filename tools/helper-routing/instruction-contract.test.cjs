'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs');
const TASK='FORGE_CLAUDE_SHARED_HELPER',DEFAULT='policy/current/AI_AUTOMATION_COMMON.txt',SCOPED='policy/current/SHARED_HELPER_COMMON.txt';
function fixture(t,{oldCommon=SCOPED,newCommon=SCOPED}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'instruction-contract-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const task={owner:'Claude',route:'utility',procedure:'lanes/FORGE_SHARED_HELPER.txt',executionMode:'EVIDENCE_ONLY',workAssignments:'control/SHARED_HELPER_WORK.json'};
 const registry=common=>({common:DEFAULT,tasks:{[TASK]:{...task,...(common===undefined?{}:{common})}}});
 const old=registry(oldCommon),now=registry(newCommon),item={kind:'ENRICHMENT',primaryId:'V2I-ONE',provider:'Claude',taskKey:TASK,assignmentVersion:1,sourceVersion:'a'.repeat(64)};
 const work={assignmentId:'TEST',enabled:true,routingActive:true,items:[item]};
 S.save(root,'control/AI_AUTOMATION_TASKS.json',now);S.save(root,task.workAssignments,work);
 const files=new Map([['control/AI_AUTOMATION_TASKS.json',JSON.stringify(old)],[task.workAssignments,JSON.stringify(work)],[DEFAULT,'general'],[SCOPED,'scoped'],[task.procedure,'procedure']]);
 for(const file of [DEFAULT,SCOPED,task.procedure]){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),files.get(file));}
 const reads=[];const historical=(_root,_sha,file)=>{reads.push(file);if(!files.has(file))throw Error('MISSING_HISTORICAL_CONTRACT');return files.get(file);};
 const batch={schema:'forge.shared-helper-batch.v1',provider:'Claude',taskKey:TASK,instructionCommit:'b'.repeat(40),items:[item]};
 return{root,files,reads,now,batch,run:()=>C.routingProof(root,batch,'c'.repeat(40),historical)};
}
test('shared proof reads only selected current and historical common contracts',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.root,DEFAULT));const proof=f.run();
 a.equal(proof.contractChanged,false);a.equal(proof.commonAtInstruction,SCOPED);a.equal(proof.commonAtCurrent,SCOPED);a.equal(proof.currentPolicyRecheckRequired,true);a.ok(!f.reads.includes(DEFAULT));
});
test('pre-split returns retain provenance and require current-policy recheck',t=>{
 const f=fixture(t,{oldCommon:DEFAULT});const proof=f.run();a.equal(proof.contractChanged,true);a.equal(proof.commonAtInstruction,DEFAULT);a.equal(proof.commonAtCurrent,SCOPED);a.equal(proof.currentPolicyRecheckRequired,true);
});
test('routes without override retain registry default and legacy fallback',t=>{
 const f=fixture(t);delete f.now.tasks[TASK].common;S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);const old=JSON.parse(f.files.get('control/AI_AUTOMATION_TASKS.json'));delete old.tasks[TASK].common;f.files.set('control/AI_AUTOMATION_TASKS.json',JSON.stringify(old));
 a.equal(f.run().commonAtCurrent,DEFAULT);delete f.now.common;S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);a.equal(f.run().commonAtCurrent,DEFAULT);
});
test('missing selected or historical contracts fail rather than loading general instructions',t=>{
 const f=fixture(t);f.files.delete(SCOPED);a.throws(f.run,/MISSING_HISTORICAL_CONTRACT/);f.files.set(SCOPED,'scoped');fs.unlinkSync(path.join(f.root,SCOPED));a.throws(f.run,/ENOENT/);
});
test('changed common does not hide a missing procedure or changed owner',t=>{
 const f=fixture(t,{oldCommon:DEFAULT});f.files.delete('lanes/FORGE_SHARED_HELPER.txt');a.throws(f.run,/MISSING_HISTORICAL_CONTRACT/);
 f.now.tasks[TASK].owner='Grok';S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);a.throws(f.run,/STALE_TASK_ROUTING/);
});
test('selected contract references cannot escape policy or be malformed',t=>{
 for(const common of ['../secret','policy/../secret.txt','/tmp/secret.txt',null,'',42]){
  const f=fixture(t);f.now.tasks[TASK].common=common;S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);
  a.throws(f.run,/INVALID_COMMON_CONTRACT/);
 }
});
test('same-owner evidence-only returns survive the explicit supported write-through transition without prior write authority',t=>{
 const f=fixture(t);f.batch.items[0].writerSubmitted=false;f.now.tasks[TASK].executionMode='WRITE_THROUGH_SUPPORTED_WRITER';S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);
 const proof=f.run();a.equal(proof.writeThroughEvidenceMigration,true);a.equal(proof.contractChanged,true);a.equal(proof.currentPolicyRecheckRequired,true);
 f.batch.items[0].writerSubmitted=true;a.throws(f.run,/STALE_TASK_ROUTING/);
});
test('write-through migration never excuses retired routes, changed ownership or the reverse transition',t=>{
 for(const change of ['owner','procedure','assignment','retired','reverse']){
  const f=fixture(t);f.batch.items[0].writerSubmitted=false;f.now.tasks[TASK].executionMode='WRITE_THROUGH_SUPPORTED_WRITER';
  if(change==='owner')f.now.tasks[TASK].owner='Grok';
  if(change==='procedure')f.now.tasks[TASK].procedure='lanes/OTHER.txt';
  if(change==='assignment')f.now.tasks[TASK].workAssignments='control/OTHER.json';
  if(change==='retired')S.save(f.root,'control/CHATGPT_OWNER_CUTOVER.json',{retired:[{taskKey:TASK,assignmentId:'OLD'}]});
  if(change==='reverse'){const old=JSON.parse(f.files.get('control/AI_AUTOMATION_TASKS.json'));old.tasks[TASK].executionMode='WRITE_THROUGH_SUPPORTED_WRITER';f.files.set('control/AI_AUTOMATION_TASKS.json',JSON.stringify(old));f.now.tasks[TASK].executionMode='EVIDENCE_ONLY';}
  S.save(f.root,'control/AI_AUTOMATION_TASKS.json',f.now);a.throws(f.run,/STALE_TASK_ROUTING/,change);
 }
});
