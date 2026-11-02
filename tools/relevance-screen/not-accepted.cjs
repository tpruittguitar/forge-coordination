'use strict';
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs'),I=require('../routine-handoffs/intake-state.cjs'),L=require('../email-recovery/ledger.cjs');
function lockRejection(response,source){
 if(response?.ok!==false||response.error!=='Lock timeout: another process was holding the lock for too long.'||Object.keys(response).some(k=>!['ok','error','errorStack','docAccess'].includes(k))||response.docAccess?.status!=='INITIAL_SUCCESS'||response.docAccess.retries!==0||!Array.isArray(response.docAccess.ops)||response.docAccess.ops.length)return false;
 const prefix=source.match(/function applyIntakeToMaster_\(req, internal\)\s*\{\s*var lock = LockService\.getScriptLock\(\);\s*lock\.waitLock\(30000\);/);if(!prefix)return false;
 const line=source.slice(0,prefix.index+prefix[0].indexOf('lock.waitLock')).split('\n').length;
 return new RegExp('^Exception: Lock timeout: another process was holding the lock for too long\\. \\| at applyIntakeToMaster_ \\(Code:'+line+':\\d+\\) \\| at dispatchWrite_ \\(Code:\\d+:\\d+\\) \\| at doPost \\(Code:\\d+:\\d+\\)').test(response.errorStack||'');
}
async function recover({root,privateDir,requestId,runId,deps}){
 if(!/^FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+$/.test(requestId))throw Error('ORIGINAL_INTAKE_REQUEST_REQUIRED');
 const payload=S.read(privateDir,requestId+'-payload-private.json'),response=S.read(privateDir,requestId+'-result-private.json'),checkpoint=S.read(root,'receipts/'+requestId+'_CHECKPOINT.json'),accepted=S.read(root,'receipts/'+requestId+'_ACCEPTANCE.json');
 if(payload.action!=='intake'||payload.requestId!==requestId||checkpoint.requestId!==requestId||accepted.requestId!==requestId||checkpoint.payloadSha256!==S.hash(payload)||accepted.responseSha256!==S.hash(response)||!Array.isArray(payload.records)||payload.records.length!==checkpoint.records||checkpoint.keys?.length!==checkpoint.records||new Set(checkpoint.keys).size!==checkpoint.records||checkpoint.queueKeys?.length!==checkpoint.records)throw Error('ORIGINAL_INTAKE_BINDING_REQUIRED');
 const status=await deps.status();T.healthy(status);if(!/^[a-f0-9]{7,40}$/.test(status.build?.commit||''))throw Error('DEPLOYED_WRITER_SOURCE_REQUIRED');
 const source=await deps.source(status.build.commit);if(!lockRejection(response,source))throw Error('INTAKE_NOT_PROVEN_UNACCEPTED');
 const [result,index]=await Promise.all([deps.result(requestId),deps.index(requestId)]);
 if(result.ok!==true||result.requestId!==requestId||result.found!==false||index.ok!==true||index.exists!==true||index.request!==null||!/^[a-f0-9]{40}$/.test(index.sha||''))throw Error('ORIGINAL_INTAKE_RESULT_OR_INDEX_PRESENT');
 const plan=S.read(root,'state/RELEVANCE_INTAKE_PLAN.json'),state=I.load(root),queue=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),file='receipts/'+requestId+'_NOT_ACCEPTED.json';
 const proof=S.read(root,file,{schema:'forge.intake-not-accepted.v1',requestId,runId,at:new Date().toISOString(),payloadSha256:S.hash(payload),responseSha256:S.hash(response),writerCommit:status.build.commit,writerSourceSha256:S.hash(source),indexSha:index.sha,reason:'INTAKE_LOCK_REJECTED_BEFORE_DOCUMENT_ACCESS',records:checkpoint.records,originalRequestMustNotBeReplayed:true,canonicalWrites:0});
 if(proof.schema!=='forge.intake-not-accepted.v1'||proof.requestId!==requestId||proof.payloadSha256!==S.hash(payload)||proof.responseSha256!==S.hash(response)||proof.reason!=='INTAKE_LOCK_REJECTED_BEFORE_DOCUMENT_ACCESS')throw Error('ORIGINAL_REJECTION_PROOF_CONFLICT');
 const completed=item=>item?.notAcceptedProof===file&&!item.requestId&&!item.submission&&!/IN_FLIGHT|SUBMITTED|HELD_WRITER|VERIFIED/.test(item.status||'');
 const targets=checkpoint.keys.map((key,n)=>{
  const item=plan.items.find(i=>i.key===key),saved=state.items.find(i=>i.key===key),job=checkpoint.queueKeys[n]?queue.jobs[checkpoint.queueKeys[n]]:null;
  if(!item||!saved||JSON.stringify(item.record)!==JSON.stringify(payload.records[n])||!completed(item)&&(item.requestId!==requestId||item.status!=='POST_IN_FLIGHT_UNKNOWN')||!completed(saved)&&(saved.requestId!==requestId||saved.status!=='POST_IN_FLIGHT_UNKNOWN')||checkpoint.queueKeys[n]&&(!job||!completed(job)&&(job.submission?.requestId!==requestId||job.status!=='POST_IN_FLIGHT_UNKNOWN')))throw Error('ORIGINAL_INTAKE_FENCE_CHANGED');
  return{item,saved,job};
 });
 deps.checkLock();S.immutable(root,file,proof); // Durable rejection before releasing any local fence.
 for(const {item,saved,job}of targets){
  for(const x of [item,saved]){if(completed(x))continue;(x.requestHistory||(x.requestHistory=[])).push({requestId,status:'NOT_ACCEPTED',proof:file});x.status='RETURNED_PENDING_SCREEN';x.notAcceptedProof=file;delete x.requestId;}
  if(job&&!completed(job)){(job.submissionHistory||(job.submissionHistory=[])).push({...job.submission,status:'NOT_ACCEPTED',proof:file});job.submissions=(job.submissions||[]).filter(s=>s.requestId!==requestId);delete job.submission;delete job.requestId;job.status='UNSCREENED';job.notAcceptedProof=file;}
 }
 L.save(require('node:path').join(root,'state/EMAIL_RECOVERY_QUEUE.json'),queue);I.save(root,state);S.save(root,'state/RELEVANCE_INTAKE_PLAN.json',plan);
 return{notAccepted:true,requestId,requeued:targets.length,proof:file};
}
module.exports={lockRejection,recover};
