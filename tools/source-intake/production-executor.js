'use strict';
/* Production Writer executor; never enabled by default, never automatically retries writes.
 * Writer intake response contract (foreman-cockpit apps-script/Code.gs applyIntakeToMaster_/intakeResponse_):
 *  - insert: ok, WRITE_ACCEPTED=true, writeId, COMPLETION_STATUS=PENDING_VERIFICATION, receipt.NEW_PRIMARY_IDS=[pid];
 *    receipt_index gets {s:'PENDING',w:writeId} before the master write and later {s:'COMPLETE',items:[{pid,op:'INSERT'}]}.
 *  - no-op (EXISTING_MATCH against live master OR terminal archive): ok, COMPLETION_STATUS=COMPLETE, no WRITE_ACCEPTED,
 *    no writeId, receipt.NEW_PRIMARY_IDS=[]; the receipt goes to the receipts log only — receipt_index gets NO entry.
 * Durability: runCanary requires a recorder {check, record, read}. check() must prove a write/read-back before any
 * network call; every Writer response is recorded and read back before it is classified. A recorder failure after
 * a POST halts as UNKNOWN with the response attached to the error — reconcile, never retry.
 * Release stages (control/SOURCE_INTAKE_RELEASE.json): CANARY = revision SOURCE_INTAKE_CANARY_V1, maxBatch 5, exactly five
 * cases covering new, existing and protected; STAGE = revision SOURCE_INTAKE_STAGE_V1, maxBatch 25 or 200, approvedBy set,
 * 1..maxBatch reviewed cases. Every case still goes through the same gates, recorder and one-transaction-at-a-time halt.
 * Kill switch: re-read before each case. Turning it off stops LATER cases only; it cannot cancel a POST already in
 * flight, so a case that was mid-POST must still be reconciled through the receipt index.
 */
const crypto=require('node:crypto');
const {read,fetchAuthenticatedArchive}=require('./writer-reader');
const {stableId}=require('./transaction-preflight');
const {checkCanaryOutcome}=require('./canary-accounting');
const ENDPOINT='https://script.google.com/macros/s/AKfycbwShspSkto70NeFWjgTuyIf-W3EDgUmKmoWevE-jZq95pm6SAulrJYHX1HmiPg8tx3i/exec';
// Contents API, not raw.githubusercontent.com: the raw CDN can serve a stale switch for minutes after it is turned off.
const SWITCH='https://api.github.com/repos/tpruittguitar/forge-coordination/contents/control/SOURCE_INTAKE_RELEASE.json?ref=main';
const KINDS=new Set(['NEW','EXISTING_MATCH','PROTECTED_NOOP']);
const INSERT=new Set(['SCOUT_INTAKE_WRITTEN','DISCOVERY_LEAD_WRITTEN']);
function requestId(record){return 'FORGE-SOURCE-'+stableId(record)}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const validPid=x=>/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x||'');
const norm=x=>String(x??'').trim().toLowerCase();
const sameIdentity=(row,record)=>norm(row.COMPANY)===norm(record.COMPANY)&&norm(row.TITLE)===norm(record.TITLE)&&
 norm(row.LOCATION)===norm(record.LOCATION)&&(!record.REQ_ID||norm(row.REQ_ID)===norm(record.REQ_ID));
// The only two armed states the executor accepts. Anything else is disarmed.
function releaseRules(cfg){
 if(!cfg||cfg.enabled!==true)return null;
 if(cfg.mode==='CANARY'&&cfg.revision==='SOURCE_INTAKE_CANARY_V1'&&cfg.maxBatch===5)return {mode:'CANARY',maxBatch:5};
 if(cfg.mode==='STAGE'&&cfg.revision==='SOURCE_INTAKE_STAGE_V1'&&(cfg.maxBatch===25||cfg.maxBatch===200)&&typeof cfg.approvedBy==='string'&&cfg.approvedBy.trim())return {mode:'STAGE',maxBatch:cfg.maxBatch};
 // AUTO (Tim 2026-10-23): the scheduled source-intake-auto workflow submits filtered candidates without per-batch review.
 if(cfg.mode==='AUTO'&&cfg.revision==='SOURCE_INTAKE_AUTO_V1'&&Number.isInteger(cfg.maxBatch)&&cfg.maxBatch>=1&&cfg.maxBatch<=25&&typeof cfg.approvedBy==='string'&&cfg.approvedBy.trim())return {mode:'AUTO',maxBatch:cfg.maxBatch};
 return null;
}
async function fetchRelease(fetcher=globalThis.fetch){
 // Authenticated when a token is available: the unauthenticated limit (60/h) halted the 24-job stage at case 13.
 const token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
 const response=await fetcher(SWITCH,{headers:{'Accept':'application/vnd.github.raw','Cache-Control':'no-store','User-Agent':'forge-source-intake',...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('BLOCKED: release switch unavailable');
 const cfg=await response.json();
 if(!releaseRules(cfg))throw Error('BLOCKED: release switch not enabled for canary or stage');
 return cfg;
}
async function preflight(record,{key,transport=globalThis.fetch}={}){
 if(!key)throw Error('BLOCKED: missing Writer credential');
 const rid=requestId(record);
 const [status,index,rules]=await Promise.all([
  read('writer_status',{key,transport}),
  read('receipt_index',{key,transport,requestId:rid}),
  read('rules',{key,transport})
 ]);
 if(status.data.freeze!=null||String(status.data.level||'').toUpperCase()!=='OK'||!Array.isArray(status.data.errors)||status.data.errors.length)throw Error('BLOCKED: Writer freeze/health');
 if(index.data.source!=='GITHUB'||index.data.exists!==true||!index.data.sha)throw Error('BLOCKED: receipt index authority');
 if(index.data.request) return {rid,mode:'EXISTING_REQUEST_HOLD',state:index.data.request.s||'UNKNOWN',entry:index.data.request};
 if(!rules.data.rules||rules.data.rules.status!=='ACTIVE'||!Array.isArray(rules.data.rules.rules)||!rules.data.rules.rules.length||!rules.data.rules.raw||!rules.data.rules.id)throw Error('BLOCKED: canonical rules unavailable');
 return {rid,mode:'READY_FOR_WRITER_ADJUDICATION',rulesHash:sha(rules.data.rules.raw)};
}
// Classify a Writer intake response strictly by the contract above. Anything else is UNKNOWN and is never retried.
function classifyWriterResponse(result,rid){
 if(!result||result.ok!==true||!Array.isArray(result.results)||result.results.length!==1||result.receipt?.REQUEST_ID!==rid||!Array.isArray(result.receipt?.NEW_PRIMARY_IDS))return {kind:'UNKNOWN'};
 const r=result.results[0],ids=result.receipt.NEW_PRIMARY_IDS;
 if(r.NEVER_CONSIDER_REVIEW_NEEDED)return {kind:'REVIEW_NEEDED'};
 if(result.WRITE_ACCEPTED===true)
  return INSERT.has(r.result)&&result.writeId&&validPid(r.PRIMARY_ID)&&ids.length===1&&ids[0]===r.PRIMARY_ID?{kind:'INSERT_ACCEPTED',primaryId:r.PRIMARY_ID}:{kind:'UNKNOWN'};
 if(r.result==='EXISTING_MATCH'&&result.COMPLETION_STATUS==='COMPLETE'&&!result.writeId&&!ids.length&&validPid(r.PRIMARY_ID))return {kind:'NOOP_COMPLETE',primaryId:r.PRIMARY_ID};
 if(r.result==='NEVER_CONSIDER_EXCLUDED'&&!result.writeId&&!ids.length)return {kind:'EXCLUDED'};
 return {kind:'UNKNOWN'};
}
const runCanary=(records,opts={})=>runIntake(records,{...opts,expectedMode:'CANARY'});
async function runIntake(records,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch,switchTransport=globalThis.fetch,sourceRunId,priorResults={},recorder,expectedMode='CANARY'}={}){
 if(!['CANARY','STAGE','AUTO'].includes(expectedMode))throw Error('BLOCKED: expected release mode must be CANARY, STAGE or AUTO');
 const auto=expectedMode==='AUTO';
 // AUTO only: a Writer answer that opened no master transaction (excluded, review flag without a write, matched an
 // existing row) is accounted as SKIPPED and the batch continues; everything else halts exactly as in STAGE.
 const skipped=(rid,kind,result)=>({requestId:rid,status:'SKIPPED',reason:kind,accounting:{status:'SKIPPED',reason:kind},writerResult:result});
 const noWrite=r=>r&&!r.writeId&&Array.isArray(r.receipt?.NEW_PRIMARY_IDS)&&!r.receipt.NEW_PRIMARY_IDS.length&&r.WRITE_ACCEPTED!==true;
 // Any well-formed answer for this request that wrote nothing, whatever its result (IDENTITY_CONFLICT halted the
 // second AUTO run as UNKNOWN on 2026-10-23). Returns the reason to record, or null.
 const autoSkip=(r,rid,kind,candidate)=>{
  if(!auto||!noWrite(r)||r.ok!==true||r.receipt?.REQUEST_ID!==rid||!Array.isArray(r.results)||r.results.length!==1)return null;
  if(kind==='INSERT_ACCEPTED'||(kind==='NOOP_COMPLETE'&&candidate.expectedOutcome!=='NEW'))return null;
  return kind==='UNKNOWN'?String(r.results[0]?.result||'NO_WRITE'):kind;
 };
 const canary=expectedMode==='CANARY';
 if(!Array.isArray(records)||(canary?records.length!==5:(records.length<1||records.length>200))||!records.every(x=>x&&x.record&&typeof x.record.COMPANY==='string'&&x.record.COMPANY.trim()&&typeof x.record.TITLE==='string'&&x.record.TITLE.trim()&&typeof x.record.LOCATION==='string'&&x.record.LOCATION.trim()&&/^https:\/\/[^\s/]+\//i.test(x.record.SOURCE_URL||'')&&x.evidenceVerified===true&&x.evidenceSource==='INDEPENDENT_VERIFIED'&&/^https:\/\/[^\s/]+\//i.test(x.evidenceUrl||'')&&typeof x.primaryBusiness==='string'&&x.primaryBusiness.trim()&&x.reviewedNeverConsider===false))throw Error(canary?'BLOCKED: exactly 5 reviewed canary candidates required':'BLOCKED: 1 to 200 reviewed intake candidates required');
 if(!/^[A-Z0-9_-]{8,120}$/.test(sourceRunId||''))throw Error('BLOCKED: source run identity');
 const kinds=records.map(x=>x.expectedOutcome);
 if(kinds.some(x=>!KINDS.has(x)))throw Error('BLOCKED: unknown expected canary outcome');
 if(canary&&(kinds.filter(x=>x==='EXISTING_MATCH').length<1||kinds.filter(x=>x==='PROTECTED_NOOP').length<1||kinds.filter(x=>x==='NEW').length<1))throw Error('BLOCKED: canary must test new, existing and protected states');
 const unique=new Set(records.map(x=>requestId(x.record)));
 if(unique.size!==records.length)throw Error('BLOCKED: repeated candidate identity');
 // No live POST without a recorder that has just proven it can persist and read back.
 if(!recorder||['check','record','read'].some(f=>typeof recorder[f]!=='function'))throw Error('BLOCKED: durable Writer-response recorder required before any Writer POST');
 let recorderReady=false;
 try{recorderReady=(await recorder.check())===true}catch{}
 if(!recorderReady)throw Error('BLOCKED: durable Writer-response recorder failed its write/read-back check');
 const outcomes=[];
 const halt=msg=>{const e=Error(msg);e.outcomes=outcomes;throw e};
 for(const [i,candidate] of records.entries()){
  const rules=releaseRules(await fetchRelease(switchTransport)); // fresh kill switch before each write
  if(rules.mode!==expectedMode)halt('BLOCKED: release switch is '+rules.mode+' but this run is '+expectedMode);
  if(records.length>rules.maxBatch)halt('BLOCKED: '+records.length+' candidates exceed the switch maxBatch '+rules.maxBatch);
  // Protected roles must be proven in the authenticated terminal archive before submission.
  if(candidate.expectedOutcome==='PROTECTED_NOOP'){
   const archive=await fetchAuthenticatedArchive({key,transport});
   const match=archive.rows.filter(r=>r.ARCHIVED_TERMINAL&&r.PRIMARY_ID===candidate.protectedPrimaryId&&sameIdentity(r,candidate.record));
   if(match.length!==1)halt('BLOCKED: protected archive identity unproven');
  }
  const record=candidate.record,rid=requestId(record);
  const pre=await preflight(record,{key,transport});
  const prior=Object.hasOwn(priorResults,rid)?priorResults[rid]:undefined;
  if(pre.mode==='EXISTING_REQUEST_HOLD'){
   // Resume only a case whose earlier accepted POST is now proven by fresh authenticated reads.
   if(pre.state!=='COMPLETE'||prior===undefined){outcomes.push({requestId:rid,status:'HOLD',reason:pre.mode,state:pre.state});halt('BLOCKED: existing or uncertain request; reconcile before retry')}
   let accounting;
   try{accounting=await verifyAcceptedCase(candidate,rid,prior,pre.entry,{key,transport})}
   catch(e){
    // Global: the isolated identity-mismatch HOLD is documented as SKIPPED and the batch continues.
    // Other verification failures still halt.
    if(/INSERT_IDENTITY_MISMATCH/.test(e.message||'')){
     outcomes.push(skipped(rid,'IDENTITY_MISMATCH_SKIPPED',prior));
     continue;
    }
    outcomes.push({requestId:rid,status:'HOLD',reason:e.message});halt(e.message)
   }
   outcomes.push({requestId:rid,status:'RESUMED_ACCOUNTED',accounting});
   continue;
  }
  if(pre.mode!=='READY_FOR_WRITER_ADJUDICATION'){outcomes.push({requestId:rid,status:'HOLD',reason:pre.mode});halt('BLOCKED: existing or uncertain request; reconcile before retry')}
  if(prior!==undefined){
   // A captured response with no receipt_index entry can only be a no-op. Re-verify it; never re-POST.
   const pk=classifyWriterResponse(prior,rid).kind;
   const priorSkip=autoSkip(prior,rid,pk,candidate);
   if(priorSkip){outcomes.push(skipped(rid,priorSkip,prior));continue}
   let accounting;
   try{accounting=await verifyNoopCase(candidate,rid,prior,{key,transport})}
   catch(e){outcomes.push({requestId:rid,status:'HOLD',reason:e.message,writerResult:prior});halt(e.message)}
   outcomes.push({requestId:rid,status:'RESUMED_ACCOUNTED',accounting,writerResult:prior});
   continue;
  }
  // Prior review must be bound to the exact canonical rules fetched from Writer now.
  // A caller-provided industry label or boolean alone cannot authorize intake.
  if(!candidate.rulesHash||candidate.rulesHash!==pre.rulesHash||candidate.businessEvidenceApproved!==true)
    halt('BLOCKED: independent employer-business review not bound to fresh canonical rules');
  const body={action:'intake',key,requestId:rid,run:{SCOUT_RUN_ID:sourceRunId+'-C'+(i+1),GROSS_FOUND:1,RUN_STARTED_AT_ET:candidate.discoveredAtEt||'UNKNOWN'},records:[{...record,INITIAL_UNKNOWN_FIELDS:record.INITIAL_UNKNOWN_FIELDS||['PAY','DEGREE','FLEX'],EMPLOYER_PRIMARY_BUSINESS:candidate.primaryBusiness||''}]};
  let response;
  try { response=await transport(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),redirect:'follow',signal:AbortSignal.timeout(60000)}); }
  catch {halt('UNKNOWN: Writer POST outcome unconfirmed; reconcile receipt index before retry')}
  let result;
  try{result=await response.json()}catch{halt('UNKNOWN: Writer response invalid; reconcile before retry')}
  // Persist and read back before classifying: an accepted write must never lose its recovery evidence.
  let recorded=false;
  try{await recorder.record(rid,result);recorded=JSON.stringify(await recorder.read(rid))===JSON.stringify(result)}catch{}
  if(!recorded){outcomes.push({requestId:rid,status:'UNKNOWN',reason:'RESPONSE_NOT_DURABLY_RECORDED',writerResult:result});halt('UNKNOWN: Writer response not durably recorded; save outcomes[].writerResult and reconcile the receipt index before any retry')}
  // writerResult must be persisted by the operator and passed back as priorResults[requestId] to resume.
  const verdict=response.ok?classifyWriterResponse(result,rid):{kind:'UNKNOWN'};
  const skipReason=response.ok?autoSkip(result,rid,verdict.kind,candidate):null;
  if(skipReason){outcomes.push(skipped(rid,skipReason,result));continue}
  if(verdict.kind==='UNKNOWN'){outcomes.push({requestId:rid,status:'UNKNOWN',writerResult:result});halt('UNKNOWN: Writer transaction not conclusively classified; reconcile before retry')}
  if(verdict.kind==='REVIEW_NEEDED'||verdict.kind==='EXCLUDED'){outcomes.push({requestId:rid,status:'HOLD',reason:verdict.kind,writerResult:result});halt('HOLD: Writer '+verdict.kind+' for canary candidate; employer review required before proceeding')}
  if(verdict.kind==='INSERT_ACCEPTED'){
   outcomes.push({requestId:rid,status:'PENDING_VERIFICATION',writeId:result.writeId||null,writerResult:result});
   if(candidate.expectedOutcome!=='NEW')halt('HOLD: Writer inserted a row for a '+candidate.expectedOutcome+' canary case; stop and reconcile');
   // No next job while current transaction is unverified. Reconciliation is a separate execution.
   halt('HOLD: Writer accepted canary record; durable receipt and exact-row readback required before proceeding');
  }
  // NOOP_COMPLETE: no master transaction was opened, so it can be proven now and the canary continues.
  if(candidate.expectedOutcome==='NEW'){outcomes.push({requestId:rid,status:'HOLD',reason:'NEW_MATCHED_EXISTING',writerResult:result});halt('HOLD: NEW canary case matched an existing row; replace candidate')}
  let accounting;
  try{accounting=await verifyNoopCase(candidate,rid,result,{key,transport})}
  catch(e){outcomes.push({requestId:rid,status:'HOLD',reason:e.message,writerResult:result});halt(e.message)}
  outcomes.push({requestId:rid,status:'NOOP_ACCOUNTED',accounting,writerResult:result});
 }
 return outcomes;
}
// Readbacks for one case. Protected roles must stay in the terminal archive and be absent from the current master.
async function caseReadbacks(candidate,rid,ids,{key,transport}){
 if(candidate.expectedOutcome==='PROTECTED_NOOP'){
  if(ids.length!==1||ids[0]!==candidate.protectedPrimaryId||!validPid(ids[0]))throw Error('HOLD: resumed case not verified (PROTECTED_ID_MISMATCH)');
  const master=(await read('row_readback',{key,transport,requestId:rid,primaryIds:ids})).data;
  if(master.master?.endMarkerPresent!==true||master.requested!==1||master.found!==0)throw Error('HOLD: resumed case not verified (PROTECTED_ROLE_IN_MASTER_OR_UNPROVEN)');
  const archive=await fetchAuthenticatedArchive({key,transport});
  return archive.rows.filter(r=>r.ARCHIVED_TERMINAL&&r.PRIMARY_ID===ids[0]).map(r=>({primaryId:r.PRIMARY_ID,found:true,matches:1,line:r.RAW_ROW}));
 }
 if(!ids.length||ids.some(x=>!validPid(x)))throw Error('HOLD: resumed case not verified (RECEIPT_IDS_UNBOUND)');
 const rb=(await read('row_readback',{key,transport,requestId:rid,primaryIds:ids})).data;
 if(!Array.isArray(rb.rows)||rb.master?.endMarkerPresent!==true||rb.requested!==ids.length||rb.found!==ids.length||rb.rows.length!==ids.length||
    rb.rows.some((x,i)=>x.primaryId!==ids[i]||!x.found||x.matches!==1))throw Error('HOLD: resumed case not verified (EXACT_ROW_READBACK_MISSING)');
 return rb.rows;
}
// READ-ONLY proof for a previously accepted insert. Called only after receipt_index reports COMPLETE.
async function verifyAcceptedCase(candidate,rid,prior,indexEntry,{key,transport}={}){
 const hold=reason=>{throw Error('HOLD: resumed case not verified ('+reason+')')};
 if(!prior||!Array.isArray(prior.results)||prior.results.length!==1||!prior.results[0]?.PRIMARY_ID)hold('CAPTURED_WRITER_RESULT_REQUIRED');
 const detail=(await read('request_result',{key,transport,requestId:rid})).data;
 if(!detail.found||detail.source!=='index'||detail.requestId!==rid||detail.status!=='COMPLETE'||detail.durable!==true)hold('RECEIPT_NOT_DURABLE');
 const a=Array.isArray(indexEntry?.items)?indexEntry.items.map(x=>x?.pid):null,b=Array.isArray(detail.entry?.items)?detail.entry.items.map(x=>x?.pid):null;
 if(candidate.expectedOutcome==='PROTECTED_NOOP')hold('PROTECTED_ROLE_OPENED_MASTER_TRANSACTION');
 let ids,receipt=detail,binding='RECEIPT_INDEX';
 if(a||b){
  // An index entry that names rows must agree exactly with request_result.
  if(!a||!b||!a.length||a.length!==b.length||a.length>25||a.some((v,i)=>!validPid(v)||v!==b[i]))hold('INDEX_RESULT_ID_MISMATCH');
  ids=a;
 }else{
  // Since 2026-10-24 receipt_index and request_result carry no row IDs (entry keys at,s,snapshotHash,w). Tim
  // 2026-10-26: bind to the PRIMARY_ID in the Writer's own durably captured acceptance instead. It must name exactly
  // one row, its receipt must carry this request ID and that same single ID, and the exact-row readback below must pass.
  const pid=prior.results[0].PRIMARY_ID,cap=prior.receipt;
  if(prior.WRITE_ACCEPTED!==true||cap?.REQUEST_ID!==rid||!Array.isArray(cap?.NEW_PRIMARY_IDS)||cap.NEW_PRIMARY_IDS.length!==1||
     cap.NEW_PRIMARY_IDS[0]!==pid||!validPid(pid))hold('CAPTURED_ID_UNBOUND');
  ids=[pid];binding='CAPTURED_RESPONSE';
  receipt={...detail,entry:{...(detail.entry||{}),items:[{pid,op:'INSERT',boundFrom:'CAPTURED_RESPONSE'}]}};
 }
 const readbacks=await caseReadbacks(candidate,rid,ids,{key,transport});
 const accounting=checkCanaryOutcome({expectedOutcome:candidate.expectedOutcome,record:candidate.record,result:prior,receipt,readbacks,requestId:rid});
 if(accounting.status==='HOLD')hold(accounting.reason);
 return {...accounting,binding};
}
// READ-ONLY proof for a no-op. receipt_index must still have no entry (no master transaction); request_result is then
// answered from the receipts log and cannot invoke pending verification.
async function verifyNoopCase(candidate,rid,prior,{key,transport}={}){
 const hold=reason=>{throw Error('HOLD: no-op case not verified ('+reason+')')};
 const verdict=classifyWriterResponse(prior,rid);
 if(verdict.kind!=='NOOP_COMPLETE')hold('CAPTURED_RESPONSE_NOT_NOOP');
 const index=(await read('receipt_index',{key,transport,requestId:rid})).data;
 if(index.source!=='GITHUB'||index.exists!==true||!index.sha)hold('RECEIPT_INDEX_UNTRUSTED');
 if(index.request!=null)hold('NOOP_OPENED_MASTER_TRANSACTION');
 const detail=(await read('request_result',{key,transport,requestId:rid})).data;
 if(detail.found!==true||detail.source!=='receipts'||detail.requestId!==rid)hold('NOOP_RECEIPT_NOT_LOGGED');
 const readbacks=await caseReadbacks(candidate,rid,[verdict.primaryId],{key,transport});
 const receipt={requestId:rid,status:'COMPLETE',durable:true,source:'receipts',entry:{items:[]}};
 const accounting=checkCanaryOutcome({expectedOutcome:candidate.expectedOutcome,record:candidate.record,result:prior,receipt,readbacks,requestId:rid});
 if(accounting.status==='HOLD')hold(accounting.reason);
 return accounting;
}
// READ-ONLY reconciliation. NEVER call request_result while receipt-index is pending:
// the Writer's request_result verification path may itself mutate the index.
async function inspectReceipt(record,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch}={}){
 const rid=requestId(record);
 const index=(await read('receipt_index',{key,transport,requestId:rid})).data;
 if(index.source!=='GITHUB'||index.exists!==true||!index.sha)return {requestId:rid,status:'HOLD',reason:'RECEIPT_INDEX_UNTRUSTED'};
 const entry=index.request;
 if(!entry||entry.s!=='COMPLETE')return {requestId:rid,status:'HOLD',reason:entry?.s||'INDEX_NOT_COMPLETE'};
 const response=(await read('request_result',{key,transport,requestId:rid})).data;
 if(response.status!=='COMPLETE'||response.requestId!==rid)return {requestId:rid,status:'HOLD',reason:'RESULT_NOT_COMPLETE'};
 // Index and result must name the same rows in the same order; a union would hide a disagreement.
 const a=(entry.items||[]).map(x=>x?.pid),b=(response.entry?.items||[]).map(x=>x?.pid);
 if(!a.length||a.length!==b.length||a.some((x,i)=>!validPid(x)||x!==b[i]))return {requestId:rid,status:'HOLD',reason:'RECEIPT_IDS_UNBOUND'};
 const back=(await read('row_readback',{key,transport,requestId:rid,primaryIds:a})).data;
 return {requestId:rid,status:'PENDING_INDEPENDENT_VERIFICATION',index,response,primaryIds:a,readback:back,verified:false};
}
module.exports={requestId,releaseRules,fetchRelease,preflight,classifyWriterResponse,runCanary,runIntake,verifyAcceptedCase,verifyNoopCase,inspectReceipt};
