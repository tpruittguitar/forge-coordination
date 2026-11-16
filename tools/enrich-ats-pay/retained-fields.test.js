'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('./retained-fields');
const saved=()=>({at:'2026-11-05T01:00:00Z',url:'https://example.org/job',basis:'EMPLOYER_POSTED',fullPosting:true,pay:{low:180000,high:220000},degree:{text:'Bachelor degree required.',req:'REQUIRED'},degreeAt:'2026-11-06T01:00:00Z',degreeUrl:'https://example.org/degree'});
test('complete retained fields preserve original independent evidence dates and URLs',()=>{
 const f=R.fields(['SALARY','DEGREE'],saved());assert.equal(R.complete(['SALARY','DEGREE'],f),true);
 assert.equal(f.SALARY_ASOF,'2026-11-05');assert.equal(f.DEGREE_ASOF,'2026-11-06');assert.equal(f.DEGREE_EVIDENCE_URL,'https://example.org/degree');assert.equal(f.SALARY_MIDPOINT,200000);
});
test('partial, salary-only, third-party estimate and missing evidence do not masquerade as complete fields',()=>{
 for(const e of [null,{...saved(),pay:null},{...saved(),fullPosting:false},{...saved(),basis:'THIRD_PARTY_ESTIMATE'}])assert.equal(R.complete(['SALARY','DEGREE'],R.fields(['SALARY','DEGREE'],e)),false);
 assert.equal(R.complete([],{}),false);
 assert.deepEqual(R.fields(['DEGREE'],{...saved(),fullPosting:false}),{});
 assert.equal(R.complete(['SALARY'],R.fields(['SALARY'],{...saved(),fullPosting:false})),true);
 assert.equal(R.complete(['DEGREE'],R.fields(['DEGREE'],{...saved(),pay:null})),true);
});
