'use strict';
// Evidence artifacts, never queued Writer payloads. A consumer creates fresh
// request IDs only after current policy, canonical inputs and guards agree.
const fs=require('node:fs'),path=require('node:path'),Store=require('../programmed-coordinator/store.cjs');
const allowed=new Set('SALARY_BASE_LOW SALARY_BASE_HIGH SALARY_MIDPOINT SALARY_SCORE_POINT SALARY_BASIS SALARY_SOURCE SALARY_ASOF SALARY_CONF SALARY_NOTE SALARY_MODEL_VERSION SALARY_CONTEXT_KEY DEGREE_TEXT DEGREE_REQ DEGREE_EVIDENCE_URL DEGREE_ASOF FEASIBILITY_ATTEMPT_ASOF'.split(' '));
const schema='forge.pay-prepared.v1',prefix='enrich-ats-pay-prepared-';
const fingerprint=Store.hash;
function protectedRow(r){return !r||!['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'].includes(r.BUCKET)||/^YES/i.test(r.p.ANTI_RESURRECTION||'')||!!r.p.DO_NOT_REWORK||!!r.p.TIM_DECISION||/^CLOSED/.test(r.p.LIVENESS||'')||/^CLOSED/.test(r.p.ATS_CHECK_RESULT||'');}
function save(dir,{row,fields,policy,inputs,evidence}){
 if(Object.keys(fields).some(k=>!allowed.has(k))||protectedRow(row)||!fields.SALARY_BASE_LOW||!fields.SALARY_SOURCE)throw Error('Unsafe prepared salary');
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
  const age=now-Date.parse(e.fields.SALARY_ASOF);if(!Number.isFinite(age)||age<0||age>7*864e5)continue;
  seen.add(r.PRIMARY_ID);out.push(e);
 }
 return out;
}
function sourceInputs(base,evidence){return fingerprint({base,ledger:evidence.ledger||null,discovery:evidence.discovery||null});}
function attemptKey(row,policy,inputs){return 'enrich-ats-pay-attempt-'+fingerprint({rowSha256:fingerprint(row),policy,inputs})+'.json';}
function attempted(dir,row,policy,inputs){const file=attemptKey(row,policy,inputs);try{return Store.read(dir,file).status==='SOURCE_EVIDENCE_REQUIRED';}catch{return false;}}
function rememberAttempt(dir,row,policy,inputs){Store.immutable(dir,attemptKey(row,policy,inputs),{schema:'forge.pay-preparation-attempt.v1',primaryId:row.PRIMARY_ID,rowSha256:fingerprint(row),policy,inputs,status:'SOURCE_EVIDENCE_REQUIRED',retryCondition:'CANONICAL_ROW_POLICY_OR_SAVED_SOURCE_INPUT_CHANGED'});}
module.exports={save,load,fingerprint,protectedRow,sourceInputs,attempted,rememberAttempt};
