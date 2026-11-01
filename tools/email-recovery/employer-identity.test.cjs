const test=require('node:test'),assert=require('node:assert/strict'),E=require('./employer-identity.cjs');
test('employer posting identities survive tracking, locale and application suffixes',()=>{
 assert.equal(E.key('https://job-boards.greenhouse.io/acme/jobs/1234567?gh_src=one'),E.key('https://boards.greenhouse.io/acme/jobs/1234567'));
 assert.equal(E.key('https://jobs.ashbyhq.com/acme/12345678-1234-1234-1234-123456789abc/application'),E.key('https://jobs.ashbyhq.com/acme/12345678-1234-1234-1234-123456789abc'));
 assert.notEqual(E.key('https://boards.greenhouse.io/acme/jobs/1234567'),E.key('https://boards.greenhouse.io/other/jobs/1234567'));
 assert.equal(E.key('https://www.linkedin.com/jobs/view/1234567/'),'');
 assert.equal(E.key('https://example.com/1234567'),'');
});
test('only a source-bound observed employer destination is reusable',()=>{
 const j={url:'https://www.linkedin.com/jobs/view/1234567/',employerPosting:{sourceUrl:'https://www.linkedin.com/jobs/view/1234567/',url:'https://boards.greenhouse.io/acme/jobs/1234567',observedAt:'2026-11-01T06:00:00Z',method:'SIGNED_IN_CHROME_APPLY_DESTINATION'}};
 assert.ok(E.evidence(j));j.employerPosting.sourceUrl='https://www.linkedin.com/jobs/view/9999999/';assert.equal(E.evidence(j),'');
});
test('Workday revision identities and alternate recruiting domain are exact',()=>{
 const a='https://clorox.wd1.myworkdayjobs.com/Clorox/job/A/Role_JR23683-1';
 assert.equal(E.key(a),E.key('https://wd1.myworkdaysite.com/en-US/recruiting/clorox/Clorox/job/B/Role_JR23683-1'));
 assert.notEqual(E.key(a),E.key(a.replace('-1','-2')));
 assert.notEqual(E.key(a),E.key(a.replace('-1','')));
 assert.notEqual(E.key(a),E.key(a.replace('clorox.wd1','other.wd1')));
});
test('Phenom and Eightfold identities remain tenant bound; browser provenance is truthful',()=>{
 assert.equal(E.key('https://careers.tranetechnologies.com/global/en/job/TRTEGLOBALJR17387EXTERNALENGLOBAL/Role'),'careers.tranetechnologies.com:TRTEGLOBALJR17387EXTERNALENGLOBAL');
 assert.notEqual(E.key('https://eaton.eightfold.ai/careers/job/687239530093'),E.key('https://other.eightfold.ai/careers/job/687239530093'));
 const j={url:'https://www.linkedin.com/jobs/view/1/',employerPosting:{sourceUrl:'https://www.linkedin.com/jobs/view/1/',url:'https://www.amazon.jobs/jobs/123/role',observedAt:'2026-11-01T08:00:00Z',method:'SIGNED_IN_BROWSER_APPLY_DESTINATION',browser:'Edge'}};
 assert.ok(E.evidence(j));delete j.employerPosting.browser;assert.equal(E.evidence(j),'');
});
test('syndication redirects require an observed employer requisition quote and proof',()=>{
 const e={url:'https://idexcorporation.jobs/marietta-ga/region-manager-operations/hash/job/',sourceUrl:'https://www.linkedin.com/jobs/view/1/',observedAt:'2026-11-01T08:00:00Z',method:'SIGNED_IN_BROWSER_EMPLOYER_REDIRECT',browser:'Edge',proof:'receipts/source.json',reqId:'R-09435',reqQuote:'Req Id: R-09435'};
 assert.ok(E.evidence({url:e.sourceUrl,employerPosting:e}));assert.equal(E.key(e.url),'');
 for(const change of [{proof:''},{reqQuote:'R-09435'},{url:'https://rr.jobsyn.org/hash'},{reqId:'R-09999'}])assert.equal(E.evidence({url:e.sourceUrl,employerPosting:{...e,...change}}),'');
});
