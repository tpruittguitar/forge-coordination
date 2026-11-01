const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('./ledger.cjs');
const input=[{gmailId:'one',url:'https://www.linkedin.com/comm/jobs/search-results/?keywords=quality&otpToken=secret',advertisedUnseen:22}],page={gmailId:'one',at:'2026-10-31T04:00:00Z',url:input[0].url,jobs:[{jobId:'123',paragraphs:['Director Quality (Verified job)\nDirector Quality','Acme','Austin (On-site)']}],next:true};
test('an observed known listing reference retains its old identity evidence and completed disposition',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,page);L.disposition(l,'linkedin:123','VERIFIED_EXISTING',{proof:'old.json',reason:'Exact canonical role',primaryId:'V2I-OLD',exactRowVerified:true});
 L.seed(l,[{...input[0],gmailId:'two'}]);L.capture(l,{...page,gmailId:'two',at:'2026-11-01T07:00:00Z',jobs:[{jobId:'123',reusePriorIdentity:true}]});
 const j=l.jobs['linkedin:123'];assert.equal(j.status,'VERIFIED_EXISTING');assert.equal(j.evidence.length,1);assert.equal(j.listingReferences.length,1);assert.equal(j.listingReferences[0].identityReusedFromPriorCapture,true);assert.deepEqual(l.sources.two.jobKeys,['linkedin:123']);
 assert.throws(()=>L.capture(l,{...page,jobs:[{jobId:'999',reusePriorIdentity:true}]}),/Unknown listing/);
});
test('overlapping captures preserve pending jobs and do not infer completion from advertised count',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);L.capture(l,page);assert.equal(Object.keys(l.jobs).length,1);assert.equal(l.sources.one.pages.length,1);assert.equal(L.summary(l).pendingJobs,1);assert.equal(L.summary(l).coverageComplete,false);assert.ok(!JSON.stringify(l).includes('secret'));});
test('a repeat sighting never resets a disposition or loses source provenance',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);L.disposition(l,'linkedin:123','VERIFIED_EXISTING',{proof:'snapshot.json',reason:'Exact identity',primaryId:'V2I-A',exactRowVerified:true});L.capture(l,page);assert.equal(L.summary(l).existing,1);assert.equal(L.summary(l).pendingJobs,0);assert.throws(()=>L.disposition(l,'linkedin:123','UNSCREENED',{}));});
test('a result-card pay quote survives capture without promotion to confirmed employer pay',()=>{
 const l=L.seed(L.empty(),input),p={...page,jobs:[{...page.jobs[0],paragraphs:[...page.jobs[0].paragraphs,'$200K/yr - $250K/yr']}]};L.capture(l,p);L.capture(l,p);
 const evidence=l.jobs['linkedin:123'].sourcePayEvidence;assert.equal(evidence.length,1);assert.equal(evidence[0].quote,'$200K/yr - $250K/yr');assert.equal(evidence[0].classification,'EXACT_SOURCE_QUOTE_NOT_EMPLOYER_VERIFIED');
});
test('viewed or accepted is insufficient to dispose a new job',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);assert.throws(()=>L.disposition(l,'linkedin:123','VERIFIED_INSERTED',{proof:'result.json',reason:'accepted'}));});
test('empty live results retain historical uncertainty',()=>{const l=L.seed(L.empty(),input);L.capture(l,{...page,jobs:[],next:false,emptyConfirmed:true,evidence:'No new matches for now'});assert.equal(L.summary(l).historicalGaps,1);assert.equal(L.summary(l).coverageComplete,false);});

test('intake waiting excludes completed and in-flight Writer jobs',()=>{const l=L.seed(L.empty(),input);L.capture(l,page);assert.equal(L.summary(l).awaitingIntake,1);l.jobs['linkedin:123'].status='POST_IN_FLIGHT_UNKNOWN';assert.equal(L.summary(l).awaitingIntake,0);l.jobs['linkedin:123'].status='VERIFIED_INSERTED';assert.equal(L.summary(l).awaitingIntake,0);});
test('a missing pagination observation never silently closes a source',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,{...page,next:undefined});assert.equal(l.sources.one.nextPageRequired,true);
 L.capture(l,{...page,next:false});assert.equal(l.sources.one.nextPageRequired,true);
 L.capture(l,{...page,next:false,endConfirmed:true});assert.equal(l.sources.one.nextPageRequired,false);assert.equal(l.sources.one.exhausted,true);
});
test('an observed empty live search stops pagination without inventing historical coverage',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,{...page,jobs:[],next:false,emptyConfirmed:true,evidence:'No matching jobs'});
 assert.equal(l.sources.one.nextPageRequired,false);assert.equal(L.summary(l).historicalGaps,1);assert.equal(L.summary(l).coverageComplete,false);
});
test('only observed results pagination with unchanged search filters advances the resume cursor',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,page);const from=L.safeUrl(page.url),to=from+'&start=25',proof={gmailId:'one',fromUrl:from,toUrl:to,at:page.at,paginationControl:'RESULTS_NEXT'};
 assert.throws(()=>L.advance(l,{...proof,paginationControl:'CAROUSEL_NEXT'}));
 assert.throws(()=>L.advance(l,{...proof,toUrl:to.replace('quality','sales')}));
 assert.throws(()=>L.advance(l,{...proof,toUrl:from}));
 L.advance(l,proof);assert.equal(l.sources.one.nextPagePosition,25);assert.equal(l.sources.one.resumeUrl,to);assert.equal(L.summary(l).remainingPageCount,null);assert.equal(L.summary(l).sourcesWithPendingResults,1);
});
test('submission checkpoints fence every candidate and retain prior recovery evidence',()=>{
 const l=L.seed(L.empty(),input);L.capture(l,page);const j=l.jobs['linkedin:123'];j.status='HELD_WRITER_REVIEW';j.disposition={proof:'original.json',reason:'WRITE_FAILED'};
 const p={requestId:'new-request',keys:[j.key],at:page.at,proof:'checkpoint.json'};
 assert.throws(()=>L.checkpointSubmission(l,p));assert.equal(j.status,'HELD_WRITER_REVIEW');
 L.checkpointSubmission(l,{...p,recoveries:{[j.key]:{originalRequestId:'original',originalCandidateOutcome:'WRITE_FAILED',durableBatchStatus:'COMPLETE',proof:'original.json'}}});
 assert.equal(j.status,'POST_IN_FLIGHT_UNKNOWN');assert.equal(j.dispositionHistory[0].evidence.proof,'original.json');assert.throws(()=>L.checkpointSubmission(l,p));
});
