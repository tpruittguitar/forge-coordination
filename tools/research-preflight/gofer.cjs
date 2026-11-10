'use strict';
// Cheap, local admission to Gofer investigation. No network, source research,
// lock acquisition, Writer calls, or canonical mutations occur in this module.
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
const W=require('../routine-handoffs/exception-work.cjs'),X=require('../routine-handoffs/exceptions.cjs'),E=require('../helper-routing/enrichment.cjs');
const TASK='FORGE_APPLICATION_WRITER_GOFER',STATE='gofer-preflight.json',MAX_AGE=24*3600000;
const assigned=i=>i.taskKey===TASK||i.alsoAssignedTo===TASK;
const stamp=(at,now)=>Number.isFinite(Date.parse(at))&&Date.parse(at)<=now+120000&&now-Date.parse(at)<=MAX_AGE;
function fileHash(root,file){try{return S.hash(fs.readFileSync(path.join(root,file)));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function originalEvidence(root,item,state,privateDir){
 const id=item.binding?.requestId||item.requestId;
 if(!id)return {sha256:S.hash({binding:item.binding}),available:false};
 if(!/^[A-Za-z0-9_-]{1,180}$/.test(id))throw Error('INVALID_ORIGINAL_REQUEST_ID');
 const tx=state.transactions?.[id],proofs={};
 for(const suffix of ['_CHECKPOINT.json','_VERIFIED.json','_NOT_ACCEPTED.json'])proofs[suffix]=fileHash(root,'receipts/'+id+suffix);
 const acceptance=privateDir?fileHash(privateDir,id+'-acceptance.json'):null;
 const payload=privateDir?fileHash(privateDir,id+'-payload.json'):null;
 const value={sourceVersion:item.binding?.sourceVersion,requestId:id,tx:tx?{status:tx.status,payloadSha256:tx.payloadSha256,acceptanceSha256:tx.acceptanceSha256,verifiedIds:tx.verifiedIds,reason:tx.reason}:null,proofs,acceptance,payload};
 return {sha256:S.hash(value),available:!!(acceptance||tx?.acceptanceSha256||proofs['_VERIFIED.json']||proofs['_NOT_ACCEPTED.json'])};
}
function reviewed(root,item,work,now){
 if(!item.review)return null;
 const ref=item.review.proof;
 if(!new RegExp('^'+W.REVIEWS+'/[a-f0-9]{64}-[a-f0-9]{64}\\.json$').test(ref||''))throw Error('IMMUTABLE_EXCEPTION_REVIEW_REQUIRED');
 const record=S.read(root,ref);W.validateReview(record,work,now,true);
 if(record.exceptionId!==item.exceptionId||record.sourceVersion!==item.binding.sourceVersion||S.hash(record)!==item.review.sha256||!ref.endsWith('-'+S.hash(record)+'.json'))throw Error('IMMUTABLE_EXCEPTION_REVIEW_REQUIRED');
 return record;
}
function exceptionView(root,work,state,{now,privateDir,previous={}}){
 const items=[],observations={},errors=[],counts={},future=[];
 for(const raw of X.currentCases(work,now).filter(assigned)){
  if(raw.status==='NO_LONGER_OPEN'){counts.closed=(counts.closed||0)+1;continue;}
  let item={...raw};
  try{
   if(!['ACTION_REQUIRED','WAITING_SOURCE_CHANGE','AWAITING_TIM'].includes(item.status))throw Error('UNKNOWN_EXCEPTION_STATUS');
   const review=reviewed(root,item,work,now),e=originalEvidence(root,item,state,privateDir),prior=previous[item.exceptionId];
   // Compare only this request's evidence. Global HEAD, observed times, unrelated
   // rows and a production lock cannot reopen an unchanged investigation.
   const sameReview=prior?.reviewSha256===(item.review?.sha256||null);
   const baseline=review?.retryEvidenceSha256||(sameReview?prior?.baseline:e.sha256);
   const changed=e.sha256!==baseline||(!prior&&!review?.retryEvidenceSha256&&e.available);
   observations[item.exceptionId]={reviewSha256:item.review?.sha256||null,baseline,observed:e.sha256,unreviewedChange:sameReview&&prior?.unreviewedChange||changed};
   if(item.status==='WAITING_SOURCE_CHANGE'&&!review)throw Error('SOURCE_BOUND_WAIT_REQUIRED');
   if(item.status==='WAITING_SOURCE_CHANGE'&&item.kind==='WRITER'&&review.retryCondition==='ORIGINAL_WRITER_EVIDENCE_CHANGED'&&observations[item.exceptionId].unreviewedChange)item={...item,status:'ACTION_REQUIRED',trigger:'ORIGINAL_WRITER_EVIDENCE_CHANGED'};
   if(item.status==='AWAITING_TIM'&&review?.askPath){const answer=review.askPath.replace('asks/open/','asks/resolved/');if(fileHash(root,answer))item={...item,status:'ACTION_REQUIRED',trigger:'RECORDED_TIM_ANSWER'};}
   if(Date.parse(review?.retryAfter)>now)future.push(Date.parse(review.retryAfter));
   counts[item.status]=(counts[item.status]||0)+1;
   if(item.status==='ACTION_REQUIRED')items.push({exceptionId:item.exceptionId,requestId:item.binding?.requestId||null,sourceVersion:item.binding?.sourceVersion,trigger:item.trigger||'ACTION_REQUIRED',retryEvidenceSha256:e.sha256});
  }catch(e){errors.push({exceptionId:item.exceptionId,reason:e.message});}
 }
 // A pending original absent from the dispatch ledger is not proof of idle.
 const represented=new Set(Object.values(work.cases).filter(i=>i.status!=='NO_LONGER_OPEN').map(i=>i.binding?.requestId).filter(Boolean));
 for(const tx of Object.values(state.transactions||{}))if(!['VERIFIED','NOT_ACCEPTED'].includes(tx.status)&&!represented.has(tx.requestId))errors.push({requestId:tx.requestId,reason:'PENDING_ORIGINAL_NOT_IN_EXCEPTION_QUEUE'});
 return {items,observations,errors,counts,nextRetryAt:future.length?new Date(Math.min(...future)).toISOString():null};
}
function check(root,{now=Date.now(),snapshot,privateDir,previous={}}={}){
 const errors=[],at=new Date(now).toISOString();let privateEvidenceChecked=false;
 if(privateDir){try{privateEvidenceChecked=fs.statSync(privateDir).isDirectory();fs.accessSync(privateDir,fs.constants.R_OK);}catch{privateEvidenceChecked=false;}if(!privateEvidenceChecked){errors.push({reason:'PRIVATE_ORIGINAL_EVIDENCE_UNAVAILABLE'});privateDir=undefined;}}
 let exceptions={items:[],observations:{},counts:{},errors:[]},research={items:[],counts:{}},sourceAt=null;
 try{
  const registry=S.read(root,'control/AI_AUTOMATION_TASKS.json'),route=registry.tasks?.[TASK];
  if(registry.schema!=='forge.ai-automation-tasks.v1'||route?.owner!=='ChatGPT'||route?.retired||route.route!=='runtime')throw Error('CURRENT_GOFER_ROUTE_REQUIRED');
  const work=S.read(root,W.FILE),state=S.read(root,'state/PROGRAMMED_COORDINATOR.json');
  if(work.schema!=='forge.ai-exception-work.v1'||!work.cases||!state.transactions)throw Error('CURRENT_EXCEPTION_QUEUE_REQUIRED');
  if(!privateEvidenceChecked&&!errors.some(e=>e.reason==='PRIVATE_ORIGINAL_EVIDENCE_UNAVAILABLE')&&Object.values(work.cases).some(i=>assigned(i)&&i.kind==='WRITER'&&i.status!=='NO_LONGER_OPEN'))errors.push({reason:'PRIVATE_ORIGINAL_EVIDENCE_UNAVAILABLE'});
  sourceAt=work.at;exceptions=exceptionView(root,work,state,{now,privateDir,previous:previous.observations});errors.push(...exceptions.errors);
  if(!stamp(work.at,now))errors.push({reason:'EXCEPTION_QUEUE_REFRESH_REQUIRED'});
  if(Object.keys(work.reviewErrors||{}).length)errors.push({reason:'EXCEPTION_REVIEW_ERRORS_REQUIRE_CODE_INSPECTION'});
  const recovery=S.read(root,'state/enrich-ats-pay-recovery.json',snapshot?{schema:'forge.enrichment-recovery.v1',rows:[],pendingWrites:{}}:undefined),w=E.validateWork(S.read(root,'control/ENRICHMENT_HELPER_WORK.json'));
  if(snapshot)research=require('../helper-routing/enrichment-plan.cjs').plan({root,snapshot,now,state,work:w,recovery});
  else {
   const returned=new Set(w.items.filter(i=>/^RETURNED|^(CONSUMED|PROTECTED_SKIP|ALREADY_COMPLETE|RELEASED)$/.test(i.status||'')).map(i=>i.primaryId));
   const candidates=recovery.rows.filter(i=>['SOURCE_RESEARCH_REQUIRED','NOT_YET_ATTEMPTED'].includes(i.status)&&!returned.has(i.id)&&(!i.retryAt||Date.parse(i.retryAt)<=now));
   research={items:[],counts:{canonicalRefreshCandidates:candidates.length,returnedPreserved:returned.size},fingerprint:S.hash(candidates.map(i=>({id:i.id,status:i.status,needs:i.needs,attempts:i.attempts,retryAt:i.retryAt})))};
   // An old exhausted assignment is not a current zero-work conclusion. Refresh
   // canonical inputs in code, then run this gate again; do not start AI searches.
   errors.push({reason:'FRESH_CANONICAL_RESEARCH_PLAN_REQUIRED'});
   if(!stamp(recovery.at,now))errors.push({reason:'SALARY_GAP_REPORT_REFRESH_REQUIRED'});
  }
 }catch(e){errors.push({reason:e.message});}
 const eligibleSalary=research.items.filter(i=>i.missingFields?.includes('SALARY')).length;
 const hasWork=exceptions.items.length>0||research.items.length>0,decision=hasWork?'WORK_AVAILABLE':errors.length?'INPUT_REFRESH_REQUIRED':'IDLE';
 const fingerprint=S.hash({exceptions:exceptions.items,observations:exceptions.observations,research:research.fingerprint||null,errors});
 const failures=S.hash(errors),unchangedFailure=previous.failureFingerprint===failures;
 return {schema:'forge.gofer-preflight.v1',taskKey:TASK,at,sourceAt,decision,skipInvestigation:!hasWork,skipSalaryResearch:research.items.length===0,
  actionableExceptions:exceptions.items.length,eligibleResearchRoles:research.items.length,eligibleSalaryRoles:eligibleSalary,exceptionCounts:exceptions.counts,researchCounts:research.counts,
  exceptionItems:exceptions.items,researchItems:research.items.map(i=>({primaryId:i.primaryId,missingFields:i.missingFields,sourceFingerprint:i.sourceFingerprint,assignmentSourceFingerprint:i.assignmentSourceFingerprint})),requiresPublishedMembership:research.requiresPublishedMembership||false,
  errors,originalPrivateEvidenceChecked:privateEvidenceChecked,nextRetryAt:exceptions.nextRetryAt,fingerprint,failureFingerprint:failures,observations:exceptions.observations,
  notify:errors.length>0&&!unchangedFailure,notificationReason:errors.length&&!unchangedFailure?'NEW_INPUT_FAILURE':null,
  rolesResearched:0,salaryEstimatesPrepared:0,submitted:0,independentlyVerified:0,receiptChecks:0,aiInvestigations:0,sourceReads:0,writerCalls:0,noReplay:true,canonicalCompletion:false};
}
function run(root,{stateDir,runId,...options}){
 if(!stateDir||!/^FORGE-GOFER-CHATGPT-[A-Za-z0-9_-]{3,100}$/.test(runId||''))throw Error('PRIVATE_STATE_AND_RUN_ID_REQUIRED');
 const previous=S.read(stateDir,STATE,{}),result=check(root,{...options,previous});
 const file=runId+'_PREFLIGHT.json';S.immutable(stateDir,file,result);
 S.save(stateDir,STATE,{schema:'forge.gofer-preflight-state.v1',at:result.at,runId,fingerprint:result.fingerprint,failureFingerprint:result.failureFingerprint,observations:result.observations});
 // No private evidence content, path or watch state is printed to model context.
 const {observations,...compact}=result;return {...compact,receipt:file};
}
if(require.main===module){try{
 const args=process.argv.slice(2),root=path.resolve(args.shift()||'.'),take=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 const snapshotFile=take('--snapshot'),options={snapshot:snapshotFile?JSON.parse(fs.readFileSync(snapshotFile,'utf8')):undefined,privateDir:take('--private-dir'),stateDir:take('--state-dir'),runId:take('--run-id')};
 const result=options.stateDir?run(root,options):check(root,options);const {observations,...out}=result;console.log(JSON.stringify(out));
 }catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={check,run,exceptionView,originalEvidence,TASK};
