'use strict';
// Public, sourced context only. Size changes evidence weights, never salary amounts.
const VERSION='size-scope-v1',DAY=86400000;
const norm=s=>String(s||'').toLowerCase().replace(/\b(incorporated|corporation|corp|inc|llc|ltd)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function fact(f,now=Date.now()){
 if(!f||f.status!=='CONFIRMED'||!f.sourceUrl||!f.quote||!Number.isFinite(Date.parse(f.asOf)))return null;
 try{const u=new URL(f.sourceUrl);if(u.protocol!=='https:'||u.username||u.password)return null;}catch{return null;}
 const age=now-Date.parse(f.asOf);return age>=-DAY&&age<=548*DAY?f.value:null;
}
function lookup(row,ref={},now=Date.now()){
 const matches=(ref.companies||[]).filter(c=>[c.company,...c.aliases||[]].some(n=>norm(n)===norm(row.COMPANY)));
 const company=matches.length===1?matches[0]:null;
 const sites=(company?.sites||[]).filter(s=>[s.location,...s.aliases||[]].some(n=>norm(n)===norm(row.LOCATION)));
 const roles=(ref.roles||[]).filter(r=>r.primaryId===row.PRIMARY_ID&&norm(r.company)===norm(row.COMPANY)&&norm(r.title)===norm(row.TITLE)&&norm(r.location)===norm(row.LOCATION));const role=roles.length===1?roles[0]:null;
 const out={};
 for(const [key,record] of [['employees',company?.facts?.employees],['revenueUsd',company?.facts?.revenueUsd],['industry',company?.facts?.industry],['siteEmployees',sites.length===1?sites[0].facts?.employees:null],...['teamSize','management','reach'].map(k=>[k,role?.facts?.[k]])]){const v=fact(record,now);if(v!==null)out[key]=v;}
 return out;
}
function postingKey(a){
 try{const u=new URL(a.page||a.sourceUrl);const li=u.hostname.match(/(^|\.)linkedin\.com$/)&&u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);if(li)return'linkedin:'+li[1];
  if(/indeed\.com$/.test(u.hostname)&&u.searchParams.get('jk'))return'indeed:'+u.searchParams.get('jk');
  if(/\/jobs?\//.test(u.pathname))return u.hostname.toLowerCase()+u.pathname.replace(/\/$/,'');
 }catch{}
 return norm(a.co)+'|'+norm(a.title)+'|'+norm(a.location||a.state)+'|'+a.low+'|'+a.high;
}
function identityKey(a){return norm(a.co)+'|'+norm(a.title).replace(/\bsr\b/g,'senior')+'|'+norm(a.location||a.state)+'|'+a.low+'|'+a.high;}
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
function similarity(target,other){
 let weight=1,known=0;const missing=[];
 for(const key of ['employees','revenueUsd','siteEmployees','teamSize']){
  if(number(target[key])&&number(other[key])){known++;weight*=1/(1+Math.abs(Math.log2(target[key]/other[key]))/2);}else missing.push(key);
 }
 for(const key of ['industry','management','reach']){
  if(target[key]&&other[key]){known++;if(target[key]!==other[key]){if(key==='management'||key==='reach')return{weight:0,known,missing,conflict:key};weight*=0.5;}}else missing.push(key);
 }
 return{weight,known,missing};
}
function rank(row,anchors,ref,now=Date.now()){
 const target=lookup(row,ref,now),seen=new Set(),out=[];
 for(const a of anchors.slice().sort((a,b)=>(Date.parse(b.asOf||b.seen)||0)-(Date.parse(a.asOf||a.seen)||0))){
  const key=postingKey(a),identity=identityKey(a);if(seen.has(key)||seen.has(identity))continue;
  const other=lookup({PRIMARY_ID:a.id,COMPANY:a.co||row.COMPANY,TITLE:a.title,LOCATION:a.location||''},ref,now),s=similarity(target,other);
  if(!s.weight)continue;
  const age=now-Date.parse(a.asOf||a.seen||'');if(Number.isFinite(age)&&(age>730*DAY||age< -DAY))continue;
  seen.add(key);seen.add(identity);
  const fresh=Number.isFinite(age)?Math.pow(0.5,Math.max(age,0)/(365*DAY)):0.5;
  const geography=a.state&&a.state===row.state?1.3:1;
  out.push({...a,weight:s.weight*fresh*geography*(norm(a.co)===norm(row.COMPANY)?1.5:1),contextKnown:s.known,contextMissing:s.missing,ageKnown:Number.isFinite(age),postingKey:key});
 }
 return out.sort((a,b)=>b.weight-a.weight||String(a.id||a.page).localeCompare(String(b.id||b.page)));
}
function weightedMedian(items,key){const a=items.slice().sort((a,b)=>a[key]-b[key]);const half=a.reduce((s,x)=>s+x.weight,0)/2;let sum=0;for(let i=0;i<a.length;i++){sum+=a[i].weight;if(Math.abs(sum-half)<1e-10&&a[i+1])return(a[i][key]+a[i+1][key])/2;if(sum>=half)return a[i][key];}return null;}
function confidence(est,used){return used.length<2||used.some(a=>!a.ageKnown)||used.filter(a=>a.contextKnown>=3).length<2?'LOW':est.conf;}
function annotation(used){return 'context model '+VERSION+'; '+used.length+' distinct postings; company/site size and responsibility weighted, no pay multiplier; '+used.filter(a=>a.contextKnown>=3).length+' with 3+ comparable context facts';}
function learn(ref,row,text,sourceUrl,asOf){
 // Only explicit responsibility wording; never infer headcount from a title or production volume.
 if(!text||!sourceUrl)return false;
 const facts={},conflicts=new Set(),put=(key,value,quote)=>{if(conflicts.has(key))return;if(facts[key]&&facts[key].value!==value){delete facts[key];conflicts.add(key);return;}facts[key]={value,quote:quote.slice(0,240),sourceUrl,asOf,status:'CONFIRMED'};};
 let m=text.match(/\b(?:manage|lead|supervise)\s+(?:a\s+)?team of\s+(\d[\d,]*)\s+(?:people|employees|engineers|direct reports)\b/i);
 if(m)put('teamSize',Number(m[1].replace(/,/g,'')),m[0]);
 m=text.match(/\b(?:manage|lead|supervise)\s+(?:a\s+)?team of\s+(?:\d+\s+)?managers\b/i);if(m)put('management','MANAGES_MANAGERS',m[0]);
 m=text.match(/\b(?:this (?:role|position) is an individual contributor|individual contributor role)\b/i);if(m)put('management','INDIVIDUAL_CONTRIBUTOR',m[0]);
 m=text.match(/\b(?:responsible for|oversee|manage)\s+(?:operations\s+)?across multiple (?:sites|plants|facilities)\b/i);if(m)put('reach','MULTI_SITE',m[0]);
 const companyFacts={};
 const escape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const count=String(text).match(new RegExp('\\b'+escape(row.COMPANY)+'\\s+(?:employs|has)\\s+([0-9][0-9,]*)\\s+(?:employees|people)\\s+(?:worldwide|globally)\\b','i'));
 if(count)companyFacts.employees={value:Number(count[1].replace(/,/g,'')),quote:count[0].slice(0,240),sourceUrl,asOf,status:'CONFIRMED'};
 if(Object.values(companyFacts).some(f=>fact(f,Date.parse(asOf))===null))return false;
 if(Object.keys(companyFacts).length){ref.companies=ref.companies||[];let c=ref.companies.find(c=>[c.company,...c.aliases||[]].some(x=>norm(x)===norm(row.COMPANY)));if(!c){c={company:row.COMPANY,facts:{},sites:[]};ref.companies.push(c);}c.facts=c.facts||{};for(const[k,v]of Object.entries(companyFacts))if(!c.facts[k]||Date.parse(c.facts[k].asOf)<Date.parse(v.asOf))c.facts[k]=v;}
 if(!Object.keys(facts).length)return !!Object.keys(companyFacts).length;
 if(Object.values(facts).some(f=>fact(f,Date.parse(asOf))===null))return false;
 ref.roles=ref.roles||[];let r=ref.roles.find(x=>x.primaryId===row.PRIMARY_ID);
 if(r&&[r.company,r.title,r.location].map(norm).join('|')!==[row.COMPANY,row.TITLE,row.LOCATION].map(norm).join('|'))return false;
 if(!r){r={primaryId:row.PRIMARY_ID,company:row.COMPANY,title:row.TITLE,location:row.LOCATION,facts:{}};ref.roles.push(r);}
 for(const [k,v]of Object.entries(facts))if(!r.facts[k]||Date.parse(r.facts[k].asOf)<=Date.parse(v.asOf))r.facts[k]=v;
 return true;
}
function merge(base,incoming){
 if(base.schema!=='forge.company-site-context.v1'||incoming.schema!==base.schema)throw Error('Context schema mismatch');
 const result=JSON.parse(JSON.stringify(base));
 // Merge facts by their source date; a stale checkout cannot erase newer curated facts.
 const mergeFacts=(target,source)=>{for(const[k,f]of Object.entries(source||{}))if(fact(f)!==null&&(!target[k]||Date.parse(target[k].asOf)<Date.parse(f.asOf)))target[k]=f;};
 for(const c of incoming.companies||[]){let old=(result.companies||[]).find(x=>norm(x.company)===norm(c.company));if(!old){old={company:c.company,aliases:c.aliases||[],facts:{},sites:[]};(result.companies=result.companies||[]).push(old);}old.facts=old.facts||{};mergeFacts(old.facts,c.facts);
  for(const site of c.sites||[]){let prior=(old.sites||[]).find(x=>norm(x.location)===norm(site.location));if(!prior){prior={location:site.location,facts:{}};(old.sites=old.sites||[]).push(prior);}mergeFacts(prior.facts,site.facts);}
 }
 for(const r of incoming.roles||[]){let old=(result.roles||[]).find(x=>x.primaryId===r.primaryId);if(!old){(result.roles=result.roles||[]).push(r);continue;}
  if([old.company,old.title,old.location].map(norm).join('|')!==[r.company,r.title,r.location].map(norm).join('|'))continue;
  for(const [k,f]of Object.entries(r.facts||{}))if(!old.facts[k]||Date.parse(old.facts[k].asOf)<Date.parse(f.asOf))old.facts[k]=f;
 }return result;
}
module.exports={VERSION,norm,fact,lookup,similarity,rank,weightedMedian,confidence,annotation,postingKey,identityKey,learn,merge};
