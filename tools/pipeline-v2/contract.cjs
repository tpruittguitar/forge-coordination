'use strict';
// Discovery handoff contract (pipeline v2, card cs-bb7d087b). Every lane hands over every
// result with the 5 fields: company, title, location, posting link, description text.
// No title or place filter here: the step 10 scope screen decides for all lanes.
const crypto=require('node:crypto');
const LANES=['JOBSPY','HIRINGCAFE','BOARD','EMAIL','WEB'];
const str=v=>v==null?'':String(v).trim();
// Where the job was found (channel) is recorded apart from the tool that processed it.
const CHANNEL={JOBSPY:'JOBSPY_HIRINGCAFE',HIRINGCAFE:'JOBSPY_HIRINGCAFE',BOARD:'EMPLOYER_CAREER_SITE',EMAIL:'EMAIL',WEB:'GENERAL_WEB_JOB_BOARD'};
function laneOf(source){
 const s=str(source).toUpperCase();
 if(s.startsWith('JOBSPY'))return 'JOBSPY';
 if(s.startsWith('HIRINGCAFE'))return 'HIRINGCAFE';
 if(s.startsWith('BOARD'))return 'BOARD';
 if(s.startsWith('EMAIL')||s.startsWith('GMAIL'))return 'EMAIL';
 if(s.startsWith('WEB'))return 'WEB';
 return '';
}
function jobId(url,company,title,location){
 const basis=str(url)||[company,title,location].map(v=>str(v).toLowerCase()).join('|');
 return 'P2-'+crypto.createHash('sha256').update(basis).digest('hex').slice(0,16);
}
// Lane-provided facts that are already known (posted pay, estimate flag) travel along with their source.
function laneFacts(r,lane){
 const f={};
 const lo=Number(r.min_amount),hi=Number(r.max_amount);
 if(Number.isFinite(lo)&&lo>0&&Number.isFinite(hi)&&hi>0){
  const per=str(r.interval).toLowerCase();
  f.LANE_PAY={value:{low:lo,high:hi,interval:per||'yearly',estimated:r.is_estimated===true,text:str(r.salaryText||r.pay)},source:lane+':'+(str(r.salary_source)||'LANE')};
 }
 return f;
}
/** One lane result -> handoff record. Never filters; returns {record, problems}. */
function handoff(r,{lane,foundAt=new Date().toISOString()}={}){
 lane=lane||laneOf(r.source||r.lane);
 if(!LANES.includes(lane))throw Error('UNKNOWN_LANE '+lane);
 const record={
  schema:'forge.pipeline-v2.handoff.v1',
  id:jobId(r.url||r.SOURCE_URL,r.company||r.COMPANY,r.title||r.TITLE,r.location||r.LOCATION),
  lane,channel:CHANNEL[lane],tool:str(r.source)||lane,
  company:str(r.company||r.COMPANY),title:str(r.title||r.TITLE),location:str(r.location||r.LOCATION),
  url:str(r.url||r.SOURCE_URL),description:str(r.description||r.DESCRIPTION),
  foundAt:str(r.foundAt)||foundAt,
  facts:laneFacts(r,lane),
  ...(r.crafted?{crafted:true,craftedCase:str(r.craftedCase)}:{})
 };
 const problems=['company','title','location','url'].filter(k=>!record[k]);
 if(!record.description)problems.push('description');
 return {record,problems};
}
// Adapters read each existing lane's own output shape; they never drop a result.
const adapters={
 // tools/source-trial report: new, identity-held, existing and protected roles are all results.
 sourceTrial(report){return ['new_roles','identity_held_roles','existing_roles'].flatMap(k=>report[k]||[]);},
 boardDiscovery(report){return ['new_roles','identity_held_roles','existing_roles'].flatMap(k=>report[k]||[]);},
 list(items){return Array.isArray(items)?items:[];}
};
module.exports={LANES,CHANNEL,laneOf,jobId,handoff,adapters};
