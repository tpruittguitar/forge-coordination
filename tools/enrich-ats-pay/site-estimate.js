'use strict';
// A site's estimate is target-specific model input, never an employer-posted anchor.
const fs=require('node:fs'),path=require('node:path'),Pay=require('./pay-values');
const PostedPay=require('../source-trial/posted-pay'),Evidence=require('../source-trial/evidence-store');
const VERSION='20261111-site-estimate-v1';
const identity=r=>Evidence.identity(r);
const key=u=>require('../pipeline-observability/upstream-flow').key(u);
function valid(row,p,now=Date.now()){
 if(!p||!require('./public-posting').publicUrl(p.sourceUrl)||p.schema!==PostedPay.schema||p.status!=='ESTIMATED'||!PostedPay.bound(p,{company:p.company,title:p.title,location:p.location,url:p.sourceUrl}))return null;
 // A provider's own good-faith salary estimate is employer disclosure. An upstream
 // ESTIMATED flag alone must not turn employer wording into a third-party signal.
 const explicit=/THIRD_PARTY_ESTIMATE|SALARY_SITE_ESTIMATE|CANONICAL_THIRD_PARTY_ESTIMATE|PARSED_SITE_ESTIMATE/i.test(p.source||'')||/\b(?:indeed|linkedin|glassdoor|payscale|salary\.com|ziprecruiter|lensa|hiringcafe|jobspy|recruiter|third.party|site)\b[^\n]{0,80}\bestimat|\bestimat[^\n]{0,80}\b(?:indeed|linkedin|glassdoor|payscale|salary\.com|ziprecruiter|lensa|hiringcafe|jobspy|recruiter|third.party|site)\b/i.test([p.source,p.text].join(' '));
 const knownFeed=/^(?:JOBSPY:|HIRINGCAFE$)/i.test(p.source||'');
 let knownSite=false;try{knownSite=/(^|\.)(?:linkedin\.com|indeed\.com|hiring\.cafe|hiringcafe\.com|ziprecruiter\.com|glassdoor\.com|salary\.com|payscale\.com|lensa\.com)$/.test(new URL(p.sourceUrl).hostname);}catch{}
 const employerWording=/\b(?:company|employer)[’']?s?[^.\n]{0,60}\bgood faith estimate|provided by (?:the )?employer|employer[- ](?:provided|posted)/i.test(p.text||'');
 if(!explicit&&(!knownFeed&&!knownSite||employerWording))return null;
 const age=now-Date.parse(p.observedAt);if(!Number.isFinite(age)||age<0||identity(p).some((x,i)=>!x||x!==identity(row)[i]))return null;
 if(!require('./recovery').urls(row).some(u=>key(u)===key(p.sourceUrl))&&row.p?.SALARY_SOURCE!==p.sourceUrl&&key(String(row.p?.SALARY_SOURCE||'').replace(/^site-estimate:/,''))!==key(p.sourceUrl))return null;
 return p;
}
function numeric(p){return p?.currency==='USD'&&Pay.annualUnit(p.period)&&p.basis==='BASE'?Pay.values(p.low,p.high):null;}
function canonical(row){const p=row.p||{};if(p.SALARY_BASIS!=='THIRD_PARTY_ESTIMATE'){
  if(!Pay.estimated(p.PAY_POSTED))return null;
  const sourceUrl=p.SALARY_EVIDENCE_URL||p.SALARY_SOURCE||p.SOURCE_URL||p.SOURCE;
  return PostedPay.fromText({...row,url:sourceUrl},p.PAY_POSTED,{observedAt:p.PAY_POSTED_ASOF||p.SALARY_ASOF||p.SOURCE_OBSERVED_AT,source:'SAVED_POSTED_PAY_TEXT'});
 }
 return {schema:PostedPay.schema,company:row.COMPANY,title:row.TITLE,location:row.LOCATION,sourceUrl:p.SALARY_SOURCE,text:p.PAY_POSTED||'',low:p.SALARY_BASE_LOW,high:p.SALARY_BASE_HIGH,currency:'USD',period:'YEAR',basis:'BASE',status:'ESTIMATED',observedAt:p.SALARY_ASOF,source:'CANONICAL_THIRD_PARTY_ESTIMATE'};
}
function fromParsed(row,parsed,url,at){
 if(parsed?.postedPay)return valid(row,parsed.postedPay);
 if(parsed?.basis!=='THIRD_PARTY_ESTIMATE'||!parsed.pay)return null;
 return valid(row,{schema:PostedPay.schema,company:row.COMPANY,title:row.TITLE,location:row.LOCATION,sourceUrl:url,text:parsed.text||'',...parsed.pay,currency:'USD',period:'YEAR',basis:'BASE',status:'ESTIMATED',observedAt:at,source:'PARSED_SITE_ESTIMATE'});
}
function create({root,ledger={},now=()=>Date.now()}={}){
 ledger.siteEstimates=ledger.siteEstimates||{};const byUrl=new Map(),seen=new Set();
 function add(p){if(p?.status!=='ESTIMATED'||!key(p.sourceUrl))return;const k=key(p.sourceUrl);if(!byUrl.has(k))byUrl.set(k,[]);byUrl.get(k).push(p);}
 function read(file){try{return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}catch{return null;}}
 const manifest=read('state/discovery-evidence/manifest.json'),entries=manifest?.schema==='forge.discovery-evidence-manifest.v1'?manifest.entries:read('state/UPSTREAM_LEDGER.json')?.entries;
 for(const e of Object.values(entries||{}))for(const ref of e.evidenceRefs||[]){if(seen.has(ref.sha256))continue;seen.add(ref.sha256);const d=Evidence.read(root,ref);if(d&&PostedPay.bound(d.postedPay,d))add(d.postedPay);}
 // The report can precede publication of the immutable evidence manifest. Only
 // source-reviewed, text-hash-bound cards carry the original estimate forward.
 for(const file of ['state/source-trial-report.json','state/board-discovery-report.json']){const report=read(file);for(const c of ['new_roles','existing_roles','protected_roles','identity_held_roles'].flatMap(k=>report?.[k]||[])){
  const d=c?.discoveryReview;if(d?.schema==='forge.discovery-review.v1'&&d.detailStatus==='SOURCE_CONTENT_REVIEWED'&&d.sourceSha256===Evidence.hash(require('../programmed-coordinator/source.cjs').text(c.description||''))&&d.source===c.source&&key(d.sourceUrl)===key(c.url)&&PostedPay.bound(c.postedPay,c))add(c.postedPay);
 }}
 function remember(row,p){p=valid(row,p,now());if(!p)return null;ledger.siteEstimates[row.PRIMARY_ID]={identity:identity(row),input:structuredClone(p)};return p;}
 function forRow(row){
  const saved=ledger.siteEstimates[row.PRIMARY_ID],source=String(row.p?.SALARY_SOURCE||'').replace(/^site-estimate:/,''),urls=[...require('./recovery').urls(row),...(require('./public-posting').publicUrl(source)?[source]:[])],candidates=[canonical(row),...(urls.flatMap(u=>byUrl.get(key(u))||[]))];
  if(saved&&JSON.stringify(saved.identity)===JSON.stringify(identity(row)))candidates.push(saved.input);
  const p=candidates.filter(p=>valid(row,p,now())).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];return p?remember(row,p):null;
 }
 return {forRow,remember};
}
function routed(row,input){return !!input||row.p?.SALARY_BASIS==='THIRD_PARTY_ESTIMATE'||/^site-estimate:/.test(row.p?.SALARY_SOURCE||'');}
function combine(baseline,input){
 if(!input)return baseline;
 if(!baseline)return null; // Never promote a site's range into a finished Forge estimate.
 const v=numeric(input),note='site-labeled THIRD_PARTY_ESTIMATE '+input.sourceUrl+' observed '+input.observedAt+'; employer disclosure unverified; no employer salary lookup required';
 if(!v)return {...baseline,siteEstimate:input,source:'SITE_ESTIMATE_CONTEXT',conf:'LOW',basis:baseline.basis+'; '+note+'; amount excluded: annual USD base range not established'};
 // Deliberately conservative, uncalibrated support: one site signal contributes
 // 25% alongside the existing model. It does not increase comparable counts.
 const low=Math.round((baseline.low*0.75+v.low*0.25)/1000)*1000;
 const high=Math.max(baseline.high,Math.round((baseline.high*0.75+v.high*0.25)/1000)*1000);
 return {...baseline,low,high,mid:Math.round((low+high)/2),conf:'LOW',n:baseline?.n||0,ids:baseline?.ids||[],siteEstimate:input,source:'SITE_ESTIMATE_BLEND',baselineSource:baseline?.source||null,basis:(baseline?.basis?baseline.basis+'; ':'')+note+'; original site range USD '+v.low+'-'+v.high+' annual base; '+'75% existing model / 25% site estimate, uncalibrated conservative weight; existing model ceiling preserved'};
}
module.exports={VERSION,valid,numeric,canonical,fromParsed,create,routed,combine};
