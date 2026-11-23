const{test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),R=require('./relevance.cjs'),C=require('../programmed-coordinator/collect.cjs');
const repo=path.resolve(__dirname,'../..');
function batch(w,provider,runId='CLAUDE-RELEVANCE-1'){return{schema:'forge.relevance-helper-batch.v1',provider,taskKey:w.taskKey,assignmentId:w.assignmentId,runId,instructionCommit:'a'.repeat(40),items:[{key:w.keys[0],writerSubmitted:false,targetedLookups:1,sourceEvidence:{},recommendation:'RETAIN_RANKED'}]};}
test('relevance helper can only prepare an assigned key once per batch and one lookup',()=>{const w={owner:'Claude',taskKey:'FORGE_CLAUDE_RELEVANCE_REVIEW',assignmentId:'new',keys:['k']},b=batch(w,'Claude');a.equal(R.validate(b,w).productionAuthorized,false);a.throws(()=>R.validate({...b,items:b.items.concat(b.items)},w));a.throws(()=>R.validate({...b,items:[{...b.items[0],targetedLookups:2}]},w));a.throws(()=>R.validate({...b,assignmentId:'old'},w));});
test('lanes have no owner: any authorized provider returns relevance evidence, the provider is recorded, never a gate',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'relevance-neutral-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'control'));
 const taskKey='FORGE_CLAUDE_RELEVANCE_REVIEW',workAssignments='control/CLAUDE_RELEVANCE_WORK.json',write=(keys=['synthetic:one'])=>{fs.writeFileSync(path.join(root,'control/AI_AUTOMATION_TASKS.json'),JSON.stringify({schema:'forge.ai-automation-tasks.v1',authorizedProviders:['ChatGPT','Claude','Hermes'],formerProviders:['Grok'],laneKeys:{FORGE_RELEVANCE_REVIEW:taskKey},tasks:{[taskKey]:{workAssignments}}}));fs.writeFileSync(path.join(root,workAssignments),JSON.stringify({schema:'forge.relevance-helper-work.v1',enabled:true,owner:'ChatGPT',taskKey,assignmentId:'NEUTRAL-FIXTURE',keys}));};
 write();const w=R.load(root);
 for(const provider of ['ChatGPT','Claude','Hermes'])a.equal(R.validate(batch(w,provider,'CLAUDE-RELEVANCE-'+provider.toUpperCase()),w,root).valid,true);
 a.equal(R.providerAccepted({provider:'Hermes',taskKey:'FORGE_RELEVANCE_REVIEW'},root),true);
 for(const provider of ['Grok','Bogus'])a.throws(()=>R.validate(batch(w,provider,'CLAUDE-RELEVANCE-X'),w,root),/Invalid relevance evidence envelope/);
 write(['k','k']);a.throws(()=>R.load(root),/Invalid relevance assignment/);
});
