'use strict';
const Profile=require('./source-profile'),L=require('./lib'),C=require('./context');
const DAY=86400000;
function create({profile,context={},cache={},readSource,now=()=>Date.now(),maxReads=6,maxPerTarget=2,canRead=()=>true,canReadSource=()=>true,sourceUrl=a=>a.sourceUrl,postingCache}){
 const stats={enabled:true,targets:0,candidates:0,saved_reused:0,cache_hits:0,reads:0,found:0,failed:0,no_pay_read:0,pay_unresolved:0,backoff:0,unsupported_routes:0,estimates_with_profile_sources:0,samples:[]},usedIds=new Set();
 async function find(target,canonicalAnchors){
  stats.targets++;const found=[],seen=new Set();let reads=0;
  for(const source of Profile.sourcesFor(target,profile,context,now()))for(const a of source.candidates){
   if(a.id===target.PRIMARY_ID||seen.has(C.postingKey(a)))continue;seen.add(C.postingKey(a));stats.candidates++;
   const saved=canonicalAnchors.find(x=>x.id===a.id&&x.low===a.low&&x.high===a.high&&x.sourceUrl===a.sourceUrl),age=now()-Date.parse(a.asOf);
   if(saved&&age>=0&&age<30*DAY){stats.saved_reused++;usedIds.add(a.id);found.push(saved);continue;}
   const key=C.postingKey(a),prior=cache[key],identity=JSON.stringify([a.id,a.co,a.title,a.location]);
   const evidenceRow={PRIMARY_ID:a.id,COMPANY:a.co,TITLE:a.title,LOCATION:a.location},full=postingCache?.find(evidenceRow,[sourceUrl(a)]);
   if(full&&!full.payNeedsRefresh){stats.cache_hits++;if(full.pay&&full.basis==='EMPLOYER_POSTED'){found.push({...a,low:full.pay.low,high:full.pay.high,asOf:full.at,sourceUrl:full.url});usedIds.add(a.id);}continue;}
   if(!full?.payNeedsRefresh&&prior?.identity===identity&&prior.anchor&&now()>=Date.parse(prior.at)&&now()-Date.parse(prior.at)<14*DAY){stats.cache_hits++;usedIds.add(a.id);found.push(prior.anchor);continue;}
   if(!full?.payNeedsRefresh&&prior?.identity===identity&&Date.parse(prior.retryAt)>now()){stats.backoff++;continue;}
   if(!canReadSource(a)){stats.unsupported_routes++;continue;}
   if(stats.reads>=maxReads||reads>=maxPerTarget||!canRead())continue;reads++;stats.reads++;
   let fresh;try{fresh=await readSource(a);}catch{}
   const at=fresh?.at||new Date(now()).toISOString();
   if(fresh)postingCache?.save(evidenceRow,fresh.sourceUrl||a.sourceUrl,fresh,{at});
   if(fresh?.identityVerified===true&&fresh.basis==='EMPLOYER_POSTED'&&fresh.pay?.low>=40000&&fresh.pay.high>=fresh.pay.low&&fresh.pay.high<=2000000){
    const anchor={...a,low:fresh.pay.low,high:fresh.pay.high,asOf:at,sourceUrl:fresh.sourceUrl||a.sourceUrl};delete anchor.weight;
    cache[key]={identity,at,anchor};found.push(anchor);usedIds.add(a.id);stats.found++;stats.samples.push({id:a.id,company:a.co,title:a.title,location:a.location,sourceUrl:anchor.sourceUrl,asOf:at,low:anchor.low,high:anchor.high,status:'REFRESHED_COMPARABLE_NOT_TARGET_PAY'});
   }else{cache[key]={identity,at,retryAt:new Date(now()+DAY).toISOString(),status:fresh?.identityVerified?(fresh.payAmbiguous?'PAY_UNRESOLVED':'NO_PAY_STATED'):'UNCONFIRMED_SOURCE'};if(fresh?.identityVerified)stats[fresh.payAmbiguous?'pay_unresolved':'no_pay_read']++;else stats.failed++;}
  }
  return found;
 }
 function count(est){if(est?.ids?.some(id=>usedIds.has(id)))stats.estimates_with_profile_sources++;}
 return {find,count,stats};
}
// Retain complete exact postings even without usable salary. The anchor-facing
// parsePage wrapper still requires valid USD annual base pay.
function parsePosting(html,a){
 const jobs=[];function visit(x){if(Array.isArray(x))return x.forEach(visit);if(!x||typeof x!=='object')return;if([].concat(x['@type']||[]).includes('JobPosting'))jobs.push(x);if(x['@graph'])visit(x['@graph']);}
 for(const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 const norm=C.norm,hits=jobs.filter(j=>norm(j.title)===norm(a.title)&&norm(j.hiringOrganization?.name)===norm(a.co));if(hits.length!==1)return null;const j=hits[0];
 const places=[].concat(j.jobLocation||[]).map(l=>l.address).filter(Boolean),loc=norm(a.location),state=L.stateFrom(a.location);
 const us=v=>/^(US|USA|United States|United States of America)$/i.test(typeof v==='string'?v:v?.name||'');
 const remote=/^(?:remote (?:us|usa|united states)|(?:us|usa|united states) remote)$/.test(loc),remoteEvidence=places.some(p=>norm(p.addressLocality)==='remote'&&us(p.addressCountry))||(j.jobLocationType==='TELECOMMUTE'&&[].concat(j.applicantLocationRequirements||[]).some(us));
 if(remote?!remoteEvidence:!state||!places.some(p=>{const location=require('../programmed-coordinator/source.cjs').location;return p.addressLocality&&p.addressRegion&&location(p.addressLocality+', '+p.addressRegion)===location(a.location)&&(!p.addressCountry||us(p.addressCountry));}))return null;
 if(j.validThrough&&(!Number.isFinite(Date.parse(j.validThrough))||Date.parse(j.validThrough)<Date.now()))return null;
 const text=String(j.description||'').replace(/<[^>]+>/g,' ');if(text.length<300||/captcha|sign in to view|verify you are human/i.test(text))return null;
 const s=j.baseSalary,Pay=require('./pay-values');
 let pay=Pay.structured(s)||(!s&&firstParty(a.sourceUrl,a.co)?Pay.employerText(text,L.payFromText,{currency:state?'USD':undefined}):null);
 const payAmbiguous=!!s&&!pay||!!pay&&Pay.conflicts(text,pay,L.payFromText)||!pay&&/\$\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP)\s*\d/i.test(text);
 if(payAmbiguous)pay=null;
 return {identityVerified:true,sourceIdentity:{company:a.co,title:a.title,location:a.location},fullPosting:true,payAmbiguous,postingFacts:{datePosted:j.datePosted||null,validThrough:j.validThrough||null},basis:'EMPLOYER_POSTED',text,identifier:typeof j.identifier==='string'?j.identifier:j.identifier?.value,structuredBaseSalary:s||null,evidenceKind:s?'EMPLOYER_STRUCTURED_BASE_SALARY':'EMPLOYER_PAGE',pay,quote:s?null:text.match(/(?:base (?:salary|pay)|annual (?:base )?salary|salary range)[^\n]{0,140}/i)?.[0]};
}
function parsePage(html,a){const parsed=parsePosting(html,a);return parsed?.pay?parsed:null;}
function firstParty(raw,company){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return false;if(L.atsApi(raw)||/\.oraclecloud\.com$/i.test(u.hostname))return true;
 const hosts={'meta':['metacareers.com'],'tesla':['tesla.com'],'applied materials':['appliedmaterials.com'],'ford motor company':['ford.com'],'anduril industries':['anduril.com'],'boeing':['boeing.com'],'lockheed martin':['lockheedmartinjobs.com'],'baxter':['jobs.baxter.com'],'blue origin':['blueorigin.com'],'carrier':['carrier.com'],'eaton':['eaton.com'],'northrop grumman':['northropgrumman.com'],'oracle':['oracle.com'],'stryker':['stryker.com']};
 return (hosts[C.norm(company)]||[]).some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
module.exports={create,parsePage,parsePosting,firstParty};
