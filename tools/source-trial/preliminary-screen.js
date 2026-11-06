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
 if(!profile)try{profile=Resume.load();}catch{}
 const answers=await Promise.allSettled(['rules','documents'].map(action=>reader(action,{key})));
 const rules=answers[0].status==='fulfilled'?answers[0].value.data.rules:null;
 const documents=answers[1].status==='fulfilled'?answers[1].value.data:null;
 return {profile,rules,documents,checkedAt:new Date().toISOString()};
}
function screen(card,{profile,rules,documents,checkedAt=new Date().toISOString()}={}){
 if(!profile)try{profile=Resume.load();}catch{}
 const text=Source.text(card.description||''),url=card.url||card.SOURCE_URL||'',company=card.company||card.COMPANY||'';
 const unresolved=[],newer=profile&&(documents?.resumes||[]).some(r=>Date.parse(r.modifiedTime)>Date.parse(profile.source.modifiedAt)||r.id===profile.source.fileId&&Date.parse(r.modifiedTime)!==Date.parse(profile.source.modifiedAt));
 let ats;
 if(!profile||newer){ats={status:profile?'RESUME_UPDATE_REQUIRED':'RESUME_UNAVAILABLE',matches:[],finalFit:false,automaticRejection:false};unresolved.push(ats.status);}
 else{ats={...Resume.match({title:card.title||card.TITLE,description:text},profile),status:!text?'ROLE_CONTENT_PENDING':'PRELIMINARY_OVERLAP',resumeAuthority:profile.source.authority};if(!documents)unresolved.push('LATEST_RESUME_INVENTORY_UNVERIFIED');}
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
 return {schema:'forge.discovery-preliminary-screen.v1',checkedAt,ats,neverConsider:nc,unresolved,decision:nc.status==='EXCLUDE'?'EXCLUDE_NEVER_CONSIDER':'PROGRESS_TO_INTAKE',finalFit:false,canonicalWrites:0};
}
module.exports={context,screen,hash};
