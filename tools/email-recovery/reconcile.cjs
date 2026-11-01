'use strict';
const crypto=require('node:crypto'),L=require('./ledger.cjs');
const E=require('./employer-identity.cjs');
const terminal=new Set(['VERIFIED_INSERTED','VERIFIED_EXISTING','OUT_OF_SCOPE','EXCLUDED_BY_WRITER']);
const n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
// These are presentation differences, not permission to equate nearby cities,
// remote regions, multi-site postings, employer aliases or different seniority.
function locationKey(x){return n(String(x||'').replace(/\s*\((?:on-site|hybrid|remote)\)\s*$/i,'').replace(/,?\s*(?:United States(?: of America)?|USA)\s*$/i,''));}
// Consume captured identities already present in canonical storage. No writes,
// fuzzy matches, reopening terminal dispositions, or invented source coverage.
function reconcile(ledger,{masterText,archiveText,at,proof}){
 if(!/^END V2_CURRENT_POPULATION_MASTER(?:\s|$)/m.test(masterText)||typeof archiveText!=='string'||!Number.isFinite(Date.parse(at))||!proof)throw Error('Complete fresh canonical evidence required');
 const R=require('../source-intake/writer-reader');R.parseMaster(masterText);
 const lines=[...masterText.split(/\r?\n/).filter(l=>/^\d+ \| V2[A-Z]-/.test(l)),...R.parseArchive(archiveText).map(r=>r.RAW_ROW)],resolved=[];
 for(const j of Object.values(ledger.jobs)){
  if(terminal.has(j.status)||['POST_IN_FLIGHT_UNKNOWN','SUBMITTED','HELD_WRITER_REVIEW'].includes(j.status))continue;
  const employerKey=E.evidence(j);
  const hits=lines.filter(line=>{const c=line.split(' | ');if(n(c[2])!==n(j.company)||n(c[3])!==n(j.title))return false;
   if(employerKey&&(line.match(/https:\/\/[^\s"<>|;]+/g)||[]).some(url=>E.key(url)===employerKey))return true;
   return locationKey(c[8])===locationKey(j.location)&&new RegExp('linkedin\\.com/(?:comm/)?jobs/view/'+j.jobId+'(?:[/;?\\s]|$)').test(line);});
  if(hits.length!==1)continue;
  const line=hits[0],primaryId=line.split(' | ')[1],rowSha256=crypto.createHash('sha256').update(line).digest('hex');
  L.disposition(ledger,j.key,'VERIFIED_EXISTING',{proof,reason:'Unique exact posting identity plus company/title found in fresh canonical master/archive; location labels may differ only when the employer posting is identical; no submission',primaryId,exactRowVerified:true,at,rowSha256,...(employerKey?{employerKey}: {})});
  resolved.push({key:j.key,primaryId,rowSha256});
 }
 ledger.lastCanonicalReconciliationAt=at;
 return {at,writerSubmissions:0,resolved,remaining:L.summary(ledger)};
}
module.exports={reconcile,locationKey};
