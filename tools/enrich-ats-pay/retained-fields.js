'use strict';
// Input is the existing identity/expiry-validated evidence combination, not raw text.
// Salary-only evidence cannot imply a degree result or a complete posting read.
function fields(needs, saved) {
 const f={};
 if(needs.includes('SALARY')&&saved?.pay&&saved.basis!=='THIRD_PARTY_ESTIMATE')Object.assign(f,{
  SALARY_BASE_LOW:saved.pay.low,SALARY_BASE_HIGH:saved.pay.high,
  SALARY_MIDPOINT:Math.round((saved.pay.low+saved.pay.high)/2),
  SALARY_BASIS:saved.basis||'EMPLOYER_POSTED',SALARY_SOURCE:saved.url,
  SALARY_ASOF:saved.at.slice(0,10),SALARY_CONF:'HIGH'
 });
 if(needs.includes('DEGREE')&&saved?.fullPosting===true&&saved.degree)Object.assign(f,{
  DEGREE_TEXT:saved.degree.text,DEGREE_REQ:saved.degree.req,
  DEGREE_EVIDENCE_URL:saved.degreeUrl||saved.url,
  DEGREE_ASOF:(saved.degreeAt||saved.at).slice(0,10)
 });
 return f;
}
function complete(needs, f){return needs.length>0&&needs.every(n=>n==='SALARY'?!!f.SALARY_BASE_LOW:n==='DEGREE'?!!f.DEGREE_REQ:false);}
module.exports={fields,complete};
