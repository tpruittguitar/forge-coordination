'use strict';
// Field state for one enrichment role. The coordinator stores it on the shared
// work item, which assignment pages already publish.
//
// FACT: a PIPELINE_RECEIPT_INDEX item records pid, op, and before/after row
// hashes (b, a). It has no submitted field map. A COMPLETE receipt therefore
// cannot by itself prove a salary, degree, fit, or link value. This module
// marks a field submitted when a receipt item, or an already captured
// submission record, includes that map. Value confirmation uses the canonical
// snapshot row the coordinator already loaded (`row.p`), and only when that
// snapshot's readAt is later than the submission. Long text stored only behind
// an EVIDENCE_REF is absent from that snapshot; a field whose submitted value
// is absent there stays pending.
const Source=require('../programmed-coordinator/source.cjs');
const {normalizeCell:cell}=require('../source-intake/writer-cell');
const {hash}=require('../programmed-coordinator/store.cjs');
const GROUPS={
 SALARY:['SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_MIDPOINT','SALARY_BASIS','SALARY_SOURCE','SALARY_ASOF','SALARY_CONF'],
 DEGREE:['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','DEGREE_ASOF','REQUIREMENTS_REVIEWED'],
 FIT:['FIT_EVIDENCE','FIT_BASIS','FIT_ASOF','FIT_CONF'],
 LINKS:['SOURCE_URL','COMPANY_SOURCE_URL']
};
const ORDER=['SALARY','DEGREE','FIT','LINKS'];
const GROUP_OF=Object.fromEntries(ORDER.flatMap(group=>GROUPS[group].map(key=>[key,group])));
const groupOf=key=>GROUP_OF[key]||null;
const blank=()=>({status:'pending',flag:null,requestId:null,submittedAt:null,values:null,evidence:null,readbackAt:null});
const gid=/^FORGE-GROK-[A-Za-z0-9_-]+$/;
const pid=/^V2[A-Z]-[A-Za-z0-9_-]+$/;
function evidenceRecord(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const url=typeof raw.url==='string'?raw.url:null;
 const quote=typeof raw.quote==='string'?raw.quote:null;
 const observedAt=typeof raw.observedAt==='string'?raw.observedAt:null;
 const captured=raw.capture&&raw.capture.kind==='TEXT_EXTRACT'&&typeof raw.capture.text==='string'?raw.capture.text:null;
 const text=captured||(typeof raw.text==='string'?raw.text:null);
 if(text&&(Buffer.byteLength(text,'utf8')>200000||!text.trim()))return null;
 if(!url&&!quote&&!text)return null;
 return {url,quote,observedAt,sha256:text?hash(text):(typeof raw.sha256==='string'?raw.sha256:null),...(text?{text}:{})};
}
function rememberEvidence(field,raw){
 const record=evidenceRecord(raw);
 if(!record)return field.evidence||null;
 if(field.evidence?.text)return field.evidence;
 if(field.evidence&&!record.text)return field.evidence;
 field.evidence=record;
 return field.evidence;
}
function evidenceFor(item,group,fetchSource){
 const field=item?.fieldState?.fields?.[group];
 if(!field)throw Error('FIELD_STATE_REQUIRED');
 if(field.evidence?.text||field.evidence?.url)return {evidence:field.evidence,fetched:false};
 if(typeof fetchSource!=='function')return {evidence:field.evidence||null,fetched:false};
 return {evidence:rememberEvidence(field,fetchSource(group)),fetched:true};
}
function valuesMatch(values,row){
 const keys=Object.keys(values||{});
 if(!keys.length)return 'unbound';
 let mismatch=false,missing=false;
 for(const key of keys){
  const observed=row?.p?.[key];
  if(!Source.known(observed)){missing=true;continue;}
  if(cell(observed)!==cell(values[key]))mismatch=true;
 }
 if(mismatch)return 'mismatch';
 if(missing)return 'noop';
 return 'match';
}
function readbackReady(readAt,submittedAt){
 const read=Date.parse(readAt||''),sent=Date.parse(submittedAt||'');
 return Number.isFinite(read)&&Number.isFinite(sent)&&read>sent;
}
function considerReadback(field,row,readAt){
 if(field.receiptComplete===false||!field.values||!field.submittedAt||!readbackReady(readAt,field.submittedAt))return;
 const verdict=valuesMatch(field.values,row);
 field.readbackAt=readAt;
 if(verdict==='match'){field.status='satisfied';field.flag=null;}
 else if(verdict==='mismatch'){field.status='pending';field.flag='READBACK_MISMATCH';}
 else {field.status='pending';field.flag='SUCCESS_NO_OP';}
}
function groupValues(fields,group){
 return Object.fromEntries(Object.entries(fields||{}).filter(([key])=>groupOf(key)===group));
}
function applySubmission(state,sub,now){
 const noWrite=sub.noWrite===true||sub.mode==='BATCH_RULING_NO_WRITE'||sub.mode==='ALREADY_APPLIED';
 for(const group of ORDER){
  const field=state.fields[group];if(!field||field.status==='satisfied')continue;
  const values=groupValues(sub.fields,group);
  if(sub.evidence)rememberEvidence(field,sub.evidence);
  if(!Object.keys(values).length)continue;
  field.values=values;
  field.requestId=sub.requestId||field.requestId;
  field.submittedAt=sub.at||field.submittedAt||now;
  field.receiptComplete=noWrite||sub.complete===true;
  if(noWrite){field.status='pending';field.flag='SUCCESS_NO_OP';continue;}
  field.status='submitted';
  field.flag=null;
 }
}
function roleOf(fields){
 const list=ORDER.map(group=>fields[group]).filter(Boolean);
 if(!list.length)return 'satisfied';
 if(list.some(field=>field.status==='pending'))return 'pending';
 if(list.every(field=>field.status==='satisfied'))return 'satisfied';
 return 'submitted';
}
function sync(item){
 const state=item.fieldState;
 state.role=roleOf(state.fields);
 const pending=ORDER.filter(group=>state.fields[group]?.status==='pending');
 item.missingFields=pending;
 if(state.role==='pending')item.status='ASSIGNED';
 else if(state.role==='submitted')item.status='AWAITING_FIELD_READBACK';
 else item.status='ALREADY_COMPLETE';
 return item;
}
function seed(item,needs){
 const tracked=ORDER.filter(group=>needs.includes(group));
 item.fieldState={role:tracked.length?'pending':'satisfied',tracked,fields:Object.fromEntries(tracked.map(group=>[group,blank()]))};
 item.missingFields=tracked.slice();
 if(!tracked.length)item.status='ALREADY_COMPLETE';
 return item;
}
function advance(item,{needs=[],row,canonicalHash,readAt,now,submissions=[],unbound=[],captured=[]}={}){
 const submittedGroups=submissions.filter(sub=>sub.primaryId===item.primaryId).flatMap(sub=>Object.keys(sub.fields||{}).map(groupOf));
 const groups=new Set([...(item.fieldState?.tracked||[]),...needs,...submittedGroups].filter(group=>ORDER.includes(group)));
 if(!groups.size){
  if(['ASSIGNED','DIRECT_REQUEST_SUBMITTED','AWAITING_FIELD_READBACK'].includes(item.status))item.status='ALREADY_COMPLETE';
  if(item.fieldState){item.fieldState.role='satisfied';item.missingFields=[];}
  return item;
 }
 const state=item.fieldState||(item.fieldState={role:'pending',tracked:[],fields:{}});
 state.fields||={};
 for(const group of groups)state.fields[group]||=blank();
 state.tracked=ORDER.filter(group=>state.fields[group]);
 const excluded=new Set(item.directWriterRequest?.excludedRequestIds||[]);
 for(const sub of submissions){
  if(sub.primaryId!==item.primaryId||excluded.has(sub.requestId)||sub.ok===false)continue;
  applySubmission(state,sub,now);
 }
 for(const cap of captured){
  if(cap.primaryId!==item.primaryId)continue;
  const named=Object.keys(cap.fields||{}).map(groupOf).filter(Boolean);
  for(const group of named.length?named:state.tracked)if(state.fields[group])rememberEvidence(state.fields[group],cap.evidence);
 }
 const blanks=new Set(needs);
 for(const hit of unbound){
  if(hit.primaryId!==item.primaryId||excluded.has(hit.requestId))continue;
  for(const group of state.tracked){
   const field=state.fields[group];
   if(!field||field.status==='satisfied'||field.values||!blanks.has(group))continue;
   field.flag='SUCCESS_NO_OP';
   field.requestId=field.requestId||hit.requestId;
   field.status='pending';
  }
 }
 for(const field of Object.values(state.fields))considerReadback(field,row,readAt);
 // A group with no captured value map is still a blank while `needs` lists it.
 // Once the snapshot shows that group present, it leaves the pending set.
 // That is a cleared blank, and it is not a value-matched satisfaction.
 for(const group of [...state.tracked]){
  const field=state.fields[group];
  if(!field||field.values)continue;
  if(!needs.includes(group))delete state.fields[group];
 }
 state.tracked=ORDER.filter(group=>state.fields[group]);
 const seen=[...submissions,...unbound].filter(sub=>sub.primaryId===item.primaryId&&sub.requestId&&!excluded.has(sub.requestId)).map(sub=>sub.requestId);
 item.directWriterRequest={sourceVersion:item.sourceVersion,canonicalHash:canonicalHash||item.directWriterRequest?.canonicalHash||null,requestIds:[...new Set([...(item.directWriterRequest?.requestIds||[]).filter(id=>!excluded.has(id)),...seen])].sort(),excludedRequestIds:[...excluded].sort(),at:item.directWriterRequest?.at||submissions.find(sub=>sub.primaryId===item.primaryId&&sub.at)?.at||null};
 return sync(item);
}
function submissionFrom(requestId,at,item,complete){
 if(!gid.test(requestId||'')||!pid.test(item?.pid||''))return null;
 const fields=item.fields&&typeof item.fields==='object'&&!Array.isArray(item.fields)?item.fields:null;
 const noWrite=!!(item.b&&item.a&&item.b===item.a)||item.mode==='BATCH_RULING_NO_WRITE'||item.mode==='ALREADY_APPLIED'||item.noop===true;
 if(!fields&&!noWrite)return null;
 return {requestId,primaryId:item.pid,at:at||null,ok:item.ok!==false,mode:item.mode||(noWrite?'BATCH_RULING_NO_WRITE':'SUCCESS'),noWrite,fields:fields||{},evidence:item.evidence||null,complete:complete===true&&!noWrite};
}
function parseReceipts(writerReceipts){
 if(writerReceipts==null)return null;
 const index=writerReceipts.index||writerReceipts;
 if(!index||typeof index.requests!=='object'||Array.isArray(index.requests)||!Array.isArray(index.pending))throw Error('GROK_WRITER_RECEIPTS_REQUIRED');
 const submissions=[],unbound=[];
 const take=(requestId,at,item,complete)=>{
  if(!gid.test(requestId||'')||!pid.test(item?.pid||''))return;
  const parsed=submissionFrom(requestId,at,item,complete);
  if(parsed)submissions.push(parsed);
  else if(complete)unbound.push({requestId,primaryId:item.pid,at:at||null});
 };
 for(const [id,entry] of Object.entries(index.requests)){
  if(!gid.test(id))continue;
  for(const item of entry?.items||[])take(id,entry?.at,item,entry?.s==='COMPLETE');
 }
 for(const pending of index.pending){
  const ids=(pending?.requestIds||[]).filter(id=>gid.test(id||''));
  for(const id of ids)for(const item of pending.items||[])take(id,pending.writtenAt,item,false);
 }
 for(const sub of writerReceipts.submissions||[]){
  if(!sub||typeof sub!=='object'||!gid.test(sub.requestId||'')||!pid.test(sub.primaryId||''))continue;
  const noWrite=sub.noWrite===true||sub.mode==='BATCH_RULING_NO_WRITE'||sub.mode==='ALREADY_APPLIED';
  submissions.push({requestId:sub.requestId,primaryId:sub.primaryId,at:sub.at||null,ok:sub.ok!==false,mode:sub.mode||(noWrite?'BATCH_RULING_NO_WRITE':'SUCCESS'),noWrite,fields:sub.fields||{},evidence:sub.evidence||null,complete:sub.complete!==false&&sub.mode!=='PENDING'&&!noWrite});
 }
 submissions.sort((a,b)=>Number(a.complete)-Number(b.complete)||String(a.at||'').localeCompare(String(b.at||''))||a.requestId.localeCompare(b.requestId));
 return {submissions,unbound};
}
function storeEvidence(item,captured=[]){
 if(!item.fieldState?.fields)return item;
 for(const cap of captured){
  if(cap.primaryId!==(item.primaryId||item.key))continue;
  const named=Object.keys(cap.fields||{}).map(groupOf).filter(Boolean);
  for(const group of named.length?named:Object.keys(item.fieldState.fields))if(item.fieldState.fields[group])rememberEvidence(item.fieldState.fields[group],cap.evidence);
 }
 return item;
}
function relevant(parsed,primaryId){
 if(!parsed)return false;
 return parsed.submissions.some(sub=>sub.primaryId===primaryId)||parsed.unbound.some(hit=>hit.primaryId===primaryId);
}
function tally(work){
 const counts={pending:0,submitted:0,satisfied:0};
 for(const item of work.items||[])if(item.taskKey==='FORGE_GROK_SHARED_HELPER'&&item.kind==='ENRICHMENT'&&item.fieldState?.role)counts[item.fieldState.role]++;
 return counts;
}
module.exports={GROUPS,ORDER,groupOf,seed,advance,parseReceipts,relevant,evidenceFor,rememberEvidence,storeEvidence,tally,valuesMatch};
