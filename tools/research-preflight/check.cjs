'use strict';
// Read-only admission to AI research, not to Writer or any other productive lane.
const path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
const DRAIN_TASKS=new Set(['FORGE_INTAKE_SCOPE_REVIEW','FORGE_INTAKE_SOURCE_RECOVERY','FORGE_INTAKE_HELD_RECONCILIATION']);
const ENRICHMENT='FORGE_CHATGPT_ENRICHMENT_RESEARCH';
const MAX_STATE_AGE=24*3600000;
function recent(at,now){const t=Date.parse(at);return Number.isFinite(t)&&t<=now+120000&&now-t<=MAX_STATE_AGE;}
function summary({taskKey,items,eligible,errors={},at,now=Date.now(),source}){
 const counts={},retryTimes=[];for(const item of items){counts[item.status]=(counts[item.status]||0)+1;
  // Only explicit research timers count. A code retry must not release an AI hold.
  const retry=item.status==='SOURCE_VALIDATION_REQUIRED'?item.validation?.retryAfter:
   ['WAITING_EVIDENCE_CHANGE','WAITING_SOURCE_CHANGE'].includes(item.status)?item.review?.retryAfter:null;
  if(Number.isFinite(Date.parse(retry))&&Date.parse(retry)>now)retryTimes.push(Date.parse(retry));
 }
 const blockers=Object.keys(errors).length,stale=!recent(at,now);
 const decision=blockers?'INSPECT_QUEUE':eligible.length?'RESEARCH_REQUIRED':stale?'INSPECT_QUEUE':'IDLE';
 return{schema:'forge.research-preflight.v1',taskKey,checkedAt:new Date(now).toISOString(),source,sourceAt:at||null,
  decision,skipResearch:decision==='IDLE',eligible:eligible.length,counts,reviewErrors:blockers,staleState:stale,
  nextRetryAt:retryTimes.length?new Date(Math.min(...retryTimes)).toISOString():null,
  // Diagnostic only: an unchanged fingerprint NEVER suppresses eligible work.
  researchFingerprint:S.hash(items.map(i=>({key:i.key||i.primaryId||i.exceptionId,sourceVersion:i.sourceVersion||i.binding?.sourceVersion||i.rowSha256,status:i.status,review:i.review||null,validation:i.validation||null}))),
  canonicalWrites:0,canonicalCompletion:false,researchOnly:true,noProcessingCap:true};
}
function check(root,taskKey,{now=Date.now()}={}){
 try{
  if(taskKey==='FORGE_APPLICATION_WRITER_GOFER')return require('./gofer.cjs').check(root,{now});
  const registry=S.read(root,'control/AI_AUTOMATION_TASKS.json'),route=registry.tasks?.[taskKey];
  if(registry.schema!=='forge.ai-automation-tasks.v1'||!route||(!require('../helper-routing/shared.cjs').TASKS[taskKey]&&route.owner!=='ChatGPT')||route.retired)throw Error('CURRENT_CHATGPT_RESEARCH_ROUTE_REQUIRED');
  if(require('../helper-routing/shared.cjs').TASKS[taskKey]){
   const H=require('../helper-routing/shared.cjs'),work=H.load(root);
   if(route.owner!==H.TASKS[taskKey]||route.procedure!=='lanes/FORGE_SHARED_HELPER.txt')throw Error('SHARED_RESEARCH_ROUTE_CHANGED');
   const next=H.next(work,taskKey);return summary({taskKey,items:work.items.filter(i=>i.taskKey===taskKey),eligible:next.items,at:work.at,now,source:H.FILE});
  }
  if(DRAIN_TASKS.has(taskKey)){
   if(route.procedure!=='lanes/CHATGPT_INTAKE_DRAIN.txt')throw Error('DRAIN_RESEARCH_ROUTE_CHANGED');
   const Q=require('../intake-drain/queue.cjs'),work=Q.sync(root,{now}),items=Object.values(work.items).filter(i=>i.taskKey===taskKey);
   const errors={...work.reviewErrors};for(const item of items){
    if(!['ACTION_REQUIRED','ACCOUNTED_UPSTREAM','WAITING_EVIDENCE_CHANGE','SOURCE_VALIDATION_REQUIRED','PENDING_INDEPENDENT_VALIDATION','READY_FOR_CONTROLLED_INTAKE','READY_FOR_CONTROLLED_EXCLUSION'].includes(item.status))errors[item.key]={reason:'UNRESOLVED_QUEUE_STATUS'};
    if(item.status==='SOURCE_VALIDATION_REQUIRED'&&!Number.isFinite(Date.parse(item.validation?.retryAfter)))errors[item.key]={reason:'RESEARCH_RETRY_TIME_REQUIRED'};
   }
   return summary({taskKey,items,eligible:items.filter(i=>Q.researchEligible(i,now)),errors,at:work.upstreamAt,now,source:Q.FILE});
  }
  if(taskKey===ENRICHMENT){
   if(route.procedure!=='lanes/CHATGPT_ENRICHMENT_RESEARCH.txt')throw Error('ENRICHMENT_RESEARCH_ROUTE_CHANGED');
   const Q=require('../helper-routing/enrichment.cjs'),work=Q.validateWork(S.read(root,'control/ENRICHMENT_HELPER_WORK.json'));
   if(!work.enabled||Q.owner(work).taskKey!==taskKey)throw Error('CURRENT_ENABLED_RESEARCH_ASSIGNMENT_REQUIRED');
   const active=Q.assignedIds(work),eligible=work.items.filter(i=>active.has(i.primaryId)&&!/^RETURNED/.test(i.status||''));
   return summary({taskKey,items:work.items,eligible,at:work.at,now,source:'control/ENRICHMENT_HELPER_WORK.json'});
  }
  throw Error('TASK_OUTSIDE_RESEARCH_PREFLIGHT_SCOPE');
 }catch(e){return{schema:'forge.research-preflight.v1',taskKey,checkedAt:new Date(now).toISOString(),decision:'INSPECT_QUEUE',skipResearch:false,reason:e.message,canonicalWrites:0,canonicalCompletion:false,researchOnly:true,noProcessingCap:true};}
}
if(require.main===module){const [taskKey,root]=process.argv.slice(2);console.log(JSON.stringify(check(path.resolve(root||path.join(__dirname,'../..')),taskKey)));}
module.exports={check,summary,recent};
