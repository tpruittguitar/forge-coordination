'use strict';
const fs=require('node:fs'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const FILE='state/AI_EXCEPTION_WORK.json',REVIEWS='receipts/AI_EXCEPTION_REVIEWS',OWNER='FORGE_APPLICATION_OUTCOME_TRACKER';
const immediate=new Set(['WORKING_SOURCE_ROUTE_REQUIRED','INVALID_PUBLIC_SOURCE_URL','SOURCE_HTTP_404','SOURCE_HTTP_410']);
const repeated=new Set(['STRUCTURED_POSTING_UNAVAILABLE','INCOMPLETE_POSTING','INCOMPLETE_ATS_POSTING_IDENTITY','SOURCE_HTTP_403','SOURCE_HTTP_429','SOURCE_ROUTE_BACKOFF']);
const empty=()=>({schema:'forge.ai-exception-work.v1',cases:{},reviewErrors:{}});
const terminal=s=>/^(VERIFIED|PROTECTED|EXISTING|NO_MISSING)/.test(s||'');
function candidates(root,report,state,now=Date.now()){
 const jobs=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{},sources:{}}),items=[];
 const input=[...(report.aiExceptions||[]),...(report.routineHandoffs?.assignments?.exceptions||[]),...(report.routineHandoffs?.mail?.exceptions||[])];
 for(const e of report.codeExceptions||[]){const item=state.items?.[e.key];if(!item||item.transactionId||terminal(item.status)||state.batches?.[item.batch]?.status!=='VALIDATED')continue;
  // Escalate after repeated code attempts, while retaining the code retry clock.
  // A host backoff must not hide an already-persistent failure from its reviewer.
  if(immediate.has(e.reason)||repeated.has(e.reason)&&(item.attempts||0)>=2)input.push({...e,escalatedFrom:'CODE'});
 }
 for(const e of input){if(e.owner!=='AI'&&!e.escalatedFrom)continue;const item=state.items?.[e.key];if(item?.transactionId||terminal(item?.status))continue;
  const job=jobs.jobs[e.key]||jobs.jobs[item?.itemKey],identity=job?{company:job.company,title:job.title,location:job.location,url:job.url}:null;
  const reason=/^SOURCE_(?:HTTP_(?:403|429)|ROUTE_BACKOFF)$/.test(e.reason)?'SOURCE_ACCESS_BLOCKED':e.reason;
  const binding={key:e.key||null,messageId:e.messageId||null,requestId:e.requestId||null,reason,sourceVersion:e.itemVersion||item?.version||e.sourceSha256||S.hash(identity||{key:e.key,messageId:e.messageId,requestId:e.requestId,reason}),recoveryReview:item?.sourceRecoveryReview||null};
  const exceptionId=S.hash(binding);items.push({...e,exceptionId,binding,kind:item?'SOURCE':e.messageId?'MAIL':'IDENTITY',owner:'ChatGPT',taskKey:OWNER,originalTaskKey:item?.taskKey||null,identity,
   nextAction:e.escalatedFrom?'Review the saved source failure. Supply exact replacement source evidence for independent code verification, or record a source-bound waiting disposition.':'Resolve interpretation or identity with source evidence; preserve protected decisions and pending writes.',
   accessRule:'Respect source refusals and retry-after. Never bypass a refused platform through another provider.',canonicalCompletion:false});
 }
 for(const [sourceId,source] of Object.entries(jobs.sources))if(source.status==='HISTORICAL_RESULTS_UNAVAILABLE'){
  const binding={sourceId,reason:'HISTORICAL_SOURCE_IDENTITIES_MISSING',sourceVersion:S.hash({sourceId,advertisedUnseen:source.advertisedUnseen,historicalCoverage:source.historicalCoverage,historicalCards:source.originalAlertRecovery||source.originalAlertEvidence||null})};
  items.push({exceptionId:S.hash(binding),binding,kind:'HISTORICAL',owner:'ChatGPT',taskKey:OWNER,reason:binding.reason,sourceId,advertisedUnseen:source.advertisedUnseen,historicalCoverage:source.historicalCoverage,nextAction:'Inspect original saved alert evidence and exact contemporaneous identities. If identities are unavailable, record WAITING_SOURCE_CHANGE; do not invent jobs or claim historical coverage.',canonicalCompletion:false});
 }
 return[...new Map(items.map(i=>[i.exceptionId,i])).values()];
}
function validateReview(record,work,now=Date.now(),allowClosed=false){
 const item=work.cases[record.exceptionId];
 if(record.schema!=='forge.ai-exception-review.v1'||!item||!allowClosed&&item.status==='NO_LONGER_OPEN'||record.exceptionId!==S.hash(item.binding)||record.sourceVersion!==item.binding.sourceVersion||record.reviewedBy!=='CHATGPT'||record.taskKey!==OWNER||!Number.isFinite(Date.parse(record.reviewedAt))||Date.parse(record.reviewedAt)>now+60000||!/^FORGE-EXCEPTION-CHATGPT-[A-Za-z0-9_-]{3,100}$/.test(record.runId||''))throw Error('CURRENT_SOURCE_BOUND_EXCEPTION_REVIEW_REQUIRED');
 const allowed=['schema','exceptionId','sourceVersion','reviewedBy','taskKey','reviewedAt','runId','disposition','reason','retryCondition','retryAfter','evidenceSha256','sourceEvidence','askPath'];
 if(Object.keys(record).some(k=>!allowed.includes(k))||!/^[a-f0-9]{64}$/.test(record.evidenceSha256||''))throw Error('EXCEPTION_REVIEW_EVIDENCE_REQUIRED');
 if(record.disposition==='WAITING_SOURCE_CHANGE'){
  if(!['SOURCE_ACCESS_BLOCKED','ORIGINAL_IDENTITIES_UNAVAILABLE','IDENTITY_CONFLICT','SOURCE_EVIDENCE_UNAVAILABLE'].includes(record.reason)||!['NEW_ORIGINAL_SOURCE_EVIDENCE','SOURCE_ACCESS_RESTORED','NEW_IDENTITY_EVIDENCE'].includes(record.retryCondition)||record.sourceEvidence||record.askPath)throw Error('EXPLICIT_SOURCE_RETRY_CONDITION_REQUIRED');
  if(record.retryAfter&&(!Number.isFinite(Date.parse(record.retryAfter))||Date.parse(record.retryAfter)<=Date.parse(record.reviewedAt)))throw Error('FUTURE_RETRY_TIME_REQUIRED');
 }else if(record.disposition==='AWAITING_TIM'){
  if(!/^asks\/open\/[A-Za-z0-9_-]+\.json$/.test(record.askPath||'')||record.sourceEvidence)throw Error('EXISTING_TIM_QUESTION_REQUIRED');
 }else if(record.disposition==='SOURCE_EVIDENCE'){
  const e=record.sourceEvidence;
  if(item.kind!=='SOURCE'||!e||Object.keys(e).some(k=>!['company','title','location','url','quote','observedAt'].includes(k))||!['company','title','location','url','quote'].every(k=>typeof e[k]==='string'&&e[k].trim())||e.quote.length<20||e.quote.length>12000||!Number.isFinite(Date.parse(e.observedAt))||Date.parse(e.observedAt)>now+60000)throw Error('EXACT_PUBLIC_SOURCE_EVIDENCE_REQUIRED');
  Source.publicUrl(e.url);
 }else throw Error('EXCEPTION_REVIEW_CANNOT_DECLARE_CANONICAL_COMPLETION');
 return item;
}
function reviews(root,work,now){
 const accepted=[];work.reviewErrors={};
 for(const file of S.files(path.join(root,REVIEWS))){const relative=path.relative(root,file).replace(/\\/g,'/');try{const record=S.read(root,relative),item=work.cases[record.exceptionId];if(!item||item.status==='NO_LONGER_OPEN'||item.binding.sourceVersion!==record.sourceVersion)continue;
   validateReview(record,work,now);if(relative!==REVIEWS+'/'+record.exceptionId+'-'+S.hash(record)+'.json')throw Error('IMMUTABLE_REVIEW_FILENAME_REQUIRED');if(record.disposition==='AWAITING_TIM'&&!fs.existsSync(path.join(root,record.askPath)))throw Error('EXISTING_TIM_QUESTION_REQUIRED');accepted.push({record,proof:relative,sha256:S.hash(record)});
  }catch(e){work.reviewErrors[relative]={reason:e.message,owner:'ChatGPT',taskKey:OWNER};}
 }
 // Only the latest decision applies. Replaying older source decisions would
 // repeatedly reset retryAfter and overwrite a later waiting disposition.
 return [...new Map(accepted.sort((a,b)=>Date.parse(a.record.reviewedAt)-Date.parse(b.record.reviewedAt)||a.proof.localeCompare(b.proof)).map(r=>[r.record.exceptionId,r])).values()];
}
function sync({root,state,report,now=Date.now(),apply=false}){
 const work=S.read(root,FILE,empty()),current=new Set(),at=new Date(now).toISOString();
 for(const item of candidates(root,report,state,now)){current.add(item.exceptionId);const old=work.cases[item.exceptionId];work.cases[item.exceptionId]={...old,...item,firstSeen:old?.firstSeen||at,lastSeen:at,status:'ACTION_REQUIRED'};delete work.cases[item.exceptionId].closedAt;}
 for(const item of Object.values(work.cases))if(!current.has(item.exceptionId)){item.status='NO_LONGER_OPEN';item.closedAt=item.closedAt||at;item.canonicalCompletion=false;}
 for(const {record,proof,sha256} of reviews(root,work,now)){const item=work.cases[record.exceptionId];item.review={proof,sha256,disposition:record.disposition,reviewedAt:record.reviewedAt,reason:record.reason,retryCondition:record.retryCondition,retryAfter:record.retryAfter};
  if(record.disposition==='WAITING_SOURCE_CHANGE'&&!(Date.parse(record.retryAfter)<=now))item.status='WAITING_SOURCE_CHANGE';
  else if(record.disposition==='AWAITING_TIM')item.status='AWAITING_TIM';
  // A proposed source is actionable until its independent verification changes the case.
 }
 work.at=at;work.runId=report.runId;work.noProcessingCap=true;work.counts={};for(const item of Object.values(work.cases))work.counts[item.status]=(work.counts[item.status]||0)+1;
 if(apply)S.save(root,FILE,work);return work;
}
function applySourceReviews({root,state,now=Date.now()}){
 const work=S.read(root,FILE,empty());let applied=0;
 for(const {record,proof,sha256} of reviews(root,work,now)){
  if(record.disposition!=='SOURCE_EVIDENCE')continue;const job=work.cases[record.exceptionId],item=state.items[job.binding.key];
  if(!item||item.version!==record.sourceVersion||item.transactionId||terminal(item.status)||state.batches[item.batch]?.status!=='VALIDATED'||item.sourceRecoveryReview===sha256)continue;
  const original=S.read(root,item.batch).items.find(e=>(e.key||e.primaryId)===item.itemKey);
  if(!original||S.hash(original)!==item.version)continue;
  if(!original||!['INTAKE_READY','ENRICHMENT_EVIDENCE_READY','SOURCE_BLOCKED','NEEDS_SOURCE_EVIDENCE'].includes(original.recommendation))continue;
  if(S.hash(record.sourceEvidence)===S.hash(original.sourceEvidence))continue;
  item.sourceRecoveryEvidence=record.sourceEvidence;item.sourceRecoveryReview=sha256;item.sourceRecoveryProof=proof;item.sourceRecoverySourceVersion=item.version;delete item.retryAfter;applied++;
 }
 return{applied};
}
function evidence(root,item,original){
 if(!item.sourceRecoveryReview)return original;
 if(!new RegExp('^'+REVIEWS+'/[a-f0-9]{64}-[a-f0-9]{64}\\.json$').test(item.sourceRecoveryProof||''))throw Error('IMMUTABLE_SOURCE_RECOVERY_REVIEW_REQUIRED');
 const record=S.read(root,item.sourceRecoveryProof,null),work=S.read(root,FILE,empty());
 if(!record||S.hash(record)!==item.sourceRecoveryReview||record.sourceVersion!==item.version||item.sourceRecoverySourceVersion!==item.version||S.hash(original)!==item.version||S.hash(record.sourceEvidence)!==S.hash(item.sourceRecoveryEvidence)||item.sourceRecoveryProof!==REVIEWS+'/'+record.exceptionId+'-'+S.hash(record)+'.json')throw Error('IMMUTABLE_SOURCE_RECOVERY_REVIEW_REQUIRED');
 const reviewed=validateReview(record,work,Date.now(),true);
 // Identity, relevance, protection, source quotes and Writer gates are still checked by the normal pipeline.
 if(record.disposition!=='SOURCE_EVIDENCE'||!['INTAKE_READY','ENRICHMENT_EVIDENCE_READY','SOURCE_BLOCKED','NEEDS_SOURCE_EVIDENCE'].includes(original.recommendation))throw Error('SOURCE_RECOVERY_SCOPE_REQUIRED');
 if(reviewed.binding.key!==item.key)throw Error('SOURCE_RECOVERY_CASE_REQUIRED');
 return{...original,sourceEvidence:record.sourceEvidence,recommendation:/ENRICHMENT/.test(item.taskKey)?'ENRICHMENT_EVIDENCE_READY':'INTAKE_READY'};
}
function publishReview(root,record,now=Date.now()){
 validateReview(record,S.read(root,FILE),now);if(record.disposition==='AWAITING_TIM'&&!fs.existsSync(path.join(root,record.askPath)))throw Error('EXISTING_TIM_QUESTION_REQUIRED');const file=REVIEWS+'/'+record.exceptionId+'-'+S.hash(record)+'.json';S.immutable(root,file,record);return{path:file,canonicalWrites:0,pendingCodeValidation:true};
}
module.exports={FILE,REVIEWS,OWNER,empty,candidates,sync,applySourceReviews,evidence,validateReview,publishReview};
