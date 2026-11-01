'use strict';
// Read-only audit of saved evidence. Source-search priority is not salary weighting or proof of universal disclosure.
const L=require('./lib'),C=require('./context');
const normalize=s=>String(s||'').toLowerCase().replace(/\b(incorporated|corporation|corp|inc|llc|ltd)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function publicUrl(s){try{const u=new URL(String(s||'').trim());if(u.protocol!=='https:'||u.username||u.password||/google\.(com|usercontent\.com)$|googleapis\.com$|script\.google\.com$/.test(u.hostname))return null;const q=new URLSearchParams();for(const [k,v]of u.searchParams)if(/^(jk|jobId|gh_jid|requisitionId|postingId|currentJobId)$/i.test(k))q.append(k,v);return u.origin+u.pathname+(q.size?'?'+q:'');}catch{return null;}}
function sourceUrl(p){for(const field of [p.SALARY_SOURCE,p.SALARY_EVIDENCE_URL,p.PAY_POSTED]){for(const u of String(field||'').match(/https:\/\/[^\s<>"')]+/g)||[]){const valid=publicUrl(u);if(valid)return valid;}}return null;}
function build(rows,{asOf=new Date().toISOString(),context={}}={}){
 if(!Array.isArray(rows)||!Number.isFinite(Date.parse(asOf)))throw Error('Rows and valid observation timestamp required');
 const groups=new Map(),byId=new Map();for(const r of rows){if(!r.PRIMARY_ID)throw Error('Canonical primary ID required');const prior=byId.get(r.PRIMARY_ID);if(!prior||prior.store==='ARCHIVE'&&r.store==='MASTER')byId.set(r.PRIMARY_ID,r);}
 for(const r of byId.values()){
  const aliases=(context.companies||[]).filter(c=>[c.company,...c.aliases||[]].some(n=>normalize(n)===normalize(r.COMPANY)));
  const company=aliases.length===1?aliases[0].company:r.COMPANY,key=normalize(company),g=groups.get(key)||{company,aliases:new Set(),records:[],identities:new Map()};g.aliases.add(r.COMPANY);g.records.push(r);groups.set(key,g);
  // Exact company/title/location grouping is a conservative distinct-role minimum, not a count of applications/cycles.
  const k=normalize(r.TITLE).replace(/\bsr\b/g,'senior')+'|'+normalize(r.LOCATION),bucket=g.identities.get(k)||[];bucket.push(r);g.identities.set(k,bucket);
 }
 const companies=[];let rawPosted=0,accepted=0,ambiguous=0;
 for(const g of groups.values()){
  const disclosures=[],unknown=new Set();let otherEvidence=0,needsReview=0;
  for(const [identity,rs]of g.identities){
   const candidates=[];for(const r of rs){const p=r.p||{},a=L.postedAnchor(r,p),source=sourceUrl(p);
    if(p.SALARY_BASIS==='EMPLOYER_POSTED')rawPosted++;
    const uncertain=/unconfirmed|not (?:yet )?(?:re-)?verified|not confirmed|binding.{0,15}(?:unclear|unknown)|identity.{0,15}(?:unclear|unknown)/i.test([p.SALARY_SOURCE,p.SALARY_NOTE,p.SALARY_BASIS].join(' '));
    if(a&&source&&!uncertain&&Number.isFinite(Date.parse(a.asOf))&&Date.parse(a.asOf)<=Date.parse(asOf)+86400000&&a.high<=2000000)candidates.push({primaryId:r.PRIMARY_ID,title:r.TITLE,location:r.LOCATION,state:L.stateFrom(r.LOCATION),level:L.level(r.TITLE),function:L.func(r.TITLE),low:a.low,high:a.high,asOf:a.asOf,sourceUrl:source,store:r.store||'UNSPECIFIED',basis:'EMPLOYER_POSTED',evidenceStatus:'SAVED_CANONICAL_DISCLOSURE_NOT_FRESH_PAGE_CHECK'});
    else if(/POSTED|MIRROR|EMPLOYER/i.test(p.SALARY_BASIS||'')&&!/ESTIMAT/i.test(p.SALARY_BASIS||'')){needsReview++;ambiguous++;}
   }
   candidates.sort((a,b)=>Date.parse(b.asOf)-Date.parse(a.asOf)||a.primaryId.localeCompare(b.primaryId));
   if(candidates.length){const latest=candidates[0];if(candidates.some(c=>c.asOf===latest.asOf&&(c.low!==latest.low||c.high!==latest.high))){needsReview++;ambiguous++;unknown.add(identity);}else{disclosures.push(latest);accepted++;}}
   else{unknown.add(identity);if(rs.some(r=>r.p?.SALARY_BASIS))otherEvidence++;}
  }
  if(!disclosures.length&&!['slate auto','scout motors'].includes(normalize(g.company)))continue;
  const strata={};for(const d of disclosures){const k=d.state||'UNKNOWN';strata[k]=(strata[k]||0)+1;}
  const sourceCategory=normalize(g.company)==='insight global'?'STAFFING_RECRUITER':normalize(g.company)==='ladders'?'JOB_BOARD':'EMPLOYER_CANDIDATE';
  companies.push({company:g.company,sourceCategory,aliases:[...g.aliases].sort(),canonicalRecords:g.records.length,masterRecords:g.records.filter(r=>r.store==='MASTER').length,archiveRecords:g.records.filter(r=>r.store==='ARCHIVE').length,distinctRoleLocationMinimum:g.identities.size,documentedDisclosures:disclosures.length,otherOrMissingEvidence:unknown.size,nonqualifyingEvidenceRoles:otherEvidence,recordsNeedingProvenanceReview:needsReview,searchTier:disclosures.length>=3?'REPEATED_DOCUMENTED_SOURCE':disclosures.length?'LIMITED_DOCUMENTED_SOURCE':'REVIEW_REQUIRED',disclosureConsistency:'NOT_ESTIMABLE_FROM_INCOMPLETE_CAPTURE',observedStates:strata,disclosures});
 }
 companies.sort((a,b)=>b.documentedDisclosures-a.documentedDisclosures||a.company.localeCompare(b.company));
 return {schema:'forge.employer-pay-sources.v1',asOf,source:'Authenticated canonical master and terminal archive; saved evidence only',method:{minimumRepeatedDisclosures:3,deduplication:'Primary ID then conservative company/title/location; newest dated source; equal-date range conflicts excluded',denominator:'Distinct saved role/location identities, not a random sample of employer postings',missingData:'Missing/estimated/legacy/mirror evidence is unknown publication behavior, never proof of non-disclosure',use:'Source discovery only. Revalidate exact postings before new canonical salary claims. Do not change salary weights or confidence because an employer is listed.'},summary:{masterRecords:rows.filter(r=>r.store==='MASTER').length,archiveRecords:rows.filter(r=>r.store==='ARCHIVE').length,uniqueCanonicalJobs:byId.size,missingSalaryBasis:[...byId.values()].filter(r=>!r.p?.SALARY_BASIS).length,strictPostedRecords:rawPosted,distinctAcceptedDisclosures:accepted,provenanceReviewRecords:ambiguous,repeatedSourceEmployers:companies.filter(c=>c.searchTier==='REPEATED_DOCUMENTED_SOURCE').length},companies};
}
function sourcesFor(target,profile,context={},now=Date.now()){
 if(profile?.schema!=='forge.employer-pay-sources.v1')return [];
 const age=now-Date.parse(profile.asOf);if(!Number.isFinite(age)||age< -86400000||age>90*86400000)return [];
 const result=[];for(const company of profile.companies){if(company.searchTier!=='REPEATED_DOCUMENTED_SOURCE'||company.sourceCategory!=='EMPLOYER_CANDIDATE')continue;
  const anchors=company.disclosures.filter(d=>L.comparable(target,{title:d.title})).map(d=>({id:d.primaryId,co:company.company,title:d.title,location:d.location,state:d.state,region:L.regionOf(d.location),low:d.low,high:d.high,asOf:d.asOf,sourceUrl:d.sourceUrl}));
  const usable=C.rank({...target,state:L.stateFrom(target.LOCATION)},anchors,context,now);if(usable.length)result.push({company:company.company,compatibleDisclosures:usable.length,sourceUrls:usable.map(a=>a.sourceUrl),candidates:usable,priority:usable[0].weight,scope:'SEARCH_ONLY_NOT_TARGET_PAY'});
 }
 return result.sort((a,b)=>b.priority-a.priority||b.compatibleDisclosures-a.compatibleDisclosures||a.company.localeCompare(b.company));
}
module.exports={build,sourcesFor};
if(require.main===module){const fs=require('fs'),[input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node source-profile.js <private-structured-rows.json> <output.json>');const profile=build(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(output,JSON.stringify(profile,null,2)+'\n');console.log(JSON.stringify(profile.summary));}
