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
