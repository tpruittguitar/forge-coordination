'use strict';
// Engine 13: employer-posted pay (script). Lane-captured posted pay first, then the posting text.
// A third-party estimate is kept apart as LANE_PAY_ESTIMATE and never counts as posted pay.
const {filled}=require('../store.cjs');
const NUM='(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s?[kK]?)';
const RANGE=new RegExp('\\$\\s?'+NUM+'\\s*(?:USD\\s*)?(?:-|–|—|to)\\s*\\$?\\s?'+NUM+'(\\s*(?:/\\s*(?:hr|hour)|per\\s+hour|hourly|an\\s+hour))?','i');
const val=s=>{s=String(s).replace(/,/g,'').trim();const k=/k$/i.test(s);const n=parseFloat(s);return k?n*1000:n;};
function fromText(text){
 for(const m of String(text||'').matchAll(new RegExp(RANGE.source,'gi'))){
  let lo=val(m[1]),hi=val(m[2]);const hourly=!!m[3]||(hi<500&&lo<500);
  if(!(lo>0&&hi>=lo))continue;
  if(hourly){if(lo<15||hi>500)continue;}
  else{if(lo<1000)continue;if(lo<30000||hi>1500000)continue;}
  return {low:lo,high:hi,interval:hourly?'hourly':'yearly',quote:m[0]};
 }
 return null;
}
const select=j=>!filled(j,'PAY_POSTED');
function work(job){
 const lane=job.facts&&job.facts.LANE_PAY,f={};
 if(lane&&lane.value.estimated){f.LANE_PAY_ESTIMATE={value:lane.value.low+'-'+lane.value.high+' '+lane.value.interval,source:lane.source+':THIRD_PARTY_ESTIMATE'};}
 let p=null,source='';
 if(lane&&!lane.value.estimated){p=lane.value;source=lane.source;}
 else{p=fromText(job.description);source='POSTING_TEXT';}
 if(!p)return {status:'PASS',reason:'NOT_POSTED',fields:{...f,PAY_POSTED:{value:'NO',source:'PIPELINE_V2_POSTED_PAY'}}};
 const mult=/hour/i.test(p.interval)?2080:1;
 return {status:'PASS',reason:'POSTED:'+(source==='POSTING_TEXT'?'TEXT':'LANE'),fields:{...f,
  PAY_POSTED:{value:'YES',source},SALARY_BASE_LOW:{value:Math.round(p.low*mult),source},SALARY_BASE_HIGH:{value:Math.round(p.high*mult),source},
  SALARY_INTERVAL_POSTED:{value:p.interval,source},...(p.quote?{SALARY_QUOTE:{value:p.quote,source}}:{})}};
}
module.exports={id:'13',select,work,fromText};
