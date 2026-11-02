'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),M=require('./mail.cjs'),W=require('./mail-writer.cjs');
async function run({root,privateDir,runId,deps,inboxes=[path.join(privateDir,'mail-inbox')],apply=false}){
 const state=S.read(root,W.FILE,W.empty()),verifiedBefore=new Set(Object.values(state.transactions).filter(t=>t.status==='VERIFIED').map(t=>t.requestId)),result={schema:'forge.mail-processing-report.v1',runId,read:0,processed:0,pending:0,exceptions:[],noProcessingCap:true};
 W.recoverOrphans(root,state);
 if(apply)try{require('./mail-connector.cjs').ingest(root,privateDir);delete state.exceptions.inventory;}catch(e){state.exceptions.inventory={owner:'CODE',reason:reason(e)};}
 if(apply)for(const tx of Object.values(state.transactions).filter(t=>!['VERIFIED','HELD'].includes(t.status))){try{await W.reconcile({root,privateDir,state,tx,deps});}catch(e){state.exceptions[tx.eventKey]={owner:'CODE',reason:reason(e),requestId:tx.requestId};}}
 const messages=new Map(),conflicts=new Set();result.observations=0;
 for(const directory of inboxes){
  if(!path.isAbsolute(directory))throw Error('ABSOLUTE_PRIVATE_MAIL_INBOX_REQUIRED');
  if(!fs.existsSync(directory))continue;
  for(const file of S.files(directory)){
   let capture;
   try{capture=JSON.parse(fs.readFileSync(file,'utf8'));if(capture.schema!=='forge.gmail-source-capture.v1'||capture.transport!=='SUPPORTED_GMAIL_CONNECTOR'||!Number.isFinite(Date.parse(capture.capturedAt))||capture.request?.format!=='full'||!Array.isArray(capture.responses))throw Error('FULL_AUTHORIZED_GMAIL_CAPTURE_REQUIRED');
    if(!Array.isArray(capture.request.ids)||capture.request.ids.length!==new Set(capture.request.ids).size||capture.responses.length!==new Set(capture.responses.map(m=>m.id)).size)throw Error('GMAIL_SOURCE_REQUEST_BINDING_REQUIRED');
    const wanted=new Set(capture.request.ids);if(capture.responses.some(m=>!wanted.has(m.id))||capture.responses.length!==wanted.size)throw Error('GMAIL_SOURCE_REQUEST_BINDING_REQUIRED');
    for(const raw of capture.responses){let message;result.observations++;
     try{message=M.normalize(raw);}catch(e){state.exceptions['message:'+S.hash(raw.id||raw)]={owner:'CODE',reason:'FULL_MESSAGE_NORMALIZATION_REQUIRED'};result.invalidObservations=(result.invalidObservations||0)+1;result.pending++;continue;}
     if(apply)S.immutable(privateDir,'gmail-captures/'+message.captureSha256+'.json',raw);
     const prior=messages.get(message.id);
     if(prior?.fullBody&&message.fullBody&&prior.sourceSha256!==message.sourceSha256)conflicts.add(message.id);
     if(!prior||!prior.fullBody&&message.fullBody)messages.set(message.id,message);
    }
   }catch(e){state.exceptions['capture:'+S.hash(file)]={owner:'CODE',reason:reason(e),sourceHash:S.hash(file)};}
  }
 }
 result.read=messages.size;result.duplicateObservations=result.observations-result.read-(result.invalidObservations||0);
 for(const message of messages.values()){
  if(conflicts.has(message.id)){state.exceptions[message.id]={owner:'CODE',messageId:message.id,reason:'CONFLICTING_FULL_MESSAGE_CAPTURES'};result.pending++;continue;}
  try{const status=await W.process({root,privateDir,state,message,deps,apply,runId}),name=typeof status==='string'?status:status.status;result.statuses=result.statuses||{};result.statuses[name]=(result.statuses[name]||0)+1;result.processed++;if(/PENDING|IN_FLIGHT|AWAITING|EXCEPTION/.test(name))result.pending++;else delete state.exceptions[message.id];}
  catch(e){state.exceptions[message.id]={owner:/MATCH|IDENTIT|THREAD|CYCLE|INTERPRETATION/.test(e.message)?'AI':'CODE',messageId:message.id,sourceSha256:message.sourceSha256,reason:reason(e)};result.pending++;}
 }
 result.exceptions=Object.values(state.exceptions);result.transactions=Object.values(state.transactions).map(t=>({requestId:t.requestId,status:t.status,primaryId:t.primaryId}));result.masterVerifiedThisRun=Object.values(state.transactions).filter(t=>t.status==='VERIFIED'&&!verifiedBefore.has(t.requestId)).length;
 if(apply){deps.checkLock();S.save(root,W.FILE,state);S.save(root,'state/MAIL_PROCESSING_REPORT.json',result);S.immutable(root,'receipts/'+runId+'_MAIL.json',result);updateCursor(root,state);}
 return result;
}
function reason(e){return /^[A-Z][A-Z0-9_]{3,100}$/.test(e.message||'')?e.message:'MAIL_SOURCE_OR_WRITE_FAILURE';}
function updateCursor(root,state){
 const cursor=S.read(root,'state/APPLICATION_TRACKER_CURSOR.json',null);if(!cursor)return;
 const done=new Set(Object.entries(state.messages).filter(([,m])=>['VERIFIED','RECORDED_EVENT','VERIFIED_NOT_RECRUITING','HANDED_TO_DISCOVERY'].includes(m.status)).map(([id])=>id));
 cursor.processedMessageIds=[...new Set([...(cursor.processedMessageIds||[]),...done])];cursor.pendingMessageIds=(cursor.pendingMessageIds||[]).filter(id=>!done.has(id));
 for(const m of cursor.helperPendingMessages||[])if(done.has(m.messageId)){m.status='COORDINATOR_DISPOSITIONED';m.fullBodyRead=true;m.evidenceVerified=true;m.proof='state/MAIL_PROCESSING.json#'+m.messageId;}
 if(!cursor.pendingMessageIds.length&&cursor.queryPagesPending===0)cursor.fullyReadThrough=cursor.enumeratedThrough;cursor.at=new Date().toISOString();S.save(root,'state/APPLICATION_TRACKER_CURSOR.json',cursor);
 const registry=S.read(root,'control/OUTCOME_HELPER_WORK.json',null);if(registry?.pendingSourceResearch){for(const item of registry.pendingSourceResearch.items||[])if(done.has(item.gmailMessageId||item.messageId))Object.assign(item,{status:'COORDINATOR_DISPOSITIONED',fullBodyRead:true,sourceBodyReadByCoordinator:true,evidenceVerified:true});registry.pendingSourceResearch.pendingMessages=(registry.pendingSourceResearch.items||[]).filter(i=>i.status==='HELPER_PENDING').length;S.save(root,'control/OUTCOME_HELPER_WORK.json',registry);}
}
module.exports={run,updateCursor};
