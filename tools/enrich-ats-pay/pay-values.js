'use strict';
function values(low,high){low=+low;high=+high;if(!(Number.isFinite(low)&&Number.isFinite(high)&&low>=40000&&high>=low&&high<=2000000))return null;return{low,high,mid:Math.round((low+high)/2),scorePoint:Math.round(low+0.75*(high-low))};}
function structured(s){
 if(!s||typeof s!=='object')return null;
 const v=s.value||s,currency=s.currency||s.currencyCode||v.currency,unit=v.unitText||s.interval||s.frequency||s.payFrequency;
 if(currency!=='USD'||!/^(YEAR|YEARLY|ANNUAL|ANNUALLY)$/i.test(unit||''))return null;
 if(/total|bonus|equity|incentive|hour/i.test(s.compensationType||s.type||s.title||''))return null;
 return values(v.minValue??v.minimum??v.min,v.maxValue??v.maximum??v.max);
}
function workday(info){
 // Accept explicit annual USD base salary fields only; no unlabeled compensation totals.
 const xs=[info?.baseSalary,info?.salaryRange,info?.compensation?.baseSalary,info?.compensation?.salaryRange].map(structured).filter(Boolean);
 const distinct=new Map(xs.map(x=>[x.low+'|'+x.high,x]));return distinct.size===1?[...distinct.values()][0]:null;
}
function employerText(text,payFromText){
 // Caller already verified an exact first-party posting. Employer wording such as
 // "estimated base salary" remains employer-disclosed; it is not a salary-site estimate.
 const t=String(text||''),hits=[];
 const labels=[...t.matchAll(/(?:base (?:salary|pay)|annual (?:base )?salary|salary range)/gi)];
 for(let i=0;i<labels.length;i++){
  const start=labels[i].index,near=t.slice(start,Math.min(start+160,labels[i+1]?.index??t.length));
  if(/total compensation|including (?:bonus|equity)|hourly|per hour|glassdoor|payscale|salary\.com/i.test(near))continue;
  const p=payFromText(near);if(p)hits.push(p);
 }
 const distinct=new Map(hits.map(x=>[x.low+'|'+x.high,x]));return distinct.size===1?[...distinct.values()][0]:null;
}
module.exports={values,structured,workday,employerText};
