'use strict';
// One contract for Writer delivery. A missing receipt never proves non-delivery.
const S=require('./programmed-coordinator/store.cjs');
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{3,160}$/.test(x))&&new Set(a).size===a.length&&[...a].sort().every((x,n)=>x===[...b].sort()[n]);
const scope=(requestId,childRequestIds=[])=>childRequestIds.length?childRequestIds:[requestId];
function classify(response,{requestId,childRequestIds=[]}={}){
 if(response?.responseClassification==='UNKNOWN')return{kind:'UNKNOWN'};
 const o=response?.outcome;
 const childAccepted=Array.isArray(response?.results)&&response.results.some(x=>x?.writeId||x?.WRITE_ACCEPTED);
 const terminal=['REJECTED_SCHEMA','REJECTED_INPUT','UNSUPPORTED_ACTION'].includes(o?.code);
 const planned=response?.mode==='BATCH_RULING_RETRY'&&Array.isArray(response.results)&&response.results.every(x=>x.ok===true&&x.mode==='PLANNED')&&sameIds(response.results.map(x=>x.requestId),scope(requestId,childRequestIds));
 const rejected=terminal&&Array.isArray(response?.results)&&response.results.every(x=>x.ok===false&&!/PENDING|APPLIED/.test(x.mode||''));
 if(response?.ok===false&&!response.writeId&&!response.WRITE_ACCEPTED&&!childAccepted&&(!response.results||response.results.length===0||planned||rejected)&&
    o?.schema==='forge.writer-outcome.v1'&&o.status==='NOT_ACCEPTED'&&o.phase==='BEFORE_MUTATION'&&o.masterMutations===0&&
    sameIds(o.requestIds,scope(requestId,childRequestIds))&&(['WRITER_BUSY','WRITE_FENCE'].includes(o.code)||terminal))
  return{kind:'NOT_ACCEPTED',code:o.code,retryable:!terminal,retryAfterMs:Math.min(600000,Math.max(30000,Number(o.retryAfterMs)||60000)),evidence:{kind:'REQUEST_BOUND_PRE_MUTATION_RESPONSE',outcome:o}};
 if(response?.ok===true&&(response.writeId||response.WRITE_ACCEPTED===true))return{kind:'ACCEPTED'};
 return{kind:'UNKNOWN'};
}
const LOCK_ERROR='Lock timeout: another process was holding the lock for too long.';
function legacyDiagnostic(response){
 if(response?.ok!==false||response.error!==LOCK_ERROR||response.writeId||response.WRITE_ACCEPTED||response.results||Object.keys(response).some(k=>!['ok','error','errorStack','docAccess'].includes(k)))return null;
 const m=String(response.errorStack||'').match(/^Exception: Lock timeout: another process was holding the lock for too long\. \| at applyRulingBatchToMaster_ \(Code:(\d+):(\d+)\) \| at dispatchWrite_ \(Code:(\d+):(\d+)\) \| at doPost \(Code:(\d+):(\d+)\)/);
 return m?{schema:'forge.writer-lock-diagnostic.v1',preMutationCandidate:true,frames:m.slice(1).map(Number)}:null;
}
function validDiagnostic(d){return d?.schema==='forge.writer-lock-diagnostic.v1'&&d.preMutationCandidate===true&&Array.isArray(d.frames)&&d.frames.length===6&&d.frames.every(n=>Number.isSafeInteger(n)&&n>0&&n<1000000)&&Object.keys(d).every(k=>['schema','preMutationCandidate','frames'].includes(k));}
function restoreDiagnostic(d){return{ok:false,error:LOCK_ERROR,errorStack:'Exception: '+LOCK_ERROR+' | at applyRulingBatchToMaster_ (Code:'+d.frames[0]+':'+d.frames[1]+') | at dispatchWrite_ (Code:'+d.frames[2]+':'+d.frames[3]+') | at doPost (Code:'+d.frames[4]+':'+d.frames[5]+')'};}
function project(response,binding={},fromProjection=false){
 const classification=classify(response,binding).kind,out={responseClassification:classification};
 if(typeof response?.ok==='boolean')out.ok=response.ok;
 if(['WRITE_FENCE','WRITER_NOT_ACCEPTED','BATCH_RULING_RETRY','REJECTED_SCHEMA','BATCH_RULING_NO_WRITE'].includes(response?.mode))out.mode=response.mode;
 // Preserve truthy acceptance markers even when they are malformed: removing
 // them must never turn an unknown response into proof of nonacceptance.
 if(response?.writeId)out.WRITE_ACCEPTED=true;
 if(response?.WRITE_ACCEPTED)out.WRITE_ACCEPTED=true;
 if(classification!=='NOT_ACCEPTED'){const diagnostic=fromProjection?(validDiagnostic(response?.legacyLockDiagnostic)?response.legacyLockDiagnostic:null):legacyDiagnostic(response);if(diagnostic)out.legacyLockDiagnostic=diagnostic;return out;}
 const o=response.outcome;out.outcome={schema:o.schema,status:o.status,phase:o.phase,code:o.code,masterMutations:o.masterMutations,requestIds:[...o.requestIds]};
 if(Number.isFinite(Number(o.retryAfterMs)))out.outcome.retryAfterMs=Number(o.retryAfterMs);
 if(typeof o.retryable==='boolean')out.outcome.retryable=o.retryable;
 if(/^[a-f0-9]{7,40}$/.test(o.writerCommit||''))out.outcome.writerCommit=o.writerCommit;
 if(Array.isArray(response.results))out.results=response.results.map(r=>{const v={ok:r.ok===true};if(['PLANNED','ALREADY_APPLIED','PENDING_VERIFICATION','HOLD','ARCHIVED_ROW'].includes(r.mode))v.mode=r.mode;if(/^[A-Za-z0-9_-]{3,160}$/.test(r.requestId||''))v.requestId=r.requestId;if(/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(r.primaryId||''))v.primaryId=r.primaryId;if(Number.isInteger(r.index)&&r.index>=0)v.index=r.index;return v;});
 return out;
}
function legacyLock(response,source){
 if(response?.ok!==false||response.error!=='Lock timeout: another process was holding the lock for too long.'||response.writeId||response.WRITE_ACCEPTED||response.results||
    Object.keys(response).some(k=>!['ok','error','errorStack','docAccess'].includes(k)))return false;
 // This exact prefix has no operations before waitLock. Verify against the
 // deployed immutable source revision, never today's assumed source layout.
 const prefix=source.match(/function applyRulingBatchToMaster_\(requests\)\s*\{\s*var started = Date\.now\(\), t = \{[^{}]+\};\s*var lock = LockService\.getScriptLock\(\), lockStart = Date\.now\(\);\s*lock\.waitLock\(30000\);/);
 if(!prefix)return false;
 const line=source.slice(0,prefix.index+prefix[0].indexOf('lock.waitLock')).split('\n').length;
 return new RegExp('^Exception: Lock timeout: another process was holding the lock for too long\\. \\| at applyRulingBatchToMaster_ \\(Code:'+line+':\\d+\\) \\| at dispatchWrite_ \\(Code:\\d+:\\d+\\) \\| at doPost \\(Code:\\d+:\\d+\\)').test(response.errorStack||'');
}
async function prove({response,responseProjection,responseProjectionSha256,acceptanceSha256,requestId,childRequestIds=[],deps={}}){
 let originalSha=response?S.hash(response):acceptanceSha256;
 if(!response){
  if(!/^[a-f0-9]{64}$/.test(originalSha||'')||!validProjection(responseProjection,responseProjectionSha256,{requestId,childRequestIds}))return null;
  const projected=classify(responseProjection,{requestId,childRequestIds});if(projected.kind==='NOT_ACCEPTED')return projected;
  if(!validDiagnostic(responseProjection.legacyLockDiagnostic))return null;response=restoreDiagnostic(responseProjection.legacyLockDiagnostic);
 }
 const outcome=classify(response,{requestId,childRequestIds});if(outcome.kind==='NOT_ACCEPTED')return outcome;
 if(!response||response.ok!==false||!String(response.errorStack||'').includes('at applyRulingBatchToMaster_'))return null;
 if(!deps.status||!deps.source||!deps.result||!deps.index)return null;
 let status,source;
 const witness=deps.witness&&await deps.witness(requestId,originalSha);
 if(witness){
  if(witness.schema!=='forge.writer-refusal-witness.v1'||witness.requestId!==requestId||witness.acceptanceSha256!==originalSha||
     !Number.isFinite(Date.parse(witness.capturedAt))||S.hash(witness.source)!==witness.sourceSha256||witness.status?.build?.commit!==witness.writerCommit)throw Error('ORIGINAL_WRITER_WITNESS_BINDING');
  status=witness.status;source=witness.source;
 }else{status=await deps.status();if(!/^[a-f0-9]{7,40}$/.test(status.build?.commit||''))return null;source=await deps.source(status.build.commit);}
 if(!/^[a-f0-9]{7,40}$/.test(status.build?.commit||'')||!legacyLock(response,source))return null;
 const index=await deps.index();if(!/^[a-f0-9]{40}$/.test(index.sha||'')||!index.index?.requests)return null;
 for(const id of [requestId,...childRequestIds]){
  if(index.index.requests[id])return null;
  const result=await deps.result(id);if(result?.ok!==true||result.requestId!==id||result.found!==false)return null;
 }
 return{kind:'NOT_ACCEPTED',code:'WRITER_BUSY',retryAfterMs:60000,evidence:{kind:'DEPLOYED_SOURCE_PRE_MUTATION_LOCK_REFUSAL',writerCommit:status.build.commit,writerSourceSha256:S.hash(source),indexSha:index.sha}};
}
function validProjection(projection,sha,binding){return !!projection&&typeof projection==='object'&&S.hash(projection)===sha&&S.hash(project(projection,binding,true))===sha;}
function evidenceValid(proof){
 const projection=proof.responseProjection;
 if(!Array.isArray(proof.childRequestIds)||!validProjection(projection,proof.responseProjectionSha256,{requestId:proof.requestId,childRequestIds:proof.childRequestIds}))return false;
 // Public proofs contain a strict projection, not a second copy of canonical
 // rows, free-form errors, document-access diagnostics or correspondence.

 const classified=classify(projection,{requestId:proof.requestId,childRequestIds:proof.childRequestIds});
 if(classified.kind==='NOT_ACCEPTED')return proof.code===classified.code&&proof.retryable===(classified.retryable!==false)&&proof.evidence?.kind==='REQUEST_BOUND_PRE_MUTATION_RESPONSE'&&S.hash(proof.evidence.outcome)===S.hash(projection.outcome);
 const e=proof.evidence;
 return proof.code==='WRITER_BUSY'&&proof.retryable===true&&e?.kind==='DEPLOYED_SOURCE_PRE_MUTATION_LOCK_REFUSAL'&&/^[a-f0-9]{7,40}$/.test(e.writerCommit||'')&&/^[a-f0-9]{64}$/.test(e.writerSourceSha256||'')&&/^[a-f0-9]{40}$/.test(e.indexSha||'')&&projection.ok===false&&projection.responseClassification==='UNKNOWN'&&validDiagnostic(projection.legacyLockDiagnostic);
}
function record(root,{requestId,payloadSha256,acceptanceSha256,response,responseProjection:providedProjection,responseProjectionSha256:providedProjectionSha,ids,childRequestIds=[],outcome,now=Date.now()}){
 if(response?S.hash(response)!==acceptanceSha256:!/^[a-f0-9]{64}$/.test(acceptanceSha256||'')||!validProjection(providedProjection,providedProjectionSha,{requestId,childRequestIds}))throw Error('ORIGINAL_ACCEPTANCE_BINDING_REQUIRED');
 const actual=classify(response||providedProjection,{requestId,childRequestIds});
 const legacy=outcome.evidence?.kind==='DEPLOYED_SOURCE_PRE_MUTATION_LOCK_REFUSAL'&&(response?!!legacyDiagnostic(response):validDiagnostic(providedProjection?.legacyLockDiagnostic));
 if(actual.kind!=='NOT_ACCEPTED'&&!legacy)throw Error('ORIGINAL_NONACCEPTANCE_REQUIRED');
 const responseProjection=response?project(response,{requestId,childRequestIds}):providedProjection,e=outcome.evidence;
 const evidence=actual.kind==='NOT_ACCEPTED'?{kind:'REQUEST_BOUND_PRE_MUTATION_RESPONSE',outcome:responseProjection.outcome}:{kind:e.kind,writerCommit:e.writerCommit,writerSourceSha256:e.writerSourceSha256,indexSha:e.indexSha};
 const file='receipts/'+requestId+'_NOT_ACCEPTED.json',old=S.read(root,file,null);
 const proof=old||{schema:'forge.writer-not-accepted.v1',requestId,payloadSha256,acceptanceSha256,responseProjection,responseProjectionSha256:S.hash(responseProjection),ids,childRequestIds,
  at:new Date(now).toISOString(),retryable:outcome.retryable!==false,retryAfter:outcome.retryable===false?null:new Date(now+outcome.retryAfterMs).toISOString(),code:outcome.code,evidence,
  canonicalWrites:0,originalRequestMustNotBeReplayed:true};
 if(proof.schema!=='forge.writer-not-accepted.v1'||proof.requestId!==requestId||proof.payloadSha256!==payloadSha256||proof.acceptanceSha256!==acceptanceSha256||!sameIds(proof.ids,ids)||
    !sameIds(proof.childRequestIds,childRequestIds)||proof.canonicalWrites!==0||proof.originalRequestMustNotBeReplayed!==true||proof.retryable!==false&&!Number.isFinite(Date.parse(proof.retryAfter))||!evidenceValid(proof))throw Error('ORIGINAL_NOT_ACCEPTED_PROOF_CONFLICT');
 S.immutable(root,file,proof);return{file,proof};
}
function released(root,tx){
 const id=tx.requestId;if(!id)return false;
 const proof=S.read(root,'receipts/'+id+'_NOT_ACCEPTED.json',null);
 const ids=tx.ids||tx.primaryIds||tx.requests?.map(r=>r.primaryId)||[tx.primaryId].filter(Boolean);
 const children=tx.childRequestId?[tx.childRequestId]:(tx.requests||[]).map(r=>r.requestId||r.ruling?.requestId);
 return proof?.schema==='forge.writer-not-accepted.v1'&&proof.requestId===id&&proof.payloadSha256===tx.payloadSha256&&
  proof.canonicalWrites===0&&proof.originalRequestMustNotBeReplayed===true&&sameIds(proof.ids,ids)&&sameIds(proof.childRequestIds,children)&&
  (!tx.acceptanceSha256||proof.acceptanceSha256===tx.acceptanceSha256)&&/^[a-f0-9]{64}$/.test(proof.acceptanceSha256||'')&&evidenceValid(proof);
}
module.exports={classify,project,validProjection,legacyLock,prove,record,released};
