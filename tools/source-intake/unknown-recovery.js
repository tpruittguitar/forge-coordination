'use strict';
// Tim 2026-10-30: uncertain transport must not strand an absent job forever.
// Recovery reuses the exact stable ID and Writer's locked master+archive dedupe.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=require('./writer-reader'),E=require('./production-executor'),C=require('./intake-cli');
const {normalizeCell}=require('./writer-cell');
const sameIdentity=(a,b)=>['COMPANY','TITLE','LOCATION'].every(k=>normalizeCell(a[k])===normalizeCell(b[k]));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const norm=x=>String(x||'').toLowerCase().replace(/\b(corporation|corp|inc|llc|ltd)\b/g,'').replace(/[^a-z0-9]/g,'');
function eligible({prior,attemptedAt,now,receipt,rows,record}){
 if(!prior||!(prior.status==='POST_IN_FLIGHT_UNKNOWN'||/timeout|aborted/i.test(prior.error||''))||prior.WRITE_ACCEPTED||prior.writeId)return 'NOT_TRANSPORT_UNKNOWN';
 const age=now-Date.parse(attemptedAt);if(!Number.isFinite(age)||age<60*60000)return 'WAIT_FOR_ORIGINAL_EXECUTION';
 if(receipt)return 'RECONCILE_EXISTING_RECEIPT';
 if(rows.some(r=>sameIdentity(r,record)))return 'EXACT_JOB_ALREADY_PRESENT';
 if(rows.some(r=>norm(r.COMPANY)===norm(record.COMPANY)&&norm(r.TITLE)===norm(record.TITLE)))return 'AMBIGUOUS_JOB_IDENTITY';
 return 'RETRY_ABSENT_JOB';
}
function resolved(s){const r=s.unknownRecovery;return r?.schema==='forge.unknown-recovery.v1'&&r.requestId===s.quarantine?.requestId&&((r.status==='VERIFIED'&&r.receiptState==='COMPLETE')||(r.status==='EXISTING_SATISFIED'&&r.receiptState==='NOT_REQUIRED_NO_WRITE'))&&r.exactRowVerified===true&&/^V2[A-Z]-/.test(r.primaryId||'')&&/^receipts\/auto-intake\/recovery\//.test(r.proof||'');}
function save(file,data){const tmp=file+'.tmp',fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,JSON.stringify(data,null,1));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
async function recover(file,{key=process.env.FORGE_WRITER_KEY,transport=fetch,root=process.cwd()}={}){
 const full=path.resolve(root,file),s=JSON.parse(fs.readFileSync(full)),q=s.quarantine;if(!q||resolved(s))return {status:'NOT_NEEDED'};
 if(!require('./auto-latch').isolatedUnknown(s))throw Error('Invalid quarantine');
 const all=JSON.parse(fs.readFileSync(full.replace(/\.json$/,'.candidates.json')));if(digest(all)!==s.candidatesHash)throw Error('Original candidate binding changed');
 const candidate=all.find(c=>E.requestId(c.record)===q.requestId);if(!candidate)throw Error('Original candidate missing');
 const dir=path.join(root,'receipts/auto-intake/recovery');fs.mkdirSync(dir,{recursive:true});const child=path.join(dir,q.requestId+'.json'),candidates=[candidate],opts={key,transport,statePath:child,candidates};
 if(!fs.existsSync(child)){
  const pre=await E.preflight(candidate.record,{key,transport});
  const master=await R.fetchAuthenticatedMaster({key,transport}),archive=await R.fetchAuthenticatedArchive({key,transport});
  const attemptedAt=s.results[q.requestId]?.attemptedAt||s.halts?.[0]?.at;
  const decision=eligible({prior:s.results[q.requestId],attemptedAt,now:Date.now(),receipt:pre.entry,rows:master.rows.concat(archive.rows),record:candidate.record});
  if(decision==='EXACT_JOB_ALREADY_PRESENT'){
   const hits=master.rows.concat(archive.rows).filter(r=>sameIdentity(r,candidate.record));if(hits.length!==1)return {status:'AMBIGUOUS_JOB_IDENTITY'};
   const proof=child.replace('.json','.existing.json');save(proof,{at:new Date().toISOString(),requestId:q.requestId,master,archive,matched:hits[0],writerSubmissions:0});
   s.unknownRecovery={schema:'forge.unknown-recovery.v1',status:'EXISTING_SATISFIED',at:new Date().toISOString(),requestId:q.requestId,receiptState:'NOT_REQUIRED_NO_WRITE',exactRowVerified:true,primaryId:hits[0].PRIMARY_ID,proof:path.relative(root,proof).split(path.sep).join('/'),originalOutcome:'UNKNOWN_TRANSPORT',carryForwardRequestIds:q.carryForwardRequestIds};save(full,s);return s.unknownRecovery;
  }
  if(decision!=='RETRY_ABSENT_JOB')return {status:decision};
  if(pre.rulesHash!==candidate.rulesHash) return {status:'REVIEW_CHANGED_RULES'};
  // Same source ID / exact payload identity, one automatic recovery attempt. A second timeout stays explicit.
  await C.snapshot('before',{...opts,sourceRunId:'FORGE-RECOVERY-'+q.requestId.slice(-24),mode:'AUTO'});
  const cs=JSON.parse(fs.readFileSync(child));cs.recoveryAuthorization={by:'Tim',policy:'ABSENT_JOB_AFTER_TRANSPORT_TIMEOUT_V1',at:new Date().toISOString(),originalState:file,originalRequestId:q.requestId,originalAttemptedAt:attemptedAt,master,archive,decision};save(child,cs);
 }
 const outcome=await C.auto(opts);if(outcome.status!=='ALL_CASES_ACCOUNTED'&&outcome.status!=='ALREADY_COMPLETE')return {status:'RECOVERY_PENDING',detail:outcome.message};
 const cs=JSON.parse(fs.readFileSync(child)),result=cs.results[q.requestId];
 if(E.classifyWriterResponse(result,q.requestId).kind==='NOOP_COMPLETE'){
  const accounting=await E.verifyNoopCase({...candidate,expectedOutcome:'EXISTING_MATCH'},q.requestId,result,{key,transport});
  if(accounting.status!=='EXISTING_NOOP_PENDING_INDEPENDENT_COUNTS')return {status:'RECOVERY_NOT_VERIFIED'};
  s.unknownRecovery={schema:'forge.unknown-recovery.v1',status:'EXISTING_SATISFIED',at:new Date().toISOString(),requestId:q.requestId,receiptState:'NOT_REQUIRED_NO_WRITE',exactRowVerified:true,primaryId:accounting.primaryId,proof:path.relative(root,child).split(path.sep).join('/'),originalOutcome:'UNKNOWN_TRANSPORT',carryForwardRequestIds:q.carryForwardRequestIds};save(full,s);return s.unknownRecovery;
 }
 const receipt=await R.read('receipt_index',{key,transport,requestId:q.requestId});
 const accounting=await E.verifyAcceptedCase(candidate,q.requestId,result,receipt.data.request,{key,transport});
 if(accounting.status!=='CONSISTENT_PENDING_INDEPENDENT_COUNT_CHECK')return {status:'RECOVERY_NOT_VERIFIED'};
 await C.snapshot('after',opts);C.finalize(opts);
 s.unknownRecovery={schema:'forge.unknown-recovery.v1',status:'VERIFIED',at:new Date().toISOString(),requestId:q.requestId,receiptState:'COMPLETE',exactRowVerified:true,primaryId:accounting.primaryId,proof:path.relative(root,child).split(path.sep).join('/'),originalOutcome:'UNKNOWN_TRANSPORT',carryForwardRequestIds:q.carryForwardRequestIds};save(full,s);
 return s.unknownRecovery;
}
function contain(file,{root=process.cwd()}={}){
 const full=path.resolve(root,file),s=JSON.parse(fs.readFileSync(full));if(s.quarantine||s.reconciliation||s.noCandidates)return false;
 const rid=require('./auto-latch').stoppedAt(s),prior=s.results?.[rid];if(!prior||prior.WRITE_ACCEPTED||prior.writeId||!(prior.status==='POST_IN_FLIGHT_UNKNOWN'||/timeout|aborted/i.test(prior.error||'')))return false;
 const candidates=JSON.parse(fs.readFileSync(full.replace(/\.json$/,'.candidates.json')));if(digest(candidates)!==s.candidatesHash)throw Error('Original candidate binding changed');const candidate=candidates.find(c=>E.requestId(c.record)===rid);if(!candidate)return false;
 s.quarantine={schema:'forge.intake-quarantine.v1',status:'UNKNOWN_NO_REPLAY',authorizedBy:'Tim',at:new Date().toISOString(),record:candidate.record,requestId:rid,candidatesHash:s.candidatesHash,proofs:[file],carryForwardRequestIds:s.requestIds.filter(id=>!Object.hasOwn(s.results||{},id)),policy:'ABSENT_JOB_AFTER_TRANSPORT_TIMEOUT_V1'};save(full,s);return true;
}
module.exports={eligible,resolved,recover,contain};
