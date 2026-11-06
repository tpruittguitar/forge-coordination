'use strict';
const VERSION='20261106-context-bound-facts-v2';
function values(low,high){low=+low;high=+high;if(!(Number.isFinite(low)&&Number.isFinite(high)&&low>=40000&&high>=low&&high<=2000000))return null;return{low,high,mid:Math.round((low+high)/2),scorePoint:Math.round(low+0.75*(high-low))};}
const annualUnit=s=>/^(?:1\s+)?(?:YEAR|YEARLY|ANNUAL|ANNUALLY|PER-YEAR-SALARY)$/i.test(String(s||''));
const mixed=/\b(?:total compensation|total cash|on.target earnings|ote|(?:includ\w*|compris\w*|consist\w*|plus variable)[^.\n]{0,90}(?:bonuses?|equity|incentives?|commissions?)|hourly|per hour|glassdoor|payscale|salary\.com)\b/i;
function statements(text){return String(text||'').split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(x=>x.trim()).filter(Boolean);}
function scope(lines,n){return lines[n]+(/^(?:this|the) (?:pay |salary )?range\b|^(?:which |this )(?:includes?|comprises?)/i.test(lines[n+1]||'')?' '+lines[n+1]:'');}
function conflicts(text,pay,parse){
 if(!pay||!parse)return false;const lines=statements(text);
 return lines.some((line,n)=>{const p=parse(line);return p&&p.low===pay.low&&p.high===pay.high&&mixed.test(scope(lines,n));});
}
function structured(s){
 if(!s||typeof s!=='object')return null;
 const v=s.value||s,currencies=[s.currency,s.currencyCode,v.currency,v.currencyCode].filter(x=>x!=null&&x!==''),units=[v.unitText,s.interval,s.frequency,s.payFrequency].filter(x=>x!=null&&x!=='');
 if(!currencies.length||currencies.some(x=>x!=='USD')||!units.length||units.some(x=>!annualUnit(x)))return null;
 const labels=[s.compensationType,s.type,s.title,v.compensationType,v.type,v.title].filter(Boolean).join(' ');
 if(/total|bonus|equity|incentive|hour/i.test(labels))return null;
 return values(v.minValue??v.minimum??v.min??v.value,v.maxValue??v.maximum??v.max??v.value);
}
function workday(info){
 // Accept explicit annual USD base salary fields only; no unlabeled compensation totals.
 const xs=[info?.baseSalary,info?.salaryRange,info?.compensation?.baseSalary,info?.compensation?.salaryRange].map(structured).filter(Boolean);
 const distinct=new Map(xs.map(x=>[x.low+'|'+x.high,x]));return distinct.size===1?[...distinct.values()][0]:null;
}
function employerText(text,payFromText,{currency}={}){
 // Caller already verified an exact first-party posting. Employer wording such as
 // "estimated base salary" remains employer-disclosed; it is not a salary-site estimate.
 const t=String(text||''),hits=[],lines=statements(t);
 for(let i=0;i<lines.length;i++){
  const near=scope(lines,i);
  if(!/\bbase (?:salary|pay)(?: range)?\b/i.test(near)||!(/\bUSD\b|US\$/i.test(near)||currency==='USD')||/\b(?:CAD|AUD|NZD|EUR|GBP)\b/i.test(near))continue;
  if(!/\b(?:annual(?:ly)?|per year|a year|yearly)\b|\/\s*(?:yr|year)\b/i.test(near)||mixed.test(near))continue;
  const p=payFromText(near);if(p)hits.push(p);
 }
 const distinct=new Map(hits.map(x=>[x.low+'|'+x.high,x]));return distinct.size===1?[...distinct.values()][0]:null;
}
function range(f){return f?{low:f.low,high:f.high}:null;}
function fact(value,source){return value?{...value,currency:'USD',period:'YEAR',basis:'BASE',source}:null;}
// A validated rejection never falls through to an unlabeled dollar-range match.
function ats(kind,j,{id,text='',payFromText}={}){
 let candidates=[],declared=false;
 if(kind==='lever'){declared=!!j?.salaryRange;if(declared)candidates=[structured(j.salaryRange)];}
 if(kind==='workday'){const x=j?.jobPostingInfo;declared=!!(x?.baseSalary||x?.salaryRange||x?.compensation?.baseSalary||x?.compensation?.salaryRange);if(declared)candidates=[workday(x)];}
 if(kind==='greenhouse'){
  const xs=j?.pay_input_ranges||[];declared=xs.length>0;
  if(xs.length===1){const x=xs[0],label=[x.title,x.blurb].filter(Boolean).join(' '),units=[x.interval,x.frequency,x.unitText].filter(Boolean),annual=units.length?units.every(annualUnit):/annual|per year|yearly/i.test(label);if(annual&&!mixed.test(label)&&!/bonus|equity|incentive|total|hour/i.test(label))candidates=[structured({currency:x.currency_type,value:{unitText:'YEAR',minValue:x.min_cents/100,maxValue:x.max_cents/100}})];}
 }
 if(kind==='ashby'){
  const x=(j?.jobs||[]).find(x=>x.id===id),xs=(x?.compensation?.summaryComponents||[]).filter(x=>/salary/i.test(x.compensationType||''));declared=xs.length>0;
  if(xs.length===1)candidates=[structured({...xs[0],value:{unitText:xs[0].interval,minValue:xs[0].minValue,maxValue:xs[0].maxValue}})];
 }
 if(declared){const safe=candidates.filter(Boolean);return safe.length===1&&!conflicts(text,safe[0],payFromText)?fact(safe[0],'STRUCTURED_ANNUAL_BASE'):null;}
 return fact(payFromText?employerText(text,payFromText):null,'EXPLICIT_ANNUAL_BASE_TEXT');
}
module.exports={VERSION,values,structured,workday,employerText,annualUnit,mixed,conflicts,range,fact,ats};
