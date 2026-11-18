'use strict';
// Public, sourced context only. Size changes evidence weights, never salary amounts.
const VERSION='pay-sample-match-v6a',DAY=86400000;
const Alias=require('./company-alias');
const norm=s=>Alias.canonical(s)||String(s||'').toLowerCase().replace(/\b(incorporated|corporation|corp|inc|llc|ltd)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
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
 for(const [key,record] of [['employees',company?.facts?.employees],['revenueUsd',company?.facts?.revenueUsd],['siteEmployees',sites.length===1?sites[0].facts?.employees:null],...['teamSize','management','reach','minExperienceYears','minLeadershipYears','launch','clearance'].map(k=>[k,role?.facts?.[k]])]){const v=fact(record,now);if(v!==null)out[key]=v;}
 // Order (PAY SAMPLE MATCH): registry `builds`, EMPLOYER_PRIMARY_BUSINESS, posting company overview. No AI or web lookup.
 const industry=industryFrom([listedBuilds(row,ref)||company?.builds,businessOf(row),companyOverview(postingOf(row))||rememberedOverview(row)]);
 if(industry)out.industry=industry;
 return out;
}
function postingKey(a){
 try{const u=new URL(a.page||a.sourceUrl);const li=u.hostname.match(/(^|\.)linkedin\.com$/)&&u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);if(li)return'linkedin:'+li[1];
  if(/indeed\.com$/.test(u.hostname)&&u.searchParams.get('jk'))return'indeed:'+u.searchParams.get('jk');
  if(/\/jobs?\//.test(u.pathname))return u.hostname.toLowerCase()+u.pathname.replace(/\/$/,'');
 }catch{}
 return norm(a.co)+'|'+norm(a.title)+'|'+norm(a.location||a.state)+'|'+a.low+'|'+a.high;
}
// Location identity: city plus US state code when one is readable ("Orlando, FL" = "Orlando, Florida, United States").
function locationKey(loc){
 const t=String(loc||''),state=require('./lib').stateFrom(t),city=norm(t.split(',')[0]);
 return state?city+' '+state.toLowerCase():norm(t);
}
const rangeKey=n=>Number.isFinite(Number(n))?Math.round(Number(n)/1000):String(n);
// Same company (after alias normalization), title, location and range is one posting, whatever URL it came from.
function identityKey(a){return norm(a.co)+'|'+norm(a.title).replace(/\bsr\b/g,'senior')+'|'+locationKey(a.location||a.state)+'|'+rangeKey(a.low)+'|'+rangeKey(a.high);}
/** Drop repeated postings before any weighting; the newest copy is kept. */
function dedupe(anchors){
 const seen=new Set(),out=[];
 for(const a of anchors.slice().sort((a,b)=>(Date.parse(b.asOf||b.seen)||0)-(Date.parse(a.asOf||a.seen)||0))){const k=postingKey(a),id=identityKey(a);if(seen.has(k)||seen.has(id))continue;seen.add(k);seen.add(id);out.push(a);}
 return out;
}
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const BANDS={employees:[[100,'UNDER_100'],[1000,'100_999'],[10000,'1000_9999'],[Infinity,'10000_PLUS']],teamSize:[[10,'UNDER_10'],[50,'10_49'],[200,'50_199'],[Infinity,'200_PLUS']]};
function band(key,n){for(const [max,label] of BANDS[key])if(n<max)return label;return null;}
// Industry buckets (PAY SAMPLE MATCH). Specific buckets first; GENERAL_MANUFACTURING is the catch-all for
// industrial makers and only applies when no specific bucket matched. Two or more specific hits is a weak
// match and counts as unknown.
const INDUSTRY=[
 ['AEROSPACE_DEFENSE',/\b(aerospace|aircraft|aviation|spacecraft|satellite|orbital|rocket|launch vehicle|defense|defence|military|drone|uav|unmanned aerial|unmanned aircraft)\b/i],
 ['AUTOMOTIVE',/\b(automotive|automobile)\b/i],
 ['SEMICONDUCTOR',/\b(semiconductor|semiconductors)\b/i],
 ['PHARMA',/\b(pharmaceutical|pharmaceuticals|pharma|biopharmaceutical)\b/i],
 ['MEDICAL_DEVICE',/\b(medical device|medical devices)\b/i],
 ['ENERGY',/\b(oil and gas|refiner(?:y|ies)|solar power|battery energy)\b/i],
 ['FURNITURE',/\b(furniture|furnishings|cabinetry|mattress(?:es)?|bedding)\b/i],
 ['FOOD_BEVERAGE',/\b(food|foods|beverage|beverages|brewery|breweries|brewing|bakery|bakeries|snacks?|dairy|meat processing|poultry|confection(?:s|ery)?|bottling|bottler)\b/i],
 ['RETAIL',/\b(retailer|retailers|retail stores?|retail chain|department stores?|grocery|supermarkets?)\b/i],
 ['NONPROFIT',/\b(non-?profit|not-for-profit|501\s?\(c\)\s?\(3\)|charity|charitable organization)\b/i],
 ['CONSUMER_PRODUCTS',/\b(consumer (?:products|goods|electronics)|sporting goods|sports equipment|athletic (?:footwear|apparel|equipment)|household products|personal care products|toys?|apparel|footwear|cosmetics|home appliances)\b/i],
 ['SPORTS_ORG',/\b(sports? (?:league|association|federation|club|organization|governing body)|tennis association|athletic association|national governing body|usta|ncaa|professional (?:sports )?league)\b/i],
 ['EDUCATION',/\b(school|schools|university|universities|college|colleges|art school|school of art|k-12|educational institution)\b/i],
 ['HEALTHCARE_SERVICES',/\b(clinic|clinics|hospital|hospitals|health system|healthcare provider|patient care|vein|vascular (?:center|clinic|care|institute)|medical center|physician practice|urgent care)\b/i],
];
const GENERAL_MANUFACTURING=['GENERAL_MANUFACTURING',/\b(manufactur\w*|industrial|fabricat\w*|machining|machinery|factory|factories)\b/i];
// Organizations that do not make products never match a manufacturing target.
const NON_MAKER=new Set(['NONPROFIT','SPORTS_ORG','EDUCATION','HEALTHCARE_SERVICES']);
const overviews=new Map();
function unclearIndustryText(text){
 const t=String(text||'').trim();
 if(!t||/^RECRUITING_AGENCY$/i.test(t))return true;
 if(/^\s*job description\b/i.test(t))return true;
 if(t.length>400&&/\b(responsibilities|qualifications|we are seeking|requirements|you(?:'|’)ll)\b/i.test(t))return true;
 return false;
}
function industryLabel(text){
 if(unclearIndustryText(text))return null;
 const hits=[];for(const [label,re] of INDUSTRY)if(re.test(text)&&!hits.includes(label))hits.push(label);
 if(hits.length===1)return hits[0];
 if(!hits.length&&GENERAL_MANUFACTURING[1].test(text))return GENERAL_MANUFACTURING[0];
 return null;
}
/** Company registry (SECTION=TARGET_COMPANIES) from the canonical rules text: [{company,aliases,builds}]. */
function registryFromRules(text){
 const out=[];for(const m of String(text||'').matchAll(/^TARGET_COMPANY=(\{.*\})\s*$/gm)){try{const c=JSON.parse(m[1]);if(c&&c.company)out.push({company:c.company,aliases:Array.isArray(c.aliases)?c.aliases:[],builds:String(c.builds||'')});}catch{}}
 return out;
}
function industryFrom(parts){for(const text of parts){const label=industryLabel(text);if(label)return label;}return null;}
function companyOverview(text){
 const t=String(text||'').replace(/\r/g,'');
 const m=t.match(/(?:^|\n)\s*(?:about (?:the )?(?:company|us)|who we are|company overview)\s*:?\s*\n+([\s\S]{0,700})/i);
 return m?m[1].split(/\n\s*(?:responsibilities|qualifications|requirements|what you(?:'|’)ll|benefits|the role)\b/i)[0].trim():'';
}
function businessOf(row){const p=row&&(row.p||row.payload)||{};return String(row&&(row.EMPLOYER_PRIMARY_BUSINESS||p.EMPLOYER_PRIMARY_BUSINESS||row.business)||'');}
function postingOf(row){return String(row&&(row.postingText||row.text||row.description)||'');}
function roleKey(row){return norm(row.COMPANY)+'|'+norm(row.TITLE)+'|'+norm(row.LOCATION);}
function rememberOverview(row,text){const overview=companyOverview(text);if(!overview)return;if(row.PRIMARY_ID)overviews.set(row.PRIMARY_ID,overview);overviews.set(roleKey(row),overview);}
function rememberedOverview(row){return overviews.get(row.PRIMARY_ID)||overviews.get(roleKey(row))||'';}
function listedBuilds(row,ref){
 for(const list of [ref&&ref.registry,ref&&ref.targetCompanies]){
  if(!Array.isArray(list))continue;
  const hits=list.filter(c=>[c.company,...(c.aliases||[])].some(n=>norm(n)===norm(row.COMPANY)));
  if(hits.length===1&&hits[0].builds)return String(hits[0].builds);
 }
 return '';
}
// PAY SAMPLE MATCH (Tim 2026-11-13): industry, company size band and scope are hard matches.
// Known on both rows and different: the sample is excluded. Unknown on either row: the sample stays in
// at the missing-fact weight (0.75), once per dimension.
const MISSING_FACT_WEIGHT=0.75;
const SCOPE_KEYS=['teamSize','management','reach'];
function closeness(a,b){return 1/(1+Math.abs(Math.log2(a/b))/2);}
function similarity(target,other){
 let weight=1,known=0;const missing=[];
 // Industry. A known non-maker (nonprofit, sports body, school, care provider) is a known mismatch for a known
 // manufacturing target; an unknown target industry keeps the sample at 0.75 like any other unknown.
 if(target.industry&&other.industry){known++;if(target.industry!==other.industry)return{weight:0,known,missing,conflict:'industry'};}
 else{missing.push('industry');weight*=MISSING_FACT_WEIGHT;}
 // Company size band.
 if(number(target.employees)&&number(other.employees)){known++;if(band('employees',target.employees)!==band('employees',other.employees))return{weight:0,known,missing,conflict:'employees'};weight*=closeness(target.employees,other.employees);}
 else{missing.push('employees');weight*=MISSING_FACT_WEIGHT;}
 // Scope: team size (including a stated direct-report count), management layer, number of sites / reach.
 let scopeKnown=0;
 for(const key of SCOPE_KEYS){
  const t=target[key],o=other[key],both=key==='teamSize'?number(t)&&number(o):!!(t&&o);
  if(!both){missing.push(key);continue;}
  known++;scopeKnown++;
  if(key==='teamSize'){if(band(key,t)!==band(key,o))return{weight:0,known,missing,conflict:key};weight*=closeness(t,o);}
  else if(t!==o)return{weight:0,known,missing,conflict:key};
 }
 if(!scopeKnown)weight*=MISSING_FACT_WEIGHT;
 // Softer context: closeness when both known; target-known/sample-unknown keeps the prior 0.75.
 for(const key of ['revenueUsd','siteEmployees','minExperienceYears','minLeadershipYears']){
  if(number(target[key])&&number(other[key])){known++;weight*=closeness(target[key],other[key]);}else{missing.push(key);if(number(target[key]))weight*=MISSING_FACT_WEIGHT;}
 }
 for(const key of ['launch','clearance']){
  if(target[key]&&other[key]){known++;if(target[key]!==other[key])weight*=0.5;}else{missing.push(key);if(target[key])weight*=MISSING_FACT_WEIGHT;}
 }
 return{weight,known,missing};
}
function rank(row,anchors,ref,now=Date.now()){
 const target=lookup(row,ref,now),seen=new Set(),out=[];
 for(const a of dedupe(anchors)){
  const key=postingKey(a),identity=identityKey(a);if(seen.has(key)||seen.has(identity))continue;
  const other=lookup({PRIMARY_ID:a.id,COMPANY:a.co||'',TITLE:a.title,LOCATION:a.location||'',business:a.business,postingText:a.postingText||a.text||a.description||'',p:a.p},ref,now),s=similarity(target,other);
  if(!s.weight)continue;
  const age=now-Date.parse(a.asOf||a.seen||'');if(Number.isFinite(age)&&(age>730*DAY||age< -DAY))continue;
  seen.add(key);seen.add(identity);
  const fresh=Number.isFinite(age)?Math.pow(0.5,Math.max(age,0)/(365*DAY)):0.5;
  const geography=a.state&&a.state===row.state?1.3:1;
  const employers=(ref.companies||[]).filter(c=>[c.company,...c.aliases||[]].some(x=>norm(x)===norm(row.COMPANY)));
  const sameEmployer=!!a.co&&(norm(a.co)===norm(row.COMPANY)||(employers.length===1&&[employers[0].company,...employers[0].aliases||[]].some(x=>norm(x)===norm(a.co))));
  out.push({...a,weight:s.weight*fresh*geography*(sameEmployer?1.5:1),sameEmployer,contextKnown:s.known,contextMissing:s.missing,ageKnown:Number.isFinite(age),postingKey:key});
 }
 return out.sort((a,b)=>b.weight-a.weight||String(a.id||a.page).localeCompare(String(b.id||b.page)));
}
function select(row,anchors,ref={},now=Date.now(),limit=Infinity){
 const ranked=rank(row,anchors,ref,now),dated=ranked.filter(a=>a.ageKnown),eligible=dated.length?dated:ranked,employer=eligible.filter(a=>a.sameEmployer);
 // Strong employer evidence must not be outvoted by the number of peer postings.
 // An undated same-company row cannot displace dated evidence from peers.
 // Blend both sources. Employer identity is evidence weight, not a veto over peers.
 // Cap each employer's aggregate weight to two ordinary postings, preventing
 // a prolific employer (including the target) from overwhelming the population.
 const totals={};for(const a of eligible){const k=norm(a.co)||a.postingKey;totals[k]=(totals[k]||0)+a.weight;}
 const pool=eligible.map(a=>({...a,weight:a.weight*Math.min(1,2/totals[norm(a.co)||a.postingKey])})).sort((a,b)=>b.weight-a.weight||String(a.id||a.page).localeCompare(String(b.id||b.page))).slice(0,limit);
 if(employer.length&&!pool.some(a=>a.sameEmployer)){const ownBest=employer[0];if(pool.length>=limit)pool.pop();pool.push({...ownBest,weight:ownBest.weight*Math.min(1,2/totals[norm(ownBest.co)||ownBest.postingKey])});}
 const own=pool.filter(a=>a.sameEmployer),peers=pool.filter(a=>!a.sameEmployer);
 if(own.length&&peers.length){
  // One employer posting is balanced against the independent peer cohort;
  // repeated employer disclosures increase support without discarding peers.
  const share=own.length/(own.length+1),ownWeight=own.reduce((s,a)=>s+a.weight,0),peerWeight=peers.reduce((s,a)=>s+a.weight,0);
  for(const a of pool)a.weight*=a.sameEmployer?share/ownWeight:(1-share)/peerWeight;
 }
 return pool.sort((a,b)=>b.weight-a.weight||String(a.id||a.page).localeCompare(String(b.id||b.page)));
}
function weightedMedian(items,key){const a=items.slice().sort((a,b)=>a[key]-b[key]);const half=a.reduce((s,x)=>s+x.weight,0)/2;let sum=0;for(let i=0;i<a.length;i++){sum+=a[i].weight;if(Math.abs(sum-half)<1e-10&&a[i+1])return(a[i][key]+a[i+1][key])/2;if(sum>=half)return a[i][key];}return null;}
function weightedQuantile(items,key,q){
 const a=items.filter(x=>Number.isFinite(x[key])&&x.weight>0).slice().sort((a,b)=>a[key]-b[key]);
 const threshold=a.reduce((sum,x)=>sum+x.weight,0)*q;let sum=0;
 for(const x of a){sum+=x.weight;if(sum>=threshold)return x[key];}return null;
}
function salaryValue(items,key){
 const own=items.filter(a=>a.sameEmployer),peers=items.filter(a=>!a.sameEmployer);
 // Screening ceiling: upper quartile of comparable posted ceilings. Do not
 // average stronger same-employer evidence down toward lower-paying peers.
 if(key==='high')return Math.max(weightedQuantile(items,key,.75)||0,own.length?weightedQuantile(own,key,.75):0);
 if(!own.length||!peers.length)return weightedMedian(items,key);
 const share=own.length/(own.length+1);return share*weightedMedian(own,key)+(1-share)*weightedMedian(peers,key);
}
function confidence(est,used){return used.length<2||used.some(a=>!a.ageKnown)||used.filter(a=>a.contextKnown>=3).length<2?'LOW':est.conf;}
function annotation(used){return 'context model '+VERSION+'; '+used.length+' distinct postings; '+(used.every(a=>a.sameEmployer)?'same-employer tier':used.some(a=>a.sameEmployer)?'blended employer/peer evidence':'peer tier')+'; upper endpoint = weighted upper quartile, same-employer ceiling retained; known industry, company-size band and scope mismatches excluded, missing facts at 0.75, no pay multiplier; '+used.filter(a=>a.contextKnown>=3).length+' with 3+ comparable context facts';}
function learn(ref,row,text,sourceUrl,asOf){
 // Only explicit responsibility wording; never infer headcount from a title or production volume.
 if(!text||!sourceUrl)return false;
 rememberOverview(row,text);
 const facts={},conflicts=new Set(),put=(key,value,quote)=>{if(conflicts.has(key))return;if(facts[key]&&facts[key].value!==value){delete facts[key];conflicts.add(key);return;}facts[key]={value,quote:quote.slice(0,240),sourceUrl,asOf,status:'CONFIRMED'};};
 let m=text.match(/\b(?:manage|lead|supervise)\s+(?:a\s+)?team of\s+(\d[\d,]*)\s+(?:people|employees|engineers|direct reports)\b/i);
 if(m)put('teamSize',Number(m[1].replace(/,/g,'')),m[0]);
 m=text.match(/\b(\d{1,4})\s+direct reports\b/i);if(m&&!facts.teamSize&&!conflicts.has('teamSize'))put('teamSize',Number(m[1]),m[0]);
 m=text.match(/\b(?:responsible for|oversee|overseeing|manage|managing|lead|leading|across)\s+(?:operations\s+(?:at|across)\s+)?(\d{1,3}|two|three|four|five|six|seven|eight|nine|ten)\s+(?:manufacturing\s+|production\s+)?(?:sites|plants|facilities)\b/i);if(m&&!/^(?:1|one)$/i.test(m[1]))put('reach','MULTI_SITE',m[0]);
 m=text.match(/\b(?:manage|lead|supervise)\s+(?:a\s+)?team of\s+(?:\d+\s+)?managers\b/i);if(m)put('management','MANAGES_MANAGERS',m[0]);
 m=text.match(/\b(?:this (?:role|position) is an individual contributor|individual contributor role)\b/i);if(m)put('management','INDIVIDUAL_CONTRIBUTOR',m[0]);
 m=text.match(/\b(?:responsible for|oversee|manage)\s+(?:operations\s+)?across multiple (?:sites|plants|facilities)\b/i);if(m)put('reach','MULTI_SITE',m[0]);
 m=text.match(/\b(\d{1,2})\+?\s+years\s+(?:of\s+)?(?:experience\s+)?in\s+high.volume[^.\n]{0,100}manufacturing/i);if(m)put('minExperienceYears',Number(m[1]),m[0]);
 m=text.match(/\b(\d{1,2})\+?\s+years of (?:progressive )?(?:operations |production )?leadership/i);if(m)put('minLeadershipYears',Number(m[1]),m[0]);
 m=text.match(/\b(?:new )?greenfield (?:manufacturing )?facility\b/i);if(m)put('launch','GREENFIELD',m[0]);
 m=text.match(/\b(?:active|current|required|maintain|obtain)[^.\n]{0,60}\b(top secret|secret|TS\/SCI)\s+(?:security\s+)?clearance\b/i);if(m)put('clearance',/top secret|TS\/SCI/i.test(m[1])?'TOP_SECRET':'SECRET',m[0]);
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
module.exports={VERSION,MISSING_FACT_WEIGHT,NON_MAKER,companyOverview,norm,dedupe,registryFromRules,locationKey,fact,lookup,similarity,rank,select,weightedMedian,weightedQuantile,salaryValue,confidence,annotation,postingKey,identityKey,learn,merge,industryLabel,industryFrom};

