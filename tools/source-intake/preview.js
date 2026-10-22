'use strict';
// Conservative read-only preview; canonical Writer classification is the only exclusion authority.
const fs=require('node:fs');
const L=require('../source-trial/lib');
const P=require('../enrich-ats-pay/lib');
const https=require('node:https');
const PRIORITY_URL='https://raw.githubusercontent.com/tpruittguitar/forge-policy/main/derived/TARGET_COMPANIES_PRIORITY.txt';
const CANONICAL_URL='https://raw.githubusercontent.com/tpruittguitar/forge-policy/main/rules/TIM_PIPELINE_RULES_CANONICAL.txt';
function priorityRegistry(text){const out=Object.fromEntries(L.parsePriority(text).map(x=>[P.normCo(x.name),x.tier]));for(const line of String(text).split(/\r?\n/)){if(!line.startsWith('TARGET_COMPANY='))continue;let x;try{x=JSON.parse(line.slice(15));}catch{continue;}if(x.status!=='ACTIVE'||!/^(DREAM|P[123])$/.test(x.priority))continue;for(const name of [x.company,...(x.aliases||[])])out[P.normCo(name)]=x.priority;}return out;}
function fetchText(url){return new Promise((resolve,reject)=>{https.get(url,res=>{if(res.statusCode!==200){res.resume();return reject(Error('priority registry HTTP '+res.statusCode));}let text='';res.setEncoding('utf8');res.on('data',x=>text+=x);res.on('end',()=>resolve(text));}).on('error',reject);});}
async function loadPriority(url=PRIORITY_URL,canonicalUrl=CANONICAL_URL){const [digest,canonical]=await Promise.all([fetchText(url),fetchText(canonicalUrl)]);return {...priorityRegistry(digest),...priorityRegistry(canonical)};}
const WRONG_FUNCTION=/\b(accounting|finance|sales|marketing|human resources|talent acquisition|corporate operations|commercial operations|business development|information technology|cybersecurity)\b/i;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const et=at=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at)).replace(',','')+' ET';
const priority=(j,registry)=>registry?.[P.normCo(j.company)]||registry?.[norm(j.company)]||(/^(DREAM|P[123])$/i.test(j.tier||'')?j.tier.toUpperCase():'UNKNOWN');
function adapt(report,{runId='FORGE-SOURCE-TRIAL-DRYRUN',discoveredAt=new Date().toISOString(),targetRegistry={}}={}){
 if(!Array.isArray(report.new_roles))throw Error('new_roles must be array');
 if(!/^[A-Z0-9_-]+$/.test(runId))throw Error('invalid runId');
 const at=et(discoveredAt);const known={urls:new Set(),ids:new Set(),keys:new Map()};
 const rows=report.new_roles.map((j,i)=>{
  const url=L.normUrl(j.url), id=L.atsId(j.url), k=L.identityKey(j.company,j.title,j.location);
  const tier=priority(j,targetRegistry);
  let verdict='CANDIDATE_REQUIRES_WRITER_CHECK';
  if(j.status&&j.status!=='NEW')verdict='EXISTING_OR_PROTECTED';
  else if(!j.company||!j.title||!j.url)verdict='MISSING_IDENTITY';
  else if(WRONG_FUNCTION.test(j.title))verdict='WRONG_FUNCTION';
  else if(known.urls.has(url)||(id&&known.ids.has(norm(j.company)+'|'+id))||(known.keys.has(k)&&(!id||!known.keys.get(k)||known.keys.get(k)===id)))verdict='DUPLICATE_IN_REPORT';
  else {
   known.urls.add(url);known.keys.set(k,id);if(id)known.ids.add(norm(j.company)+'|'+id);
  }
  // No text-only industry exclusion. Writer decides based on canonical NC rules + employer core-business evidence.
  const industry='NEVER_CONSIDER_REVIEW';
  const flags=[];
  if(/\bmemphis\b/i.test(j.location||''))flags.push('MEMPHIS_STRONG_NEGATIVE');
  if(industry==='NEVER_CONSIDER_REVIEW')flags.push('EMPLOYER_CORE_BUSINESS_UNVERIFIED');
  const record={COMPANY:j.company||'',TITLE:j.title||'',LOCATION:j.location||'',SOURCE_URL:j.url||'',SOURCE_PROVIDER:j.source||'Source Trial',REQ_ID:id,DISCOVERED_AT_ET:at,DISCOVERY_SOURCE:'GitHub source-trial',IDENTITY_CONFIDENCE:id?'HIGH':'UNKNOWN',INITIAL_UNKNOWN_FIELDS:['PAY','DEGREE','FLEX','LIVE_WRITER_DEDUPE','POSTING_LIVENESS','EMPLOYER_PRIMARY_BUSINESS'],SCOUT_NOTES:'PREVIEW_ONLY; TARGET_PRIORITY='+tier+'; '+flags.join('; ')};
  return {index:i+1,verdict,industry,tier,flags,record,trial_status:j.status||'UNKNOWN'};
 });
 const counts={input:rows.length,writer_submission_count:0};for(const j of rows)counts[j.verdict]=(counts[j.verdict]||0)+1;
 const candidates=rows.filter(x=>x.verdict==='CANDIDATE_REQUIRES_WRITER_CHECK').map(x=>x.record);
 const batches=[];for(let i=0;i<candidates.length;i+=200)batches.push({action:'intake',requestId:runId+'-B'+String(batches.length+1).padStart(2,'0'),run:{SCOUT_RUN_ID:runId,GROSS_FOUND:report.new_roles.length,RUN_STARTED_AT_ET:at},records:candidates.slice(i,i+200)});
 return {mode:'DRY_RUN_ONLY_NO_WRITER_CALLS',canonical_never_consider:'UNVERIFIED_REVIEW_REQUIRED',report_source_run:report.summary?.run||'UNKNOWN',counts,rows,batches};
}
module.exports={adapt,priority,priorityRegistry,loadPriority};
if(require.main===module){(async()=>{const [input,output,runId,registryFile]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node tools/source-intake/preview.js report.json output.json [RUN_ID] [PRIORITY_FILE]');const registry=registryFile?priorityRegistry(fs.readFileSync(registryFile,'utf8')):await loadPriority();const result=adapt(JSON.parse(fs.readFileSync(input,'utf8')),{runId:runId||'FORGE-SOURCE-TRIAL-DRYRUN',targetRegistry:registry});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));})().catch(e=>{console.error('BLOCKED_PRIORITY_REGISTRY: '+e.message);process.exitCode=1;});}
