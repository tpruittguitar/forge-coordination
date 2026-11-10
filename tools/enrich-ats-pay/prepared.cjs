'use strict';
// Evidence artifacts, never queued Writer payloads. A consumer creates fresh
// request IDs only after current policy, canonical inputs and guards agree.
const fs=require('node:fs'),path=require('node:path'),Store=require('../programmed-coordinator/store.cjs');
const allowed=new Set('SALARY_BASE_LOW SALARY_BASE_HIGH SALARY_MIDPOINT SALARY_SCORE_POINT SALARY_BASIS SALARY_SOURCE SALARY_ASOF SALARY_CONF SALARY_NOTE SALARY_MODEL_VERSION SALARY_CONTEXT_KEY DEGREE_TEXT DEGREE_REQ DEGREE_EVIDENCE_URL DEGREE_ASOF FEASIBILITY_ATTEMPT_ASOF'.split(' '));
const schema='forge.pay-prepared.v2',prefix='enrich-ats-pay-prepared-';
const fingerprint=Store.hash;
function protectedRow(r){return !r||!['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'].includes(r.BUCKET)||/^YES/i.test(r.p.ANTI_RESURRECTION||'')||!!r.p.DO_NOT_REWORK||!!r.p.TIM_DECISION||/^CLOSED/.test(r.p.LIVENESS||'')||/^CLOSED/.test(r.p.ATS_CHECK_RESULT||'');}
// Reuse the shared exact-identity, expiry and parser checks, never legacy
// success flags or a lane timestamp as evidence of a complete posting.
function posting(row,e,now=Date.now()){
 if(!e||!require('./posting-cache').complete(row,e.url,e,e.at))return null;
 return require('./posting-cache').create({cache:{postingEvidence:{source:e}},now:()=>now}).find(row,[e.url]);
}
function sourceValid(row,fields,evidence,now=Date.now()){
 const e=posting(row,evidence?.postingEvidence,now);
 if(!e)return false;
 return fields.SALARY_BASIS!=='FORGE-ESTIMATE'||(!e.pay&&!e.payAmbiguous&&!e.payNeedsRefresh);
}
function save(dir,{row,fields,policy,inputs,evidence}){
 if(Object.keys(fields).some(k=>!allowed.has(k))||protectedRow(row)||!fields.SALARY_BASE_LOW||!fields.SALARY_SOURCE)throw Error('Unsafe prepared salary');
 if(!sourceValid(row,fields,evidence))throw Error('Complete exact posting evidence required');
 const identity=Object.fromEntries(['PRIMARY_ID','COMPANY','TITLE','LOCATION'].map(k=>[k,row[k]]));
 const record={schema,row:identity,rowSha256:fingerprint(row),fields,policy,inputs,evidence};
 const file=prefix+fingerprint(record)+'.json';Store.immutable(dir,file,record);return file;
}
function load(dir,{rows,policy,inputs,blocked,needsSalary,hints=false,now=Date.now()}){
 const byId=new Map(rows.map(r=>[r.PRIMARY_ID,r])),seen=new Set(),out=[];
 for(const file of fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.startsWith(prefix)&&f.endsWith('.json')).sort():[]){
  let e;try{e=Store.read(dir,file);}catch{continue;}
  const r=byId.get(e.row?.PRIMARY_ID);
  if(!r||!e.fields||Object.keys(e.fields).some(k=>!allowed.has(k))||file!==prefix+fingerprint(e)+'.json'||e.schema!==schema||(!hints&&(e.policy!==policy||e.inputs!==(typeof inputs==='function'?inputs(r):inputs)))||e.rowSha256!==fingerprint(r)||protectedRow(r)||blocked.has(r.PRIMARY_ID)||!needsSalary(r)||seen.has(r.PRIMARY_ID))continue;
  if(!sourceValid(r,e.fields,e.evidence,now))continue;
  const age=now-Date.parse(e.fields.SALARY_ASOF);if(!Number.isFinite(age)||age<0||age>7*864e5)continue;
  seen.add(r.PRIMARY_ID);out.push(e);
 }
 return out;
}
// Narrow live handoff: only complete no-pay observations are portable today.
// Never trust saved numeric or degree fields, even when their hashes are valid.
function liveAllowed(original,current,{blocked=false,fenced=false}={}){return !!current&&!protectedRow(current)&&fingerprint(original)===fingerprint(current)&&!blocked&&!fenced;}
function noPaySource(row,record,now=Date.now()){
 const raw=record.evidence?.postingEvidence,Pay=require('./pay-values'),L=require('./lib'),R=require('./recovery');
 if(!raw||record.evidence.postingEvidenceSha256!==fingerprint(raw)||raw.factsVersion!==Pay.VERSION)return null;
 const e=posting(row,raw,now);
 if(!e||e.pay||e.payFacts||e.payAmbiguous||e.payNeedsRefresh||e.structuredBaseSalary||e.basis!=='EMPLOYER_POSTED')return null;
 if(Pay.employerText(e.text,L.payFromText)||/\$\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP)\s*\d/i.test(e.text))return null;
 // saveEvidence reruns the current degree parser and stamps parser versions;
 // the original source observation time, identity and expiry remain unchanged.
 return {...R.saveEvidence({},row,e.url,{text:e.text,identityVerified:true,sourceIdentity:e.sourceIdentity,basis:'EMPLOYER_POSTED'},Date.parse(e.at)),postingFacts:e.postingFacts||null};
}
function sourceInputs(base,evidence){return fingerprint({base,ledger:evidence.ledger||null,discovery:evidence.discovery||null});}
function attemptKey(row,policy,inputs){return 'enrich-ats-pay-attempt-'+fingerprint({rowSha256:fingerprint(row),policy,inputs})+'.json';}
function attempted(dir,row,policy,inputs){const file=attemptKey(row,policy,inputs);try{return Store.read(dir,file).status==='SOURCE_EVIDENCE_REQUIRED';}catch{return false;}}
function rememberAttempt(dir,row,policy,inputs){Store.immutable(dir,attemptKey(row,policy,inputs),{schema:'forge.pay-preparation-attempt.v1',primaryId:row.PRIMARY_ID,rowSha256:fingerprint(row),policy,inputs,status:'SOURCE_EVIDENCE_REQUIRED',retryCondition:'CANONICAL_ROW_POLICY_OR_SAVED_SOURCE_INPUT_CHANGED'});}
module.exports={liveAllowed,noPaySource,posting,sourceValid,save,load,fingerprint,protectedRow,sourceInputs,attempted,rememberAttempt};
