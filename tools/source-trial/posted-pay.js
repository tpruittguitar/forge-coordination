'use strict';
// Source-bound disclosure, separate from annual USD base salary used for scoring.
const Pay=require('../enrich-ats-pay/pay-values');
const schema='forge.posted-pay.v1';
const number=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(+x)?+x:null;
function identity(c){return {company:c.company||c.COMPANY||'',title:c.title||c.TITLE||'',location:c.location||c.LOCATION||'',sourceUrl:c.url||c.SOURCE_URL||c.sourceUrl||''};}
function samePosting(a,b){if(a===b)return true;try{const U=require('../pipeline-observability/upstream-flow'),x=U.key(a);return !!x&&x===U.key(b);}catch{return false;}}
function bound(p,c){const i=identity(c);return p?.schema===schema&&['company','title','location','sourceUrl'].every(k=>i[k]&&(k==='sourceUrl'?samePosting(p[k],i[k]):p[k]===i[k]));}
function capture(c,{observedAt}={}){
 if(c.postedPay)return bound(c.postedPay,c)?c.postedPay:null;
 const i=identity(c),f=c.payFacts,raw=c.salaryText||c.compensation||c.pay||'';
 if(!Object.values(i).every(Boolean)||!/^https:\/\//.test(i.sourceUrl)||!(raw||f||number(c.min_amount)!==null))return null;
 const source=c.salary_source||c.provenance||c.source||'';
 const estimated=/THIRD_PARTY_ESTIMATE|SALARY_SITE_ESTIMATE|(?:indeed|glassdoor|payscale|salary\.com|site)[ _-]*estimat/i.test(source)||Pay.estimated(source)||c.is_estimated===true||Pay.estimated(raw);
 return {schema,...i,text:String(raw),low:number(f?.low??c.min_amount),high:number(f?.high??c.max_amount),currency:f?.currency||c.currency||null,period:f?.period||c.interval||null,basis:f?.basis||null,status:estimated?'ESTIMATED':'POSTED',observedAt:observedAt||c.observedAt||null,source};
}
function eligible(c){
 const p=c.postedPay,f=c.payFacts;
 if(!bound(p,c)||p.status!=='POSTED'||!Number.isFinite(Date.parse(p.observedAt))||!f||typeof f.low!=='number'||typeof f.high!=='number'||!Number.isFinite(f.low)||!Number.isFinite(f.high)||f.currency!=='USD'||f.period!=='YEAR'||f.basis!=='BASE'||!f.source||p.currency!=='USD'||p.period!=='YEAR'||p.basis!=='BASE'||p.low!==f.low||p.high!==f.high)return null;
 return Pay.values(f.low,f.high)?f:null;
}
function fields(c){const f=eligible(c);return f?{SALARY_BASE_LOW:f.low,SALARY_BASE_HIGH:f.high,SALARY_MIDPOINT:Math.round((f.low+f.high)/2),SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:c.postedPay.sourceUrl,SALARY_ASOF:c.postedPay.observedAt.slice(0,10),SALARY_CONF:'HIGH'}:{};}
function carry(c){const p=c.postedPay;return bound(p,c)?{postedPay:p,...(eligible(c)?{payFacts:c.payFacts}:{}),...(c.pay?{pay:c.pay}:{})}:{};}
module.exports={schema,identity,bound,capture,eligible,fields,carry};

// Only call with an exact posting/card quote, never arbitrary notes or role requirements.
function fromText(card,text,{observedAt,source='EXACT_POSTING_QUOTE'}={}){
 const raw=String(text||''),amount='(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?[kK]?',money='(?:USD\\s*\\$?|US\\$|CAD\\s*\\$?|AUD\\s*\\$?|NZD\\s*\\$?|EUR\\s*€?|GBP\\s*£?|[$€£])',unit='(?:\\/\\s*(?:years?|yrs?|hours?|hrs?|months?|mos?|weeks?|wks?|days?)|(?:per|a|an)\\s+(?:year|hour|month|week|day)|annually|annual|yearly|hourly|monthly|weekly|daily)';
 const re=new RegExp('(?<money1>'+money+')\\s*(?<low>'+amount+')\\s*(?<unit1>'+unit+')?\\s*(?:[-–—]|to)\\s*(?<money2>'+money+')?\\s*(?<high>'+amount+')(?<unit2>\\s*'+unit+')?','gi'),hits=[];
 const numeric=s=>Number(s.replace(/,/g,'').replace(/[kK]$/,''))*(/[kK]$/.test(s)?1000:1),period=s=>/year|yr|annual/i.test(s)?'YEAR':/hour|hr/i.test(s)?'HOUR':/month|mo\b/i.test(s)?'MONTH':/week|wk/i.test(s)?'WEEK':/day|daily/i.test(s)?'DAY':null;
 for(const m of raw.matchAll(re)){
  const tail=raw.slice(m.index+m[0].length);if(/^[\d,]|^\.\d|^\s*(?:\.{2,}|…)|^\s*(?:million|billion|mm?\b)/i.test(tail))continue;
  const g=m.groups,low=numeric(g.low),high=numeric(g.high);if(!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<low)continue;
  const before=raw.slice(0,m.index),breaks=[...before.matchAll(/\n|[.!?]\s+/g)],start=breaks.length?breaks.at(-1).index+breaks.at(-1)[0].length:0,prefix=raw.slice(start,m.index),statement=prefix+m[0]+tail.split(/\n|[.!?](?:\s|$)/)[0],context=prefix+m[0];
  if(/\b(?:budgets?|revenue|sales volume|project costs?|sign.on|signing|bonuses?|equity|stock|total compensation|total cash|on.target earnings|ote|commission)\b/i.test(prefix)||/^\s*(?:including|plus|with)\b[^.\n]{0,60}\b(?:bonus|equity|stock|commission)/i.test(tail))continue;
  const salaryContext=/\b(?:salary|salaries|pay|wage|wages|compensation range)\b/i.test(prefix),standalone=!prefix.replace(/(?:estimated?|est\.)\s*/gi,'').trim()&&!tail.replace(/[.\s]/g,'');
  if(!salaryContext&&!g.unit1&&!g.unit2&&!standalone)continue;
  const currencies=[...context.matchAll(/\b(USD|CAD|AUD|NZD|EUR|GBP)\b|US\$/gi)].map(x=>x[1]?.toUpperCase()||'USD'),periods=[period(g.unit1||''),period(g.unit2||''),period(prefix.match(/\b(?:annual|annually|yearly|hourly|monthly|weekly|daily)\b/i)?.[0]||'')].filter(Boolean);
  const conflicting=new Set(currencies).size>1||new Set(periods).size>1;
  const p=capture({...card,postedPay:null,payFacts:null,pay:'',salaryText:m[0].trim(),min_amount:low,max_amount:high,source,salary_source:Pay.estimated(statement)||Pay.estimated(card.salary_source)||/THIRD_PARTY_ESTIMATE/.test(card.salary_source||'')?'THIRD_PARTY_ESTIMATE':source,is_estimated:card.is_estimated===true||Pay.estimated(statement),currency:currencies[0]||null,interval:periods[0]||null},{observedAt});if(!p)continue;
  p.basis=/\bbase (?:salary|pay)\b/i.test(context)?'BASE':null;if(conflicting){p.status='AMBIGUOUS';p.low=p.high=p.currency=p.period=null;}hits.push(p);
 }
 if(!hits.length)return null;
 const unique=new Map(hits.map(p=>[JSON.stringify([p.low,p.high,p.currency,p.period,p.basis,p.status]),p]));
 if(unique.size===1)return hits[0];
 return {...hits[0],text:hits.map(p=>p.text).join('\n'),low:null,high:null,currency:null,period:null,basis:null,status:'AMBIGUOUS'};
}
function fromSaved(card,{observedAt}={}){
 if(card.postedPay&&bound(card.postedPay,card))return card.postedPay;
 const i=identity(card),quotes=[];
 for(const e of card.sourcePayEvidence||[])if(samePosting(e.sourceUrl,i.sourceUrl)&&typeof e.quote==='string')quotes.push({text:e.quote,at:e.observedAt,source:/ESTIMAT/i.test(e.classification||'')?'THIRD_PARTY_ESTIMATE':'EXACT_SOURCE_QUOTE'});
 const screens=[card.preliminaryScreen,card.discoveryReview?.preliminaryScreen];
 for(const s of screens){if(s?.schema!=='forge.discovery-preliminary-screen.v1'||s.ats?.schema!=='forge.resume-overlap.v1'||s.ats.contentBasis!=='TITLE_AND_ROLE_CONTENT'||s.neverConsider?.sourceUrl&&!samePosting(s.neverConsider.sourceUrl,i.sourceUrl))continue;for(const m of s.ats.matches||[])for(const q of [...(Array.isArray(m.postingQuotes)?m.postingQuotes:[]),...(typeof m.postingQuote==='string'?[m.postingQuote]:[])])if(typeof q==='string')quotes.push({text:q,at:s.sourceObservedAt||card.observedAt||observedAt||card.firstSeen,source:'SAVED_POSTING_EXCERPT'});}
 const original=card.discoveryReview?.contentBasis==='EXACT_ORIGINAL_ALERT_CARD',sourcePosting=/^(?:BOARD:|JOBSPY:|HIRINGCAFE$)/.test(card.source||'');
 if((original||sourcePosting)&&typeof card.description==='string')quotes.push({text:card.description,at:card.observedAt||observedAt||card.firstSeen,source:original?'EXACT_ORIGINAL_ALERT_CARD':'SAVED_POSTING_DESCRIPTION'});
 const parsed=quotes.map(q=>fromText(card,q.text,{observedAt:q.at||observedAt||card.observedAt,source:q.source})).filter(Boolean);if(!parsed.length)return null;
 const unique=new Set(parsed.map(p=>JSON.stringify([p.low,p.high,p.currency,p.period,p.basis,p.status])));if(unique.size===1)return parsed[0];
 return {...parsed[0],text:[...new Set(parsed.map(p=>p.text))].join('\n'),low:null,high:null,currency:null,period:null,basis:null,status:'AMBIGUOUS'};
}
module.exports.fromText=fromText;module.exports.fromSaved=fromSaved;
