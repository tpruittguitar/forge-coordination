'use strict';
/* Production admission policy: derive eligible records ONLY from real live Writer audit.
 * Deliberately does not transport writes; Writer mutation remains a separate verified step. */
const {auditLiveWriter}=require('./writer-reader');
const MAX_BATCH=200;
function eligibleFromAudit(audit,preview){
 if(audit?.mode!=='NON_SUBMITTABLE_REVIEW_ONLY'||audit.productionAdmission!=='BLOCKED_UNTIL_READER_CONTRACT_QA'||audit.writer_submissions!==0)throw Error('BLOCKED: unsupported audit');
 if(!Array.isArray(preview?.rows)||audit.rows.length!==preview.rows.length)throw Error('BLOCKED: preview/audit mismatch');
 const held=[],admitted=[];
 for(let i=0;i<audit.rows.length;i++){
  const gate=audit.rows[i],source=preview.rows[i],rec=source.record||{};
  if(gate.index!==source.index||gate.url!==rec.SOURCE_URL||gate.company!==rec.COMPANY||gate.title!==rec.TITLE)throw Error('BLOCKED: audit input divergence');
  const proof=source.employerEvidence;
  const hasEvidence=proof&&proof.verified===true&&/^https:\/\//i.test(proof.url||'')&&
    typeof proof.primaryBusiness==='string'&&proof.primaryBusiness.trim().length>=3&&
    proof.neverConsider===false&&proof.actor&&proof.checkedAt&&
    Number.isFinite(Date.parse(proof.checkedAt))&&Date.now()-Date.parse(proof.checkedAt)<86400000;
  if(gate.masterStatus!=='NEW'||gate.sourceVerdict!=='CANDIDATE_REQUIRES_WRITER_CHECK'||!hasEvidence||gate.gate!=='EMPLOYER_BUSINESS_REVIEW'){
   held.push({index:gate.index,reason:gate.gate,masterStatus:gate.masterStatus,evidenceVerified:!!hasEvidence});continue;
  }
  if(!rec.COMPANY||!rec.TITLE||!rec.LOCATION||!/^https:\/\//i.test(rec.SOURCE_URL||'')){held.push({index:gate.index,reason:'IDENTITY_INCOMPLETE'});continue}
  admitted.push({...rec,EMPLOYER_PRIMARY_BUSINESS:proof.primaryBusiness,EMPLOYER_EVIDENCE_URL:proof.url});
 }
 if(admitted.length>MAX_BATCH)throw Error('BLOCKED: admission exceeds 200');
 return {mode:'AUTHORIZED_TO_REQUEST_FINAL_WRITER_INTAKE_CHECK',admitted,held,submissionExecuted:false,writerSubmissions:0};
}
async function prepareLiveAdmission(preview,options={}){
 if(options.auditOverride||options.fetchMaster||options.fetchArchive)throw Error('BLOCKED: injected audit readers forbidden in production');
 const audit=await auditLiveWriter(preview,{key:options.key,transport:options.transport,clock:options.clock});
 return {auditSummary:{...audit,rows:undefined},decision:eligibleFromAudit(audit,preview)};
}
module.exports={eligibleFromAudit,prepareLiveAdmission};
