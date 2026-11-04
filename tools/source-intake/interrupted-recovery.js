'use strict';
// Recover bookkeeping only. This module never POSTs, verifies pending transactions,
// fabricates acceptance responses, or changes the original candidate list.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=require('./writer-reader'),E=require('./production-executor');
const {reconcileIntakeBatch}=require('./intake-accounting');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function save(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.tmp',fd=fs.openSync(tmp,'wx');
 try{fs.writeFileSync(fd,JSON.stringify(value,null,1)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(tmp,file);
}
function noWrite(result,rid){
 return result?.ok===true&&result.COMPLETION_STATUS==='COMPLETE'&&result.WRITE_ACCEPTED!==true&&!result.writeId&&
  result.receipt?.REQUEST_ID===rid&&Array.isArray(result.receipt.NEW_PRIMARY_IDS)&&!result.receipt.NEW_PRIMARY_IDS.length&&
  Array.isArray(result.results)&&result.results.length===1&&typeof result.results[0]?.result==='string';
}
async function recover(file,{root='.',key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch}={}){
 const full=path.resolve(root,file),original=fs.readFileSync(full,'utf8'),state=JSON.parse(original);
 if(state.reconciliation||state.noCandidates||state.quarantine)return {status:'NOT_NEEDED'};
 if(state.mode!=='AUTO')return {status:'NOT_AUTO'};
 const candidates=JSON.parse(fs.readFileSync(full.replace(/\.json$/,'.candidates.json'),'utf8'));
 const ids=candidates.map(c=>E.requestId(c.record));
 if(hash(candidates)!==state.candidatesHash||JSON.stringify(ids)!==JSON.stringify(state.requestIds)||new Set(ids).size!==ids.length)
  throw Error('BLOCKED: interrupted recovery candidate binding changed');
 const results=state.results||{},attempted=ids.filter(id=>Object.hasOwn(results,id));
 if(Object.keys(results).some(id=>!ids.includes(id)))throw Error('BLOCKED: unknown recovered request identity');
 if(!attempted.length)return {status:'NO_CAPTURED_RESULTS'};
 // An uncertain response stays fenced. Do not turn a timeout into a no-write.
 if(attempted.some(id=>E.classifyWriterResponse(results[id],id).kind!=='INSERT_ACCEPTED'&&!noWrite(results[id],id)))
  return {status:'UNKNOWN_REMAINS'};
 const cases=[],proofs=[];
 for(const id of attempted){
  const candidate=candidates[ids.indexOf(id)],result=results[id];
  const index=(await R.read('receipt_index',{key,transport,requestId:id})).data;
  if(index.source!=='GITHUB'||index.exists!==true||!index.sha)throw Error('BLOCKED: recovery receipt index authority');
  if(E.classifyWriterResponse(result,id).kind==='INSERT_ACCEPTED'){
   if(index.request?.s!=='COMPLETE')return {status:'WAITING_FOR_COMPLETE',requestId:id};
   if(!result.writeId||index.request.w!==result.writeId)throw Error('BLOCKED: recovered write ID mismatch');
   // verifyAcceptedCase reads request_result only AFTER the independent index is COMPLETE,
   // then performs a fresh exact row readback with normal protected-identity checks.
   const accounting=await E.verifyAcceptedCase(candidate,id,result,index.request,{key,transport,expectedWriteId:result.writeId});
   if(accounting.status!=='CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK')throw Error('BLOCKED: recovered insert accounting');
   cases.push({...candidate,accounting});
   proofs.push({requestId:id,writeId:result.writeId,receiptState:'COMPLETE',exactRowVerified:true,primaryId:accounting.primaryId,binding:accounting.binding});
  }else{
   if(index.request)throw Error('BLOCKED: captured no-write has a master transaction');
   cases.push({...candidate,accounting:{status:'SKIPPED',reason:result.results[0].result}});
   proofs.push({requestId:id,status:'CAPTURED_NO_WRITE',reason:result.results[0].result});
  }
 }
 const [master,archive]=await Promise.all([R.fetchAuthenticatedMaster({key,transport}),R.fetchAuthenticatedArchive({key,transport})]);
 const before=state.snapshots?.before;
 const accounting=reconcileIntakeBatch({cases,before:before?.master,after:master,archiveBefore:before?.archive,archiveAfter:archive,mode:'AUTO'});
 if(accounting.status==='HOLD')return {status:'ACCOUNTING_HOLD',reason:accounting.reason};
 const at=new Date().toISOString(),carryForwardRequestIds=ids.filter(id=>!Object.hasOwn(results,id));
 const relative='receipts/auto-intake/recovery/'+state.sourceRunId+'-'+at.replace(/[^0-9]/g,'')+'-'+crypto.randomBytes(4).toString('hex')+'.json';
 const proof={schema:'forge.interrupted-intake-recovery.v1',at,run:state.sourceRunId,candidatesHash:state.candidatesHash,
  writerSubmissions:0,requests:proofs,carryForwardRequestIds,accounting};
 // Never overwrite a concurrent operator/worker update. Publish evidence before releasing the latch.
 if(fs.readFileSync(full,'utf8')!==original)throw Error('BLOCKED: interrupted run changed during recovery');
 save(path.resolve(root,relative),proof);
 state.reconciliation={status:'RECONCILED_INTERRUPTED_RUN_WITH_CARRY_FORWARD',at,authorizedBy:'Tim',
  writerSubmissions:0,proofs:[relative],verifiedRequestIds:proofs.filter(p=>p.receiptState==='COMPLETE').map(p=>p.requestId),
  noWriteRequestIds:proofs.filter(p=>p.status==='CAPTURED_NO_WRITE').map(p=>p.requestId),carryForwardRequestIds,accounting};
 save(full,state);
 return {status:'RECOVERED',run:state.sourceRunId,verified:state.reconciliation.verifiedRequestIds.length,
  noWrite:state.reconciliation.noWriteRequestIds.length,carriedForward:carryForwardRequestIds.length,proof:relative,writerSubmissions:0};
}
module.exports={recover,noWrite};
