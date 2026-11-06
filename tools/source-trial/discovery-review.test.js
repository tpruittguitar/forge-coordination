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
