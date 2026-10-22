'use strict';
/* Read-only proof collection through the actual authenticated Writer endpoint.
 * No call to intake, submit, post, or mutable Writer actions. */
const {read}=require('./writer-reader');
const {verifyExactRow}=require('./transaction-preflight');
async function inspectDurableReadback(proposal,requestId,{key,transport,clock}={}){
 if(!/^[A-Za-z0-9_-]{3,160}$/.test(requestId||''))throw Error('BLOCKED: invalid request ID');
 const opts={key,transport,clock,requestId};
 const result=await read('request_result',opts);
 const index=await read('receipt_index',opts);
 if(index.data.source!=='GITHUB')throw Error('BLOCKED: Writer receipt index must come from GITHUB');
 // These shapes are intentionally checked conservatively. Unknown live schema = hold.
 const detail=result.data;
 if(detail.requestId!==requestId||detail.status!=='COMPLETE'||detail.durable!==true)
  return {status:'PENDING_RECEIPT_PROOF',verified:false};
 if(index.data.exists!==true||!index.data.updatedAt)
  return {status:'PENDING_INDEX_PROOF',verified:false};
 if(!index.data.request||index.data.request.s!=='COMPLETE')return {status:'PENDING_INDEX_REQUEST_PROOF',verified:false};
 const pid=String(detail.primaryId||detail.PRIMARY_ID||detail.entry?.primaryId||detail.entry?.PRIMARY_ID||'');
 if(!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(pid))return {status:'PENDING_PRIMARY_ID',verified:false};
 const rb=await read('row_readback',{...opts,primaryIds:[pid]});
 if(!Array.isArray(rb.data.rows))return {status:'PENDING_READBACK_SCHEMA',verified:false};
 if(rb.data.master?.endMarkerPresent!==true||rb.data.requested!==1||rb.data.found!==1||rb.data.rows.length!==1||rb.data.rows[0].matches!==1||rb.data.rows[0].found!==true)return {status:'PENDING_EXACT_ROW_READBACK',verified:false};
 const row=rb.data.rows[0],cells=String(row.line||'').split(' | ');
 if(cells.length<10||cells[1]!==pid)return {status:'READBACK_SCHEMA_MISMATCH',verified:false};
 const readback={PRIMARY_ID:pid,COMPANY:cells[2],TITLE:cells[3],LOCATION:cells[8],REQ_ID:cells[7]};
 const consistency=verifyExactRow(proposal,{receipt:detail,requestId,masterRows:[readback]});
 return {status:consistency.status,verified:false,matchedPrimaryId:consistency.matchedPrimaryId||null,proofReads:['request_result','receipt_index','row_readback'],writerPayloads:[],writerSubmissions:0};
}
module.exports={inspectDurableReadback};
