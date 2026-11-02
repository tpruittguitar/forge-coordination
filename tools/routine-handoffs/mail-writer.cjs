'use strict';
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs'),Match=require('./mail-match.cjs');
const FILE='state/MAIL_PROCESSING.json',eventKey=e=>require('../helper-routing/outcome.cjs').eventKey(e.gmailMessageId,e.type,e.primaryId);
const empty=()=>({schema:'forge.mail-processing.v1',messages:{},transactions:{},exceptions:{}});
function persistEvent(root,event){
 for(const [file,schema]of [['state/APPLICATION_TRACKER_EVENTS.json','forge.application-tracker-events.v1'],['state/APPLICATION_OUTCOMES.json','forge.application-outcomes.v1']]){
  const ledger=S.read(root,file,{schema,events:[]}),index=ledger.events.findIndex(e=>e.gmailMessageId&&e.type===event.type&&e.primaryId===event.primaryId&&e.gmailMessageId===event.gmailMessageId);
  if(index<0)ledger.events.push(event);else ledger.events[index]={...ledger.events[index],...event};ledger.at=new Date().toISOString();S.save(root,file,ledger);
 }
}
const same=(a,b)=>String(a||'').trim()===String(b||'').trim();
function finish(root,state,tx,proof){tx.status='VERIFIED';tx.proof=proof;const message=state.messages[tx.messageId];message.status='VERIFIED';message.proof=proof;persistEvent(root,{...message.event,masterWriteStatus:'VERIFIED',writerProof:proof});delete state.exceptions[tx.eventKey];S.save(root,FILE,state);return tx.status;}
function verifyEffects(row,tx){if(!row||row.PRIMARY_ID!==tx.primaryId||!T.same(row,tx.identity)||Object.entries(tx.expected).some(([k,v])=>!same(k==='BUCKET'?row.BUCKET:row.p?.[k],v)))throw Error('EXACT_MAIL_EFFECT_NOT_PROVEN');}
async function reconcile({root,privateDir,state,tx,deps}){
 if(tx.status==='VERIFIED'||tx.status==='HELD')return tx.status;deps.checkLock();
 const payload=S.read(privateDir,'mail/'+tx.requestId+'-payload.json',null),response=S.read(privateDir,'mail/'+tx.requestId+'-acceptance.json',null);
 if(!payload||S.hash(payload)!==tx.payloadSha256)throw Error('ORIGINAL_MAIL_PAYLOAD_REQUIRED');
 if(!response)return tx.status='POST_IN_FLIGHT_UNKNOWN'; // Never infer acceptance or repeat the POST.
 if(tx.acceptanceSha256&&tx.acceptanceSha256!==S.hash(response))throw Error('ORIGINAL_MAIL_ACCEPTANCE_CHANGED');
 const results=response.results||[],result=results.filter(r=>r.requestId===tx.childRequestId&&(!r.primaryId||r.primaryId===tx.primaryId));
 if(results.length!==1||result.length!==1||result[0].ok!==true){tx.status='HELD';state.exceptions[tx.eventKey]={owner:'CODE',reason:'ORIGINAL_MAIL_RESULT_REQUIRES_REVIEW',requestId:tx.requestId};S.save(root,FILE,state);return tx.status;}
 const proof='receipts/'+tx.requestId+'_VERIFIED.json',existing=S.read(root,proof,null);
 if(existing){const times=[existing.completeObservedAt,existing.readbackStartedAt,existing.verifiedAt].map(Date.parse),noWrite=response.mode==='BATCH_RULING_NO_WRITE'&&!response.writeId;
  if(existing.schema!=='forge.mail-writer-verification.v1'||existing.requestId!==tx.requestId||existing.childRequestId!==tx.childRequestId||existing.primaryId!==tx.primaryId||existing.eventKey!==tx.eventKey||existing.acceptanceSha256!==S.hash(response)||!/^[a-f0-9]{64}$/.test(existing.rowSha256||'')||existing.noWrite!==noWrite||!noWrite&&!/^[a-f0-9]{40}$/.test(existing.independentIndexSha||'')||JSON.stringify([...existing.fields||[]].sort())!==JSON.stringify(Object.keys(tx.expected).sort())||times.some(t=>!Number.isFinite(t))||times[1]<times[0]||times[2]<times[1])throw Error('ORIGINAL_MAIL_VERIFICATION_BINDING_REQUIRED');return finish(root,state,tx,proof);}
 const noWrite=response.mode==='BATCH_RULING_NO_WRITE'&&!response.writeId;let index=null;
 if(!noWrite){if(!response.writeId)throw Error('MAIL_ACCEPTANCE_WRITE_ID_REQUIRED');index=await deps.index();const r=index.index.requests[tx.childRequestId];if(r?.s!=='COMPLETE'||r.w!==response.writeId||!r.items?.some(i=>i.pid===tx.primaryId))return tx.status='AWAITING_VERIFICATION';}
 const completeObservedAt=new Date().toISOString(),readback=await deps.rows(tx.requestId,[tx.primaryId]);if(Date.parse(readback.startedAt)<Date.parse(completeObservedAt)||!Number.isFinite(Date.parse(readback.startedAt)))throw Error('POST_COMPLETE_MAIL_READBACK_REQUIRED');
 const rows=readback.rows.filter(r=>r.PRIMARY_ID===tx.primaryId);if(rows.length!==1)throw Error('EXACT_MAIL_ID_REQUIRED');verifyEffects(rows[0],tx);
 S.immutable(root,proof,{schema:'forge.mail-writer-verification.v1',requestId:tx.requestId,childRequestId:tx.childRequestId,eventKey:tx.eventKey,primaryId:tx.primaryId,acceptanceSha256:S.hash(response),independentIndexSha:index?.sha||null,completeObservedAt,readbackStartedAt:readback.startedAt,verifiedAt:new Date().toISOString(),rowSha256:S.hash(rows[0].line||rows[0]),fields:Object.keys(tx.expected),noWrite,noReplay:true});
 return finish(root,state,tx,proof);
}
async function process({root,privateDir,state,message,deps,apply=true,runId}){
 const prior=state.messages[message.id];if(prior){
  if(prior.sourceSha256!==message.sourceSha256&&!(prior.classification==='FULL_MESSAGE_REQUIRED'&&!prior.transactionId&&message.fullBody))throw Error('IMMUTABLE_MAIL_SOURCE_CHANGED');
  if(prior.transactionId)return apply?reconcile({root,privateDir,state,tx:state.transactions[prior.transactionId],deps}):prior.status;
  if(!['PENDING','EXCEPTION','MATCH_REQUIRED'].includes(prior.status))return prior.status;
 }
 const classification=require('./mail.cjs').classify(message),entry={sourceSha256:message.sourceSha256,classification:classification.classification,status:classification.status,at:new Date().toISOString()};
 if(classification.owner!=='CODE'||classification.status==='PENDING'){if(apply){state.messages[message.id]=entry;state.exceptions[message.id]={owner:classification.owner,reason:classification.classification,messageId:message.id,sourceSha256:message.sourceSha256};S.save(root,FILE,state);}return entry.status;}
 if(classification.status!=='MATCH_REQUIRED'){
  if(apply){state.messages[message.id]=entry;if(classification.discoveryPending||classification.reportCollectionRequired){const ledger=S.read(root,'state/MAIL_SOURCE_HANDOFFS.json',{schema:'forge.mail-source-handoffs.v1',messages:{}});ledger.messages[message.id]={messageId:message.id,sourceSha256:message.sourceSha256,classification:classification.classification,status:'PENDING_SOURCE_ACCOUNTING',owner:classification.discoveryPending?'FORGE_EMAIL_DISCOVERY':'CODE_REPORT_TRANSPORT'};S.save(root,'state/MAIL_SOURCE_HANDOFFS.json',ledger);}S.save(root,FILE,state);}return entry.status;
 }
 const snapshot=await deps.snapshot();if(!Number.isFinite(Date.parse(snapshot.source?.readAt))||Date.now()-Date.parse(snapshot.source.readAt)>900000)throw Error('FRESH_MAIL_CANONICAL_REQUIRED');
 const events=S.read(root,'state/APPLICATION_TRACKER_EVENTS.json',{events:[]}).events,matched=Match.match(message,{...snapshot,events}),row=matched.row;
 const event={primaryId:row.PRIMARY_ID,type:classification.type,eventDate:message.at.slice(0,10),gmailMessageId:message.id,threadId:message.threadId,matchingMethod:matched.method,sourceType:'EMAIL',sourceSha256:message.sourceSha256,evidenceVerified:true,masterWriteStatus:'PENDING',evidenceRef:'gmail:'+message.id};
 const key=eventKey(event),plan=Match.mutation(event,row,matched);entry.event=event;entry.eventKey=key;
 if(!apply)return{status:plan.eventOnly?'EVENT_ONLY':'READY',primaryId:row.PRIMARY_ID,eventKey:key};
 deps.checkLock();
 if(plan.eventOnly){state.messages[message.id]=entry;entry.status='RECORDED_EVENT';entry.reason=plan.reason;persistEvent(root,{...event,masterWriteStatus:'EVENT_ONLY',canonicalStatePreserved:true});S.save(root,FILE,state);return entry.status;}
 T.healthy(snapshot.status);if(T.fenced(root,{transactions:{}},row.PRIMARY_ID))throw Error('ORIGINAL_MAIL_OR_WRITER_FENCE');
 const requestId='FORGE-MAIL-CHATGPT-'+key.slice(0,32),childRequestId=requestId+'-R1';if(await deps.exists(requestId)||await deps.exists(childRequestId))throw Error('ORIGINAL_MAIL_REQUEST_ALREADY_EXISTS');
 const ruling={requestId:childRequestId,primaryId:row.PRIMARY_ID,kind:plan.kind,eventDate:event.eventDate,actor:'CHATGPT',evidence:'Gmail '+message.id+'; source SHA256 '+message.sourceSha256,fields:{UPSERT_KEY:'UK-'+key.slice(0,24)}};
 plan.expected[plan.kind==='REJECTED_BY_EMPLOYER'?'REJECTION_EVIDENCE':row.BUCKET==='APPLIED'?'APP_EMAIL_EVIDENCE':'APP_STATUS_EVIDENCE']=ruling.evidence;
 const payload={action:'batch',requestId,requests:[{action:'ruling',ruling}]};
 const tx={schema:'forge.mail-writer-transaction.v1',requestId,childRequestId,messageId:message.id,eventKey:key,event,sourceSha256:message.sourceSha256,primaryId:row.PRIMARY_ID,ids:[row.PRIMARY_ID],identity:T.identity(row),expected:plan.expected,payloadSha256:S.hash(payload),status:'POST_IN_FLIGHT_UNKNOWN',runId,at:new Date().toISOString()};
 S.immutable(privateDir,'mail/'+requestId+'-payload.json',payload);S.immutable(root,'receipts/'+requestId+'_CHECKPOINT.json',tx);state.messages[message.id]=entry;state.transactions[requestId]=tx;entry.transactionId=requestId;entry.status='POST_IN_FLIGHT_UNKNOWN';persistEvent(root,event);S.save(root,FILE,state);deps.checkLock();
 try{const response=await deps.post(payload);S.immutable(privateDir,'mail/'+requestId+'-acceptance.json',response);tx.acceptanceSha256=S.hash(response);tx.status='AWAITING_VERIFICATION';}catch{tx.status='POST_IN_FLIGHT_UNKNOWN';}
 S.save(root,FILE,state);return reconcile({root,privateDir,state,tx,deps});
}
function recoverOrphans(root,state){for(const f of S.files(require('node:path').join(root,'receipts')).filter(f=>/FORGE-MAIL-CHATGPT-[a-f0-9]+_CHECKPOINT\.json$/.test(f))){const tx=JSON.parse(require('node:fs').readFileSync(f,'utf8'));if(!state.transactions[tx.requestId]){state.transactions[tx.requestId]=tx;state.messages[tx.messageId]={sourceSha256:tx.sourceSha256,event:tx.event,eventKey:tx.eventKey,status:'POST_IN_FLIGHT_UNKNOWN',transactionId:tx.requestId};}}}
module.exports={empty,eventKey,process,reconcile,persistEvent,verifyEffects,recoverOrphans,FILE};
