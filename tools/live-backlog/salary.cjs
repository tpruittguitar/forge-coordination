'use strict';
// Read saved discovery pay only. Do not estimate, annualize, convert currencies,
// fetch postings, or join another vacancy by company/title alone.
const {key:sourceKey}=require('../pipeline-observability/upstream-flow');
const PostedPay=require('../source-trial/posted-pay'),Pay=require('../enrich-ats-pay/pay-values');
const REPORTS=['state/source-trial-report.json','state/board-discovery-report.json'];
const norm=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase():'';
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const identity=row=>[norm(row.company),norm(row.title),norm(row.location)];
const periods={YEAR:'year',YEARLY:'year',ANNUAL:'year',ANNUALLY:'year',MONTH:'month',MONTHLY:'month',WEEK:'week',WEEKLY:'week',DAY:'day',DAILY:'day',HOUR:'hour',HOURLY:'hour'};
const empty=basis=>({salaryRange:null,salaryUpperBound:null,salaryBasis:basis,salaryCurrency:null,salaryPeriod:null,salarySource:null,salaryObservedAt:null,salaryEvidence:null});
function savedIndex(read){
 const index=new Map();
 for(const path of REPORTS){
  let report;try{report=JSON.parse(read(path));}catch{continue;}
  if(!validDate(report?.summary?.at))continue;
  for(const field of ['new_roles','existing_roles','protected_roles','identity_held_roles'])for(const row of Array.isArray(report[field])?report[field]:[]){
   if(!row||typeof row!=='object')continue;
   const key=sourceKey(row.url),ids=identity(row);if(!key||ids.some(x=>!x))continue;
   const id=JSON.stringify([key,...ids]);if(!index.has(id))index.set(id,[]);
   index.get(id).push({pay:row.pay,postedPay:row.postedPay||PostedPay.capture(row,{observedAt:report.summary.at}),source:typeof row.source==='string'?row.source:'Discovery report',path,at:report.summary.at});
  }
 }
 return index;
}
function structured(pay){
 if(!pay||typeof pay!=='object'||Array.isArray(pay))return null;
 const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 const low=pay.low,high=pay.high;if(!valid(low)||!valid(high)||high<low)return null;
 // Explicit metadata only. Old discovery facts omit currency/period; a dollar
 // symbol, location or plausible amount is not proof of either.
 const currency=typeof pay.currency==='string'&&/^[A-Z]{3}$/.test(pay.currency)?pay.currency:null;
 const period=typeof pay.period==='string'?periods[pay.period.toUpperCase()]||null:null;
 const amount=n=>n.toLocaleString('en-US',{maximumFractionDigits:20});
 return {salaryUpperBound:high,salaryRange:(currency?currency+' ':'')+amount(low)+(low===high?'':'–'+amount(high))+(period?' / '+period:''),salaryCurrency:currency,salaryPeriod:period,salaryEvidence:typeof pay.quote==='string'?pay.quote:null};
}
function postingDisplay(item,p,source){
 if(!p||p.schema!==PostedPay.schema||!['POSTED','ESTIMATED'].includes(p.status)||!validDate(p.observedAt)||sourceKey(p.sourceUrl)!==item.key||identity(item).some((value,n)=>!value||value!==identity(p)[n]))return null;
 const values=structured(p),raw=typeof p.text==='string'&&p.text.length<=500&&/[0-9]/.test(p.text)?p.text.trim():null;
 if(!values&&!raw)return null;
 const currency=typeof p.currency==='string'&&/^[A-Z]{3}$/.test(p.currency)?p.currency:null;
 const period=typeof p.period==='string'?periods[p.period.toUpperCase()]||null:null;
 const literal=raw&&PostedPay.fromText(item,raw,{observedAt:p.observedAt});
 const range=!currency&&literal&&literal.low===p.low&&literal.high===p.high?literal.text:values?.salaryRange||raw;
 return {...empty(p.status==='ESTIMATED'?'Estimated salary range':'Posted salary range'),salaryCurrency:currency,salaryPeriod:period,...values,salaryRange:range,salarySource:source||p.sourceUrl,salaryObservedAt:p.observedAt,salaryEvidence:raw};
}
function display(item,index=new Map()){
 const facts=item.discoveredFacts,p=item.postedPay||facts?.postedPay;
 if(p)return p.status==='AMBIGUOUS'?empty('Conflicting saved ranges'):postingDisplay(item,p)||empty('Saved pay evidence unavailable');
 if(facts?.pay!=null){
  const ref=(Array.isArray(item.evidenceRefs)?item.evidenceRefs:[]).find(ref=>ref?.path===facts.sourceRef&&/^state\/discovery-evidence\/[a-f0-9]{64}\.json$/.test(ref.path)&&ref.path.endsWith(ref.sha256+'.json'));
  const value=structured(facts.pay);
  if(!value||facts.fullPosting!==true||!ref||!validDate(facts.observedAt))return empty('Saved pay evidence unavailable');
  return {...empty('Posted salary range'),...value,salarySource:facts.sourceRef,salaryObservedAt:facts.observedAt};
 }
 const saved=PostedPay.fromSaved(item);
 if(saved)return saved.status==='AMBIGUOUS'?empty('Conflicting saved ranges'):postingDisplay(item,saved)||empty('Saved pay evidence unavailable');
 const ids=identity(item);if(ids.some(x=>!x))return empty('Not recorded');
 const records=index.get(JSON.stringify([item.key,...ids]))||[];
 if(!records.length)return empty(facts?.payAmbiguous===true?'Ambiguous saved pay':'Not recorded');
 const latest=Math.max(...records.map(r=>Date.parse(r.at))),current=records.filter(r=>Date.parse(r.at)===latest);
 const distinct=new Set(current.map(r=>JSON.stringify([r.pay??null,r.postedPay??null])));
 if(distinct.size!==1)return empty('Conflicting saved ranges');
 const record=current[0],pay=record.pay;
 const posted=postingDisplay(item,record.postedPay,record.source+' · '+record.path);if(posted)return posted;
 if(pay==null||pay==='')return empty('Not recorded in latest source');
 // Legacy reports store rounded display strings and lose their currency code,
 // pay period and base/total distinction. Preserve them verbatim, with a caveat.
 if(typeof pay!=='string'||pay.length>500||!/[0-9]/.test(pay)||Pay.estimated(pay))return empty('Saved pay evidence unavailable');
 return {...empty('Posted salary range'),salaryRange:pay.trim(),salarySource:record.source+' · '+record.path,salaryObservedAt:record.at};
}
module.exports={savedIndex,display,structured,postingDisplay,REPORTS};
