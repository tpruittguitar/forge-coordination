'use strict';
const Source=require('../programmed-coordinator/source.cjs'),U=require('../pipeline-observability/upstream-flow'),E=require('../email-recovery/employer-identity.cjs');
const phrase=s=>' '+String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()+' ';
function employerNames(name){const names=[String(name||'')],tenant=/^([^()]+)\s+\(([^()]+) Workday tenant "([^"]+)"\)$/.exec(String(name||''));if(tenant)names.push(tenant[1].trim(),tenant[2].trim());return names;}
function urls(text){return[...new Set((String(text).match(/https:\/\/[^\s<>"')]+/g)||[]).map(u=>u.replace(/&amp;/g,'&').replace(/[.,;]+$/,'')))];}
// A shared careers home/search/login link is not a posting identity. Keep exact
// ATS/board IDs and specific job paths; unfamiliar routes need interpretation.
function postingKey(value){
 const employer=E.key(value);if(employer)return employer;
 let u;try{u=new URL(value);}catch{return null;}
 const key=U.key(value);if(!key)return null;
 if(/^(linkedin|indeed):/.test(key))return key;
 if(/(^|\.)(?:linkedin|indeed)\.com$/.test(u.hostname))return null;
 if(/\/(?:jobs?|positions?|opportunities)\/(?!search(?:[-_/]|$)|login(?:\/|$)|apply(?:\/|$)|categories(?:\/|$)|locations(?:\/|$))[^/]+/i.test(u.pathname)||/\/job-details\/?$/i.test(u.pathname)&&u.searchParams.get('id')||/\/OpportunityDetail\/?$/i.test(u.pathname)&&u.searchParams.get('opportunityId'))return key;
 return null;
}
function match(message,{rows,archiveRows=[],events=[]}){
 if(!message.fullBody)throw Error('FULL_MESSAGE_REQUIRED');
 const all=rows.concat(archiveRows),byId=new Map();for(const r of all){if(!byId.has(r.PRIMARY_ID))byId.set(r.PRIMARY_ID,[]);byId.get(r.PRIMARY_ID).push(r);}
 const rowFor=id=>{const group=byId.get(id);if(!group)throw Error('BOUND_CANONICAL_ID_MISSING');if(group.length!==1)throw Error('CONFLICTING_CANONICAL_IDENTITY');return group[0];};
 const bindings=new Set(events.filter(e=>e.evidenceVerified&&e.threadId===message.threadId).map(e=>e.primaryId));
 if(bindings.size>1)throw Error('CONFLICTING_THREAD_BINDINGS');
 const found=new Map(),links=urls(message.body+' '+(message.links||[]).join(' '));
 for(const row of all){
  const saved=urls(['ATS_POSTING_URL','DIRECT_JOB_URL','SOURCE_URL','INITIATING_URL'].map(k=>row.p?.[k]||'').join(' ')),exact=links.some(u=>saved.some(v=>postingKey(u)&&postingKey(u)===postingKey(v)));
  if(exact)found.set(row.PRIMARY_ID,'EXACT_POSTING_URL');
 }
 if(bindings.size===1){const id=[...bindings][0];if(found.size&&![...found.keys()].every(k=>k===id))throw Error('THREAD_AND_POSTING_CONFLICT');return{row:rowFor(id),method:'VERIFIED_THREAD_BINDING',archived:archiveRows.some(r=>r.PRIMARY_ID===id)};}
 if(!found.size){const text=phrase(message.subject+' '+message.body);for(const row of all){const companies=employerNames(row.COMPANY).map(name=>phrase(name.replace(/(?:,?\s+)(?:incorporated|inc\.?|llc|ltd\.?|corp\.?|corporation|plc)\s*$/i,''))),title=phrase(row.TITLE);if(title.trim().length>=8&&companies.some(co=>co.trim().length>=4&&text.includes(co))&&text.includes(title))found.set(row.PRIMARY_ID,'UNIQUE_COMPANY_TITLE_IN_FULL_SOURCE');}}
 if(found.size!==1)throw Error(found.size?'AMBIGUOUS_CANONICAL_MATCH':'CANONICAL_MATCH_REQUIRED');
 const [id,method]=[...found][0];return{row:rowFor(id),method,archived:archiveRows.some(r=>r.PRIMARY_ID===id)};
}
function mutation(event,row,{archived=false}={}){
 const p=row.p||{},date=event.eventDate.slice(0,10),application=String(p.APP_DATE||'').slice(0,10),rejection=String(p.REJECTION_DATE||'').slice(0,10);
 if(archived||['DECLINED_BY_TIM','CLOSED_DEAD','DUPLICATE'].includes(row.BUCKET)||p.DO_NOT_REWORK||p.TIM_DECISION||/^(DO_NOT_PURSUE|DECLINE)/i.test(p.TIM_RULING||''))return{eventOnly:true,reason:'PROTECTED_OR_ARCHIVED_STATE_PRESERVED'};
 if(event.type==='APPLICATION_CONFIRMED'){
  if(row.BUCKET==='REJECTED_BY_EMPLOYER'){if(rejection&&date>rejection)throw Error('NEW_APPLICATION_CYCLE_REQUIRES_INTERPRETATION');return{eventOnly:true,reason:'LATER_REJECTION_PRESERVED'};}
  if(row.BUCKET==='APPLIED'){
   if(p.APP_CONFIRMATION==='TIM_RULING')return{kind:'APPLIED',expected:{BUCKET:'APPLIED',APP_CONFIRMATION:'EMAIL',APP_EMAIL_DATE:date,...(application?{APP_DATE:application}:{})}};
   return{eventOnly:true,reason:'CURRENT_APPLICATION_ALREADY_RECORDED'};
  }
  return{kind:'APPLIED',expected:{BUCKET:'APPLIED',APP_CONFIRMATION:'EMAIL',APP_DATE:date,ANTI_RESURRECTION:'YES'}};
 }
 if(event.type==='REJECTED_BY_EMPLOYER'){
  if(application&&date<application||rejection&&date<=rejection)return{eventOnly:true,reason:'NEWER_APPLICATION_OR_REJECTION_PRESERVED'};
  return{kind:'REJECTED_BY_EMPLOYER',expected:{BUCKET:'REJECTED_BY_EMPLOYER',REJECTION_DATE:date,ANTI_RESURRECTION:'YES',...(application?{APP_DATE:application}:{})}};
 }
 throw Error('INTERPRETATION_REQUIRED');
}
module.exports={match,mutation,urls,postingKey};
