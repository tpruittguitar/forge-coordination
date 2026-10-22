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
 const pid=String(detail.primaryId||detail.PRIMARY_ID||'');
 if(!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(pid))return {status:'PENDING_PRIMARY_ID',verified:false};
 const rb=await read('row_readback',{...opts,primaryIds:[pid]});
 if(!Array.isArray(rb.data.rows))return {status:'PENDING_READBACK_SCHEMA',verified:false};
 const consistency=verifyExactRow(proposal,{receipt:detail,requestId,masterRows:rb.data.rows});
 return {status:consistency.status,verified:false,matchedPrimaryId:consistency.matchedPrimaryId||null,proofReads:['request_result','receipt_index','row_readback'],writerPayloads:[],writerSubmissions:0};
}
module.exports={inspectDurableReadback};
