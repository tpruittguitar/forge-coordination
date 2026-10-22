'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {eligibleFromAudit,prepareLiveAdmission}=require('./controlled-admission');
function fixture(overrides={}){
 const record={COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin, TX',SOURCE_URL:'https://example.com/jobs/123'};
 const row={index:1,verdict:'CANDIDATE_REQUIRES_WRITER_CHECK',record,employerEvidence:{verified:true,url:'https://acme.example.com/about',primaryBusiness:'Industrial automation',neverConsider:false,actor:'REVIEWER',checkedAt:new Date().toISOString()}};
 const preview={rows:[row]};const audit={mode:'NON_SUBMITTABLE_REVIEW_ONLY',productionAdmission:'BLOCKED_UNTIL_READER_CONTRACT_QA',writer_submissions:0,rows:[{index:1,url:record.SOURCE_URL,company:record.COMPANY,title:record.TITLE,gate:'EMPLOYER_BUSINESS_REVIEW',masterStatus:'NEW',sourceVerdict:row.verdict}]};
 return {preview,audit,...overrides};
}
test('eligible only with live audit and independent employer business evidence',()=>{
 const {preview,audit}=fixture();const r=eligibleFromAudit(audit,preview);
 assert.equal(r.admitted.length,1);assert.equal(r.writerSubmissions,0);assert.equal(r.submissionExecuted,false);
});
test('protected, existing, unverifiable and never consider candidates are held',()=>{
 for(const [type,override] of [['protected',1],['existing',2],['unknown',3],['never',4]]){
  const {preview,audit}=fixture();
  if(override===1){audit.rows[0].masterStatus='EXISTING_PROTECTED';audit.rows[0].gate='PROTECTED_HOLD'}
  if(override===2)audit.rows[0].masterStatus='EXISTING';
  if(override===3)delete preview.rows[0].employerEvidence;
  if(override===4)preview.rows[0].employerEvidence.neverConsider=true;
  const r=eligibleFromAudit(audit,preview);assert.equal(r.admitted.length,0,type);assert.equal(r.held.length,1,type);
 }
});
test('reject injected Writer reader overrides and mismatched audit inputs',async()=>{
 await assert.rejects(()=>prepareLiveAdmission({rows:[]},{fetchMaster:()=>[]}),/injected/);
 const {preview,audit}=fixture();audit.rows[0].url='https://evil.example.com';
 assert.throws(()=>eligibleFromAudit(audit,preview),/divergence/);
});
