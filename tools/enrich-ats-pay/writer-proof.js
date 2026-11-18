'use strict';
const {normalizeCell}=require('../source-intake/writer-cell');
const DAY=86400000;

// Mirror of the Writer's isEvidenceKey_ (foreman-cockpit apps-script/Code.gs:1076-1083): these keys go to the
// evidence sidecar, never a master cell, so a master readback can never match them (EXPERIENCE_FIT_BASIS, SALARY_NOTE).
const EVIDENCE=new Set(['ANALYSIS_BASIS','ANALYSIS_CONFIDENCE','AUDIT_B2','AUDIT_B3','AUDIT_B4','AUDIT_B5','AUDIT_FINAL','AUDIT_FINAL2','CONFLICTING_EVIDENCE','EXPERIENCE_FIT_BASIS','FIT_BASIS','FIT_EVIDENCE','FLEX_EVIDENCE','GROK_FIT_BASIS','GROK_FIT_EVIDENCE','LEGACY_FLOOR_AUDIT','PRIOR_DECLINE_REASON_CODE','PRIOR_DECLINE_REASON_TEXT','PRIOR_REOPEN_TRIGGER','PRIOR_SIGNAL','REQ_ID_EVIDENCE','SALARY_AUDIT','SALARY_AUDIT_LOCATION','SALARY_REASON','SCOPE_SUMMARY','SCORING_EVIDENCE']);
const KEPT=new Set(['ANALYSIS_ASOF','ANALYSIS_ACTOR','NOTE','TIM_NOTE','FLEX_BASIS','SALARY_BASIS','LIVENESS_BASIS','REOPEN_BASIS','PROPOSED_DISPOSITION','PROPOSED_DECLINE_REASON_CODE','PROPOSED_DECLINE_REASON_TEXT','RESEARCH_REQUEST','APP_STATUS_EVIDENCE','APP_EVIDENCE','REJECTION_EVIDENCE','CLAUDE_APPLICATION_EVIDENCE','POSTING_STATUS_EVIDENCE','DECLINE_REASON_TEXT','DECLINE_REASON_CODE','REOPEN_TRIGGER','INVALID_REASON','NEVER_CONSIDER_REASON','EVIDENCE_REF']);
function evidenceKey(k){
  if(KEPT.has(k)||/_URL(_\d+)?$/.test(k)||/^(DEGREE|SALARY_BASE|TIM_|APP_|FLEX_CLASS|FLEX_MODIFIER)/.test(k))return false;
  return EVIDENCE.has(k)||/(^|_)(NOTE|NOTES|ANALYSIS|QUOTE)(_\d+)?$/.test(k);
}
const masterFields=q=>Object.entries(q.ruling.fields||{}).filter(([k])=>!evidenceKey(k));
const drift=(q,row)=>masterFields(q).filter(([k,v])=>normalizeCell(row?.p?.[k])!==normalizeCell(v)).map(([k])=>k);
const hitsFor=(rb,id)=>(rb.rows||[]).filter(x=>x.primaryId===id);

// Applied: every alias COMPLETE in the receipt index, a durable COMPLETE RESULT, and each row present exactly once.
// The receipt is the Writer's record that the batch landed; a master cell that changed later (a newer write) is
// reported through onDrift and does not keep the fence.
async function verify(batch, {index, read, parse, onDrift}) {
  const aliases=batch.map(q=>q.ruling.requestId);
  if(!aliases.length||!aliases.every(id=>index.requests?.[id]?.s==='COMPLETE'))return false;
  const result=await read('request_result',{requestId:aliases[0]});
  if(result.requestId!==aliases[0]||result.status!=='COMPLETE'||result.durable!==true||!result.found)return false;
  const rb=await read('row_readback',{requestId:aliases[0],ids:batch.map(q=>q.ruling.primaryId).join(',')});
  if(!rb.ok||rb.master?.endMarkerPresent!==true)return false;
  return batch.every(q=>{
    const hits=hitsFor(rb,q.ruling.primaryId);
    if(hits.length!==1||!hits[0].found||hits[0].matches!==1)return false;
    const row=parse(hits[0].line);if(row?.PRIMARY_ID!==q.ruling.primaryId)return false;
    const changed=drift(q,row);if(changed.length&&onDrift)onDrift(q.ruling.primaryId,changed);
    return true;
  });
}

// Proven never applied (fresh recompute, never replay): older than minAgeMs, every alias that is not COMPLETE is
// absent from the receipt index or NOT_PERSISTED, the Writer RESULT says found:false or NOT_PERSISTED (non-durable),
// and none of those rows carries all of its submitted master values. Returns {reason} or null (stays fenced).
// The stored rulings are only read here for comparison; the caller drops them and never sends them.
async function notApplied(entry, {index, read, parse, now=Date.now(), minAgeMs=DAY}) {
  const batch=entry?.requests;
  if(!Array.isArray(batch)||!batch.length||!(now-Date.parse(entry.at)>=minAgeMs))return null;
  const state=q=>index.requests?.[q.ruling.requestId]?.s,open=batch.filter(q=>state(q)!=='COMPLETE');
  if(!open.length||!open.every(q=>!state(q)||state(q)==='NOT_PERSISTED'))return null;
  const first=open[0].ruling.requestId,result=await read('request_result',{requestId:first});
  if(result?.ok!==true||result.requestId!==first)return null;
  const reason=result.found===false&&!state(open[0])?'NO_RECEIPT':result.found===true&&result.status==='NOT_PERSISTED'&&result.durable===false?'NOT_PERSISTED':null;
  if(!reason)return null;
  const rb=await read('row_readback',{requestId:first,ids:open.map(q=>q.ruling.primaryId).join(',')});
  if(!rb?.ok||rb.master?.endMarkerPresent!==true)return null;
  const absent=open.every(q=>{
    const hits=hitsFor(rb,q.ruling.primaryId);if(hits.length>1)return false;
    if(!hits.length||!hits[0].found)return true;
    const row=parse(hits[0].line);return row?.PRIMARY_ID===q.ruling.primaryId&&masterFields(q).length>0&&drift(q,row).length>0;
  });
  return absent?{reason,open:open.length,complete:batch.length-open.length}:null;
}
module.exports={verify,notApplied,evidenceKey};
