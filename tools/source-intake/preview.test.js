'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {adapt}=require('./preview');
const job=(company,title,location,url)=>({status:'NEW',source:'JobSpy',company,title,location,url});
test('provisional exclusions, duplicate URL, separate cities, and missing fields',()=>{
const roles=[
 job('Baxter','Director Quality','TN','https://example.com/jobs/1111111'),
 job('Acme','Director Manufacturing','Austin, TX','https://example.com/jobs/2222222'),
 job('Acme','Director Manufacturing','Dallas, TX','https://example.com/jobs/3333333'),
 job('Acme','Director Manufacturing','Austin, TX','https://example.com/jobs/2222222?utm_source=abc'),
 job('Acme','Director Accounting','TN','https://example.com/jobs/4444444'),
 job('Acme','Director Manufacturing','Seattle, WA','https://example.com/jobs/5555555'),
 job('','Director Manufacturing','TX','https://example.com/jobs/6666666')
];
const x=adapt({summary:{run:'test'},new_roles:roles},{runId:'FORGE-TEST'});
assert.equal(x.counts.input,7);assert.equal(x.counts.CANDIDATE_REQUIRES_WRITER_CHECK,2);
assert.equal(x.counts.EXCLUDED_INDUSTRY_PROVISIONAL,1);
assert.equal(x.counts.DUPLICATE_IN_REPORT,1);
assert.equal(x.counts.GEOGRAPHY_PAY_REVIEW,1);
assert.equal(x.counts.WRONG_FUNCTION,1);
assert.equal(x.counts.MISSING_IDENTITY,1);
assert.equal(x.batches[0].records.length,2);
assert.equal(x.counts.writer_submission_count,0);
});
test('requires explicit valid report and does not infer degree or pay',()=>{
assert.throws(()=>adapt({}),/new_roles/);
const x=adapt({new_roles:[job('Acme','VP Quality','Chattanooga, TN','https://example.org/jobs/1234567')]});
assert.deepEqual(x.batches[0].records[0].INITIAL_UNKNOWN_FIELDS,['PAY','DEGREE','FLEX','LIVE_WRITER_DEDUPE','POSTING_LIVENESS']);
});