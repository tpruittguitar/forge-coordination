'use strict';
/* Production Writer executor; never enabled by default, never automatically retries writes. */
const crypto=require('node:crypto');
const {read}=require('./writer-reader');
const {stableId}=require('./transaction-preflight');
const {auditLiveWriter}=require('./writer-reader');
const ENDPOINT='https://script.google.com/macros/s/AKfycbwShspSkto70NeFWjgTuyIf-W3EDgUmKmoWevE-jZq95pm6SAulrJYHX1HmiPg8tx3i/exec';
const SWITCH='https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/SOURCE_INTAKE_RELEASE.json';
function requestId(record){return 'FORGE-SOURCE-'+stableId(record)}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function fetchRelease(fetcher=globalThis.fetch){
 const response=await fetcher(SWITCH,{headers:{'Cache-Control':'no-store'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('BLOCKED: release switch unavailable');
 const cfg=await response.json();
 if(cfg.enabled!==true||cfg.mode!=='CANARY'||cfg.maxBatch!==5||cfg.revision!=='SOURCE_INTAKE_CANARY_V1')throw Error('BLOCKED: release switch not enabled for canary');
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
 if(index.data.request) return {rid,mode:'EXISTING_REQUEST_HOLD',state:index.data.request.s||'UNKNOWN'};
 if(!rules.data.rules||rules.data.rules.status!=='ACTIVE'||!Array.isArray(rules.data.rules.rules)||!rules.data.rules.rules.length||!rules.data.rules.raw||!rules.data.rules.id)throw Error('BLOCKED: canonical rules unavailable');
 return {rid,mode:'READY_FOR_WRITER_ADJUDICATION',rulesHash:sha(rules.data.rules.raw)};
}
async function runCanary(records,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch,switchTransport=globalThis.fetch,sourceRunId}={}){
 if(!Array.isArray(records)||records.length!==5||!records.every(x=>x&&x.record&&x.evidenceVerified===true&&x.evidenceSource==='INDEPENDENT_VERIFIED'&&/^https:\/\//.test(x.evidenceUrl||'')&&x.primaryBusiness&&x.reviewedNeverConsider===false))throw Error('BLOCKED: exactly 5 reviewed canary candidates required');
 if(!/^[A-Z0-9_-]{8,120}$/.test(sourceRunId||''))throw Error('BLOCKED: source run identity');
 const kinds=records.map(x=>x.expectedOutcome);
 if(kinds.filter(x=>x==='EXISTING_MATCH').length<1||kinds.filter(x=>x==='PROTECTED_NOOP').length<1||kinds.filter(x=>x==='NEW').length<1)throw Error('BLOCKED: canary must test new, existing and protected states');
 const unique=new Set(records.map(x=>requestId(x.record)));
 if(unique.size!==5)throw Error('BLOCKED: repeated candidate identity');
 const outcomes=[];
 for(const candidate of records){
  await fetchRelease(switchTransport); // fresh kill switch before each write
  if(candidate.expectedOutcome==='PROTECTED_NOOP')throw Error('BLOCKED: archived protected canary requires proven Writer no-op semantics before enabling executor');
  const record=candidate.record,rid=requestId(record);
  const pre=await preflight(record,{key,transport});
  if(pre.mode!=='READY_FOR_WRITER_ADJUDICATION'){outcomes.push({requestId:rid,status:'HOLD',reason:pre.mode});throw Error('BLOCKED: existing or uncertain request; reconcile before retry')}
  const body={action:'intake',key,requestId:rid,run:{SCOUT_RUN_ID:sourceRunId,GROSS_FOUND:1,RUN_STARTED_AT_ET:candidate.discoveredAtEt||'UNKNOWN'},records:[{...record,INITIAL_UNKNOWN_FIELDS:record.INITIAL_UNKNOWN_FIELDS||['PAY','DEGREE','FLEX'],EMPLOYER_PRIMARY_BUSINESS:candidate.primaryBusiness||''}]};
  let response;
  try { response=await transport(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),redirect:'follow',signal:AbortSignal.timeout(60000)}); }
  catch {throw Error('UNKNOWN: Writer POST outcome unconfirmed; reconcile receipt index before retry')}
  let result;
  try{result=await response.json()}catch{throw Error('UNKNOWN: Writer response invalid; reconcile before retry')}
  if(!response.ok||result.ok!==true||result.WRITE_ACCEPTED!==true)throw Error('UNKNOWN: Writer transaction not conclusively accepted; reconcile before retry');
  outcomes.push({requestId:rid,status:'PENDING_VERIFICATION',writeId:result.writeId||null});
  // No next job while current transaction is unverified. Reconciliation is a separate execution.
  throw Error('HOLD: Writer accepted canary record; durable receipt and exact-row readback required before proceeding');
 }
 return outcomes;
}
module.exports={requestId,fetchRelease,preflight,runCanary};
