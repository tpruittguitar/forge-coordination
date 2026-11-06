'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),W=require('./exception-work.cjs'),Dispatch=require('./exception-order.cjs');
const DIRECTORY='receipts/AI_EXCEPTION_RUNS',FILE='state/AI_EXCEPTION_PROGRESS.json';
const validRun=id=>/^FORGE-EXCEPTION-CHATGPT-[A-Za-z0-9_-]{3,100}$/.test(id||'');
function start(root,runId,size=20,now=Date.now()){
 if(!validRun(runId))throw Error('EXCEPTION_PROGRESS_RUN_ID_REQUIRED');
 const file=DIRECTORY+'/'+runId+'_START.json',prior=S.read(root,file,null);
 if(prior)return prior; // Resuming never changes the original selected bindings.
 const queue=require('./exceptions.cjs').queue(root,{size});
 const manifest={schema:'forge.ai-exception-start.v1',runId,taskKey:W.OWNER,startedAt:new Date(now).toISOString(),dispatchCursor:queue.dispatchCursor||null,selected:queue.items.map(i=>({exceptionId:i.exceptionId,binding:i.binding,kind:i.kind,reason:i.reason,nextAction:i.nextAction,identity:i.identity||null,sourceFile:i.sourceFile||null,priorReviewSha256:i.priorReviewSha256||null,originalTaskKey:i.originalTaskKey||null})),sourceCaptureIsReview:false,artifactSizeOnly:true,noProcessingCap:true};
 S.immutable(root,file,manifest);return manifest;
}
function verifiedProof(root,proof,requestId){
 if(typeof proof!=='string'||!/^receipts\/[A-Za-z0-9_-]+_VERIFIED\.json$/.test(proof))return false;
 const saved=S.read(root,proof,null);
 return saved?.requestId===requestId&&['forge.programmed-coordinator-verification.v1','forge.mail-writer-verification.v1'].includes(saved.schema)&&/^[a-f0-9]{64}$/.test(saved.acceptanceSha256||'');
}
function resolution(root,item){
 if(item.status!=='NO_LONGER_OPEN')return null;
 if(item.kind==='SOURCE'){
  const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{items:{}}),row=state.items[item.binding.key];
  if(row?.status==='VERIFIED'&&row.version===item.binding.sourceVersion&&verifiedProof(root,row.proof,row.transactionId))return{kind:'VERIFIED_CANONICAL_EFFECT',proof:row.proof};
 }
 if(item.kind==='WRITER'){
  const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{transactions:{}}),tx=state.transactions[item.binding.requestId]||S.read(root,'state/MAIL_PROCESSING.json',{transactions:{}}).transactions[item.binding.requestId],proof='receipts/'+item.binding.requestId+'_VERIFIED.json';
  if(tx?.status==='VERIFIED'&&verifiedProof(root,proof,item.binding.requestId))return{kind:'VERIFIED_ORIGINAL_TRANSACTION',proof};
  if(tx?.status==='NOT_ACCEPTED'&&require('../writer-outcome.cjs').released(root,tx))return{kind:'PROVEN_ORIGINAL_NOT_ACCEPTED',proof:tx.notAcceptedProof||'receipts/'+tx.requestId+'_NOT_ACCEPTED.json'};
 }
 if(item.kind==='MAIL'){
  const entry=S.read(root,'state/MAIL_PROCESSING.json',{messages:{}}).messages[item.binding.messageId];
  if(entry?.sourceSha256!==item.binding.sourceVersion)return null;
  if(entry.status==='VERIFIED'&&verifiedProof(root,entry.proof,entry.transactionId))return{kind:'VERIFIED_MAIL_EFFECT',proof:entry.proof};
  if(entry.status==='REVIEWED_CORRESPONDENCE'&&/^[a-f0-9]{64}$/.test(entry.reviewSha256||''))return{kind:'CONSUMED_SOURCE_BOUND_CORRESPONDENCE_REVIEW',reviewSha256:entry.reviewSha256};
 }
 if(item.kind==='INTERVIEW'){
  const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{}),accepted=state.interviewReviews?.resolvedReviews?.find(r=>r.sourceReviewRef===item.binding.sourceReviewRef&&r.sourceVersion===item.binding.sourceVersion&&r.status==='SOURCE_BOUND_REVIEW_CONSUMED'&&r.canonicalWrites===0&&/^[a-f0-9]{64}$/.test(r.correctedBy||'')&&/^[a-f0-9]{64}$/.test(r.eventKey||''));
  const event=accepted&&S.read(root,'state/APPLICATION_OUTCOMES.json',{events:[]}).events.find(e=>e.reviewSha256===accepted.correctedBy||e.sourceReviewSha256===accepted.correctedBy);
  if(event)return{kind:'CONSUMED_SOURCE_BOUND_INTERVIEW_REVIEW',correctedBy:accepted.correctedBy,eventKey:accepted.eventKey};
 }
 // Disappearance, quarantine and a source proposal are not resolution proofs.
 return null;
}
function snapshot(root){
 const progress=S.read(root,FILE,{runs:{}}),open=[];
 for(const file of S.files(path.join(root,DIRECTORY)).filter(f=>f.endsWith('_START.json'))){
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));if(!fs.existsSync(path.join(root,DIRECTORY,manifest.runId+'_CHECKPOINT.json')))open.push({runId:manifest.runId,startedAt:manifest.startedAt,selected:manifest.selected.length,status:'CHECKPOINT_REQUIRED'});
 }
 return{...progress,uncheckpointedRuns:open};
}
function advanceAttempts(work,attempts,runId,file){
 for(const attempt of attempts){const item=work.cases[attempt.exceptionId];if(!item||item.binding.sourceVersion!==attempt.sourceVersion)continue;
  if(!item.lastAttempt||Date.parse(attempt.observedAt)>=Date.parse(item.lastAttempt.observedAt))item.lastAttempt={runId,sourceVersion:attempt.sourceVersion,observedAt:attempt.observedAt,evidenceSha256:attempt.evidenceSha256,reason:attempt.reason,nextAction:attempt.nextAction,proof:file};
  if(!Number.isFinite(Date.parse(work.dispatch?.observedAt||work.dispatch?.reviewedAt))||Date.parse(attempt.observedAt)>=Date.parse(work.dispatch.observedAt||work.dispatch.reviewedAt))work.dispatch={...work.dispatch,lastServedKind:Dispatch.kind(item),exceptionId:item.exceptionId,sourceVersion:attempt.sourceVersion,observedAt:attempt.observedAt,basis:'SOURCE_BOUND_ATTEMPT',artifactSizeOnly:true};
 }
}
function finish(root,receipt,work,file){
 advanceAttempts(work,receipt.attempts,receipt.runId,file);S.save(root,W.FILE,work);
 const progress=S.read(root,FILE,{schema:'forge.ai-exception-progress.v1',runs:{},consecutiveNoReviewProgress:0});
 progress.runs=progress.runs||{};progress.runs[receipt.runId]={proof:file,completedAt:receipt.completedAt,attempted:receipt.attempted,reviewed:receipt.reviewed,resolved:receipt.resolved,waiting:receipt.waiting,status:receipt.status};
 if(!progress.at||Date.parse(receipt.completedAt)>=Date.parse(progress.at)){
  progress.latestRunId=receipt.runId;progress.latestProof=file;progress.consecutiveNoReviewProgress=receipt.consecutiveNoReviewProgress;progress.status=receipt.stalled?'AI_REVIEW_STALLED':receipt.status;progress.nextCase=receipt.nextCase;progress.at=receipt.completedAt;
  if(receipt.reviewed||receipt.resolved)progress.lastProgressAt=receipt.completedAt;
 }
 S.save(root,FILE,progress);return receipt;
}
function checkpoint(root,input,now=Date.now()){
 if(!validRun(input?.runId)||Object.keys(input).some(k=>!['runId','completedAt','attempts','sourceCaptures'].includes(k))||!Number.isFinite(Date.parse(input.completedAt))||Date.parse(input.completedAt)>now+60000||!Array.isArray(input.attempts)||input.sourceCaptures!==undefined&&(!Number.isInteger(input.sourceCaptures)||input.sourceCaptures<0))throw Error('SOURCE_BOUND_EXCEPTION_PROGRESS_REQUIRED');
 const manifest=S.read(root,DIRECTORY+'/'+input.runId+'_START.json',null),work=S.read(root,W.FILE,null);
 if(manifest?.schema!=='forge.ai-exception-start.v1'||!work||Date.parse(input.completedAt)<Date.parse(manifest.startedAt))throw Error('ORIGINAL_EXCEPTION_SELECTION_REQUIRED');
 const selected=new Map(manifest.selected.map(i=>[i.exceptionId,i])),seen=new Set(),attempts=[];
 for(const attempt of input.attempts){
  const original=selected.get(attempt.exceptionId),item=work.cases[attempt.exceptionId];
  if(Object.keys(attempt).some(k=>!['exceptionId','sourceVersion','observedAt','evidenceSha256','reason','nextAction','reviewPath'].includes(k))||seen.has(attempt.exceptionId)||!original||!item||attempt.sourceVersion!==original.binding.sourceVersion||item.binding.sourceVersion!==attempt.sourceVersion||item.status==='NO_LONGER_OPEN'&&!resolution(root,item)||!Number.isFinite(Date.parse(attempt.observedAt))||Date.parse(attempt.observedAt)<Date.parse(manifest.startedAt)-60000||Date.parse(attempt.observedAt)>Date.parse(input.completedAt)||!/^[a-f0-9]{64}$/.test(attempt.evidenceSha256||'')||typeof attempt.reason!=='string'||!attempt.reason.trim()||attempt.reason.length>1000||typeof attempt.nextAction!=='string'||!attempt.nextAction.trim()||attempt.nextAction.length>1000)throw Error('EXACT_SOURCE_EXAMINATION_REQUIRED');
  seen.add(attempt.exceptionId);let review=null;
  if(attempt.reviewPath){
   if(!new RegExp('^'+W.REVIEWS+'/'+attempt.exceptionId+'-[a-f0-9]{64}\\.json$').test(attempt.reviewPath))throw Error('IMMUTABLE_PROGRESS_REVIEW_REQUIRED');
   review=S.read(root,attempt.reviewPath,null);if(!review||attempt.reviewPath!==W.REVIEWS+'/'+attempt.exceptionId+'-'+S.hash(review)+'.json'||review.exceptionId!==attempt.exceptionId||review.runId!==input.runId||review.sourceVersion!==attempt.sourceVersion||Date.parse(review.reviewedAt)<Date.parse(manifest.startedAt)-60000||Date.parse(review.reviewedAt)>Date.parse(input.completedAt))throw Error('IMMUTABLE_PROGRESS_REVIEW_REQUIRED');
   W.validateReview(review,work,now,true);
  }
  attempts.push({...attempt,reviewDisposition:review?.disposition||null});
 }
 const file=DIRECTORY+'/'+input.runId+'_CHECKPOINT.json',existing=S.read(root,file,null),inputSha256=S.hash(input);
 if(existing){if(existing.inputSha256!==inputSha256)throw Error('IMMUTABLE_EXCEPTION_PROGRESS_CHANGED');return finish(root,existing,work,file);}
 // A real source-bound attempt advances fair service even while independently
 // checking its proposal. It does not close the case or reset source retries.
 advanceAttempts(work,attempts,input.runId,file);
 const resolved=manifest.selected.flatMap(original=>{const item=work.cases[original.exceptionId],proof=item&&resolution(root,item);return proof?[{exceptionId:item.exceptionId,...proof}]:[];}),waiting=manifest.selected.filter(i=>['WAITING_SOURCE_CHANGE','AWAITING_TIM'].includes(work.cases[i.exceptionId]?.status)),reviewed=attempts.filter(i=>i.reviewPath),ordered=Dispatch.order(Object.values(work.cases).filter(i=>i.status==='ACTION_REQUIRED'),work.dispatch),next=ordered[0];
 const progress=S.read(root,FILE,{schema:'forge.ai-exception-progress.v1',runs:{},consecutiveNoReviewProgress:0});
 const stillActionable=manifest.selected.filter(i=>work.cases[i.exceptionId]?.binding.sourceVersion===i.binding.sourceVersion&&work.cases[i.exceptionId].status==='ACTION_REQUIRED');
 const superseded=manifest.selected.filter(i=>!work.cases[i.exceptionId]||work.cases[i.exceptionId].binding.sourceVersion!==i.binding.sourceVersion||work.cases[i.exceptionId].status==='NO_LONGER_OPEN'&&!resolved.some(r=>r.exceptionId===i.exceptionId));
 const noReviewProgress=stillActionable.length>0&&reviewed.length===0;
 const consecutive=noReviewProgress?(progress.consecutiveNoReviewProgress||0)+1:0;
 const receipt={schema:'forge.ai-exception-progress-receipt.v1',runId:input.runId,taskKey:W.OWNER,startedAt:manifest.startedAt,completedAt:input.completedAt,inputSha256,selectionSha256:S.hash(manifest),selected:manifest.selected.length,attempted:attempts.length,reviewed:reviewed.length,resolved:resolved.length,waiting:waiting.length,stillActionable:stillActionable.length,superseded: superseded.map(i=>({exceptionId:i.exceptionId,sourceVersion:i.binding.sourceVersion,canonicalResolutionClaimed:false})),awaitingIndependentCode:attempts.filter(i=>i.reviewDisposition==='SOURCE_EVIDENCE'&&!resolved.some(r=>r.exceptionId===i.exceptionId)).length,sourceCaptures:input.sourceCaptures||0,sourceCaptureIsReview:false,attempts,resolutions:resolved,status:!manifest.selected.length?'NO_ACTIONABLE_WORK':superseded.length===manifest.selected.length?'STALE_SELECTION':reviewed.length===manifest.selected.length?'AI_REVIEW_DISPOSITIONS_RECORDED':noReviewProgress?'NO_REVIEW_PROGRESS':!stillActionable.length&&!reviewed.length?'SELECTION_NO_LONGER_ACTIONABLE':'PARTIAL_AI_REVIEW',stalled:noReviewProgress&&consecutive>=2,consecutiveNoReviewProgress:consecutive,nextCase:next?{exceptionId:next.exceptionId,sourceVersion:next.binding.sourceVersion,kind:next.kind,nextAction:next.nextAction||'Examine the exact bound source and publish a durable disposition'}:null,canonicalCompletionsClaimed:0};
 S.immutable(root,file,receipt);return finish(root,receipt,work,file);
}
module.exports={DIRECTORY,FILE,start,checkpoint,snapshot,resolution};
