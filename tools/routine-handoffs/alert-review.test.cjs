'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),S=require('../programmed-coordinator/store.cjs'),{importReview}=require('./alert-review.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'alert-review-')),privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'alert-private-')),quote='Plant Manager\nFactory\nAustin, TX\nhttps://jobs.factory.com/123',m={id:'abc',sourceSha256:'a'.repeat(64),at:new Date().toISOString(),fullBody:true,sender:'alerts@ziprecruiter.com',subject:'New jobs matching your job alert',body:'Job alert:\n'+quote};const review={schema:'forge.alert-card-review.v1',messageId:m.id,sourceSha256:m.sourceSha256,reviewedBy:'CHATGPT',taskKey:'FORGE_APPLICATION_WRITER_GOFER',cards:[{title:'Plant Manager',company:'Factory',location:'Austin, TX',url:'https://jobs.factory.com/123',quote}]};return{root,privateDir,m,review,save(){S.save(privateDir,'alert-reviews/'+m.sourceSha256+'.json',review);}};}
test('Gofer can supply an unsupported alert card only with its exact original private quote',()=>{
 const f=fixture();f.save();a.equal(importReview(f.root,f.m,f.privateDir).visible,1);
 const q=S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json');a.equal(Object.values(q.jobs)[0].title,'Plant Manager');a.ok(Object.values(q.jobs).every(j=>j.evidence.every(e=>!Object.hasOwn(e,'quote'))));a.equal(Object.values(q.sources)[0].historicalCoverage,'UNPROVEN');
});
test('invented fields stay pending without creating facts; changed envelope bindings still block the review',()=>{
 for(const change of [r=>r.cards[0].company='Other',r=>r.cards[0].url='https://different.example.com/123']){const f=fixture();change(f.review);f.save();const r=importReview(f.root,f.m,f.privateDir);a.equal(r.visible,0);const q=S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json');a.equal(Object.keys(q.jobs).length,0);a.equal(q.sources.abc.originalAlertRecovery.pendingCards[0].reason,'EXACT_ORIGINAL_ALERT_QUOTE_REQUIRED');}
 const f=fixture();f.review.sourceSha256='b'.repeat(64);f.save();a.throws(()=>importReview(f.root,f.m,f.privateDir),/SOURCE_BOUND_ALERT_REVIEW_REQUIRED/);a.equal(fs.existsSync(path.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json')),false);
});
test('AI repair isolates malformed cards and preserves opaque identities without exposing personalized links or quotes',()=>{
 const f=fixture(),opaque={title:'Director of Quality',company:'Second Factory',location:'Dallas, TX',url:'https://t.ladders.co/f/a/PRIVATE_REDIRECT_TOKEN'};
 opaque.quote=[opaque.title,opaque.company,opaque.location,opaque.url,'Sent to person@private.example'].join('\n');f.m.body+='\n'+opaque.quote;
 f.review.cards.push(opaque,{title:'Invented Title',company:'Fake',location:'Nowhere',url:'https://jobs.fake.example/456',quote:'not in original source'});f.save();
 const result=importReview(f.root,f.m,f.privateDir);a.equal(result.visible,2);a.equal(result.sourceRecoveryRequired,1);a.equal(result.unresolvedCards,1);
 const q=S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),jobs=Object.values(q.jobs);a.equal(jobs.length,2);a.equal(jobs.find(j=>j.company==='Factory').url,'https://jobs.factory.com/123');
 const unresolved=jobs.find(j=>j.company==='Second Factory');a.equal(unresolved.url,null);a.equal(unresolved.jobId,null);a.equal(unresolved.sourceRecovery.owner,'FORGE_INTAKE_SOURCE_RECOVERY');a.equal(unresolved.discoveryReview.contentBasis,'EXACT_ORIGINAL_ALERT_CARD');
 const raw=JSON.stringify(q);a.equal(raw.includes('PRIVATE_REDIRECT_TOKEN'),false);a.equal(raw.includes('person@private.example'),false);a.equal(raw.includes('not in original source'),false);
 S.save(f.root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{abc:{classification:'JOB_ALERT'}}});a.throws(()=>require('./alert-recovery.cjs').handoff(f.root,f.m),/ALERT_CARD_SOURCE_RESEARCH_REQUIRED/);a.equal(S.read(f.root,'state/MAIL_SOURCE_HANDOFFS.json').messages.abc.candidateKeys.length,2);
});
test('AI-reviewed public job routes strip nonidentity tracking but unknown personalized query fields remain unresolved',()=>{
 const {reviewedJob}=require('./alert-formats.cjs');a.equal(reviewedJob('https://jobs.factory.com/123?utm_source=email&token=PRIVATE_TOKEN').url,'https://jobs.factory.com/123');
 a.equal(reviewedJob('https://email.example.com/c/PRIVATE_TOKEN'),null);a.equal(reviewedJob('https://jobs.factory.com/123?email=person%40private.example'),null);a.equal(reviewedJob('https://127.0.0.1/jobs/123'),null);a.equal(reviewedJob('https://jobs.factory.com/PRIVATE_OPAQUE_TOKEN'),null);
});
test('contradictory AI-reviewed cards for the same posting remain unresolved rather than accepting the first',()=>{
 const f=fixture(),second={...f.review.cards[0],title:'Different Job'};second.quote=[second.title,second.company,second.location,second.url].join('\n');f.m.body+='\n'+second.quote;f.review.cards.push(second);f.save();
 const result=importReview(f.root,f.m,f.privateDir);a.equal(result.visible,0);a.equal(result.unresolvedCards,1);a.equal(Object.keys(S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json').jobs).length,0);
});
