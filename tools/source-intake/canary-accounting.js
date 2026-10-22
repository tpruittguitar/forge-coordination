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
  return {status:'EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS',primaryId:outcome.PRIMARY_ID,verified:false,scaleUpAllowed:false};
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

// Independent snapshot reconciliation never trusts a Writer response as a row-count oracle.
// Both snapshots must come from authenticated, complete Writer master acquisitions.
function reconcileCanaryBatch({cases:casesInput,before,after}={}){
 const hold=reason=>({status:'HOLD',reason,verified:false,scaleUpAllowed:false});
 if(!Array.isArray(casesInput)||casesInput.length!==5)return hold('FIVE_CASES_REQUIRED');
 if(!before||!after||before.authenticated!==true||after.authenticated!==true||
    before.source!=='WRITER'||after.source!=='WRITER'||!Array.isArray(before.rows)||!Array.isArray(after.rows))
   return hold('INDEPENDENT_WRITER_SNAPSHOTS_REQUIRED');
 const index=rows=>{
  const map=new Map();
  for(const row of rows){if(!row?.PRIMARY_ID||map.has(row.PRIMARY_ID))return null;map.set(row.PRIMARY_ID,row)}
  return map;
 };
 const a=index(before.rows),b=index(after.rows);
 if(!a||!b)return hold('INVALID_OR_DUPLICATE_SNAPSHOT_IDS');
 const inserted=[...b.keys()].filter(id=>!a.has(id));
 const deleted=[...a.keys()].filter(id=>!b.has(id));
 if(deleted.length)return hold('UNEXPECTED_ROW_DELETION');
 const newCases=casesInput.filter(x=>x.expectedOutcome==='NEW');
 if(!newCases.length||!casesInput.some(x=>x.expectedOutcome==='EXISTING_MATCH')||
    !casesInput.some(x=>x.expectedOutcome==='PROTECTED_NOOP'))return hold('CANARY_CASE_COVERAGE');
 if(casesInput.some(x=>!x.accounting||x.accounting.status!=='CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK'&&
    x.accounting.status!=='EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS'))
   return hold('UNVERIFIED_CASE_ACCOUNTING');
 const expectedIds=newCases.map(x=>x.accounting.primaryId);
 if(expectedIds.some(x=>!x)||new Set(expectedIds).size!==expectedIds.length||
    inserted.length!==newCases.length||inserted.some(x=>!expectedIds.includes(x)))
   return hold('INSERTED_ID_SET_MISMATCH');
 const norm=x=>String(x??'').trim().toLowerCase();
 for(const x of casesInput){
  const id=x.accounting.primaryId||x.primaryId;
  if(!id||!b.has(id))return hold('CASE_ID_NOT_IN_MASTER');
  if(x.expectedOutcome!=='NEW'&&!a.has(id))return hold('NOOP_CREATED_NEW_ROW');
  const row=b.get(id),record=x.record||{};
  if(norm(row.COMPANY)!==norm(record.COMPANY)||norm(row.TITLE)!==norm(record.TITLE)||
    norm(row.LOCATION)!==norm(record.LOCATION)||
    (record.REQ_ID&&norm(row.REQ_ID)!==norm(record.REQ_ID)))
   return hold('MASTER_IDENTITY_MISMATCH');
  if(x.expectedOutcome==='PROTECTED_NOOP'&&
     (!x.protectedBefore||x.protectedBefore.PRIMARY_ID!==id))
   return hold('ARCHIVED_PROTECTION_NOT_PROVEN');
 }
 return {status:'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA',verified:false,scaleUpAllowed:false,
   beforeCount:a.size,afterCount:b.size,insertedIds:inserted};
}
module.exports={checkCanaryOutcome,reconcileCanaryBatch};
