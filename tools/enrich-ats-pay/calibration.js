'use strict';
const L=require('./lib'),C=require('./context');
function evaluate(rows,anchors,reference,now=Date.now()){
 const unique=C.rank({COMPANY:'',TITLE:'',LOCATION:''},anchors,{},now),cases=[];
 for(const target of unique){
  const row=rows.find(r=>r.PRIMARY_ID===target.id);if(!row)continue;
  // Exclude every alias/copy of the target posting, not merely its primary ID.
  const pool=anchors.filter(a=>C.postingKey(a)!==C.postingKey(target)&&C.identityKey(a)!==C.identityKey(target)&&a.id!==target.id);
  const same=L.sameEmployerAnchors(row,pool);
  const est=L.estimate(row,pool,reference)||require('./leadership').estimate(row,pool,reference,L,C);
  if(!est){cases.push({primaryId:target.id,status:'NO_COMPARABLES'});continue;}
  const actual=(target.low+target.high)/2,error=(est.mid-actual)/actual;
  const baseline=(same.length&&L.sameEmployerEstimate(row,same,null))||L.estimate(row,pool);
  cases.push({primaryId:target.id,status:'ESTIMATED',actualPostedLow:target.low,actualPostedHigh:target.high,estimatedLow:est.low,estimatedHigh:est.high,actualPostedMidpoint:actual,estimatedMidpoint:est.mid,errorPct:Math.round(error*1000)/10,baselineErrorPct:baseline?Math.round((baseline.mid-actual)/actual*1000)/10:null,midpointInsideRange:actual>=est.low&&actual<=est.high,confidence:est.conf,comparableIds:est.ids});
 }
 const scored=cases.filter(c=>c.status==='ESTIMATED'),avg=f=>scored.length?Math.round(scored.reduce((s,c)=>s+f(c),0)/scored.length*10)/10:null;
 return{schema:'forge.salary-calibration.v1',model:C.VERSION,method:'Leave one distinct posting out; target salary and duplicate source aliases excluded; no geographic adjustment in this diagnostic',caution:'Diagnostic on available posted salaries, not an independent future-performance guarantee. Range coverage measures posted midpoint, not the full posted band.',eligible:cases.length,evaluated:scored.length,noComparables:cases.length-scored.length,coveragePct:cases.length?Math.round(scored.length/cases.length*1000)/10:null,meanAbsoluteErrorPct:avg(c=>Math.abs(c.errorPct)),signedBiasPct:avg(c=>c.errorPct),underestimatedPct:avg(c=>c.errorPct<0?100:0),postedMidpointInsideRangePct:avg(c=>c.midpointInsideRange?100:0),floorChecks:[190000,200000,210000,220000,260000].map(floor=>({floor,postedEligible:scored.filter(c=>c.actualPostedHigh>=floor).length,falseExclusions:scored.filter(c=>c.actualPostedHigh>=floor&&c.estimatedHigh<floor).length,falseInclusions:scored.filter(c=>c.actualPostedHigh<floor&&c.estimatedHigh>=floor).length})),upperEndpointSignedError:avg(c=>c.estimatedHigh-c.actualPostedHigh),cases};
}
module.exports={evaluate};

