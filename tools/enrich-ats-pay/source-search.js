'use strict';
const Profile=require('./source-profile'),L=require('./lib'),C=require('./context');
const DAY=86400000;
function create({profile,context={},cache={},readSource,now=()=>Date.now(),maxReads=6,maxPerTarget=2,canRead=()=>true,canReadSource=()=>true}){
 const stats={enabled:true,targets:0,candidates:0,saved_reused:0,cache_hits:0,reads:0,found:0,failed:0,backoff:0,unsupported_routes:0,estimates_with_profile_sources:0,samples:[]},usedIds=new Set();
 async function find(target,canonicalAnchors){
  stats.targets++;const found=[],seen=new Set();let reads=0;
  for(const source of Profile.sourcesFor(target,profile,context,now()))for(const a of source.candidates){
   if(a.id===target.PRIMARY_ID||seen.has(C.postingKey(a)))continue;seen.add(C.postingKey(a));stats.candidates++;
   const saved=canonicalAnchors.find(x=>x.id===a.id&&x.low===a.low&&x.high===a.high&&x.sourceUrl===a.sourceUrl),age=now()-Date.parse(a.asOf);
   if(saved&&age>=0&&age<30*DAY){stats.saved_reused++;usedIds.add(a.id);found.push(saved);continue;}
   const key=C.postingKey(a),prior=cache[key],identity=JSON.stringify([a.id,a.co,a.title,a.location]);
   if(prior?.identity===identity&&prior.anchor&&now()>=Date.parse(prior.at)&&now()-Date.parse(prior.at)<14*DAY){stats.cache_hits++;usedIds.add(a.id);found.push(prior.anchor);continue;}
   if(prior?.identity===identity&&Date.parse(prior.retryAt)>now()){stats.backoff++;continue;}
   if(!canReadSource(a)){stats.unsupported_routes++;continue;}
   if(stats.reads>=maxReads||reads>=maxPerTarget||!canRead())continue;reads++;stats.reads++;
   let fresh;try{fresh=await readSource(a);}catch{}
   const at=new Date(now()).toISOString();
   if(fresh?.identityVerified===true&&fresh.basis==='EMPLOYER_POSTED'&&fresh.pay?.low>=40000&&fresh.pay.high>=fresh.pay.low&&fresh.pay.high<=2000000){
    const anchor={...a,low:fresh.pay.low,high:fresh.pay.high,asOf:at,sourceUrl:fresh.sourceUrl||a.sourceUrl};delete anchor.weight;
    cache[key]={identity,at,anchor};found.push(anchor);usedIds.add(a.id);stats.found++;stats.samples.push({id:a.id,company:a.co,title:a.title,location:a.location,sourceUrl:anchor.sourceUrl,asOf:at,low:anchor.low,high:anchor.high,status:'REFRESHED_COMPARABLE_NOT_TARGET_PAY'});
   }else{cache[key]={identity,at,retryAt:new Date(now()+DAY).toISOString(),status:'UNCONFIRMED_SOURCE'};stats.failed++;}
  }
  return found;
 }
 function count(est){if(est?.ids?.some(id=>usedIds.has(id)))stats.estimates_with_profile_sources++;}
 return {find,count,stats};
}
// Require a full, exact employer/title/location JobPosting and explicit USD annual baseSalary.
// No snippets, whole-page salary regex, estimates, total compensation, or loose source identity.
function parsePage(html,a){
 const jobs=[];function visit(x){if(Array.isArray(x))return x.forEach(visit);if(!x||typeof x!=='object')return;if([].concat(x['@type']||[]).includes('JobPosting'))jobs.push(x);if(x['@graph'])visit(x['@graph']);}
 for(const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 const norm=C.norm,hits=jobs.filter(j=>norm(j.title)===norm(a.title)&&norm(j.hiringOrganization?.name)===norm(a.co));if(hits.length!==1)return null;const j=hits[0];
 const places=[].concat(j.jobLocation||[]).map(l=>l.address).filter(Boolean),loc=norm(a.location),state=L.stateFrom(a.location);
 const us=v=>/^(US|USA|United States|United States of America)$/i.test(typeof v==='string'?v:v?.name||'');
 const remote=/^(?:remote (?:us|usa|united states)|(?:us|usa|united states) remote)$/.test(loc),remoteEvidence=places.some(p=>norm(p.addressLocality)==='remote'&&us(p.addressCountry))||(j.jobLocationType==='TELECOMMUTE'&&[].concat(j.applicantLocationRequirements||[]).some(us));
 if(remote?!remoteEvidence:!state||!places.some(p=>{const city=norm(p.addressLocality),region=L.stateFrom(p.addressRegion)||String(p.addressRegion||'').toUpperCase();return region===state&&city&&loc.includes(city)&&(!p.addressCountry||us(p.addressCountry));}))return null;
 if(j.validThrough&&Date.parse(j.validThrough)<Date.now())return null;
 const text=String(j.description||'').replace(/<[^>]+>/g,' ');if(text.length<300||/captcha|sign in to view|verify you are human/i.test(text))return null;
 const s=j.baseSalary,v=s?.value;if(s?.currency!=='USD'||!/^(YEAR|ANNUAL)$/i.test(v?.unitText||'')||!Number.isFinite(+v.minValue)||!Number.isFinite(+v.maxValue))return null;
 return {identityVerified:true,basis:'EMPLOYER_POSTED',pay:{low:+v.minValue,high:+v.maxValue}};
}
function firstParty(raw,company){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return false;if(L.atsApi(raw)||/\.oraclecloud\.com$/i.test(u.hostname))return true;
 const hosts={'meta':['metacareers.com'],'tesla':['tesla.com'],'applied materials':['appliedmaterials.com'],'ford motor company':['ford.com'],'anduril industries':['anduril.com'],'boeing':['boeing.com'],'blue origin':['blueorigin.com'],'carrier':['carrier.com'],'eaton':['eaton.com'],'northrop grumman':['northropgrumman.com'],'oracle':['oracle.com'],'stryker':['stryker.com']};
 return (hosts[C.norm(company)]||[]).some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
module.exports={create,parsePage,firstParty};
