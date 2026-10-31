'use strict';
const crypto=require('node:crypto'),L=require('./lib'),C=require('./context');
const ACTIVE=['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'];
const confidence=s=>({LOW:1,MED:2,HIGH:3}[s]||0);
function eligible(r){const p=r.p||{};return ACTIVE.includes(r.BUCKET)&&p.SALARY_BASIS==='FORGE-ESTIMATE'&&!/^CLOSED/.test(p.LIVENESS||'')&&!/^CLOSED/.test(p.ATS_CHECK_RESULT||'')&&!/^YES/i.test(p.ANTI_RESURRECTION||'')&&!p.DO_NOT_REWORK;}
function stamp(r){return JSON.stringify([r.COMPANY,r.TITLE,r.LOCATION,Object.entries(r.p||{}).filter(([k])=>/^SALARY_|URL$|^SOURCE$/.test(k)).map(([k,v])=>[k,String(v)]).sort()]);}
function fingerprint(r){return crypto.createHash('sha256').update(stamp(r)).digest('hex');}
function order(rows,history={},inFlight=new Set(),now=Date.now()){
 return rows.filter(r=>eligible(r)&&!inFlight.has(r.PRIMARY_ID)).filter(r=>{const h=history[r.PRIMARY_ID];return !h||h.fingerprint!==fingerprint(r)||now>=Date.parse(h.retryAt||'');}).sort((a,b)=>{
  // Never-reviewed jobs precede repeated attempts; weak evidence then oldest pay gets first attention.
  const age=r=>Date.parse(history[r.PRIMARY_ID]?.at||'')||0;
  return (age(a)>0)-(age(b)>0)||confidence(a.p.SALARY_CONF)-confidence(b.p.SALARY_CONF)||age(a)-age(b)||(Date.parse(a.p.SALARY_ASOF)||0)-(Date.parse(b.p.SALARY_ASOF)||0)||a.PRIMARY_ID.localeCompare(b.PRIMARY_ID);
 });
}
function remember(history,r,status,{fields,now=Date.now(),hours=24}={}){const projected=fields?{...r,p:{...r.p,...fields}}:r;return history[r.PRIMARY_ID]={fingerprint:fingerprint(projected),at:new Date(now).toISOString(),retryAt:new Date(now+hours*3600000).toISOString(),status};}
function improved(r,est){if(!est)return false;const prior=confidence(r.p.SALARY_CONF),next=confidence(est.conf);return next>prior||(next>=prior&&est.source==='SAME_EMPLOYER'&&!/^same-employer:/.test(r.p.SALARY_SOURCE||''));}
// The ATS URL must already belong to the canonical job. Require returned title and exact city/state,
// plus explicit USD annual structured compensation; broad description regex is insufficient for replacement.
function parseApi(r,api,j){
 const x=api.kind==='workday'?j?.jobPostingInfo:api.kind==='ashby'?j?.jobs?.find(x=>x.id===api.id):j;
 if(!x||C.norm(x.title||x.text)!==C.norm(r.TITLE))return null;
 const loc=x.location?.name||x.categories?.location||x.location||'',state=L.stateFrom(r.LOCATION),city=C.norm(r.LOCATION.split(',')[0]);
 if(typeof loc!=='string'||!state||L.stateFrom(loc)!==state||C.norm(loc.split(',')[0])!==city)return null;
 if(api.kind==='greenhouse'&&String(x.id)!==api.api.match(/\/jobs\/(\d+)/)?.[1])return null;
 const text=L.parseAts(api.kind,j,api.id)?.text||'';if(text.length<300||/captcha|sign in to view|verify you are human/i.test(text))return null;
 let lo,hi,currency,unit;
 if(api.kind==='lever'){const s=x.salaryRange||{};lo=s.min;hi=s.max;currency=s.currency;unit=s.interval;}
 if(api.kind==='greenhouse'){const ranges=(x.pay_input_ranges||[]).filter(s=>s.currency_type==='USD'&&/annual|year/i.test(s.interval||'')&&!/bonus|equity|total compensation/i.test(s.title||''));if(ranges.length!==1)return null;lo=ranges[0].min_cents/100;hi=ranges[0].max_cents/100;currency='USD';unit='year';}
 if(api.kind==='ashby'){const ranges=(x.compensation?.summaryComponents||[]).filter(s=>/salary/i.test(s.compensationType||'')&&!/total|bonus|equity/i.test(s.compensationType||''));if(ranges.length!==1)return null;const s=ranges[0];lo=s.minValue;hi=s.maxValue;currency=s.currencyCode;unit=s.interval;}
 if(currency!=='USD'||!/^(year|yearly|annual)$/i.test(unit||'')||!(+lo>=40000&&+hi>=+lo&&+hi<=2000000))return null;
 return {identityVerified:true,basis:'EMPLOYER_POSTED',pay:{low:+lo,high:+hi}};
}
module.exports={eligible,fingerprint,order,remember,improved,parseApi};
