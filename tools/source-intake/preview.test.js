'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {adapt}=require('./preview');
const job=(company,title,location,url)=>({status:'NEW',source:'JobSpy',company,title,location,url});
test('never exclude from title/company terms; detect Memphis; preserve priority',()=>{
 const r=adapt({new_roles:[
 job('Baxter','Director Quality','TN','https://example.com/a'),
 job('Tesla','Director Clinical Quality','Austin, TX','https://example.com/b'),
 job('Packaging Systems','Director Food Safety Quality','Memphis, TN','https://example.com/c'),
 job('Shield AI','Director Manufacturing','San Diego, CA','https://example.com/d')
 ]},{targetRegistry:{shieldai:'DREAM'}});
 assert.equal(r.counts.CANDIDATE_REQUIRES_WRITER_CHECK,4);
 assert(r.rows[2].flags.includes('MEMPHIS_STRONG_NEGATIVE'));
 assert.equal(r.rows[3].tier,'DREAM');
 assert.equal(r.rows[3].verdict,'CANDIDATE_REQUIRES_WRITER_CHECK');
 assert.equal(r.rows[0].industry,'NEVER_CONSIDER_REVIEW');
});
test('normalize Austin variants; no Workday city slug ID collision',()=>{
 const r=adapt({new_roles:[
 job('Acme','Director Manufacturing','Austin TX','https://acme.wd1.myworkdayjobs.com/en-US/Jobs/job/San-Diego-California/Position-One_R100'),
 job('Acme','Director Manufacturing','Austin, Texas','https://acme.wd1.myworkdayjobs.com/en-US/Jobs/job/San-Diego-California/Position-Two_R200'),
 job('Acme','Director Manufacturing','Dallas, TX','https://example.com/unique'),
 ]});
 assert.equal(r.counts.DUPLICATE_IN_REPORT||0,0);
 assert.equal(r.counts.CANDIDATE_REQUIRES_WRITER_CHECK,3);
 assert.notEqual(r.rows[0].record.REQ_ID,'San-Diego-California');
});
test('ET timestamps, no Writer, 200 records max',()=>{
 const a=[];for(let i=0;i<205;i++)a.push(job('Acme','Director Manufacturing '+i,'Austin, TX','https://example.com/jobs/'+i));
 const r=adapt({new_roles:a},{discoveredAt:'2026-10-22T11:00:00Z'});
 assert.equal(r.batches.length,2);assert.equal(r.batches[0].records.length,200);
 assert.match(r.rows[0].record.DISCOVERED_AT_ET,/ET$/);
 assert.equal(r.counts.writer_submission_count,0);
});
