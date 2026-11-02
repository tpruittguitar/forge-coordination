'use strict';
// Observed director/VP disclosures, never an assumed title or industry premium.
// Dependency injected to avoid a lib/context cycle and to keep calibration identical to production.
function estimate(row,anchors,context,L,C){
 const level=L.level(row.TITLE);if(level<2)return null;
 const specialty=t=>/\b(AI|ML|artificial intelligence|machine learning)\b/i.test(t)?'AI_ML':'GENERAL';
 const scope=require('./anchor-scope');
 const pool=anchors.filter(a=>a.id!==row.PRIMARY_ID&&L.level(a.title)===level&&L.func(a.title)===L.func(row.TITLE)&&scope.executiveScope(a.title)===scope.executiveScope(row.TITLE)&&specialty(a.title)===specialty(row.TITLE));
 const used=C.select({...row,state:L.stateFrom(row.LOCATION)},pool,context||{},Date.now(),9);
 // One or two broad leadership matches cannot establish a leadership pay distribution.
 if(used.length<3)return null;
 const low=Math.round(C.salaryValue(used,'low')/1000)*1000,high=Math.round(C.salaryValue(used,'high')/1000)*1000;
 return{low,high,mid:Math.round((low+high)/2),conf:'LOW',n:used.length,ids:used.map(a=>a.id),source:'LEADERSHIP_POSTINGS',basis:`${used.length} distinct employer-posted leadership ranges at level ${level} ${L.func(row.TITLE)}; broader role family fallback, not ordinary-manager BLS; no title/company premium; `+C.annotation(used)};
}
module.exports={estimate};
