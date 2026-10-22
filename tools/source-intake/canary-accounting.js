'use strict';
/* Pure receipt accounting. A Writer response alone is never durable proof. */
const NOOP=new Set(['EXISTING_MATCH','NEVER_CONSIDER_EXCLUDED']);
const INSERT=new Set(['SCOUT_INTAKE_WRITTEN','DISCOVERY_LEAD_WRITTEN']);
const norm=x=>String(x??'').trim().toLowerCase();
const sameIdentity=(row,record)=>norm(row.COMPANY)===norm(record.COMPANY)&&norm(row.TITLE)===norm(record.TITLE)&&
 norm(row.LOCATION)===norm(record.LOCATION)&&(!record.REQ_ID||norm(row.REQ_ID)===norm(record.REQ_ID));
function checkCanaryOutcome({expectedOutcome,record,result,receipt,readbacks,requestId}={}){
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
 if(requestId!==undefined&&receipt.requestId!==requestId)return held('RECEIPT_REQUEST_ID_MISMATCH');
 const pids=receipt.entry.items.map(x=>x.pid).filter(Boolean);
 if(!Array.isArray(readbacks))return held('READBACK_MISSING');
 if(kind==='EXISTING_MATCH'){
  if(!outcome.PRIMARY_ID||pids.length>1||pids.some(pid=>pid!==outcome.PRIMARY_ID))return held('EXISTING_IDENTITY_UNCERTAIN');
  const match=readbacks.filter(x=>x.primaryId===outcome.PRIMARY_ID&&x.found&&x.matches===1);
  if(match.length!==1)return held('EXISTING_READBACK_MISSING');
  const cells=String(match[0].line||'').split(' | '),norm=x=>String(x??'').trim().toLowerCase();
  if(cells.length<10||cells[1]!==outcome.PRIMARY_ID||norm(cells[2])!==norm(record?.COMPANY)||norm(cells[3])!==norm(record?.TITLE)||norm(cells[8])!==norm(record?.LOCATION)|| (record?.REQ_ID&&norm(cells[7])!==norm(record.REQ_ID)))return held('EXISTING_IDENTITY_MISMATCH');
  // A Writer no-op opens no master transaction, so its receipt carries no items at all, whatever their op name.
  if(receipt.entry.items.length)return held('UNEXPECTED_ROW_WRITE');
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
function reconcileCanaryBatch({cases:casesInput,before,after,archiveBefore,archiveAfter}={}){
 const hold=reason=>({status:'HOLD',reason,verified:false,scaleUpAllowed:false});
 if(!Array.isArray(casesInput)||casesInput.length!==5)return hold('FIVE_CASES_REQUIRED');
 if(!before||!after||before.authenticated!==true||after.authenticated!==true||
    before.source!=='WRITER'||after.source!=='WRITER'||!Array.isArray(before.rows)||!Array.isArray(after.rows))
   return hold('INDEPENDENT_WRITER_SNAPSHOTS_REQUIRED');
 if(!archiveBefore||!archiveAfter||archiveBefore.authenticated!==true||archiveAfter.authenticated!==true||
    archiveBefore.source!=='WRITER'||archiveAfter.source!=='WRITER'||!Array.isArray(archiveBefore.rows)||!Array.isArray(archiveAfter.rows))
   return hold('INDEPENDENT_ARCHIVE_SNAPSHOTS_REQUIRED');
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
 for(const x of casesInput){
  const id=x.accounting.primaryId||x.primaryId,record=x.record||{};
  if(x.expectedOutcome==='PROTECTED_NOOP'){
   // A protected no-op stays archived in both snapshots and must never be resurrected into the master.
   if(!id||id!==x.protectedPrimaryId)return hold('ARCHIVED_PROTECTION_NOT_PROVEN');
   if(a.has(id)||b.has(id))return hold('PROTECTED_ROLE_IN_MASTER');
   const was=archiveBefore.rows.filter(r=>r?.ARCHIVED_TERMINAL===true&&r.PRIMARY_ID===id);
   const now=archiveAfter.rows.filter(r=>r?.ARCHIVED_TERMINAL===true&&r.PRIMARY_ID===id);
   if(was.length!==1||now.length!==1)return hold('ARCHIVED_PROTECTION_NOT_PROVEN');
   if(!sameIdentity(was[0],record)||!sameIdentity(now[0],record))return hold('ARCHIVE_IDENTITY_MISMATCH');
   continue;
  }
  if(!id||!b.has(id))return hold('CASE_ID_NOT_IN_MASTER');
  if(x.expectedOutcome!=='NEW'&&!a.has(id))return hold('NOOP_CREATED_NEW_ROW');
  if(!sameIdentity(b.get(id),record))return hold('MASTER_IDENTITY_MISMATCH');
 }
 return {status:'COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA',verified:false,scaleUpAllowed:false,
   beforeCount:a.size,afterCount:b.size,insertedIds:inserted,archiveBeforeCount:archiveBefore.rows.length,archiveAfterCount:archiveAfter.rows.length};
}
module.exports={checkCanaryOutcome,reconcileCanaryBatch};
