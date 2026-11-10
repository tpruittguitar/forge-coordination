'use strict';
// Read-only producer selection. Progress suppresses repeat work; it never grants
// write authority, changes reservations, or establishes canonical completion.
const fs=require('node:fs');
const Shared=require('./shared.cjs');
const TASK='FORGE_GROK_SHARED_HELPER';
const PHASES=new Set(['RESEARCH_BLOCKED','RESEARCH_READY','SUBMISSION_NOT_ATTEMPTED',
 'SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN','QUEUED','RESULT_RECEIVED','COMPLETE_PENDING_READBACK',
 'VERIFIED','NO_CHANGE','RECONCILIATION_REQUIRED','HELPER_RETURN_DELIVERED']);
const ATTEMPTED=new Set(['SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN','QUEUED','RESULT_RECEIVED',
 'COMPLETE_PENDING_READBACK','RECONCILIATION_REQUIRED','HELPER_RETURN_DELIVERED']);
function select(work,progress,now=Date.now(),limit=20){
 Shared.validateWork(work);
 if(!Array.isArray(progress)||!Number.isInteger(limit)||limit<1||limit>100)throw Error('DIRECT_PROGRESS_REQUIRED');
 const byId=new Map(),recordIds=new Set();
 for(const p of progress){
  if(!p||!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(p.primaryId||'')||!PHASES.has(p.phase)||
   !Number.isInteger(p.assignmentVersion)||p.assignmentVersion<1||!p.sourceVersion||!p.recordId||recordIds.has(p.recordId)||!Number.isFinite(Date.parse(p.observedAt)))throw Error('INVALID_DIRECT_PROGRESS');
  recordIds.add(p.recordId);
  const history=byId.get(p.primaryId)||[];history.push(p);byId.set(p.primaryId,history);
 }
 const mine=work.items.filter(i=>i.taskKey===TASK),ordering=Shared.ordering(mine,now),selected=[],skipped=[];
 if(!work.enabled||!work.routingActive||!work.providers[TASK].available)return{items:[],skipped:[],status:'UNAVAILABLE',canonicalCompletion:false};
 for(const item of ordering.actionable.sort(ordering.sort)){
  if(item.kind!=='ENRICHMENT'){skipped.push({primaryId:Shared.key(item),reason:'EXISTING_NON_ENRICH_ROUTE'});continue;}
  const history=byId.get(item.primaryId)||[];
  // An immutable later VERIFIED record can reconcile only its exact original
  // request. Historical ambiguous attempts without such a record remain fenced.
  const reconciled=history.filter(p=>p.phase==='VERIFIED'&&typeof p.requestId==='string'&&p.requestId.trim());
  let reason=null;
  if(history.some(p=>ATTEMPTED.has(p.phase)&&(!p.requestId||!reconciled.some(v=>v.requestId===p.requestId&&Date.parse(v.observedAt)>Date.parse(p.observedAt)))))reason='ORIGINAL_TRANSACTION_FENCED';
  const matching=history.filter(p=>p.assignmentVersion===item.assignmentVersion&&p.sourceVersion===item.sourceVersion);
  const terminalAt=Math.max(-Infinity,...matching.filter(p=>p.phase==='VERIFIED').map(p=>Date.parse(p.observedAt)));
  const same=matching.filter(p=>Date.parse(p.observedAt)>=terminalAt);
  if(!reason&&same.some(p=>['VERIFIED','NO_CHANGE'].includes(p.phase)&&!(Array.isArray(p.remainingFields)&&p.remainingFields.length)))reason='UNCHANGED_WORK_ALREADY_HANDLED';
  if(!reason&&same.some(p=>['RESEARCH_READY','SUBMISSION_NOT_ATTEMPTED'].includes(p.phase)))reason='RESUME_SAVED_ARTIFACT_NOT_RESEARCH';
  const blocked=same.filter(p=>p.phase==='RESEARCH_BLOCKED').sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
  if(!reason&&blocked.length&&!(blocked[0].retryAfter&&Number.isFinite(Date.parse(blocked[0].retryAfter))&&Date.parse(blocked[0].retryAfter)<=now))reason='UNCHANGED_SOURCE_BLOCK';
  if(reason)skipped.push({primaryId:item.primaryId,reason});else selected.push(item);
 }
 // Scan past handled items instead of truncating the first stale assignment page.
 return{schema:'forge.grok-direct-next.v1',items:selected.slice(0,limit),remaining:selected.length,
  skipped,status:selected.length?'WORK_AVAILABLE':'NO_NEW_ELIGIBLE_WORK',canonicalCompletion:false};
}
if(require.main===module){try{
 const [command,file]=process.argv.slice(2);if(command!=='next'||!file)throw Error('Use next <fresh-work-and-private-progress.json>');
 const input=JSON.parse(fs.readFileSync(file,'utf8'));console.log(JSON.stringify(select(input.work,input.progress)));
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={select};
