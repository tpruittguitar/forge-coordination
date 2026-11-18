'use strict';
// Run #303: one INDEPENDENT_VERIFIED candidate with primaryBusiness:'' (as auto-run has built them since #380)
// fails the executor entry contract and blocked all 14 candidates. auto-run now applies the same check first.
const test=require('node:test'),assert=require('node:assert/strict');
const {reviewedCandidate}=require('./production-executor');
const record={COMPANY:'Acme',TITLE:'Director Manufacturing',LOCATION:'Austin, Texas, United States',SOURCE_URL:'https://boards.example.com/acme/jobs/1'};
const verified={record,expectedOutcome:'NEW',evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:record.SOURCE_URL,primaryBusiness:'',reviewedNeverConsider:false,businessEvidenceApproved:true};
test('verified candidate without employer business fails the entry contract (run #303 shape)',()=>{
 assert.ok(!reviewedCandidate(verified,true));
 assert.ok(!reviewedCandidate(verified,false));
});
test('verified candidate with employer business still passes',()=>{
 assert.ok(reviewedCandidate({...verified,primaryBusiness:'Makes widgets'},true));
});
test('auto-run applies the entry contract before batching',()=>{
 const src=require('node:fs').readFileSync(require.resolve('./auto-run'),'utf8');
 assert.match(src,/if\(candidate&&!reviewedCandidate\(candidate,true\)\)/);
});
