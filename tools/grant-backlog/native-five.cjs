'use strict';
// Callable only by the trusted host. No JSON/config can supply authority.
// This adapter does not create grants, assignments, return envelopes or Writer requests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const W=require('./worker.cjs'),T=require('../programmed-coordinator/transactions.cjs');
const Eligibility=require('./research-eligibility.cjs');
const {lock}=require('../automation-run-lock.cjs'),{save}=require('./checkpoint.cjs');
const {response}=require('./responses.cjs'),{startup}=require('./windows-credential.cjs');
const deny=c=>{throw Error(c);},CAP=5*W.LIMITS.reservationMicrousd;
function fresh(at,now){const t=Date.parse(at);return Number.isFinite(t)&&t<=now&&now-t<=900000;}
async function bounded(fn,ms){const c=new AbortController();let timer;try{return await Promise.race([fn(c.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{c.abort();reject(Error('PILOT_TIMEOUT'));},ms);})]);}finally{clearTimeout(timer);c.abort();}}
function grantCheck(g,now,dir){
 if(!g||g.release!=='AUTHORIZED'||g.purpose!=='FIVE_JOB_LOCAL_EVIDENCE_ONLY'||g.provider!=='OpenAI'||
    !g.workIdentity||/FORGE_(CHATGPT|CLAUDE|GROK)/.test(g.workIdentity)||!g.receiptId||!g.revision||
    !fresh(g.readAt,now)||!Number.isFinite(Date.parse(g.expiresAt))||Date.parse(g.expiresAt)<=now||
    g.checkpointDir!==dir||!Array.isArray(g.ids)||g.ids.length!==5||new Set(g.ids).size!==5||
    g.ids.some(id=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(id)))deny('AUTHORITATIVE_EXACT_FIVE_RELEASE_REQUIRED');
 if(g.project?.name!=='Default'||!/^proj_[A-Za-z0-9_-]+$/.test(g.project.id||'')||
    g.project.responsesOnly!==true||g.project.grantOnly!==true||g.project.noPaidFallback!==true||
    !fresh(g.credit?.verifiedAt,now)||!Number.isSafeInteger(g.credit?.balanceMicrousd)||
    g.credit.balanceMicrousd<CAP+W.LIMITS.balanceFloorMicrousd||
    !Number.isFinite(Date.parse(g.credit.expiresAt))||Date.parse(g.credit.expiresAt)<=now+86400000||now>=Date.parse(W.LIMITS.stopAt))deny('GRANT_ONLY_BUDGET_REQUIRED');
 return W.hash({receiptId:g.receiptId,revision:g.revision,ids:g.ids,workIdentity:g.workIdentity,project:g.project,dir});
}
function report(s){const jobs=Object.values(s.jobs);return {mode:'live-evidence-only',jobs:jobs.length,modelAttempts:jobs.filter(j=>j.attempted).length,
 preparedJobs:jobs.filter(j=>j.status==='PREPARED').length,preparedFields:jobs.reduce((n,j)=>n+Object.keys(j.evidence?.proposedRawFields||{}).length,0),
 reservedMicrousd:s.reservedMicrousd,confirmedUsageMicrousd:s.confirmedUsageMicrousd,
 unknownOutcomeJobs:jobs.filter(j=>j.status==='OUTCOME_UNKNOWN').length,writerRequests:0,stop:s.stop||null};}
async function run({grantRef,dir,authority},deps={}){
 // authority must be an in-process existing coordinator capability, not a file assertion.
 if(typeof authority?.verifyGrant!=='function'||typeof authority?.readCurrent!=='function')deny('COORDINATOR_PILOT_CAPABILITY_REQUIRED');
 if(!grantRef||!path.isAbsolute(dir||''))deny('GRANT_REFERENCE_AND_ABSOLUTE_OUTPUT_REQUIRED');
 const now=deps.now||Date.now,write=deps.save||save,call=deps.response||response,open=deps.startup||startup;
 const jobMs=deps.jobMs||W.LIMITS.jobMs;
 const readGrant=signal=>authority.verifyGrant(grantRef,signal);
 const g=await bounded(readGrant,jobMs),binding=grantCheck(g,now(),dir);
 const lockFile=path.join(dir,'native-five.lock'),token=crypto.randomUUID();
 if(!lock(lockFile,'acquire',token).acquired)deny('SINGLE_INSTANCE_LOCK');
 let credential;
 try{
  const file=path.join(dir,'native-five-checkpoint.json');
  const s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schema:'forge.native-five-local.v1',binding,ids:g.ids,jobs:{},reservedMicrousd:0,confirmedUsageMicrousd:0};
  if(s.schema!=='forge.native-five-local.v1'||s.binding!==binding||W.hash(s.ids)!==W.hash(g.ids)||!s.jobs||Array.isArray(s.jobs)||
    Object.keys(s.jobs).some(id=>!g.ids.includes(id))||!Number.isSafeInteger(s.reservedMicrousd)||s.reservedMicrousd<0||s.reservedMicrousd>CAP||
    !Number.isSafeInteger(s.confirmedUsageMicrousd)||s.confirmedUsageMicrousd<0||s.confirmedUsageMicrousd>s.reservedMicrousd)deny('CHECKPOINT_INVALID');
  for(const j of Object.values(s.jobs))if(j.status==='IN_FLIGHT'){j.status='OUTCOME_UNKNOWN';s.stop='OUTCOME_UNKNOWN';}
  write(file,s);if(s.stop)return report(s);
  const deadline=Date.now()+W.LIMITS.batchMs;
  for(const id of g.ids){
   if(s.jobs[id])continue;
   if(Date.now()>=deadline){s.stop='BATCH_TIMEOUT';write(file,s);break;}
   const record=s.jobs[id]={status:'CHECKING'};write(file,s);
   try{await bounded(async signal=>{
    const currentGrant=await readGrant(signal);signal.throwIfAborted();
    if(grantCheck(currentGrant,now(),dir)!==binding)deny('AUTHORITY_CHANGED');
    // The existing authority resolves claims, pending returns/requests and exact source identity.
    const c=await authority.readCurrent(grantRef,id,signal);signal.throwIfAborted();
    if(c?.receiptId!==g.receiptId||c.revision!==g.revision||c.exclusive!==true||c.returned!==false||c.originalRequestsReconciled!==true||
       !fresh(c.snapshot?.source?.readAt,now())||!['CANONICAL_WRITER_MASTER','CANONICAL_DRIVE_MASTER'].includes(c.snapshot.source.kind)||c.priorEvidenceReviewed!==true||c.row?.PRIMARY_ID!==id||!c.snapshot.rows?.some(r=>r.PRIMARY_ID===id&&W.hash(r)===W.hash(c.row)))deny('CURRENT_EXCLUSIVE_ROW_REQUIRED');
    require('../helper-routing/enrichment-plan.cjs').fullSnapshot(c.snapshot);
    Eligibility.validate(c.admission,c.row,c.snapshot);
    if(T.protectedRow(c.row))deny('PROTECTED_ROW');
    if(!Array.isArray(c.missingGroups)||!c.missingGroups.length||c.missingGroups.some(k=>!c.snapshot.needsById[id]?.includes(k)))deny('CURRENT_MISSING_FIELDS_REQUIRED');
    const e=W.publicEvidence(c.evidence,c.row),body=W.request(e,c.missingGroups);
    if(c.admission.sourceSha256!==e.sha256||c.admission.sourceUrl!==e.url)deny('ADMITTED_SOURCE_CHANGED');
    signal.throwIfAborted();
    if(c.reusableResult){const p=W.proposal(c.reusableResult,e,c.missingGroups,c.row);record.status=Object.keys(p.fields).length?'PREPARED':'NO_SUPPORTED_FACTS';record.reused=true;record.evidence=p.evidence;record.degree=p.degree;return;}
    if(s.reservedMicrousd+W.LIMITS.reservationMicrousd>CAP)deny('BUDGET_STOP');
    // Durable reservation precedes credential read and HTTP. Never retry ambiguous outcomes.
    record.status='RESERVED';record.requestHash=W.hash(body);
    s.reservedMicrousd+=W.LIMITS.reservationMicrousd;write(file,s);
    credential ||= open({expectedSid:g.expectedSid});
    // Reverify after all potentially slow row/evidence/native reads, immediately
    // before dispatch. Re-read credit rather than reusing the batch-start value.
    const dispatchGrant=await readGrant(signal);signal.throwIfAborted();
    if(grantCheck(dispatchGrant,now(),dir)!==binding)deny('AUTHORITY_CHANGED');
    record.status='IN_FLIGHT';record.attempted=true;write(file,s);
    grantCheck(dispatchGrant,now(),dir);
    const until=Math.min(Date.parse(dispatchGrant.expiresAt),Date.parse(dispatchGrant.readAt)+900000,
      Date.parse(dispatchGrant.credit.verifiedAt)+900000,Date.parse(dispatchGrant.credit.expiresAt)-86400000,Date.parse(W.LIMITS.stopAt));
    const remaining=Math.floor(until-now());if(remaining<=0)deny('GRANT_VALIDITY_EXPIRED');
    const callSignal=AbortSignal.any([signal,AbortSignal.timeout(remaining)]);
    const result=await call(body,{secureRuntime:credential.secureRuntime,projectId:dispatchGrant.project.id,signal:callSignal,transport:globalThis.fetch});
    callSignal.throwIfAborted();
    signal.throwIfAborted();
    const usage=result.usage;
    if(!Number.isSafeInteger(usage?.input_tokens)||usage.input_tokens<0||usage.input_tokens>W.LIMITS.inputTokens||
       !Number.isSafeInteger(usage.output_tokens)||usage.output_tokens<0||usage.output_tokens>W.LIMITS.outputTokens)deny('API_USAGE_INVALID');
    record.usage=usage;record.responseId=result.responseId;
    s.confirmedUsageMicrousd+=Math.ceil(usage.input_tokens*W.LIMITS.inputUsdPerMillion+usage.output_tokens*W.LIMITS.outputUsdPerMillion);
    record.status='RESPONSE_RECEIVED';
    const p=W.proposal(result.result,e,c.missingGroups,c.row);
    record.status=Object.keys(p.fields).length?'PREPARED':'NO_SUPPORTED_FACTS';record.evidence=p.evidence;record.degree=p.degree;
   },Math.min(jobMs,Math.max(1,deadline-Date.now())));
   }catch(err){
    if(err.message==='CHECKPOINT_DURABILITY_FAILURE')throw err;
    const code=/^[A-Z][A-Z0-9_]{2,80}$/.test(err.message)?err.message:'PILOT_HOLD';
    record.status=record.status==='IN_FLIGHT'?'OUTCOME_UNKNOWN':'HELD';record.reason=code;
    if(record.status==='OUTCOME_UNKNOWN'||/AUTHORITY|RELEASE|GRANT_ONLY|BUDGET|API_AUTH|CREDENTIAL|WINDOWS|SID/.test(code))s.stop=code;
   }
   write(file,s);if(s.stop)break;
  }
  return report(s);
 }finally{credential?.close();lock(lockFile,'release',token);}
}
async function main(args,host){
 if(args.length!==4||args[0]!=='--grant'||args[2]!=='--output')deny('USAGE_GRANT_OUTPUT');
 return run({grantRef:args[1],dir:path.resolve(args[3]),authority:host?.authority});
}
if(require.main===module)main(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('COORDINATOR_PILOT_CAPABILITY_REQUIRED: launch through the authorized host binding');process.exitCode=1;});
module.exports={run,main,grantCheck,CAP};
