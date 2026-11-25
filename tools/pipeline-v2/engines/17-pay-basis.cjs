'use strict';
// Engine 17: pay basis (script). Labels what the pay figure rests on. Pay estimates themselves belong to
// Comp's method; this engine builds no pay model. A not-posted job waits on engine 14's buried-pay read and
// is re-labelled when that lands.
const {filled}=require('../store.cjs');
const v=(j,k)=>j.fields[k]&&j.fields[k].value;
const select=j=>!filled(j,'SALARY_BASIS')||(/^PENDING/.test(v(j,'SALARY_BASIS'))&&filled(j,'BURIED_PAY'));
function work(job){
 if(!filled(job,'PAY_POSTED'))return {status:'WAIT',reason:'WAITING_ON_13_POSTED_PAY'};
 const src='PIPELINE_V2_PAY_BASIS';
 if(v(job,'PAY_POSTED')==='YES')return {status:'PASS',reason:'EMPLOYER_POSTED',fields:{SALARY_BASIS:{value:'EMPLOYER_POSTED',source:src}}};
 const buried=v(job,'BURIED_PAY');
 if(buried&&buried!=='NONE'){const b=JSON.parse(buried),m=/hour/i.test(b.interval)?2080:1;
  return {status:'PASS',reason:'EMPLOYER_POSTED_BURIED',fields:{SALARY_BASIS:{value:'EMPLOYER_POSTED',source:src+':BURIED'},SALARY_BASE_LOW:{value:Math.round(b.low*m),source:job.fields.BURIED_PAY.source},SALARY_BASE_HIGH:{value:Math.round(b.high*m),source:job.fields.BURIED_PAY.source}}};}
 if(!buried)return {status:'PASS',reason:'PENDING_BURIED_PAY_CHECK',fields:{SALARY_BASIS:{value:'PENDING_BURIED_PAY_CHECK',source:src}}};
 if(filled(job,'LANE_PAY_ESTIMATE'))return {status:'PASS',reason:'THIRD_PARTY_ESTIMATE_ONLY',fields:{SALARY_BASIS:{value:'ESTIMATE_INPUT_FOR_COMP',source:src}}};
 return {status:'PASS',reason:'NO_PAY_FOR_COMP_MODEL',fields:{SALARY_BASIS:{value:'NONE_AWAITING_COMP_ESTIMATE',source:src}}};
}
module.exports={id:'17',select,work};
