'use strict';
const test=require('node:test'), a=require('node:assert/strict');
const G=require('./grant-salary-estimate.cjs'), R=require('./recovery');
test('bulk grant reuses the stock estimate only for an exact no-pay posting; protects live salary group', async()=>{
  const now=Date.parse('2026-11-22T20:00:00Z'), today='2026-11-22';
  const url='https://boards.greenhouse.io/acme/jobs/1234567';
  const row={PRIMARY_ID:'V2I-TEST',COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:url}};
  const sourceIdentity={company:row.COMPANY,title:row.TITLE,location:row.LOCATION};
  const text='The Director of Quality leads plant operations and manufacturing quality in Dayton, Ohio. '.repeat(5);
  const make=(extra={})=>R.saveEvidence({},row,url,{text,fullPosting:true,identityVerified:true,sourceIdentity,basis:'EMPLOYER_POSTED',...extra},now-1000);
  const capture=make();let calls=0;
  const plan={row,capture,enabled:true,today,now,fields:{WORK_ARRANGEMENT:'ONSITE'},
    estimateFor:async(r,opts)=>{calls++;a.equal(r,row);a.deepEqual(opts,{noBoard:true,ignoreSiteEstimate:true});return {low:180000,high:220000,conf:'MED',basis:'stock comp evidence',bls:{note:'stock wage check'}};},
    salarySource:()=> 'comparables:V2I-ANCHOR',modelFields:()=>({SALARY_MODEL_VERSION:'existing',SALARY_CONTEXT_KEY:'current'})};
  for(const patch of [{enabled:false},{capture:null},{capture:{...capture,fullPosting:false}},
    {capture:{...capture,url:url+'9'}},{capture:{...capture,identityVerified:false}},
    {capture:{...capture,factsVersion:'stale'}},{capture:{...capture,structuredBaseSalary:{value:180000}}},
    {capture:make({payAmbiguous:true})},{capture:make({pay:{low:180000,high:220000}})},
    {capture:make({text:text+'Salary range: 180000 to 220000.'})},{old:{payNeedsRefresh:true}},
    {row:{...row,p:{...row.p,SALARY_SOURCE:'existing'}}},{fields:{SALARY_BASE_LOW:180000}}]){
    a.deepEqual(await G.plan({...plan,...patch}),{});
  }
  a.equal(calls,0);
  const f=await G.plan(plan);a.equal(calls,1);
  a.deepEqual(f,{SALARY_MODEL_VERSION:'existing',SALARY_CONTEXT_KEY:'current',SALARY_BASE_LOW:180000,SALARY_BASE_HIGH:220000,
    SALARY_MIDPOINT:200000,SALARY_SCORE_POINT:210000,SALARY_BASIS:'FORGE-ESTIMATE',SALARY_CONF:'MED',
    SALARY_ASOF:today,SALARY_SOURCE:'comparables:V2I-ANCHOR',SALARY_NOTE:'FORGE-ESTIMATE; this exact posting was read and stated no pay; stock comp evidence; stock wage check'});
  a.deepEqual(G.liveFields(row,{...f,WORK_ARRANGEMENT:'ONSITE'}),{...f,WORK_ARRANGEMENT:'ONSITE'});
  a.deepEqual(G.liveFields({...row,p:{...row.p,SALARY_BASE_LOW:190000}},{...f,WORK_ARRANGEMENT:'ONSITE'}),{WORK_ARRANGEMENT:'ONSITE'});
  const posted={SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:url};
  a.deepEqual(G.liveFields(row,posted),posted);
});
