'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./discovery-review'),P=require('../enrich-ats-pay/lib');
const card={company:'Acme',title:'Director of Manufacturing',location:'Austin, TX',url:'https://example.com/job/1',source:'BOARD:greenhouse',family:'MFG_PROD',level:'DIRECTOR_PLUS',place:'TX'};
test('discovery explains its pass and carries quoted ATS hits, source hash, date and unknowns',()=>{
 const description='<p>Lead manufacturing and assembly operations at the plant.</p><p>Manage quality and production engineering teams.</p>',r=R.review(card,{description,observedAt:'2026-11-05T06:00:00Z'});
 a.match(r.selectionReason,/MFG_PROD/);a.ok(r.discoveryReview.scopeHits.includes('assembly'));a.ok(r.discoveryReview.leadershipHits.includes('manage'));a.match(r.discoveryReview.sourceSha256,/^[a-f0-9]{64}$/);a.ok(r.discoveryReview.evidenceQuotes.length);a.equal(r.discoveryReview.canonicalEligibility,false);a.equal(r.description.includes('<p>'),false);
});
test('no ATS content remains provisional and never claims responsibilities were checked',()=>{
 const r=R.review(card);a.equal(r.discoveryReview.detailStatus,'NOT_RETURNED_BY_SOURCE');a.ok(r.discoveryReview.unknowns.includes('ROLE_CONTENT'));a.equal(r.discoveryReview.sourceSha256,null);a.match(r.selectionReason,/unavailable/);
});
test('ATS content already retrieved is retained rather than fetched again; Workday details get one bounded read',async()=>{
 let calls=0;const cards=[{...card,description:'Manage production at the plant.',detailUrl:'https://example.com/redundant'},{...card,detailUrl:'https://example.com/workday/detail'}];await R.reviewAll(cards,{detail:async()=>{calls++;return{jobPostingInfo:{jobDescription:'Lead manufacturing and quality teams.'}};}});a.equal(calls,1);a.equal(cards[1].discoveryReview.detailStatus,'SOURCE_CONTENT_REVIEWED');
});
test('source failure and runtime boundaries preserve candidates with explicit review obligations',async()=>{
 const cards=[{...card,detailUrl:'https://example.com/1'}];await R.reviewAll(cards,{deadline:0});a.equal(cards.length,1);a.equal(cards[0].discoveryReview.detailStatus,'DEFERRED_RUNTIME_BOUNDARY');
});
test('Greenhouse, Lever and Ashby board parsing preserves description evidence',()=>{
 a.match(P.parseBoard({kind:'greenhouse'},{jobs:[{title:card.title,content:'Manufacturing leadership',location:{name:card.location}}]})[0].description,/Manufacturing/);
 a.match(P.parseBoard({kind:'lever'},[{text:card.title,descriptionPlain:'Plant leadership',lists:[{text:'Responsibilities',content:'Manage manufacturing'}]}])[0].description,/Manage manufacturing/);
 a.match(P.parseBoard({kind:'ashby'},{jobs:[{title:card.title,descriptionHtml:'Quality leadership'}]})[0].description,/Quality/);
});

test('detail reads are capped at three, retain order and isolate one failing source',async()=>{
 let active=0,peak=0;
 const cards=Array.from({length:8},(_,n)=>({...card,title:card.title+' '+n,detailUrl:String(n)}));
 const result=await R.reviewAll(cards,{concurrency:30,detail:async url=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;if(url==='2')throw Error('offline');return {jobPostingInfo:{jobDescription:'Manage production '+url}};}});
 a.equal(peak,3);a.deepEqual(result.map(r=>r.title),Array.from({length:8},(_,n)=>card.title+' '+n));a.equal(result[2].discoveryReview.detailStatus,'DETAIL_ACCESS_FAILED');a.equal(result[7].description,'Manage production 7');
});

test('all discovery sources apply the shared zero gate without new reads and retain captured identities',async()=>{
 const profile=require('./resume-match').load(),screenContext={profile,documents:{resumes:[{id:profile.source.fileId,modifiedTime:profile.source.modifiedAt}]}},description=('Oversee client appointments and customer support. Direct account administrators and oversee branch budgets. Coordinate customer correspondence and resolve service inquiries. ').repeat(3);
 const cards=['BOARD:greenhouse','BOARD:lever','BOARD:ashby','BOARD:workday','JOBSPY:linkedin','HIRINGCAFE'].map((source,n)=>({...card,source,url:card.url+'/'+n,title:'Director of Operational Excellence',description,status:n===0?'EXISTING_PROTECTED':'NEW'}));let calls=0;
 await R.reviewAll(cards,{screenContext,detail:async()=>{calls++;throw Error('No new lookup');}});a.equal(calls,0);a.equal(cards.length,6);a.equal(cards[0].status,'EXISTING_PROTECTED');
 for(const c of cards){a.equal(c.discoveryReview.decision,'EXCLUDE_ATS_ZERO');a.equal(c.discoveryReview.preliminaryScreen.atsGate.hits,0);a.equal(c.description,description.trim());a.match(c.selectionReason,/0; exclude from active discovery/);a.equal(c.discoveryReview.canonicalEligibility,false);}
});
