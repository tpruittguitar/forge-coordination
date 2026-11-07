'use strict';
// Discovery evidence only. No canonical writes, final fit score, or rejection on missing facts.
const crypto=require('node:crypto'),Resume=require('./resume-match'),Source=require('../programmed-coordinator/source.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const protectedBusiness=/\b(suppliers?|supplies|serving|serves|customers?|for the|to the|machinery|machines?|tooling|equipment for|equipment makers?|equipment manufacturers?|packaging equipment|process equipment|machine builders?|automation|integrators?|integration|consulting|consultancy|software|logistics|components?|engineering firms?|contract engineering|vendors?)\b/i;
// Producing packaging or machinery for a category is not producing that category's
// products. This is a supplier carveout, never evidence of an exclusion.
const industryInputs=/\b(?:food|beverage|medical|surgical|diagnostic|pharmaceutical|drug|restaurants?|catering|food.service)(?:\s+[a-z-]+){0,3}\s+(?:packaging|machines?|machinery|components?|tooling|equipment)\b|\b(?:packaging|machines?|machinery|components?|tooling|equipment)(?:\s+(?:manufacturers?|makers?|suppliers?|products?))?\s+(?:for|to|serving)\s+(?:the\s+)?(?:restaurants?|caterers?|food.service)\b/i;
const categories={
 PHARMACEUTICAL_MANUFACTURER:/\b(?:pharmaceutical|drug)\s+(?:development|manufacturer|manufacturing|production|developer)|\b(?:manufacture|produce|develop)\s+(?:pharmaceuticals|drugs|medicines)\b/i,
 MEDICAL_DEVICE_MANUFACTURER:/\b(?:medical|surgical|diagnostic)\s+devices?\b/i,
 FOOD_OR_BEVERAGE_MANUFACTURER:/\b(?:food|beverage)\s+(?:manufacturer|manufacturing|producer|production|processing)|\b(?:manufacture|produce|process)\s+(?:food|beverages)\b/i,
 RESTAURANT_OR_FOOD_SERVICE:/\b(?:restaurants?|fast.food|quick.service|catering|food.service)\b/i
};
async function context({key,reader=require('../source-intake/writer-reader').read,profile}={}){
 if(profile===undefined)try{profile=Resume.load();}catch{}
 const answers=await Promise.allSettled(['rules','documents'].map(action=>reader(action,{key})));
 const rules=answers[0].status==='fulfilled'?answers[0].value.data.rules:null;
 const documents=answers[1].status==='fulfilled'?answers[1].value.data:null;
 return {profile,rules,documents,checkedAt:new Date().toISOString()};
}
function screen(card,{profile,rules,documents,checkedAt=new Date().toISOString()}={}){
 if(profile===undefined)try{profile=Resume.load();}catch{}
 const text=Source.text(card.description||''),url=card.url||card.SOURCE_URL||'',company=card.company||card.COMPANY||'';
 if(!Resume.valid(profile))profile=null;
 const inventory=Array.isArray(documents?.resumes)&&documents.resumes.every(r=>r&&typeof r.id==='string'&&Number.isFinite(Date.parse(r.modifiedTime)));
 const unresolved=[],newer=profile&&inventory&&documents.resumes.some(r=>Date.parse(r.modifiedTime)>Date.parse(profile.source.modifiedAt)||r.id===profile.source.fileId&&Date.parse(r.modifiedTime)!==Date.parse(profile.source.modifiedAt));
 let ats;
 if(!profile||newer){ats={status:profile?'RESUME_UPDATE_REQUIRED':'RESUME_UNAVAILABLE',matches:[],finalFit:false,automaticRejection:false};unresolved.push(ats.status);}
 else{ats={...Resume.match({title:card.title||card.TITLE,description:text},profile),status:!text?'ROLE_CONTENT_PENDING':'PRELIMINARY_OVERLAP',resumeAuthority:profile.source.authority};if(!inventory)unresolved.push('LATEST_RESUME_INVENTORY_UNVERIFIED');}
 const active=rules?.status==='ACTIVE'&&typeof rules.raw==='string'&&rules.raw.length>0;
 const nc={status:active?'NO_CONFIRMED_EXCLUSION':'RULES_UNAVAILABLE',rulesSha256:active?hash(rules.raw):null,ruleId:null,quote:null,sourceUrl:url,sourceSha256:text?hash(text):null,canonicalEligibility:false};
 // An employer's own explicit business statement is required. Job title, employer name,
 // industry customers, missing ATS terms and an agency's unnamed client cannot exclude.
 const escaped=company.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const self=new RegExp('^(?:we (?:are|manufacture|produce|develop|operate)|'+(escaped?escaped+' (?:is|manufactures|produces|develops|operates)':'(?!)')+')\\b','i');
 const verb=new RegExp('^(?:we|'+(escaped||'(?!)')+') (?:manufacture|manufactures|produce|produces|develop|develops|operate|operates)\\b','i');
 const statements=text.split(/\n|(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>self.test(x));
 const quotes=statements.filter(x=>(/\b(?:manufacturer|producer|developer|manufacturing company|development company|restaurants?|caterer|food.service operator)\b/i.test(x)||verb.test(x))&&!(/\b(?:not|no longer|our client|on behalf|recruiting|staffing agency|seeking|hiring|looking for|searching for|partner with|partnering with|proud to|supporting)\b/i.test(x)));
 if(active&&/^https:\/\//.test(url)&&company){
  for(const rule of rules.rules||[]){if(!rule.active||rule.ACTION!=='DO_NOT_ADD'||!categories[rule.CATEGORY])continue;
   const definition=require('./never-consider-patterns.json').rules.find(r=>r.id===rule.RULE_ID&&r.category===rule.CATEGORY&&r.matchSha256===hash(rule.MATCH||''));
   if(!definition){nc.status='REVIEW_RULE_CHANGED';continue;}
   const quote=quotes.find(q=>categories[rule.CATEGORY].test(q));if(!quote)continue;
   nc.status=protectedBusiness.test(statements.join(' '))||industryInputs.test(quote)?'REVIEW_PROTECTED_SUPPLIER':'EXCLUDE';nc.ruleId=rule.RULE_ID;nc.quote=quote;nc.confidence=nc.status==='EXCLUDE'?'HIGH':'REVIEW';break;
  }
 }
 if(!active)unresolved.push('CANONICAL_RULES_NOT_VERIFIED');
 if(!quotes.length)unresolved.push('EMPLOYER_BUSINESS_NOT_REVIEWED');
 const atsGate=gate(card,{text,ats,inventory:inventory&&profile&&documents.resumes.some(r=>r.id===profile.source.fileId&&Date.parse(r.modifiedTime)===Date.parse(profile.source.modifiedAt))});
 return {schema:'forge.discovery-preliminary-screen.v1',checkedAt,ats,atsGate,neverConsider:nc,unresolved,decision:nc.status==='EXCLUDE'?'EXCLUDE_NEVER_CONSIDER':atsGate.status==='EXCLUDE'?'EXCLUDE_ATS_ZERO':'PROGRESS_TO_INTAKE',finalFit:false,canonicalWrites:0};
}
// A negative decision needs actual role content, not a title, pay card, selected
// matching quotes or an access-error page. Reuse the existing posting parser's
// 300-character completeness floor. This gate never fetches or calls a model.
function gate(card,{text,ats,inventory}){
 const sourceUrl=card.url||card.SOURCE_URL||'',sourceIdentity={company:card.company||card.COMPANY||'',title:card.title||card.TITLE||'',location:card.location||card.LOCATION||''};
 const contentBasis=card.contentBasis||card.discoveryReview?.contentBasis||(text?'CAPTURED_ROLE_CONTENT':'TITLE_ONLY');
 let reason=null;
 if(ats.status==='RESUME_UNAVAILABLE'||ats.status==='RESUME_UPDATE_REQUIRED')reason=ats.status;
 else if(!inventory)reason='LATEST_RESUME_INVENTORY_UNVERIFIED';
 else if(!sourceIdentity.company||!sourceIdentity.title||!/^https:\/\//.test(sourceUrl))reason='SOURCE_IDENTITY_UNAVAILABLE';
 else if(!text)reason='ROLE_CONTENT_UNAVAILABLE';
 else if(contentBasis!=='CAPTURED_ROLE_CONTENT'||card.discoveryReview?.fullPosting===false)reason='ROLE_CONTENT_INCOMPLETE';
 else if(text.length<300||Source.norm(text)===Source.norm(card.title||card.TITLE)||/captcha|sign in to view|verify you are human|access denied|enable javascript/i.test(text))reason='ROLE_CONTENT_INCOMPLETE';
 const hits=reason?null:new Set(ats.matches.map(m=>m.competencyId)).size;
 return {schema:'forge.discovery-ats-gate.v1',status:reason?'UNKNOWN':hits===0?'EXCLUDE':'PASS',hits,reason:reason||(hits===0?'NO_RESUME_COMPETENCY_HITS':'POSITIVE_RESUME_COMPETENCY_HITS'),contentBasis,sourceUrl,sourceIdentity,sourceSha256:text?hash(text):null,resumeTextSha256:ats.resumeTextSha256||null,resumeVersion:ats.resumeVersion||null,canonicalWrites:0};
}
const excluded=s=>['EXCLUDE_NEVER_CONSIDER','EXCLUDE_ATS_ZERO'].includes(s?.decision);
module.exports={context,screen,hash,excluded};
