'use strict';
/* Authenticated Writer consistency inspection; no admissions or submissions.
 * receipt_index must be consulted BEFORE request_result: pending request_result can invoke verifyNow_.
 */
const {read}=require('./writer-reader');
const {stableId}=require('./transaction-preflight');
const validPid=x=>/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x);
const idsFrom=entry=>Array.isArray(entry?.items)?entry.items.map(x=>x?.pid):null;
async function inspectDurableReadback(proposal,requestId,{key,transport,clock=()=>Date.now()}={}){
 if(!/^[A-Za-z0-9_-]{3,160}$/.test(requestId||''))throw Error('BLOCKED: invalid request ID');
 if(!proposal?.record||stableId(proposal.record)!==proposal.identityHash)throw Error('BLOCKED: proposal identity changed');
 const opts={key,transport,clock,requestId};
 const index=await read('receipt_index',opts);
 if(index.data.source!=='GITHUB'||index.data.exists!==true||!index.data.sha||!index.data.updatedAt)throw Error('BLOCKED: missing GitHub receipt index proof');
 const now=clock(),updated=Date.parse(index.data.updatedAt);
 if(!Number.isFinite(updated)||updated>now+120000)throw Error('BLOCKED: receipt index timestamp invalid');
 const requestAt=index.data.request?.at;
 if(requestAt!=null){const recorded=Date.parse(requestAt);if(!Number.isFinite(recorded)||recorded>updated)throw Error('BLOCKED: receipt request timestamp invalid');}
 const meta={receiptIndexSha:index.data.sha,receiptIndexUpdatedAt:index.data.updatedAt,receiptIndexIdleMs:Math.max(0,now-updated),verified:false,writerPayloads:[],writerSubmissions:0};
 if(index.data.request?.s!=='COMPLETE')return {...meta,status:'PENDING_INDEX_REQUEST_PROOF',proofReads:['receipt_index']};
 const result=await read('request_result',opts),detail=result.data;
 if(!detail.found||detail.source!=='index'||detail.requestId!==requestId||detail.status!=='COMPLETE'||detail.durable!==true)
  return {...meta,status:'PENDING_RECEIPT_PROOF',proofReads:['receipt_index','request_result']};
 const a=idsFrom(index.data.request),b=idsFrom(detail.entry);
 if(!a||!b||!a.length||a.length>25||a.length!==b.length||a.some((v,i)=>!validPid(v)||v!==b[i])||new Set(a).size!==a.length)
  return {...meta,status:'PENDING_CANONICAL_ID_BINDING',proofReads:['receipt_index','request_result']};
 const rb=await read('row_readback',{...opts,primaryIds:a});
 if(!Array.isArray(rb.data.rows)||rb.data.master?.endMarkerPresent!==true||rb.data.requested!==a.length||rb.data.found!==a.length||
    rb.data.rows.length!==a.length||rb.data.rows.some((x,i)=>x.primaryId!==a[i]||!x.found||x.matches!==1))
  return {...meta,status:'PENDING_EXACT_ROW_READBACK',proofReads:['receipt_index','request_result','row_readback']};
 const normalized=rb.data.rows.map(x=>{const c=String(x.line||'').split(' | ');
  if(c.length<10||c[1]!==x.primaryId)return null;
  return {PRIMARY_ID:c[1],COMPANY:c[2],TITLE:c[3],REQ_ID:c[7],LOCATION:c[8]};
 });
 if(normalized.some(x=>!x))return {...meta,status:'READBACK_SCHEMA_MISMATCH'};
 const {normalizeCell:norm}=require('./writer-cell'),rec=proposal.record;
 const matched=normalized.filter(x=>norm(x.COMPANY)===norm(rec.COMPANY)&&norm(x.TITLE)===norm(rec.TITLE)&&
  norm(x.LOCATION)===norm(rec.LOCATION)&&(!rec.REQ_ID||!x.REQ_ID||norm(x.REQ_ID)===norm(rec.REQ_ID)));
 if(matched.length!==1)return {...meta,status:matched.length?'AMBIGUOUS_READBACK':'ROW_NOT_FOUND',matchedCount:matched.length};
 return {...meta,status:'CONSISTENT_PENDING_PROVENANCE_VALIDATION',matchedPrimaryId:matched[0].PRIMARY_ID,
  receiptPrimaryIds:a,proofReads:['receipt_index','request_result','row_readback']};
}
module.exports={inspectDurableReadback};
