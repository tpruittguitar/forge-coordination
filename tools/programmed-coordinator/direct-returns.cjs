'use strict';
// A processing scope, not another Writer or permission to trust helper output.
const path=require('node:path'),S=require('./store.cjs'),Reports=require('../routine-handoffs/reports.cjs');
const FILE='state/DIRECT_RETURN_TRANSPORT.json';
const SCHEMAS=new Set(['forge.shared-helper-batch.v1','forge.claude-helper-batch.v1','forge.intake-helper-batch.v1','forge.enrichment-helper-batch.v1','forge.relevance-helper-batch.v1']);
const validPath=p=>typeof p==='string'&&/^receipts\/(?:(?:CLAUDE_HELPERS|GROK_HELPERS|CHATGPT_HELPERS)\/FORGE_[A-Z0-9_]+\/|CLAUDE_RELEVANCE\/)[A-Za-z0-9_-]+\.json$/.test(p);
function options({returnsOnly=false,batches=[]}={}){
 if(typeof returnsOnly!=='boolean'||!Array.isArray(batches)||batches.some(p=>!validPath(p))||(!returnsOnly&&batches.length))throw Error('INVALID_RETURN_PROCESSING_SCOPE');
 return{returnsOnly,batches:[...new Set(batches)]};
}
function args(argv){
 const value={returnsOnly:false,batches:[]};
 for(let n=0;n<argv.length;n++){
  if(argv[n]==='--returns-only')value.returnsOnly=true;
  else if(argv[n]==='--batch'&&argv[n+1])value.batches.push(argv[++n]);
  else throw Error('Use --returns-only [--batch <published helper receipt path>]');
 }
 return options(value);
}
function selector(root,batches=[]){
 const selected=new Set(batches),cache=new Map();
 return item=>{
  if(!item||selected.size&&!selected.has(item.batch))return false;
  if(!cache.has(item.batch)){try{cache.set(item.batch,S.read(root,item.batch,null));}catch{cache.set(item.batch,null);}}
  const b=cache.get(item.batch);
  return !!b&&SCHEMAS.has(b.schema)&&b.taskKey===item.taskKey;
 };
}
function intakeKeys(root,state,select){
 const keys=new Set(),cache=new Map();
 for(const item of Object.values(state.items)){
  if(!select(item)||state.batches[item.batch]?.status!=='VALIDATED')continue;
  if(!cache.has(item.batch))cache.set(item.batch,S.read(root,item.batch));
  const batch=cache.get(item.batch),source=batch.items.find(i=>(i.key||i.primaryId)===item.itemKey);
  const enrichment=batch.schema==='forge.shared-helper-batch.v1'?source?.kind==='ENRICHMENT':/ENRICHMENT/.test(item.taskKey);
  if(source&&!enrichment)keys.add(item.itemKey);
 }
 return keys;
}
function checkSelected(state,batches){
 for(const batch of batches){
  const key='direct-return:'+batch,status=state.batches[batch]?.status;
  if(status==='VALIDATED')delete state.exceptions[key];
  else state.exceptions[key]={owner:'CODE',path:batch,reason:status==='LEGACY_TRACKED'?'LEGACY_RETURN_RECONCILIATION_REQUIRED':status?'SELECTED_RETURN_NOT_VALIDATED':'SELECTED_RETURN_NOT_CAPTURED'};
 }
}
function settleShared({root,state,snapshot,select,checkLock}){
 const H=require('../helper-routing/shared.cjs'),work=S.read(root,H.FILE,null);if(!work)return{updated:0,newAssignments:0};
 H.validateWork(work);const byId=new Map(snapshot.rows.map(r=>[r.PRIMARY_ID,r])),intake=require('../routine-handoffs/intake-state.cjs').load(root);let updated=0;
 for(const item of Object.values(state.items)){
  if(!select(item)||state.batches[item.batch]?.status!=='VALIDATED'||!H.TASKS[item.taskKey])continue;
  const batch=S.read(root,item.batch),source=batch.items.find(i=>H.key(i)===item.itemKey),reservation=work.items.find(i=>H.key(i)===item.itemKey);
  if(!source||!reservation||!H.active(reservation))continue;
  // Preserve ownership and every original-request fence, even across retries.
  try{H.validateBatch({...batch,items:[source]},work);}catch{continue;}
  const row=byId.get(source.primaryId),remaining=row?require('../helper-routing/shared-assignments.cjs').needs(row).filter(f=>(reservation.missingFields||[]).includes(f)):null;
  const consumed=intake.items.find(i=>i.coordinatorKey===item.key&&/^VERIFIED_(INSERTED|EXISTING)$/.test(i.status)&&i.proof);
  reservation.status=item.status==='PROTECTED_SKIP'?'PROTECTED_SKIP':consumed||/^EXISTING/.test(item.status)||row&&remaining.length===0?'CONSUMED':/^VERIFIED|^NO_MISSING/.test(item.status)?'RETURNED_PARTIALLY_CONSUMED':'RETURNED_PENDING_REVIEW';
  reservation.returnProof=item.batch;if(item.proof||consumed?.proof)reservation.consumptionProof=item.proof||consumed.proof;
  if(remaining)reservation.remainingFields=remaining;
  updated++;
 }
 if(updated){checkLock();S.save(root,H.FILE,work);}
 return{updated,newAssignments:0};
}
function capture({root,privateDir,commit,runId,apply,config=require('../routine-handoffs/run.cjs').settings(privateDir)}){
 const state=S.read(root,FILE,Reports.empty());
 const report={schema:'forge.direct-return-transport.v1',runId,imported:0,source:'EXISTING_CAPTURED_ARTIFACTS',browserPolling:false,mailProcessing:false,writerSubmissions:0};
 if(!apply)return{...report,mode:'PUBLISHED_RETURNS_ONLY'};
 const captured=require('../routine-handoffs/direct-handoffs.cjs').consume(privateDir);
 // Always include the already-authorized captured Drive destination. Configured
 // inboxes reuse the ordinary importer, historical routing and immutable checks.
 const inboxes=[{directory:path.join(privateDir,'helper-inbox'),pattern:'.*\\.(?:json|jsonl|md|txt|zip)$'},...(config.inboxes||[])];
 const unique=[...new Map(inboxes.map(i=>[path.resolve(i.directory),i])).values()];
 report.imported=Reports.scanInboxes({root,privateDir,state,commit,inboxes:unique,python:config.python,acceptBatch:b=>SCHEMAS.has(b.schema)}).imported;
 report.capture=captured;
 report.exceptions=[...Object.values(state.exceptions),...captured.pending.filter(i=>i.reason!=='DIRECT_HANDOFF_CAPTURE_NOT_YET_RUN').map(i=>({owner:'CODE',...i}))];
 S.save(root,FILE,state);
 return report;
}
module.exports={FILE,SCHEMAS,options,arguments:args,selector,intakeKeys,checkSelected,settleShared,capture};
