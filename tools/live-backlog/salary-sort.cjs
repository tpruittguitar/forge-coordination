'use strict';
const {display:salaryDisplay}=require('./salary.cjs');
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=Number.MAX_SAFE_INTEGER;
const periods={year:'year',yearly:'year',annual:'year',annually:'year',yr:'year',month:'month',monthly:'month',mo:'month',week:'week',weekly:'week',wk:'week',day:'day',daily:'day',hour:'hour',hourly:'hour',hr:'hour'};
const amount='(?:(?:\\d{1,3}(?:,\\d{3})+)|\\d+)(?:\\.\\d+)?';
const bound='([A-Z]{3}|[$€£])?\\s*('+amount+')\\s*([kKmM])?';
const range=new RegExp('^'+bound+'(?:\\s*(?:[-–—]|to)\\s*'+bound+')?(?:\\s*(?:/|per\\s+)\\s*([a-z]+))?$','i');
// Only a single amount or a complete, unambiguous numeric range is sortable.
// Preserve the display text. Do not treat a floor/plus sign as an upper bound,
// guess missing units, annualize hourly pay, or convert currencies.
function legacyTop(value){
 if(typeof value!=='string')return null;
 const match=value.trim().match(range);if(!match)return null;
 const [,,lowText,lowScale,,highText,highScale,periodText]=match;
 const number=(text,scale)=>Number(text.replaceAll(',',''))*(scale?.toLowerCase()==='m'?1000000:scale?.toLowerCase()==='k'?1000:1);
 const low=number(lowText,lowScale),high=highText?number(highText,highScale):low;
 const lowUnit=match[1]?.toUpperCase(),highUnit=match[4]?.toUpperCase();
 if(!positive(low)||!positive(high)||high<low||(lowUnit&&highUnit&&lowUnit!==highUnit))return null;
 // A trailing scale alone may apply to both bounds (200-100K), so do not
 // invent a low amount and accidentally accept a reversed shorthand range.
 if(highText&&highScale&&!lowScale&&low<1000)return null;
 const name=periodText?.toLowerCase(),period=name&&Object.hasOwn(periods,name)?periods[name]:null;if(periodText&&!period)return null;
 const unit=lowUnit||highUnit||null,currency=unit&&/^[A-Z]{3}$/.test(unit)?unit:null;
 return {high,currency,period,symbol:currency?null:unit};
}
function display(item,index){
 const salary=salaryDisplay(item,index);
 const unavailable={salaryUpperBound:null,salarySortGroup:null,salarySortUnitsKnown:false};
 if(salary.salaryRange==null)return {...salary,...unavailable};
 // salaryDisplay has already checked the source identity, ambiguity and proof.
 // Prefer its validated numeric high when available. The text fallback also
 // supports exact structured range displays from older snapshots.
 const top=positive(salary.salaryUpperBound)?{high:salary.salaryUpperBound,currency:salary.salaryCurrency,period:salary.salaryPeriod}:legacyTop(salary.salaryRange);
 if(!top||!positive(top.high))return {...salary,...unavailable};
 const currency=top.currency||`currency not recorded${top.symbol?' ('+top.symbol+')':''}`;
 return {...salary,salaryUpperBound:top.high,salarySortGroup:`${currency} / ${top.period||'period not recorded'}`,salarySortUnitsKnown:!!(top.currency&&top.period)};
}
module.exports={display,legacyTop};
