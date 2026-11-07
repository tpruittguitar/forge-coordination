'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./saved-card.cjs');
const raw={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/1'};
test('code reuses missing location from an exact saved identity before AI research',()=>{
 const m=new Map([['key',[{card:raw,proof:'saved-original.json',sourceSha256:'a'.repeat(64)}]]]),r=R.recover({...raw,location:''},['key'],m);a.equal(r.card.location,raw.location);a.deepEqual(r.recovery.fields,['location']);a.equal(r.recovery.postingFetched,false);
});
test('different worksites and contradictory known identities remain AI conflicts',()=>{
 const m=new Map([['key',[{card:raw},{card:{...raw,location:'Dallas, TX'}}]]]);a.equal(R.recover({...raw,location:''},['key'],m).conflict,'CONFLICTING_SAVED_IDENTITY');a.equal(R.recover({...raw,company:'Other',location:''},['key'],m).conflict,'CONFLICTING_SAVED_IDENTITY');
});
test('a complete saved identity reuses its salary without recovering or fetching identity again',()=>{const P=require('../source-trial/posted-pay'),c={...raw,payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'}};c.postedPay=P.capture(c,{observedAt:'2026-11-06T00:00:00Z'});const m=new Map([['key',[{card:c,proof:'saved-original.json'}]]]),r=R.recover(raw,['key'],m);a.equal(r.recovery,null);a.equal(P.eligible(r.card).low,180125);});
test('complete saved cards recover missing scope, requisition and additional URL metadata',()=>{
 const I=require('../source-trial/job-identity'),saved={...raw,p:{REMOTE_HYBRID:'HYBRID',OPERATING_SCOPE:'MULTI_SITE',OPERATING_SCOPE_EVIDENCE:'Across sites',ATS_POSTING_URL:'https://ats.example.com/1',REQ_ID:'REQ-1'}};
 const m=new Map([['key',[{card:saved,proof:'saved.json'}]]]),r=R.recover(raw,['key'],m);
 a.equal(r.card.REMOTE_HYBRID,'HYBRID');a.equal(r.card.REQ_ID,'REQ-1');a.equal(r.card.ATS_POSTING_URL,'https://ats.example.com/1');a.equal(I.fields(r.card).scopeUncertain,true);a.equal(r.recovery.postingFetched,false);a.ok(r.recovery.fields.includes('OPERATING_SCOPE'));
});
test('contradictory saved metadata remains explicit rather than choosing a URL or clearing broad scope',()=>{
 const m=new Map([['key',[{card:{...raw,REMOTE_HYBRID:'ONSITE',ATS_POSTING_URL:'https://ats.example.com/1'}},{card:{...raw,REMOTE_HYBRID:'REMOTE',ATS_POSTING_URL:'https://ats.example.com/2'}}]]]);
 const r=R.recover(raw,['key'],m);a.equal(r.conflict,'CONFLICTING_SAVED_IDENTITY_METADATA');a.equal(r.card.ATS_POSTING_URL,undefined);a.equal(r.card.REMOTE_HYBRID,undefined);
 const alias=new Map([['key',[{card:{...raw,workArrangement:'REMOTE'}}]]]);a.equal(R.recover({...raw,REMOTE_HYBRID:'ONSITE'},['key'],alias).conflict,'CONFLICTING_SAVED_IDENTITY_METADATA');
});
test('saved-card indexing retains flattened scope and identity metadata',()=>{
 const saved={...raw,payload:{REMOTE_HYBRID:'REMOTE',LOCATION_SCOPE:'regional',REQ_ID:'R-42',DIRECT_JOB_URL:'https://ats.example.com/42'}},m=R.index('.', {entries:{}},{jobs:{}},[{new_roles:[saved]}]),card=[...m.values()][0][0].card;
 a.equal(card.REMOTE_HYBRID,'REMOTE');a.equal(card.LOCATION_SCOPE,'regional');a.equal(card.REQ_ID,'R-42');a.equal(card.DIRECT_JOB_URL,'https://ats.example.com/42');
});
