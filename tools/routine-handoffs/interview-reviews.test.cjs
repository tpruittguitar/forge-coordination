const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path'),S=require('../programmed-coordinator/store.cjs'),I=require('./interview-reviews.cjs');
test('a source-bound recruiter contact clears only its matching mail exception and preserves an uncertain write',t=>{const dir=fs.mkdtempSync(p.join(os.tmpdir(),'contact-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const root=p.join(dir,'repo'),privateDir=p.join(dir,'private'),source={id:'abc',fullBody:true,body:'Personal recruiter contact for the exact saved role',sourceSha256:'a'.repeat(64)};S.save(privateDir,'source.json',source);S.save(root,'state/MAIL_PROCESSING.json',{messages:{abc:{sourceSha256:source.sourceSha256,status:'EXCEPTION'}},exceptions:{abc:{reason:'RECRUITING_OR_AMBIGUOUS'},other:{reason:'unchanged'}},transactions:{}});const r={schema:'forge.interview-source-review.v1',reviewedBy:'CHATGPT',reviewedAt:new Date().toISOString(),sourceFile:'source.json',sourceSha256:S.hash(source),company:'Employer',title:'Role',evidenceQuote:source.body,event:{primaryId:'ID',type:'RECRUITER_CONTACT',eventDate:'2026-11-04',sourceType:'EMAIL',gmailMessageId:'abc',evidenceVerified:true}};S.save(privateDir,'interview-reviews/a.json',r);const args={root,privateDir,snapshot:{rows:[{PRIMARY_ID:'ID',COMPANY:'Employer',TITLE:'Role'}]},checkLock(){}};a.equal(I.consume(args).recorded,1);let m=S.read(root,'state/MAIL_PROCESSING.json');a.equal(m.messages.abc.status,'RECORDED_EVENT');a.equal(m.exceptions.abc,undefined);a.ok(m.exceptions.other);m.messages.abc.transactionId='pending';m.messages.abc.status='POST_IN_FLIGHT_UNKNOWN';S.save(root,'state/MAIL_PROCESSING.json',m);I.consume(args);a.equal(S.read(root,'state/MAIL_PROCESSING.json').messages.abc.status,'POST_IN_FLIGHT_UNKNOWN');});
test('source-bound interview handoff deduplicates and never writes canonical jobs',t=>{const dir=fs.mkdtempSync(p.join(os.tmpdir(),'interview-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const root=p.join(dir,'repo'),privateDir=p.join(dir,'private'),source={id:'abc',body:'Advance to panel for Quality Engineering Manager, Solar'};S.save(privateDir,'source.json',source);const r={schema:'forge.interview-source-review.v1',reviewedBy:'CHATGPT',reviewedAt:new Date().toISOString(),sourceFile:'source.json',sourceSha256:S.hash(source),company:'Tesla',title:'Quality Engineering Manager, Solar',evidenceQuote:source.body,event:{primaryId:'V2I-ONE',type:'INTERVIEW_STATUS',stage:'ONSITE_PANEL',progress:'INVITED',eventDate:'2026-11-04',sourceType:'EMAIL',gmailMessageId:'abc',evidenceVerified:true}};S.save(privateDir,'interview-reviews/a.json',r);const args={root,privateDir,snapshot:{rows:[{PRIMARY_ID:'V2I-ONE',COMPANY:r.company,TITLE:r.title}]},checkLock(){}};a.equal(I.consume(args).recorded,1);a.equal(I.consume(args).unchanged,1);a.equal(S.read(root,'state/APPLICATION_OUTCOMES.json').events.length,1);S.save(privateDir,'source.json',{body:'changed'});a.equal(I.consume(args).exceptions[0].reason,'SOURCE_BOUND_INTERVIEW_REVIEW_REQUIRED');});
function fixture(t){const dir=fs.mkdtempSync(p.join(os.tmpdir(),'interview-revisions-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return{root:p.join(dir,'repo'),privateDir:p.join(dir,'private'),snapshot:{rows:[{PRIMARY_ID:'V2I-ONE',COMPANY:'Employer',TITLE:'Role'}]},checkLock(){}};}
function review(f,name,{at='2026-11-01T00:00:00Z',progress='INVITED',id='message1',sourceType='EMAIL',sourceId=id}={}){
 const source={id:sourceId,body:'Exact captured source text for this interview or recruiter event',fullBody:true,sourceSha256:S.hash(sourceId||'calendar')};
 S.save(f.privateDir,name+'-source.json',source);
 const r={schema:'forge.interview-source-review.v1',reviewedBy:'CHATGPT',reviewedAt:at,sourceFile:name+'-source.json',sourceSha256:S.hash(source),company:'Employer',title:'Role',evidenceQuote:source.body,event:{primaryId:'V2I-ONE',type:'INTERVIEW_STATUS',stage:'ONSITE_PANEL',progress,eventDate:'2026-10-30T12:00:00Z',sourceType,evidenceVerified:true,...(sourceType==='EMAIL'?{gmailMessageId:id}:{sourceEventHash:'a'.repeat(64)})}};
 S.save(f.privateDir,'interview-reviews/'+name+'.json',r);return r;
}
test('review revision time controls precedence across filenames and unchanged runs make no ledger writes',t=>{
 const f=fixture(t),newer=review(f,'a-new',{at:'2026-11-02T00:00:00Z',progress:'COMPLETED',sourceType:'GOOGLE_CALENDAR'}),older=review(f,'z-old',{sourceType:'GOOGLE_CALENDAR'});
 const first=I.consume(f);a.equal(first.recorded,1);a.equal(first.superseded,1);a.deepEqual(first.exceptions,[]);
 const before=['state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_EVENTS.json'].map(n=>fs.readFileSync(p.join(f.root,n),'utf8'));
 const event=S.read(f.root,'state/APPLICATION_OUTCOMES.json').events[0];a.equal(event.progress,'COMPLETED');a.equal(event.sourceReviewAt,newer.reviewedAt);a.ok(event.supersededReviews.includes(S.hash(older)));
 const second=I.consume(f);a.equal(second.recorded,0);a.equal(second.unchanged,1);
 a.deepEqual(['state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_EVENTS.json'].map(n=>fs.readFileSync(p.join(f.root,n),'utf8')),before);
 fs.rmSync(p.join(f.privateDir,'interview-reviews/a-new.json'));a.equal(I.consume(f).recorded,0);a.equal(S.read(f.root,'state/APPLICATION_OUTCOMES.json').events[0].progress,'COMPLETED');
});
test('equal-time conflicting reviews do not overwrite events or block unrelated email events',t=>{
 const f=fixture(t);review(f,'a',{progress:'INVITED'});review(f,'b',{progress:'COMPLETED'});review(f,'other',{id:'other-message'});
 const r=I.consume(f);a.equal(r.recorded,1);a.equal(r.exceptions[0].reason,'INTERVIEW_REVIEW_REVISION_CONFLICT');a.equal(S.read(f.root,'state/APPLICATION_OUTCOMES.json').events[0].gmailMessageId,'other-message');
});
test('missing or mismatched Gmail source IDs are rejected per review without collapsing valid messages',t=>{
 const f=fixture(t);review(f,'missing',{id:undefined});
 const missing=S.read(f.privateDir,'interview-reviews/missing.json');delete missing.event.gmailMessageId;S.save(f.privateDir,'interview-reviews/missing.json',missing);
 review(f,'wrong',{id:'wrong',sourceId:'actual'});review(f,'one',{id:'one'});review(f,'two',{id:'two'});
 const r=I.consume(f);a.equal(r.recorded,2);a.deepEqual(r.exceptions.map(e=>e.reason).sort(),['BOUND_GMAIL_MESSAGE_ID_REQUIRED','EXACT_REVIEW_EMAIL_SOURCE_REQUIRED']);
 a.deepEqual(S.read(f.root,'state/APPLICATION_OUTCOMES.json').events.map(e=>e.gmailMessageId).sort(),['one','two']);
});
test('a thread review quote must be in the exact bound message',t=>{
 const f=fixture(t),r=review(f,'thread');const source={messages:[{id:'message1',body:'Other text belonging to the correct message',fullBody:true},{id:'message2',body:r.evidenceQuote,fullBody:true}]};
 S.save(f.privateDir,r.sourceFile,source);r.sourceSha256=S.hash(source);S.save(f.privateDir,'interview-reviews/thread.json',r);
 const result=I.consume(f);a.equal(result.recorded,0);a.equal(result.exceptions[0].reason,'INTERVIEW_QUOTE_REQUIRED');
});
test('unknown prior review precedence remains explicit and independently verified persistence is preserved',t=>{
 const f=fixture(t),r=review(f,'next',{at:'2026-11-02T00:00:00Z'}),prior={...r.event,reviewSha256:'b'.repeat(64),masterWriteStatus:'VERIFIED',writerProof:'receipts/original.json'};
 for(const file of ['state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_EVENTS.json'])S.save(f.root,file,{events:[prior]});
 a.equal(I.consume(f).exceptions[0].reason,'INTERVIEW_REVIEW_PRECEDENCE_REQUIRED');
 prior.sourceReviewAt='2026-11-01T00:00:00Z';for(const file of ['state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_EVENTS.json'])S.save(f.root,file,{events:[prior]});
 a.equal(I.consume(f).recorded,1);const saved=S.read(f.root,'state/APPLICATION_OUTCOMES.json').events[0];a.equal(saved.masterWriteStatus,'VERIFIED');a.equal(saved.writerProof,prior.writerProof);
});
test('invalid interview review reaches existing scheduled exception work and a consumed correction resolves it',t=>{
 const W=require('./exception-work.cjs'),Q=require('./exceptions.cjs'),P=require('./exception-progress.cjs'),f=fixture(t),bad=review(f,'bad'),other=review(f,'unrelated',{id:'other'});
 delete bad.event.gmailMessageId;S.save(f.privateDir,'interview-reviews/bad.json',bad);
 const first=I.consume(f);a.equal(first.recorded,1);a.equal(first.exceptions.length,1);const held=first.exceptions[0];
 const inspected=I.inspect({privateDir:f.privateDir,sourceReviewRef:held.sourceReviewRef,sourceVersion:held.sourceVersion});a.equal(inspected.review.sourceFile,bad.sourceFile);
 a.throws(()=>I.inspect({privateDir:f.privateDir,sourceReviewRef:held.sourceReviewRef,sourceVersion:'a'.repeat(64)}),/VERSION_CHANGED/);
 const state={items:{},transactions:{},batches:{},interviewReviews:first},report={runId:'COORDINATOR-TEST',aiExceptions:[],codeExceptions:[]};
 S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);W.sync({root:f.root,state,report,apply:true});
 const queue=Q.queue(f.root);a.equal(queue.items.length,1);a.equal(queue.items[0].kind,'INTERVIEW');a.match(queue.items[0].nextAction,/correctsReview/);a.ok(!JSON.stringify(queue).includes(bad.sourceFile));
 const started=Date.now(),runId='FORGE-EXCEPTION-CHATGPT-INTERVIEW-CORRECTION';P.start(f.root,runId,20,started);
 const corrected={...bad,reviewedAt:new Date().toISOString(),correctsReview:{sourceReviewRef:held.sourceReviewRef,sourceVersion:held.sourceVersion},event:{...bad.event,gmailMessageId:'message1'}};
 S.save(f.privateDir,'interview-reviews/corrected.json',corrected);
 const before=S.read(f.root,'state/APPLICATION_OUTCOMES.json').events.find(e=>e.gmailMessageId==='other');
 state.interviewReviews=I.consume(f);a.equal(state.interviewReviews.recorded,1);a.equal(state.interviewReviews.unchanged,1);a.deepEqual(state.interviewReviews.exceptions,[]);a.equal(state.interviewReviews.resolvedReviews[0].correctedBy,S.hash(corrected));
 S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',state);const synced=W.sync({root:f.root,state,report,apply:true});a.equal(synced.cases[queue.items[0].exceptionId].status,'NO_LONGER_OPEN');a.equal(Q.queue(f.root).items.length,0);
 const proof=P.checkpoint(f.root,{runId,completedAt:new Date().toISOString(),attempts:[]});a.equal(proof.resolved,1);a.equal(proof.canonicalCompletionsClaimed,0);
 a.deepEqual(S.read(f.root,'state/APPLICATION_OUTCOMES.json').events.find(e=>e.gmailMessageId==='other'),before);a.equal(I.consume(f).recorded,0);
});
test('a correction cannot suppress a different review version or replace its retained source',t=>{
 const f=fixture(t),bad=review(f,'bad');delete bad.event.gmailMessageId;S.save(f.privateDir,'interview-reviews/bad.json',bad);
 const held=I.consume(f).exceptions[0],corrected={...bad,reviewedAt:new Date().toISOString(),correctsReview:{sourceReviewRef:held.sourceReviewRef,sourceVersion:'f'.repeat(64)},event:{...bad.event,gmailMessageId:'message1'}};
 S.save(f.privateDir,'interview-reviews/corrected.json',corrected);let r=I.consume(f);a.equal(r.recorded,0);a.equal(r.resolvedReviews.length,0);a.ok(r.exceptions.some(e=>e.reason==='INTERVIEW_CORRECTION_BINDING_REQUIRED'));
 const other={id:'message1',body:'Different source content is not a repair of this captured message'};S.save(f.privateDir,'different-source.json',other);corrected.correctsReview.sourceVersion=held.sourceVersion;corrected.sourceFile='different-source.json';corrected.sourceSha256=S.hash(other);corrected.evidenceQuote=other.body;S.save(f.privateDir,'interview-reviews/corrected.json',corrected);
 r=I.consume(f);a.equal(r.recorded,0);a.equal(r.resolvedReviews.length,0);a.ok(r.exceptions.some(e=>e.reason==='INTERVIEW_CORRECTION_SOURCE_REQUIRED'));
});
test('unknown legacy precedence can be repaired by an exact bound source review supersession',t=>{
 const f=fixture(t),pending=review(f,'pending'),oldHash='b'.repeat(64);
 for(const file of ['state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_EVENTS.json'])S.save(f.root,file,{events:[{...pending.event,reviewSha256:oldHash}]});
 const held=I.consume(f).exceptions[0];a.equal(held.reason,'INTERVIEW_REVIEW_PRECEDENCE_REQUIRED');a.equal(held.priorReviewSha256,oldHash);
 const corrected={...pending,reviewedAt:new Date().toISOString(),correctsReview:{sourceReviewRef:held.sourceReviewRef,sourceVersion:held.sourceVersion},supersedesReviewSha256:oldHash};S.save(f.privateDir,'interview-reviews/repair.json',corrected);
 const r=I.consume(f);a.equal(r.recorded,1);a.deepEqual(r.exceptions,[]);a.equal(r.resolvedReviews.length,1);a.ok(S.read(f.root,'state/APPLICATION_OUTCOMES.json').events[0].supersededReviews.includes(oldHash));
});
