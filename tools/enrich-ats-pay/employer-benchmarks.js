'use strict';
// Shared evidence inventory independent of job admission. No new master rows.
const crypto=require('node:crypto'),L=require('./lib'),C=require('./context'),S=require('./source-search');
const SCHEMA='forge.employer-pay-benchmarks.v1',DAY=86400000;
function valid(e,now=Date.now()){
 if(!e||!e.company||!e.title||!L.stateFrom(e.location)||e.currency!=='USD'||e.salaryType!=='ANNUAL_BASE'||e.status!=='VERIFIED'||!S.firstParty(e.sourceUrl,e.company))return false;
 const age=now-Date.parse(e.observedAt),pay=e.evidenceKind==='EMPLOYER_STRUCTURED_BASE_SALARY'&&e.structuredBaseSalary?.currency==='USD'&&/^(YEAR|ANNUAL)$/i.test(e.structuredBaseSalary?.value?.unitText||'')?{low:+e.structuredBaseSalary.value.minValue,high:+e.structuredBaseSalary.value.maxValue}:L.payFromText(e.quote);
 return Number.isFinite(age)&&age>=-DAY&&age<=30*DAY&&pay&&pay.low===e.low&&pay.high===e.high&&e.low>=40000&&e.high<=2000000&&/^(EMPLOYER_PAGE|EMPLOYER_POSTING_INDEXED_FULL_TEXT|EMPLOYER_STRUCTURED_BASE_SALARY)$/.test(e.evidenceKind||'');
}
function anchor(e){return {id:e.id,co:e.company,title:e.title,location:e.location,state:L.stateFrom(e.location),region:L.regionOf(e.location),low:e.low,high:e.high,asOf:e.observedAt,sourceUrl:e.sourceUrl,context:e.context||{}};}
function candidates(row,ref,now=Date.now()){
 if(ref?.schema!==SCHEMA)return [];
 const same=e=>C.norm(e.company)===C.norm(row.COMPANY);
 return ref.entries.filter(e=>same(e)&&valid(e,now)&&L.comparable(row,{title:e.title})).map(anchor);
}
function merge(base,incoming){
 if(base?.schema!==SCHEMA||incoming?.schema!==SCHEMA)throw Error('Invalid employer benchmark schema');
 const out=JSON.parse(JSON.stringify(base)),by=new Map(out.entries.map(e=>[e.id,e]));
 for(const e of incoming.entries||[])if(valid(e)&&(!by.has(e.id)||Date.parse(e.observedAt)>Date.parse(by.get(e.id).observedAt)))by.set(e.id,e);
 out.entries=[...by.values()];out.searches={...(base.searches||{})};for(const[k,v]of Object.entries(incoming.searches||{}))if(!out.searches[k]||Date.parse(v.at)>Date.parse(out.searches[k].at))out.searches[k]=v;return out;
}
function learn(ref,a,parsed,at){
 if(!parsed?.identityVerified||parsed.basis!=='EMPLOYER_POSTED'||!parsed.pay||!S.firstParty(a.sourceUrl,a.co))return false;
 const id='PAYBENCH-'+crypto.createHash('sha256').update(C.postingKey(a)).digest('hex').slice(0,20).toUpperCase(),e={id,company:a.co,title:a.title,location:a.location,currency:'USD',salaryType:'ANNUAL_BASE',status:'VERIFIED',low:parsed.pay.low,high:parsed.pay.high,quote:'$'+parsed.pay.low.toLocaleString('en-US')+' - $'+parsed.pay.high.toLocaleString('en-US')+'/annual salary',sourceUrl:a.sourceUrl,observedAt:at,evidenceKind:'EMPLOYER_PAGE'};
 e.evidenceKind='EMPLOYER_STRUCTURED_BASE_SALARY';e.structuredBaseSalary=parsed.structuredBaseSalary;delete e.quote;if(!valid(e,Date.parse(at)))return false;const i=ref.entries.findIndex(x=>x.id===id);if(i<0)ref.entries.push(e);else ref.entries[i]=e;return true;
}
// Only observed, linked job URLs on the configured first-party host, never guessed requisitions.
function links(html,searchUrl,row){
 const base=new URL(searchUrl),out=[];
 for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  try{const u=new URL(m[1].replace(/&amp;/g,'&'),base),title=m[2].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\b(?:learn more|apply now)\b/gi,'').replace(/\s+/g,' ').trim();
   if(u.origin!==base.origin||!S.firstParty(u.href,row.COMPANY)||!L.comparable(row,{title})||!/(?:\/jobs?\/|\/OpportunityDetail|jobId=)/i.test(u.href))continue;
   if(!out.some(x=>x.sourceUrl===u.href))out.push({co:row.COMPANY,title,sourceUrl:u.href});
  }catch{}
 }return out;
}
function create({reference,read,canRead=()=>true,now=()=>Date.now(),maxReads=6}){
 const stats={saved:0,discoveryReads:0,postingReads:0,found:0,blocked:0},cache=reference.searches||(reference.searches={});
 async function find(row){
  const saved=candidates(row,reference,now());if(saved.length){stats.saved+=saved.length;return saved;}
  const routes=(reference.employers||[]).filter(e=>C.norm(e.company)===C.norm(row.COMPANY)).flatMap(e=>e.searchUrls||[]);
  for(const url of routes){const k=C.norm(row.COMPANY)+'|'+L.level(row.TITLE)+'|'+require('./anchor-scope').family(row.TITLE);if(Date.parse(cache[k]?.retryAt)>now()||stats.discoveryReads+stats.postingReads>=maxReads||!canRead()||!S.firstParty(url,row.COMPANY))continue;
   const foundBefore=stats.found;try{stats.discoveryReads++;const html=await read(url),found=links(html,url,row).slice(0,2);for(const a of found){if(stats.discoveryReads+stats.postingReads>=maxReads||!canRead())break;stats.postingReads++;const page=await read(a.sourceUrl),parsed=parseEmployer(page,a);if(parsed&&learn(reference,{...a,location:parsed.location},parsed,new Date(now()).toISOString()))stats.found++;}
    cache[k]={at:new Date(now()).toISOString(),retryAt:new Date(now()+DAY).toISOString(),status:stats.found>foundBefore?'DISCLOSURES_CAPTURED':'NO_VERIFIED_MATCH'};
   }catch{stats.blocked++;cache[k]={at:new Date(now()).toISOString(),retryAt:new Date(now()+DAY).toISOString(),status:'ACCESS_UNAVAILABLE'};}
  }return candidates(row,reference,now());
 }return{find,stats};
}
function parseEmployer(html,a){
 const jobs=[];function visit(x){if(Array.isArray(x))return x.forEach(visit);if(!x||typeof x!=='object')return;if([].concat(x['@type']||[]).includes('JobPosting'))jobs.push(x);if(x['@graph'])visit(x['@graph']);}
 for(const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 const j=jobs.filter(j=>C.norm(j.title)===C.norm(a.title)&&C.norm(j.hiringOrganization?.name)===C.norm(a.co));if(j.length!==1)return null;
 const loc=[].concat(j[0].jobLocation||[]).map(l=>l.address).filter(x=>x?.addressLocality&&x.addressRegion&&/^(US|USA|United States|United States of America)$/i.test(typeof x.addressCountry==='string'?x.addressCountry:x.addressCountry?.name||''));if(loc.length!==1)return null;
 const location=loc[0].addressLocality+', '+loc[0].addressRegion,parsed=S.parsePage(html,{...a,location});return parsed?{...parsed,location}:null;
}
module.exports={SCHEMA,valid,anchor,candidates,merge,learn,links,create,parseEmployer};
