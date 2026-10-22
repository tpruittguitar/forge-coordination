'use strict';
/* Immutable, idempotent Writer intake request drafting. Never sends a request.
 * Only a separate live Writer transaction executor may submit after fresh re-admission. */
const crypto=require('node:crypto');
function stableId(record){const identity=[record.COMPANY,record.REQ_ID||'',record.SOURCE_URL||'',record.TITLE,record.LOCATION].map(x=>String(x||'').trim().toLowerCase()).join('|');return crypto.createHash('sha256').update(identity).digest('hex').slice(0,24).toUpperCase()}
function prepareRequests(decision,{runId,sourceRunId}={}){
 if(decision?.mode!=='MANUAL_EVIDENCE_REVIEW_REQUIRED'||decision.submissionExecuted!==false||decision.writerSubmissions!==0||!Array.isArray(decision.proposed)||!Array.isArray(decision.admitted)||decision.admitted.length)throw Error('BLOCKED: only unsigned, nonadmitted staging decisions accepted');
 if(!/^[A-Z0-9_-]{8,120}$/.test(runId||'')||!/^[A-Z0-9_-]{8,120}$/.test(sourceRunId||''))throw Error('BLOCKED: stable run identity required');
 if(decision.proposed.length>200)throw Error('BLOCKED: intake batch over 200');
 const identities=new Set();
 const proposed=decision.proposed.map(rec=>{
  if(!rec||typeof rec.COMPANY!=='string'||typeof rec.TITLE!=='string'||!/^https:\/\//i.test(rec.SOURCE_URL||''))throw Error('BLOCKED: incomplete record identity');
  const id=stableId(rec);if(identities.has(id))throw Error('BLOCKED: duplicate identity in run');identities.add(id);
  return {identityHash:id,record:structuredClone(rec),verification:'REQUIRES_FRESH_WRITER_DEDUPE_AND_RECEIPT_READBACK'};
 });
 return {status:'REQUIRES_MANUAL_CONFIRMATION_AND_VERIFIED_WRITER_EXECUTOR',runId,sourceRunId,grossFound:decision.proposed.length,proposed,held:decision.held||[],writerPayloads:[],writerSubmissions:0,submissionExecuted:false};
}
function classifyReceipt(result,requestId){
 if(!result||!requestId||result.requestId!==requestId)return 'PENDING_VERIFICATION';
 if(result.status==='COMPLETE'&&result.durable===true)return 'COMPLETE_PENDING_EXACT_ROW_READBACK';
 if(result.status==='FAILED'||result.status==='REJECTED_SCHEMA')return 'FAILED_REQUIRES_REVIEW';
 return 'PENDING_VERIFICATION';
}
module.exports={stableId,prepareRequests,classifyReceipt};
