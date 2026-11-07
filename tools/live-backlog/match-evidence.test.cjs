'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{tokens,evidence}=require('./match-evidence.cjs');
const match=urls=>evidence(urls.map(sourceUrl=>({sourceUrl})));
test('Recruitics same employer-scoped req survives tracking while preserving route warning in cards',()=>{
 const url=(cid,id,destination)=>'https://jsv3.recruitics.com/redirect?rx_cid='+cid+'&rx_jobId='+id+'&rx_url='+encodeURIComponent(destination);
 assert.equal(match([url('3426','01885470','https://careers.example/one?ts=1'),url('3426','01885470','https://careers.example/two?ts=2')]).matchEvidence,'Same Recruitics requisition');
 assert.equal(match([url('1','123','https://example/a'),url('2','123','https://example/b')]).matchEvidence,'Name/location match only');
 assert.equal(match([url('1','123','https://example/a'),url('1','124','https://example/a')]).identityConflict,true);
});
test('supported provider tokens retain tenant, host and complete requisition path',()=>{
 const pairs=[
 ['https://www.glassdoor.com/partner/jobListing.htm?jobListingId=123','https://www.glassdoor.com/job-listing/manager.htm?jobListingId=123','Same Glassdoor listing'],
 ['https://company.wd5.myworkdayjobs.com/en-US/jobs/job/US-TX/Manager_123','https://company.wd5.myworkdayjobs.com/en-US/jobs/job/US-TX/Manager_123?source=feed','Same Workday posting'],
 ['https://jobs.lever.co/tenant/12345678-1234-1234-1234-123456789abc','https://jobs.lever.co/tenant/12345678-1234-1234-1234-123456789abc/apply','Same Lever posting'],
 ['https://company.bamboohr.com/careers/123','https://company.bamboohr.com/careers/123?source=feed','Same BambooHR posting'],
 ['https://jobs.buildsubmarines.com/jobs/123/manager','https://jobs.buildsubmarines.com/job_activities/track?redirect_url='+encodeURIComponent('https://jobs.buildsubmarines.com/jobs/123/manager'),'Same BuildSubmarines posting'],
 ['https://www.linkedin.com/jobs/view/123','https://www.linkedin.com/jobs/view/manager-123/','Same LinkedIn listing'],
 ['https://www.indeed.com/viewjob?jk=1234567890abcdef','https://www.indeed.com/viewjob?jk=1234567890abcdef&from=feed','Same Indeed listing']
 ];for(const[a,b,label]of pairs)assert.equal(match([a,b]).matchEvidence,label);
 assert.equal(match(['https://company.wd5.myworkdayjobs.com/en-US/jobs/job/US-TX/Manager_123','https://company.wd5.myworkdayjobs.com/en-US/jobs/job/US-CA/Manager_123']).identityConflict,true);
});
test('host spoofing, duplicate query IDs, credentials, generic routes and unsupported redirects stay unproven',()=>{
 for(const url of ['https://www.glassdoor.com/profile/?jobListingId=123','https://jsv3.recruitics.com/not-a-redirect?rx_cid=1&rx_jobId=2&rx_url=https%3A%2F%2Fwww.linkedin.com%2Fjobs%2Fview%2F123','https://notlinkedin.com/jobs/view/123','https://www.glassdoor.com.evil.test/?jobListingId=123','https://jsv3.recruitics.com/redirect?rx_cid=1&rx_jobId=2&rx_jobId=3','https://user:secret@company.bamboohr.com/careers/123','https://jobs.buildsubmarines.com/jobs','https://opaque.example/?url=https://www.linkedin.com/jobs/view/123'])assert.deepEqual(tokens(url),[]);
 const nested='https://jsv3.recruitics.com/redirect?rx_url='+encodeURIComponent('https://jsv3.recruitics.com/redirect?rx_url='+encodeURIComponent('https://www.linkedin.com/jobs/view/123'));assert.deepEqual(tokens(nested),[]);
 assert.equal(match(['https://example.com/careers','https://example.com/careers']).matchEvidence,'Same URL; vacancy unverified');
 assert.equal(match(['https://example.com/a','https://example.com/b']).matchEvidence,'Name/location match only');
});
