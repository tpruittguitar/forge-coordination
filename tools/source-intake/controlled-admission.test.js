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
 assert.equal(r.proposed.length,1);assert.equal(r.admitted.length,0);assert.equal(r.writerSubmissions,0);assert.equal(r.submissionExecuted,false);
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

test('transaction preflight creates stable identities but no writer payloads',()=>{
 const {prepareRequests,stableId}=require('./transaction-preflight');
 const {preview,audit}=fixture();const decision=eligibleFromAudit(audit,preview);
 const a=prepareRequests(decision,{runId:'FORGE-SOURCE-20261022-01',sourceRunId:'FORGE-SOURCE-20261022'});
 const z=prepareRequests(decision,{runId:'FORGE-SOURCE-20261022-01',sourceRunId:'FORGE-SOURCE-20261022'});
 assert.deepEqual(a.proposed,z.proposed);
 assert.equal(a.proposed[0].identityHash,stableId(preview.rows[0].record));
 assert.equal(a.writerPayloads.length,0);assert.equal(a.writerSubmissions,0);
});
test('receipt COMPLETE never claims exact-row verification',()=>{
 const {classifyReceipt}=require('./transaction-preflight');
 assert.equal(classifyReceipt({requestId:'ABC',status:'COMPLETE',durable:true},'ABC'),'COMPLETE_PENDING_EXACT_ROW_READBACK');
 assert.equal(classifyReceipt({requestId:'ABC',status:'PENDING'},'ABC'),'PENDING_VERIFICATION');
 assert.equal(classifyReceipt({requestId:'DIFFERENT',status:'COMPLETE',durable:true},'ABC'),'PENDING_VERIFICATION');
});

test('exact-row consistency remains unverified pending trusted readback provenance',()=>{
 const {verifyExactRow,stableId}=require('./transaction-preflight');
 const record={COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin, TX',REQ_ID:'REQ-21',SOURCE_URL:'https://example.com/jobs/123'};
 const proposal={record,identityHash:stableId(record)};
 const receipt={requestId:'SOURCE-REQ-21',status:'COMPLETE',durable:true};
 const masterRows=[{PRIMARY_ID:'V2I-123',...record}];
 const x=verifyExactRow(proposal,{receipt,requestId:'SOURCE-REQ-21',masterRows});
 assert.equal(x.status,'CONSISTENT_PENDING_PROVENANCE_VALIDATION');assert.equal(x.verified,false);
 assert.equal(x.matchedPrimaryId,'V2I-123');
 assert.equal(verifyExactRow(proposal,{receipt,requestId:'WRONG',masterRows}).verified,false);
 assert.equal(verifyExactRow(proposal,{receipt,requestId:'SOURCE-REQ-21',masterRows:[]}).status,'ROW_NOT_FOUND');
 assert.equal(verifyExactRow(proposal,{receipt,requestId:'SOURCE-REQ-21',masterRows:[...masterRows,...masterRows]}).status,'AMBIGUOUS_READBACK');
 assert.throws(()=>verifyExactRow({...proposal,identityHash:'ALTERED'},{receipt,requestId:'SOURCE-REQ-21',masterRows}),/identity changed/);
});
