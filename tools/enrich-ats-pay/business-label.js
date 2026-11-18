'use strict';
// Employer business label (card 6e439fa, Tim's pipeline via President, Nov 18 2026). 91% of active rows have a blank
// EMPLOYER_PRIMARY_BUSINESS, so the employer_business_any never-consider rules (NC-022 ...) and the PAY SAMPLE MATCH
// industry test cannot fire. When the field is blank (or LinkedIn boilerplate) and a saved posting carries a company
// overview, write ONE controlled label, only when exactly one label matches. Never prose: prose that names a customer
// industry ("we serve construction customers") would trip NC-022 on a manufacturer. No AI, no network.
const Context=require('./context');
const CONSTRUCTION=/\b(general contractors?|construction (?:company|companies|firm|contractors?|services company)|(?:civil|site ?work|paving|earthwork|excavation|soil[- ]stabilization|epc) contractors?|soil[- ]stabilization)\b/ig;
const MAKER=/\b(manufactur\w*|fabricat\w*|machining|factory|factories|production plants?)\b/i;
// A construction phrase right after "serve / supply / customers / for ..." describes who the employer sells to, not what it is.
const CUSTOMER_LEAD=/\b(serv\w*|suppl\w*|sell\w*|support\w*|customers?|clients?|partners?|markets?|for|to|with|including)\b[^.]{0,40}$/i;
const BOILERPLATE=/full-time .{0,40}role\b.*\bon linkedin|see responsibilities/i;
const MAX_PER_RUN=100;
function blank(v){const t=String(v||'').trim();return !t||BOILERPLATE.test(t);}
function constructionSelf(text){for(const m of String(text).matchAll(CONSTRUCTION)){if(!CUSTOMER_LEAD.test(text.slice(Math.max(0,m.index-60),m.index)))return true;}return false;}
function label(overview){
 const text=String(overview||'').trim();if(!text)return null;
 const maker=MAKER.test(text),labels=new Set();
 const industry=Context.industryLabel(text);
 // A maker whose only industry hit is a non-maker word (it sells to hospitals, schools ...) is general manufacturing.
 if(industry)labels.add(maker&&Context.NON_MAKER.has(industry)?'GENERAL_MANUFACTURING':industry);
 if(!maker&&constructionSelf(text))labels.add('CONSTRUCTION_CONTRACTOR');
 return labels.size===1?[...labels][0]:null;
}
function plan({rows,requests,saved,active=()=>true,unavailable=new Set(),runId,slots,max=MAX_PER_RUN}){
 const stats={labeled:0,merged:0,added:0,has_business:0,no_overview:0,no_single_label:0,deferred:0,fenced:0,inactive:0,by_label:{}},sample=[];
 for(const r of rows){
  if(stats.labeled>=max)break;
  if(unavailable.has(r.PRIMARY_ID)){stats.fenced++;continue;}
  if(!active(r)){stats.inactive++;continue;}
  if(!blank((r.p||{}).EMPLOYER_PRIMARY_BUSINESS)){stats.has_business++;continue;}
  const overview=Context.companyOverview(saved(r)?.text||'');
  if(!overview){stats.no_overview++;continue;}
  const l=label(overview);if(!l){stats.no_single_label++;continue;}
  const existing=requests.find(q=>q.ruling.primaryId===r.PRIMARY_ID);
  if(!existing&&requests.length>=slots){stats.deferred++;continue;}
  if(existing){existing.ruling.fields.EMPLOYER_PRIMARY_BUSINESS=l;stats.merged++;}
  else{requests.push({action:'ruling',ruling:{requestId:runId+'-BL'+String(stats.added+1).padStart(3,'0'),primaryId:r.PRIMARY_ID,kind:'ENRICH',actor:'ATSBOT',fields:{EMPLOYER_PRIMARY_BUSINESS:l}}});stats.added++;}
  stats.labeled++;stats.by_label[l]=(stats.by_label[l]||0)+1;if(sample.length<5)sample.push({id:r.PRIMARY_ID,label:l});
 }
 return{stats,sample};
}
// Writer readback guard: drop the label when the row gained a real business value meanwhile or its identity changed.
function guard(fields,planned,current){
 if(!('EMPLOYER_PRIMARY_BUSINESS' in fields))return false;
 if(planned&&current&&blank((current.p||{}).EMPLOYER_PRIMARY_BUSINESS)&&['COMPANY','TITLE','LOCATION'].every(k=>planned[k]===current[k]))return false;
 delete fields.EMPLOYER_PRIMARY_BUSINESS;return true;
}
module.exports={label,plan,guard,blank,constructionSelf,MAX_PER_RUN};
