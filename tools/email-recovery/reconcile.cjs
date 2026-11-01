'use strict';
const crypto=require('node:crypto'),L=require('./ledger.cjs');
const E=require('./employer-identity.cjs');
const terminal=new Set(['VERIFIED_INSERTED','VERIFIED_EXISTING','OUT_OF_SCOPE','EXCLUDED_BY_WRITER']);
const n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const companyKey=x=>n(String(x||'').toLowerCase().replace(/&amp;|&/g,' and ').replace(/\b(inc|llc|corp|corporation|company|ltd|limited)\b/g,' '));
const titleKey=x=>n(String(x||'').toLowerCase().replace(/&amp;|&/g,' and ').replace(/\bsr\b/g,'senior').replace(/\bjr\b/g,'junior'));
// These are presentation differences, not permission to equate nearby cities,
// remote regions, multi-site postings, employer aliases or different seniority.
function locationKey(x){return n(String(x||'').replace(/\s*\((?:on-site|hybrid|remote)\)\s*$/i,'').replace(/,?\s*(?:United States(?: of America)?|USA)\s*$/i,''));}
// Consume captured identities already present in canonical storage. No writes,
// fuzzy matches, reopening terminal dispositions, or invented source coverage.
function reconcile(ledger,{masterText,archiveText,at,proof,appliedRepeatRule=false,decidedRepeatRule=false}){
 if(!/^END V2_CURRENT_POPULATION_MASTER(?:\s|$)/m.test(masterText)||typeof archiveText!=='string'||!Number.isFinite(Date.parse(at))||!proof)throw Error('Complete fresh canonical evidence required');
 const R=require('../source-intake/writer-reader');R.parseMaster(masterText);
 const lines=[...masterText.split(/\r?\n/).filter(l=>/^\d+ \| V2[A-Z]-/.test(l)),...R.parseArchive(archiveText).map(r=>r.RAW_ROW)],resolved=[];
 const byRole=new Map(),byId=new Map();for(const line of lines){const c=line.split(' | '),role=companyKey(c[2])+'|'+titleKey(c[3]);if(!byRole.has(role))byRole.set(role,[]);byRole.get(role).push(line);if(!byId.has(c[1]))byId.set(c[1],[]);byId.get(c[1]).push(line);}
 // Reuse a prior verified alias binding, not a second master or a speculative
 // company/title match. Conflicting bindings are deliberately not selected.
 const known=new Map(),bindingKey=j=>[E.evidence(j),companyKey(j.company),titleKey(j.title)].join('|');
 for(const peer of Object.values(ledger.jobs))if(['VERIFIED_EXISTING','VERIFIED_INSERTED'].includes(peer.status)&&E.evidence(peer)&&peer.disposition?.primaryId&&peer.disposition?.proof){const key=bindingKey(peer);if(!known.has(key))known.set(key,new Set());known.get(key).add(peer.disposition.primaryId);}
 for(const j of Object.values(ledger.jobs)){
  const rejected=j.status==='HELD_WRITER_REVIEW'&&j.disposition?.batchStatus==='COMPLETE'&&j.disposition?.originalCandidateOutcome==='WRITE_FAILED';
  if(terminal.has(j.status)||['POST_IN_FLIGHT_UNKNOWN','SUBMITTED'].includes(j.status)||(j.status==='HELD_WRITER_REVIEW'&&!rejected))continue;
  const employerKey=E.evidence(j);
  const cached=employerKey&&known.get(bindingKey(j)),cachedId=cached?.size===1?[...cached][0]:null;
  const roleRows=byRole.get(companyKey(j.company)+'|'+titleKey(j.title))||[];
  const hits=(cachedId?(byId.get(cachedId)||[]):roleRows).filter(line=>{const c=line.split(' | ');if(cachedId===c[1])return true;if(companyKey(c[2])!==companyKey(j.company)||titleKey(c[3])!==titleKey(j.title))return false;
   if(employerKey&&(line.match(/https:\/\/[^\s"<>|;]+/g)||[]).some(url=>E.key(url)===employerKey))return true;
   return locationKey(c[8])===locationKey(j.location)&&new RegExp('linkedin\\.com/(?:comm/)?jobs/view/'+j.jobId+'(?:[/;?\\s]|$)').test(line);});
  let decidedRepeat=false;
  if(hits.length!==1&&(appliedRepeatRule||decidedRepeatRule)){
   // Tim 2026-11-01: close matching applied repeats unless proven different.
   // Keep different known sites/requisitions and multiple canonical hits explicit.
   const repeats=roleRows.filter(line=>{const c=line.split(' | ');if(!(c[4]==='APPLIED'||decidedRepeatRule&&c[4]==='DECLINED_BY_TIM')||companyKey(c[2])!==companyKey(j.company)||titleKey(c[3])!==titleKey(j.title))return false;
    const oldSite=locationKey(c[8]),newSite=locationKey(j.location),unknown=x=>!x||/^(notstated|unknown|uncaptured)$/.test(x);
    if(!unknown(oldSite)&&oldSite!==newSite)return false;
    const oldPosting=(line.match(/https:\/\/[^\s"<>|;]+/g)||[]).map(E.key).filter(Boolean);
    if(employerKey&&oldPosting.length&&!oldPosting.includes(employerKey))return false;
    // A saved employer requisition without a parsed ATS URL is still evidence.
    // Do not let a title-only repeat rule erase that possible contradiction.
    const req=(line.match(/(?:^|;\s*)REQ_ID=([^;]+)/)?.[1]||c[7]||'').trim(),boardIds=[...line.matchAll(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/g)].map(m=>m[1]);
    if(employerKey&&!oldPosting.length&&req&&!/^(?:LI|LINKEDIN)\d+$|^(?:UNKNOWN|UNCAPTURED|NOT_STATED|-)$/.test(req)&&!boardIds.includes(req))return false;
    return true;});
   if(repeats.length===1){hits.splice(0,hits.length,repeats[0]);decidedRepeat=true;}
  }
  if(hits.length!==1)continue;
  const line=hits[0],primaryId=line.split(' | ')[1],rowSha256=crypto.createHash('sha256').update(line).digest('hex');
  L.disposition(ledger,j.key,'VERIFIED_EXISTING',{proof,reason:decidedRepeat?'Tim repeat directive: unique decided company/title and compatible or missing site, without contradictory employer posting; preserve saved decision; no submission':cachedId?'Prior verified employer-posting alias binding reused; exact bound canonical primary ID is present in fresh master/archive; no submission':'Unique exact posting identity plus company/title found in fresh canonical master/archive; location labels may differ only when the employer posting is identical; no submission',primaryId,exactRowVerified:true,at,rowSha256,...(employerKey?{employerKey}: {}),...(cachedId?{bindingProofs:Object.values(ledger.jobs).filter(p=>['VERIFIED_EXISTING','VERIFIED_INSERTED'].includes(p.status)&&bindingKey(p)===bindingKey(j)&&p.disposition?.primaryId===cachedId).map(p=>p.disposition.proof)}:{})});
  resolved.push({key:j.key,primaryId,rowSha256});
 }
 ledger.lastCanonicalReconciliationAt=at;
 ledger.at=Date.parse(ledger.at||0)>Date.parse(at)?ledger.at:at;
 return {at,writerSubmissions:0,resolved,remaining:L.summary(ledger)};
}
module.exports={reconcile,locationKey};
