'use strict';
// Read-only Source Trial -> Writer intake preview. Never sends network requests.
const fs = require('node:fs');
const crypto = require('node:crypto');
const FORBIDDEN = /\b(pharma(?:ceutical)?s?|biopharma|biotech|medical devices?|medtech|hospital|clinical|patients?|food|restaurant|fast food|beverage|dairy|nutrition|snack|bakery)\b/i;
const WRONG_FUNCTION = /\b(accounting|finance|sales|marketing|human resources|talent acquisition|corporate operations|commercial operations|business development|information technology|cybersecurity)\b/i;
const WEST = /,\s*(CA|WA|OR)\b/i;
const STATE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const normUrl = s => { try { const u=new URL(s);return (u.hostname+u.pathname).toLowerCase().replace(/\/$/,''); } catch{return norm(s);} };
const req = u => { const s=String(u||'');return (s.match(/(?:\/jobs\/|\/job\/|gh_jid=)([a-z0-9-]{7,})/i)||[])[1]||''; };
const key = j => [norm(j.company),norm(j.title),norm(j.location)].join('|');
function classify(j,known) {
  const text=[j.company,j.title].join(' ');
  if (j.status && j.status!=='NEW') return 'EXISTING_OR_PROTECTED';
  if (FORBIDDEN.test(text)) return 'EXCLUDED_INDUSTRY_PROVISIONAL';
  if (WRONG_FUNCTION.test(j.title)) return 'WRONG_FUNCTION';
  if (!j.company || !j.title || !j.url) return 'MISSING_IDENTITY';
  const url=normUrl(j.url),k=key(j),id=req(j.url);
  if (known.urls.has(url)||known.keys.has(k)|| (id&&known.req.has(norm(j.company)+'|'+id))) return 'DUPLICATE_IN_REPORT';
  known.urls.add(url);known.keys.add(k);if(id)known.req.add(norm(j.company)+'|'+id);
  if (WEST.test(j.location||'')) return 'GEOGRAPHY_PAY_REVIEW';
  return 'CANDIDATE_REQUIRES_WRITER_CHECK';
}
function adapt(report,{runId='FORGE-SOURCE-TRIAL-DRYRUN',discoveredAt='UNKNOWN'}={}) {
  if(!Array.isArray(report.new_roles))throw Error('new_roles must be array');
  if(!/^[A-Z0-9_-]+$/.test(runId))throw Error('invalid runId');
  const known={urls:new Set(),keys:new Set(),req:new Set()};
  const rows=report.new_roles.map((j,i)=>{
    const verdict=classify(j,known), id=req(j.url);
    const record={COMPANY:j.company||'',TITLE:j.title||'',LOCATION:j.location||'',SOURCE_URL:j.url||'',SOURCE_PROVIDER:j.source||'Source Trial',REQ_ID:id,DISCOVERED_AT_ET:discoveredAt,DISCOVERY_SOURCE:'GitHub source-trial',IDENTITY_CONFIDENCE:id?'HIGH':'UNKNOWN',INITIAL_UNKNOWN_FIELDS:['PAY','DEGREE','FLEX','LIVE_WRITER_DEDUPE','POSTING_LIVENESS']};
    return {index:i+1,verdict,record,trial_status:j.status||'UNKNOWN'};
  });
  const stats=Object.fromEntries([...new Set(rows.map(x=>x.verdict))].map(k=>[k,rows.filter(x=>x.verdict===k).length]));
  const eligible=rows.filter(x=>x.verdict==='CANDIDATE_REQUIRES_WRITER_CHECK').map(x=>x.record);
  const batches=[];for(let i=0;i<eligible.length;i+=200)batches.push({action:'intake',requestId:runId+'-B'+String(batches.length+1).padStart(2,'0'),run:{SCOUT_RUN_ID:runId,GROSS_FOUND:report.new_roles.length,RUN_STARTED_AT_ET:discoveredAt},records:eligible.slice(i,i+200)});
  return {mode:'DRY_RUN_ONLY_NO_WRITER_CALLS',report_source_run:report.summary?.run||'UNKNOWN',counts:{input:rows.length,...stats,writer_submission_count:0},rows,batches};
}
module.exports={adapt,classify,normUrl,key,req};
if(require.main===module){
 const [input,output,runId] = process.argv.slice(2);
 if(!input||!output) {console.error('Usage: node tools/source-intake/preview.js report.json output.json [SCOUT_RUN_ID]');process.exit(2);}
 const v=adapt(JSON.parse(fs.readFileSync(input,'utf8')),{runId:runId||'FORGE-SOURCE-TRIAL-DRYRUN',discoveredAt:new Date().toISOString()});
 fs.writeFileSync(output,JSON.stringify(v,null,2)+'\n');console.log(JSON.stringify(v.counts)); 
}