'use strict';
/* Pure receipt accounting. A Writer response alone is never durable proof. */
const NOOP=new Set(['EXISTING_MATCH','NEVER_CONSIDER_EXCLUDED']);
const INSERT=new Set(['SCOUT_INTAKE_WRITTEN','DISCOVERY_LEAD_WRITTEN']);
function checkCanaryOutcome({expectedOutcome,record,result,receipt,readbacks}={}){
 const held=(reason)=>({status:'HOLD',reason,verified:false,scaleUpAllowed:false});
 if(!result||!Array.isArray(result.results)||result.results.length!==1)return held('RESPONSE_NOT_EXACTLY_ONE');
 const outcome=result.results[0];
 if(!outcome||typeof outcome.result!=='string')return held('UNKNOWN_OUTCOME');
 const kind=outcome.result;
 if(!NOOP.has(kind)&&!INSERT.has(kind))return held('UNKNOWN_OUTCOME');
 if(expectedOutcome==='EXISTING_MATCH'&&kind!=='EXISTING_MATCH')return held('UNEXPECTED_EXISTING_OUTCOME');
 if(expectedOutcome==='PROTECTED_NOOP'&&kind!=='EXISTING_MATCH')return held('PROTECTED_NOT_NOOP');
 if(expectedOutcome==='NEW'&&!INSERT.has(kind))return held('NEW_NOT_INSERTED');
 if(!receipt||receipt.status!=='COMPLETE'||!receipt.durable||!Array.isArray(receipt.entry?.items))return held('RECEIPT_NOT_DURABLE_AND_BOUND');
 const pids=receipt.entry.items.map(x=>x.pid).filter(Boolean);
 if(!Array.isArray(readbacks))return held('READBACK_MISSING');
 if(kind==='EXISTING_MATCH'){
  if(!outcome.PRIMARY_ID||pids.length>1)return held('EXISTING_IDENTITY_UNCERTAIN');
  const match=readbacks.filter(x=>x.primaryId===outcome.PRIMARY_ID&&x.found&&x.matches===1);
  if(match.length!==1)return held('EXISTING_READBACK_MISSING');
  // Existing means no newly inserted rows in receipt. Reconcile before declaring a no-op.
  if(receipt.entry.items.some(x=>['INSERT','CREATE','APPEND'].includes(String(x.op||'').toUpperCase())))return held('UNEXPECTED_ROW_WRITE');
  return held('EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS');
 }
 if(pids.length!==1||outcome.PRIMARY_ID!==pids[0])return held('INSERT_PRIMARY_ID_MISMATCH');
 const rb=readbacks.filter(x=>x.primaryId===pids[0]&&x.found&&x.matches===1);
 if(rb.length!==1)return held('INSERT_READBACK_MISSING');
 const cells=String(rb[0].line||'').split(' | ');
 const norm=x=>String(x||'').trim().toLowerCase();
 if(cells.length<10||cells[1]!==pids[0]||norm(cells[2])!==norm(record?.COMPANY)||norm(cells[3])!==norm(record?.TITLE)||
    norm(cells[8])!==norm(record?.LOCATION)|| (record?.REQ_ID&&norm(cells[7])!==norm(record.REQ_ID)))return held('INSERT_IDENTITY_MISMATCH');
 return {status:'CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK',primaryId:pids[0],verified:false,scaleUpAllowed:false};
}
module.exports={checkCanaryOutcome};
