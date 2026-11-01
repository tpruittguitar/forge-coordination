const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('./ledger.cjs');
const input=[{gmailId:'one',url:'https://www.linkedin.com/comm/jobs/search-results/?keywords=quality&otpToken=secret',advertisedUnseen:22}],page={gmailId:'one',at:'2026-10-31T04:00:00Z',url:input[0].url,jobs:[{jobId:'123',paragraphs:['Director Quality (Verified job)\nDirector Quality','Acme','Austin (On-site)']}],next:true};
test('overlapping captures preserve pending jobs and do not infer completion from advertised count',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);L.capture(l,page);assert.equal(Object.keys(l.jobs).length,1);assert.equal(l.sources.one.pages.length,1);assert.equal(L.summary(l).pendingJobs,1);assert.equal(L.summary(l).coverageComplete,false);assert.ok(!JSON.stringify(l).includes('secret'));});
test('a repeat sighting never resets a disposition or loses source provenance',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);L.disposition(l,'linkedin:123','VERIFIED_EXISTING',{proof:'snapshot.json',reason:'Exact identity',primaryId:'V2I-A',exactRowVerified:true});L.capture(l,page);assert.equal(L.summary(l).existing,1);assert.equal(L.summary(l).pendingJobs,0);assert.throws(()=>L.disposition(l,'linkedin:123','UNSCREENED',{}));});
test('viewed or accepted is insufficient to dispose a new job',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);assert.throws(()=>L.disposition(l,'linkedin:123','VERIFIED_INSERTED',{proof:'result.json',reason:'accepted'}));});
test('empty live results retain historical uncertainty',()=>{const l=L.seed(L.empty(),input);L.capture(l,{...page,jobs:[],next:false,emptyConfirmed:true,evidence:'No new matches for now'});assert.equal(L.summary(l).historicalGaps,1);assert.equal(L.summary(l).coverageComplete,false);});

test('intake waiting excludes completed and in-flight Writer jobs',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);assert.equal(L.summary(l).awaitingIntake,1);l.jobs['linkedin:123'].status='POST_IN_FLIGHT_UNKNOWN';assert.equal(L.summary(l).awaitingIntake,0);l.jobs['linkedin:123'].status='VERIFIED_INSERTED';assert.equal(L.summary(l).awaitingIntake,0);});
test('a missing pagination observation never silently closes a source',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,{...page,next:undefined});assert.equal(l.sources.one.nextPageRequired,true);
 L.capture(l,{...page,next:false});assert.equal(l.sources.one.nextPageRequired,true);
 L.capture(l,{...page,next:false,endConfirmed:true});assert.equal(l.sources.one.nextPageRequired,false);assert.equal(l.sources.one.exhausted,true);
});
test('only observed results pagination with unchanged search filters advances the resume cursor',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,page);const from=L.safeUrl(page.url),to=from+'&start=25',proof={gmailId:'one',fromUrl:from,toUrl:to,at:page.at,paginationControl:'RESULTS_NEXT'};
 assert.throws(()=>L.advance(l,{...proof,paginationControl:'CAROUSEL_NEXT'}));
 assert.throws(()=>L.advance(l,{...proof,toUrl:to.replace('quality','sales')}));
 assert.throws(()=>L.advance(l,{...proof,toUrl:from}));
 L.advance(l,proof);assert.equal(l.sources.one.nextPagePosition,25);assert.equal(l.sources.one.resumeUrl,to);assert.equal(L.summary(l).remainingPageCount,null);assert.equal(L.summary(l).sourcesWithPendingResults,1);
});
