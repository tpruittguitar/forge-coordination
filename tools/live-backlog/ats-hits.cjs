'use strict';
// Display existing discovery evidence only. Never run a matcher, read Writer, or
// turn observed competency overlap into a percentage or eligibility decision.
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const strings=value=>Array.isArray(value)&&value.length>0&&value.every(s=>typeof s==='string'&&s.trim());
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function display(item){
 // The current ledger screen is authoritative when present. An incomplete or
 // failed current screen must not be replaced by an older discovery success.
 const screen=item.preliminaryScreen??item.discoveryReview?.preliminaryScreen;
 const unavailable=basis=>({atsHits:null,atsTerms:null,atsBasis:basis,atsEvidence:'',atsCheckedAt:null,atsResumeVersion:null});
 if(screen!=null&&(typeof screen!=='object'||Array.isArray(screen)))return unavailable('Saved evidence unavailable');
 const ats=screen?screen.ats:item.discoveryReview?.resumeMatch;
 if(!ats)return unavailable('Not recorded');
 if(ats.status==='RESUME_UPDATE_REQUIRED')return unavailable('Resume update required');
 if(ats.status==='RESUME_UNAVAILABLE')return unavailable('Resume unavailable');
 if(ats.schema!=='forge.resume-overlap.v1'||ats.method!=='OBSERVED_TERM_OVERLAP_WITH_RESUME_SUPPORTED_COMPETENCIES'||ats.finalFit!==false||ats.automaticRejection!==false||!hash(ats.resumeTextSha256)||!date(ats.resumeVersion)||!Array.isArray(ats.matches)||!['TITLE_ONLY','TITLE_AND_ROLE_CONTENT'].includes(ats.contentBasis)||ats.status&&!['PRELIMINARY_OVERLAP','ROLE_CONTENT_PENDING'].includes(ats.status))return unavailable('Saved evidence unavailable');
 const ids=new Set();
 for(const m of ats.matches){if(!m||typeof m.competencyId!=='string'||!m.competencyId.trim()||!hash(m.resumeEvidenceSha256)||!strings(m.postingTerms)||!strings(m.postingQuotes))return unavailable('Saved evidence incomplete');ids.add(m.competencyId);}
 // Terms come only from saved postingTerms, never competency names or excerpts.
 // The matcher caps saved excerpts; the complete saved term list is independent.
 const terms=new Map();
 for(const m of ats.matches)for(const term of m.postingTerms){const key=term.trim().normalize('NFC').toLowerCase();if(!terms.has(key))terms.set(key,term.trim());}
 const checked=screen?screen.checkedAt:item.discoveryReview?.observedAt;
 const titleOnly=ats.contentBasis==='TITLE_ONLY'||ats.status==='ROLE_CONTENT_PENDING';
 const gate=screen?.atsGate,sourceBasis=gate?.contentBasis||item.discoveryReview?.contentBasis;
 const screened=gate?.schema==='forge.discovery-ats-gate.v1'&&['PASS','EXCLUDE'].includes(gate.status)&&sourceBasis==='CAPTURED_ROLE_CONTENT';
 const snippet=sourceBasis&&sourceBasis!=='CAPTURED_ROLE_CONTENT'&&sourceBasis!=='TITLE_ONLY';
 const basis=titleOnly?'Title only':screened?'Role content screened':snippet?'Source snippet':'Captured content (extent unverified)';
 const evidence=ats.matches.map(m=>m.competencyId.replaceAll('_',' ')+': '+m.postingTerms.join(', ')+'\n'+m.postingQuotes.join('\n')).join('\n\n');
 return {atsHits:ids.size,atsTerms:[...terms.values()],atsBasis:basis,atsEvidence:evidence||(screened?'No resume-supported competency matches observed in screened role content.':'No resume-supported competency matches observed. Insufficient evidence of a complete job-description check; this is not a screened-out job.'),atsCheckedAt:date(checked)?checked:null,atsResumeVersion:ats.resumeVersion};
}
module.exports={display};
