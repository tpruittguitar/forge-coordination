'use strict';
// One contract for Writer delivery. A missing receipt never proves non-delivery.
const S=require('./programmed-coordinator/store.cjs');
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{3,160}$/.test(x))&&new Set(a).size===a.length&&[...a].sort().every((x,n)=>x===[...b].sort()[n]);
const scope=(requestId,childRequestIds=[])=>childRequestIds.length?childRequestIds:[requestId];
function classify(response,{requestId,childRequestIds=[]}={}){
 const o=response?.outcome;
 const terminal=['REJECTED_SCHEMA','REJECTED_INPUT','UNSUPPORTED_ACTION'].includes(o?.code);
 const planned=response?.mode==='BATCH_RULING_RETRY'&&Array.isArray(response.results)&&response.results.every(x=>x.ok===true&&x.mode==='PLANNED')&&sameIds(response.results.map(x=>x.requestId),scope(requestId,childRequestIds));
 const rejected=terminal&&Array.isArray(response?.results)&&response.results.every(x=>x.ok===false&&!/PENDING|APPLIED/.test(x.mode||''));
 if(response?.ok===false&&!response.writeId&&!response.WRITE_ACCEPTED&&(!response.results||response.results.length===0||planned||rejected)&&
    o?.schema==='forge.writer-outcome.v1'&&o.status==='NOT_ACCEPTED'&&o.phase==='BEFORE_MUTATION'&&o.masterMutations===0&&
    sameIds(o.requestIds,scope(requestId,childRequestIds))&&(['WRITER_BUSY','WRITE_FENCE'].includes(o.code)||terminal))
  return{kind:'NOT_ACCEPTED',code:o.code,retryable:!terminal,retryAfterMs:Math.min(600000,Math.max(30000,Number(o.retryAfterMs)||60000)),evidence:{kind:'REQUEST_BOUND_PRE_MUTATION_RESPONSE',outcome:o}};
 if(response?.ok===true&&(response.writeId||response.WRITE_ACCEPTED===true))return{kind:'ACCEPTED'};
 return{kind:'UNKNOWN'};
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
async function prove({response,requestId,childRequestIds=[],deps={}}){
 const outcome=classify(response,{requestId,childRequestIds});if(outcome.kind==='NOT_ACCEPTED')return outcome;
 if(!response||response.ok!==false||!String(response.errorStack||'').includes('at applyRulingBatchToMaster_'))return null;
 if(!deps.status||!deps.source||!deps.result||!deps.index)return null;
 let status,source;
 const witness=deps.witness&&await deps.witness(requestId,S.hash(response));
 if(witness){
  if(witness.schema!=='forge.writer-refusal-witness.v1'||witness.requestId!==requestId||witness.acceptanceSha256!==S.hash(response)||
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
function evidenceValid(proof){
 if(!proof.response||typeof proof.response!=='object'||!Array.isArray(proof.childRequestIds))return false;
 if(S.hash(proof.response)!==proof.acceptanceSha256)return false;
 const classified=classify(proof.response,{requestId:proof.requestId,childRequestIds:proof.childRequestIds});
 if(classified.kind==='NOT_ACCEPTED')return proof.code===classified.code&&proof.retryable===(classified.retryable!==false)&&proof.evidence?.kind==='REQUEST_BOUND_PRE_MUTATION_RESPONSE'&&S.hash(proof.evidence.outcome)===S.hash(proof.response.outcome);
 const e=proof.evidence;
 return proof.code==='WRITER_BUSY'&&proof.retryable===true&&e?.kind==='DEPLOYED_SOURCE_PRE_MUTATION_LOCK_REFUSAL'&&/^[a-f0-9]{7,40}$/.test(e.writerCommit||'')&&/^[a-f0-9]{64}$/.test(e.writerSourceSha256||'')&&/^[a-f0-9]{40}$/.test(e.indexSha||'')&&
   proof.response?.ok===false&&proof.response.error==='Lock timeout: another process was holding the lock for too long.'&&!proof.response.writeId&&!proof.response.results&&/^Exception: Lock timeout:.*\| at applyRulingBatchToMaster_ \(Code:\d+:\d+\)/.test(proof.response.errorStack||'');
}
function record(root,{requestId,payloadSha256,acceptanceSha256,response,ids,childRequestIds=[],outcome,now=Date.now()}){
 const file='receipts/'+requestId+'_NOT_ACCEPTED.json',old=S.read(root,file,null);
 const proof=old||{schema:'forge.writer-not-accepted.v1',requestId,payloadSha256,acceptanceSha256,response,ids,childRequestIds,
  at:new Date(now).toISOString(),retryable:outcome.retryable!==false,retryAfter:outcome.retryable===false?null:new Date(now+outcome.retryAfterMs).toISOString(),code:outcome.code,evidence:outcome.evidence,
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
module.exports={classify,legacyLock,prove,record,released};
