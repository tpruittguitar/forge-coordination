'use strict';
// Full public postings shared by enrichment research paths. A salary-only anchor,
// failed transport, partial page or unverified identity is never a posting read.
const crypto=require('node:crypto'),L=require('./lib'),P=require('./public-posting'),R=require('./recovery'),Pay=require('./pay-values');
const MAX_AGE_MS=7*86400000;
const identity=r=>JSON.stringify([r.COMPANY,r.TITLE,r.LOCATION]);
function route(raw){try{
 const url=P.publicUrl(raw);if(!url)return null;const u=new URL(url),host=u.hostname;
 // Alias only real provider hosts. Ashby's endpoint returns the whole board,
 // so its distinct requisition ID must remain part of the posting cache key.
 const api=/^(?:(?:boards|job-boards|boards-api)\.greenhouse\.io|(?:jobs|api)\.lever\.co|jobs\.ashbyhq\.com|[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com)$/i.test(host)?L.atsApi(url):null;
 const agg=/(^|\.)(?:linkedin|indeed|ziprecruiter)\.com$/i.test(host)?L.aggregatorPage(url):null;
 const result=new URL(api?(api.kind==='ashby'?'https://jobs.ashbyhq.com/'+new URL(api.page).pathname.split('/').filter(Boolean)[0]+'/'+api.id:api.api):agg?.fetch||url);result.hash='';return result.href;
}catch{return null;}}
function complete(row,url,parsed,at){return !!([row.COMPANY,row.TITLE,row.LOCATION].every(v=>typeof v==='string'&&v.trim())&&route(url)&&Number.isFinite(Date.parse(at))&&parsed?.identityVerified===true&&parsed.sourceIdentity&&identity(row)===JSON.stringify([parsed.sourceIdentity.company,parsed.sourceIdentity.title,parsed.sourceIdentity.location])&&typeof parsed.text==='string'&&parsed.text.length>=300&&parsed.text.length<=500000&&parsed.fullPosting!==false&&!/captcha|sign in to view|verify you are human/i.test(parsed.text));}
function create({cache,now=()=>Date.now()}){
 const entries=cache.postingEvidence||(cache.postingEvidence={}),stats={saved:0,hits:0,no_pay_hits:0};
 // Backoff checks must not scan thousands of unrelated posting bodies per row.
 // Keep keys (not copies) so pruning/replacement remains authoritative.
 const byIdentity=new Map();
 function index(key,e){if(!byIdentity.has(e.identity))byIdentity.set(e.identity,new Set());byIdentity.get(e.identity).add(key);}
 for(const [key,e] of Object.entries(entries))index(key,e);
 function save(row,url,parsed,{at=new Date(now()).toISOString()}={}){
  if(!complete(row,url,parsed,at)||Date.parse(at)>now())return null;
  const key=crypto.createHash('sha256').update(JSON.stringify([identity(row),route(url),at])).digest('hex');
  const e=R.saveEvidence({},{...row,PRIMARY_ID:key},url,parsed,Date.parse(at));
  // Raw evidence and its original observation time survive reuse. Reuse never
  // renews freshness or converts unsupported compensation into "no pay".
  e.payAmbiguous=parsed.payAmbiguous===true||!e.pay&&!!(parsed.structuredBaseSalary||/\$\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP)\s*\d/i.test(e.text));
  e.payStatus=e.pay?'PAY_FOUND':e.payAmbiguous?'PAY_UNRESOLVED':'NO_PAY_STATED';
  e.postingFacts=parsed.postingFacts||null;e.identifier=parsed.identifier||parsed.postingFacts?.reqId||null;e.structuredBaseSalary=parsed.structuredBaseSalary||null;e.quote=parsed.quote||null;e.evidenceKind=parsed.evidenceKind||null;
  entries[key]=e;index(key,e);stats.saved++;return e;
 }
 function find(row,urls=R.urls({...row,p:row.p||{}})){
  const routes=new Set(urls.map(route).filter(Boolean)),hits=[],eligible=[],current=new Map();
  for(const key of byIdentity.get(identity(row))||[]){
   const e=entries[key];if(!e)continue;
   const age=now()-Date.parse(e.at);if(!Number.isFinite(age)||age<0||age>=MAX_AGE_MS||e.postingFacts?.validThrough&&(!Number.isFinite(Date.parse(e.postingFacts.validThrough))||Date.parse(e.postingFacts.validThrough)<now())||!routes.has(route(e.url))||!complete(row,e.url,e,e.at))continue;
   eligible.push(e);if(e.factsVersion===Pay.VERSION)current.set(route(e.url),Math.max(current.get(route(e.url))||0,Date.parse(e.at)));
  }
  for(const e of eligible){
   // A successfully refreshed version supersedes migration-only uncertainty
   // for that source, including a confirmed full no-pay read.
   if(e.factsVersion!==Pay.VERSION&&(current.get(route(e.url))||0)>=Date.parse(e.at))continue;
   let checked=R.cached({postingEvidence:{[row.PRIMARY_ID]:e}},row,now());
   // Text-only migration must not revive pay that structured facts rejected.
   // Keep full text/degree reusable, but refresh salary under the new parser.
   if(checked&&e.factsVersion!==Pay.VERSION)checked={...checked,pay:null,payFacts:null,payAmbiguous:true,payNeedsRefresh:true};
   if(checked)hits.push(checked);
  }
  if(!hits.length)return null;
  const found=hits.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).reduce((out,e)=>R.combine(out,e),null);
  found.payNeedsRefresh=!found.pay&&hits.some(e=>e.payNeedsRefresh===true);
  found.payStatus=found.pay?'PAY_FOUND':found.payAmbiguous?'PAY_UNRESOLVED':'NO_PAY_STATED';
  stats.hits++;if(found.payStatus==='NO_PAY_STATED')stats.no_pay_hits++;return found;
 }
 function prune(){for(const[k,e]of Object.entries(entries)){const age=now()-Date.parse(e.at);if(!Number.isFinite(age)||age<0||age>=MAX_AGE_MS)delete entries[k];}}
 function forSource(company,title,url){
  const hits=Object.values(entries).filter(e=>route(e.url)===route(url)&&e.sourceIdentity?.company===company&&e.sourceIdentity?.title===title),locations=[...new Set(hits.map(e=>e.sourceIdentity.location))];
  return locations.length===1?find({COMPANY:company,TITLE:title,LOCATION:locations[0]},[url]):null;
 }
 return{save,find,forSource,prune,stats};
}
module.exports={create,complete,route,MAX_AGE_MS};
