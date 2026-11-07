'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./writer-reader'),I=require('../source-trial/job-identity');
const row=payload=>'1 | V2I-ONE | Acme | Director Manufacturing | NEW | ACTIVE | P1 | REQ-ONE | Austin, TX | '+payload;
const parsers=[text=>R.parseMaster(text+'\nEND V2_CURRENT_POPULATION_MASTER'),R.parseArchive];
test('master and archive preserve worksite scope evidence and identity URLs/reqs',()=>{
 const fields={REMOTE_HYBRID:'HYBRID',OPERATING_SCOPE:'MULTI_SITE',OPERATING_SCOPE_EVIDENCE:'Responsible across facilities',LOCATION_SCOPE:'regional',REQ:'REQ-ALIAS',REQUISITION_ID:'REQ-ALIAS-2',ATS_POSTING_URL:'https://example.com/job/123'};
 for(const parse of parsers){const [r]=parse(row(Object.entries(fields).map(([k,v])=>k+'='+v).join('; ')+'; SALARY_EVIDENCE_URL=https://salary.example.com'));
  a.deepEqual(r.p,fields);a.equal(I.fenceApplies({company:'Acme',title:'Director Manufacturing',location:'Portland, OR',url:'https://example.com/other'},r),true);
 }
});
test('each parsed remote or operating scope signal independently prevents cross-state fence relief',()=>{
 for(const parse of parsers)for(const [field,value]of [['REMOTE_HYBRID','REMOTE'],['OPERATING_SCOPE','MULTI_SITE'],['OPERATING_SCOPE_EVIDENCE','Responsible across sites'],['LOCATION_SCOPE','regional']]){
  const [r]=parse(row(field+'='+value));a.equal(r.p[field],value);a.equal(I.fenceApplies({company:'Acme',title:'Director Manufacturing',location:'Portland, OR'},r),true,field);
 }
});
