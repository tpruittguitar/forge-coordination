'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./saved-card.cjs');
const raw={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/1'};
test('code reuses missing location from an exact saved identity before AI research',()=>{
 const m=new Map([['key',[{card:raw,proof:'saved-original.json',sourceSha256:'a'.repeat(64)}]]]),r=R.recover({...raw,location:''},['key'],m);a.equal(r.card.location,raw.location);a.deepEqual(r.recovery.fields,['location']);a.equal(r.recovery.postingFetched,false);
});
test('different worksites and contradictory known identities remain AI conflicts',()=>{
 const m=new Map([['key',[{card:raw},{card:{...raw,location:'Dallas, TX'}}]]]);a.equal(R.recover({...raw,location:''},['key'],m).conflict,'CONFLICTING_SAVED_IDENTITY');a.equal(R.recover({...raw,company:'Other',location:''},['key'],m).conflict,'CONFLICTING_SAVED_IDENTITY');
});
