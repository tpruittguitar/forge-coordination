'use strict';
// Step 10: scope screen, one decision for all 5 discovery lanes, with a reason for every drop.
//  a) US: drop only when the location clearly names a place outside the US (unknown places pass).
//  b) Never-Consider title and state rules, read from Tim's canonical rules text (title_any / title_exempt /
//     level_exempt / states / location_exempt keys). Employer-business rules need research and stay with
//     enrichment step 16; they are not applied here.
//  c) Leadership title in Tim's three families (quality, manufacturing/production, manufacturing engineering)
//     with the senior-staff rule (Senior Staff, Staff and Principal engineers count), using the shared
//     source-trial family() so discovery and intake judge titles the same way.
const T=require('../../source-trial/lib');
const Identity=require('../../source-trial/job-identity');
const NON_US=/\b(canada|mexico|india|germany|united kingdom|uk|england|scotland|ireland|france|spain|italy|netherlands|belgium|poland|czech\w*|hungary|romania|sweden|norway|denmark|finland|switzerland|austria|portugal|israel|china|japan|korea|taiwan|singapore|malaysia|vietnam|thailand|philippines|indonesia|australia|new zealand|brazil|argentina|chile|colombia|peru|costa rica|puerto rico|south africa|egypt|uae|united arab emirates|saudi arabia|qatar|turkey|ontario|quebec|british columbia|alberta|manitoba|nova scotia|toronto|montreal|vancouver|calgary|london|berlin|munich|paris|bangalore|bengaluru|pune|hyderabad|chennai|shanghai|shenzhen|beijing|tokyo|seoul|monterrey|guadalajara|tijuana|juarez)\b/i;
const CA_PROV=/,\s*(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE)\b(?!\s*\d)/;
function usCheck(location){
 const st=Identity.usPlace(location);
 if(st)return {us:true,place:st};
 const t=String(location||'');
 if(/\bremote\b/i.test(t)&&/\b(us|u\.s\.?|usa|united states)\b/i.test(t))return {us:true,place:'REMOTE_US'};
 if(NON_US.test(t)||CA_PROV.test(t))return {us:false,place:'NON_US'};
 return {us:null,place:'UNKNOWN'};
}
const words=s=>String(s||'').split('|').map(x=>x.trim()).filter(Boolean);
const wordRe=list=>list.length?new RegExp('\\b(?:'+list.map(w=>w.replace(/[.*+?^${}()[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')).join('|')+')\\b','i'):null;
/** Never-Consider rules with title or state keys, parsed from the canonical rules text. */
function parseRules(text){
 const out=[];
 for(const line of String(text||'').split(/\r?\n/)){
  const m=line.match(/^- (NC-\d{3}) ([A-Z_]+):(.*)$/);if(!m)continue;
  const kv={};for(const k of ['title_any','title_exempt','level_exempt','states','city_any','location_exempt','employer_business_exempt'])
   {const x=m[3].match(new RegExp('\\b'+k+'=([^;]*)'));if(x)kv[k]=x[1].trim();}
  if(!kv.title_any&&!kv.states)continue;
  // Title rules with an employer-business exemption cannot be judged from the title alone.
  if(kv.title_any&&kv.employer_business_exempt)continue;
  out.push({id:m[1],name:m[2],any:wordRe(words(kv.title_any)),exempt:wordRe(words(kv.title_exempt)),levelExempt:wordRe(words(kv.level_exempt)),states:words(kv.states),cities:wordRe(words(kv.city_any)),locationExempt:words(kv.location_exempt)});
 }
 return out;
}
function ncHit(job,rules,place,srStaff){
 const remoteOrMulti=/\bremote\b|multiple locations|multi-location|various locations|\bor\b|;|\//i.test(job.location);
 for(const r of rules){
  if(r.any){
   if(!r.any.test(job.title))continue;
   if(r.exempt&&r.exempt.test(job.title))continue;
   if(r.levelExempt&&r.levelExempt.test(job.title))continue;
   // Senior-staff rule: Senior Staff, Staff and Principal engineers are never declined as individual contributors.
   if(r.id==='NC-020'&&srStaff)continue;
   return r;
  }
  if(r.states.length&&(r.states.includes(place)||r.cities&&r.cities.test(job.location))&&!(remoteOrMulti&&r.locationExempt.length))return r;
 }
 return null;
}
function laneHigh(job){const p=job.facts&&job.facts.LANE_PAY&&job.facts.LANE_PAY.value;if(!p||p.estimated)return 0;return /hour/i.test(p.interval)?p.high*2080:p.high;}
function screen(job,ctx={}){
 const us=usCheck(job.location);
 if(us.us===false)return {status:'DROP',reason:'OUT_OF_SCOPE:NON_US'};
 const fam=T.family(job.title);
 const nc=ncHit(job,ctx.ncRules||[],us.place,!!fam&&T.level(job.title)==='SR_STAFF');
 // NC-023 sends VP-and-up ("Head of" counts) and $250k+ posted base to Tim's review instead of excluding.
 const review=nc&&nc.id==='NC-023'&&(/\b(vp|vice president|svp|evp|chief|head of|head,|president)\b/i.test(job.title)||laneHigh(job)>=250000);
 if(nc&&!review)return {status:'DROP',reason:'NEVER_CONSIDER:'+nc.id+'_'+nc.name};
 if(!fam){
  const asLeader=T.family('Director '+String(job.title||'').replace(/\b(assistant|associate|intern|coordinator|specialist|analyst|technician|administrator)\b/ig,''));
  return {status:'DROP',reason:asLeader?'OUT_OF_SCOPE:NOT_LEADERSHIP_LEVEL':'OUT_OF_SCOPE:NOT_TARGET_FAMILY'};
 }
 const flags=review?{NC_REVIEW_NEEDED:{value:'NC-023_UPPER_MIDWEST_ONSITE',source:'PIPELINE_V2_SCOPE'}}:{};
 return {status:'PASS',reason:'IN_SCOPE:'+fam+':'+T.level(job.title)+(review?':NC-023_REVIEW':''),fields:{...flags,SCOPE_FAMILY:{value:fam,source:'PIPELINE_V2_SCOPE'},SCOPE_LEVEL:{value:T.level(job.title),source:'PIPELINE_V2_SCOPE'},US_PLACE:{value:us.place,source:'PIPELINE_V2_SCOPE'}}};
}
module.exports=screen;module.exports.parseRules=parseRules;module.exports.usCheck=usCheck;
