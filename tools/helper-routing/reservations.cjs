'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE=path.resolve(__dirname,'../../control/CLAUDE_HELPER_WORK.json');
const TASKS=['FORGE_CLAUDE_INTAKE_A','FORGE_CLAUDE_INTAKE_B','FORGE_CLAUDE_ENRICHMENT'];
function shard(key){return crypto.createHash('sha256').update(key).digest()[0]%2;}
function validate(x){
 if(x?.schema!=='forge.claude-helper-work.v1'||!Array.isArray(x.intake)||!Array.isArray(x.enrichment)||typeof x.enabled!=='boolean')throw Error('Invalid Claude helper reservations');
 const keys=new Set(),ids=new Set();for(const r of x.intake){if(!r.key||r.task!==TASKS[shard(r.key)])throw Error('Overlapping or incorrect intake shard');for(const k of new Set([r.key,...r.aliases||[]])){if(keys.has(k))throw Error('Overlapping intake alias');keys.add(k);}}
 for(const r of x.enrichment){if(!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(r.primaryId)||ids.has(r.primaryId)||r.task!==TASKS[2])throw Error('Invalid enrichment reservation');ids.add(r.primaryId);}return x;
}
function load(file=FILE){return validate(JSON.parse(fs.readFileSync(file,'utf8')));}
function intakeOwner(key,x=load()){return x.enabled?x.intake.find(r=>r.key===key||(r.aliases||[]).includes(key))?.task||null:null;}
function enrichmentIds(x=load()){return new Set(x.enabled?x.enrichment.map(r=>r.primaryId):[]);}
function validateBatch(batch,x=load()){
 const historical=!x.enabled&&x.transfer?.status==='COMPLETE'&&x.transfer.to==='ChatGPT'&&typeof x.transfer.proof==='string'&&x.transfer.proof.startsWith('receipts/');
 if((!x.enabled&&!historical)||batch?.schema!=='forge.claude-helper-batch.v1'||batch.provider!=='Claude'||!TASKS.includes(batch.taskKey)||batch.assignmentId!==x.assignmentId||!Array.isArray(batch.items)||!batch.items.length||batch.items.length>20||!batch.runId||!batch.instructionCommit)throw Error('Invalid helper batch envelope');
 let releasedItems=0;
 const seen=new Set();for(const item of batch.items){const key=item.key||item.primaryId;if(!key||seen.has(key))throw Error('Duplicate helper item');seen.add(key);const owner=batch.taskKey===TASKS[2]?(x.enrichment.find(r=>r.primaryId===key)?.task):(historical?x.intake.find(r=>r.key===key||(r.aliases||[]).includes(key))?.task:intakeOwner(key,x));
  // A partially consumed immutable batch stays readable after proven items are
  // released. This validates historical assignment only: intakeOwner() and
  // enrichmentIds() still exclude released work from production ownership.
  const released=!owner&&(x.released||[]).some(r=>(r.key||r.primaryId)===key&&r.task===batch.taskKey&&typeof r.proof==='string'&&r.proof.startsWith('receipts/'));
  if(owner!==batch.taskKey&&!released)throw Error('Item outside assigned work');if(released)releasedItems++;if(!item.sourceEvidence||!item.recommendation||item.writerSubmitted!==false)throw Error('Evidence-only result required');}
 return{valid:true,taskKey:batch.taskKey,items:seen.size,activeItems:historical?0:seen.size-releasedItems,releasedItems,historicalItems:historical?seen.size:releasedItems,coordinator:historical?'ChatGPT':null,productionAuthorized:false};
}
if(require.main===module){const [mode,file,after]=process.argv.slice(2);try{const x=load();if(mode==='validate')console.log(JSON.stringify(validateBatch(JSON.parse(fs.readFileSync(file,'utf8')),x)));else if(TASKS.includes(mode)){if(!x.enabled)throw Error('Claude preparation assignment is disabled; local coordination owns the retained work');const all=(mode===TASKS[2]?x.enrichment:x.intake).filter(r=>r.task===mode),i=file==='--after'?all.findIndex(r=>(r.key||r.primaryId)===after):-1;if(file&&file!=='--after'||file==='--after'&&i<0)throw Error('Unknown continuation; never silently restart');const items=all.slice(i+1,i+21);console.log(JSON.stringify({assignmentId:x.assignmentId,mode:'EVIDENCE_ONLY',taskKey:mode,total:all.length,items,nextAfter:items.at(-1)?.key||items.at(-1)?.primaryId||null}));}else throw Error('Supply task key or validate <batch.json>');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={TASKS,shard,validate,load,intakeOwner,enrichmentIds,validateBatch};
