'use strict';
const crypto=require('node:crypto'),L=require('./lib'),C=require('./context');
const {normalizeCell}=require('../source-intake/writer-cell');
const ACTIVE=['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'];
const confidence=s=>({LOW:1,MED:2,HIGH:3}[s]||0);
function eligible(r){const p=r.p||{};return ACTIVE.includes(r.BUCKET)&&/^(FORGE-ESTIMATE|THIRD_PARTY_ESTIMATE)$/.test(p.SALARY_BASIS||'')&&!/^CLOSED/.test(p.LIVENESS||'')&&!/^CLOSED/.test(p.ATS_CHECK_RESULT||'')&&!/^YES/i.test(p.ANTI_RESURRECTION||'')&&!p.DO_NOT_REWORK;}
function stamp(r){return JSON.stringify([r.COMPANY,r.TITLE,r.LOCATION,Object.entries(r.p||{}).filter(([k])=>/^SALARY_|URL$|^SOURCE$/.test(k)).map(([k,v])=>[k,normalizeCell(v)]).sort()]);}
function fingerprint(r){return crypto.createHash('sha256').update(stamp(r)).digest('hex');}
function order(rows,history={},inFlight=new Set(),now=Date.now(),decisionIds=new Set()){
 return rows.filter(r=>eligible(r)&&!inFlight.has(r.PRIMARY_ID)).filter(r=>{const h=history[r.PRIMARY_ID];return !h||h.fingerprint!==fingerprint(r)||now>=Date.parse(h.retryAt||'');}).sort((a,b)=>{
  // Never-reviewed jobs precede repeated attempts; weak evidence then oldest pay gets first attention.
  const age=r=>Date.parse(history[r.PRIMARY_ID]?.at||'')||0;
  return (b.BUCKET==='TIM_DECISION_REQUIRED'||decisionIds.has(b.PRIMARY_ID))-(a.BUCKET==='TIM_DECISION_REQUIRED'||decisionIds.has(a.PRIMARY_ID))||(age(a)>0)-(age(b)>0)||confidence(a.p.SALARY_CONF)-confidence(b.p.SALARY_CONF)||age(a)-age(b)||(Date.parse(a.p.SALARY_ASOF)||0)-(Date.parse(b.p.SALARY_ASOF)||0)||a.PRIMARY_ID.localeCompare(b.PRIMARY_ID);
 });
}
function remember(history,r,status,{fields,now=Date.now(),hours=24}={}){const projected=fields?{...r,p:{...r.p,...fields}}:r;return history[r.PRIMARY_ID]={fingerprint:fingerprint(projected),at:new Date(now).toISOString(),retryAt:new Date(now+hours*3600000).toISOString(),status};}
function improved(r,est){if(!est||r.p.SALARY_BASIS!=='FORGE-ESTIMATE')return false;const prior=confidence(r.p.SALARY_CONF),next=confidence(est.conf);return next>prior||(next>=prior&&r.p.SALARY_MODEL_VERSION&&r.p.SALARY_MODEL_VERSION!==C.VERSION)||(next>=prior&&est.source==='SAME_EMPLOYER'&&!/^same-employer:/.test(r.p.SALARY_SOURCE||''));}
// The ATS URL must already belong to the canonical job. Require returned title and exact city/state,
// plus explicit USD annual structured compensation; broad description regex is insufficient for replacement.
function parseApi(r,api,j){
 const parsed=require('./recovery').exactApi(r,api,j);return parsed?.pay?{...parsed,basis:'EMPLOYER_POSTED'}:null;
}
module.exports={eligible,fingerprint,order,remember,improved,parseApi};
