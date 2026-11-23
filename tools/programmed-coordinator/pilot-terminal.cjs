'use strict';
const S=require('./store.cjs'),W=require('../grant-backlog/worker.cjs'),HF=require('../helper-routing/helper-fields.cjs');
const fail=()=>{throw Error('PILOT_CHECKPOINT_NOT_VERIFIABLE');};
function validate(s,g,report){
 const binding=W.hash({receiptId:g.receiptId,revision:g.revision,ids:g.ids,workIdentity:g.workIdentity,project:g.project,dir:g.checkpointDir});
 if(s?.schema!=='forge.native-five-local.v1'||s.binding!==binding||S.hash(s.ids)!==S.hash(g.ids)||!s.jobs||Array.isArray(s.jobs)||Object.keys(s.jobs).some(id=>!g.ids.includes(id)))fail();
 if(s.stop!=null&&(typeof s.stop!=='string'||!/^[A-Z][A-Z0-9_]{2,80}$/.test(s.stop)))fail();
 const jobs=Object.values(s.jobs),allowed=new Set(['CHECKING','RESERVED','IN_FLIGHT','OUTCOME_UNKNOWN','HELD','PREPARED','NO_SUPPORTED_FACTS','RESPONSE_RECEIVED']);
 let cost=0,fields=0;
 for(const j of jobs){
  if(!allowed.has(j.status))fail();
  if(j.usage){if(!j.attempted||!Number.isSafeInteger(j.usage.input_tokens)||!Number.isSafeInteger(j.usage.output_tokens)||j.usage.input_tokens<0||j.usage.output_tokens<0||j.usage.input_tokens>8192||j.usage.output_tokens>1024)fail();cost+=Math.ceil(j.usage.input_tokens*.1+j.usage.output_tokens*.5);}
  if(j.status==='PREPARED'){
   if(j.reason||j.retryCondition||!(j.reused===true&&!j.attempted||j.attempted===true&&j.usage&&typeof j.responseId==='string'&&j.responseId))fail();
   const e=j.evidence;if(!e||e.capture?.kind!=='TEXT_EXTRACT'||typeof e.capture.text!=='string'||S.hash(e.capture.text)!==e.sha256||!Object.keys(e.proposedRawFields||{}).length)fail();
   HF.check(e,{capture:e.capture.text});
   if(Object.values(e.fieldQuotes||{}).some(q=>typeof q!=='string'||!q||!e.capture.text.includes(q)))fail();
   if(!['REQUIRED','PREFERRED','UNKNOWN'].includes(j.degree?.requirement)||!['EXPLICIT','UNKNOWN'].includes(j.degree.equivalence)||!['HIGH','LOW'].includes(j.degree.confidence))fail();
   if(e.proposedRawFields.DEGREE_REQ&&(j.degree.requirement!==e.proposedRawFields.DEGREE_REQ||j.degree.confidence!=='HIGH'||j.degree.quote!==e.fieldQuotes.DEGREE))fail();
   fields+=Object.keys(e.proposedRawFields).length;
  }
 }
 const attempts=jobs.filter(j=>j.attempted).length;
 if(!Number.isSafeInteger(s.reservedMicrousd)||s.reservedMicrousd<attempts*2048||s.reservedMicrousd>10240||s.confirmedUsageMicrousd!==cost)fail();
 const expected={mode:'live-evidence-only',jobs:jobs.length,modelAttempts:attempts,preparedJobs:jobs.filter(j=>j.status==='PREPARED').length,preparedFields:fields,reservedMicrousd:s.reservedMicrousd,confirmedUsageMicrousd:cost,unknownOutcomeJobs:jobs.filter(j=>j.status==='OUTCOME_UNKNOWN').length,writerRequests:0,stop:s.stop||null};
 if(S.hash(report)!==S.hash(expected))fail();
 return jobs.length===5&&g.ids.every(id=>s.jobs[id]?.status==='PREPARED')&&!s.stop;
}
module.exports={validate};
