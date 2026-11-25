'use strict';
// Step 06: the 5 required fields. Company, title, location and an https posting link must be present;
// a missing description passes on to step 07, which fetches it. Missing identity is held with its reason
// (policy URL_PROVENANCE: no-URL records are held, never silently dropped).
const PLACEHOLDER=/^(UNKNOWN|UNCAPTURED|NOT_STATED|N\/A|NONE|TBD|-|CONFIDENTIAL)$/i;
module.exports=function requiredFields(job){
 const miss=['company','title','location'].filter(k=>!job[k]||PLACEHOLDER.test(job[k]));
 if(!/^https:\/\//i.test(job.url||''))miss.push('url');
 if(miss.length)return {status:'HOLD',park:true,reason:'MISSING_REQUIRED_FIELD:'+miss.join('+')};
 return {status:'PASS',reason:job.description?'ALL_5_FIELDS':'DESCRIPTION_TO_FETCH'};
};
