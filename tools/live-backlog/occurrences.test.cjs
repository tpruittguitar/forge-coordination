'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{annotate}=require('./occurrences.cjs');
const row=(key,extra={})=>({key,company:'Example Inc.',title:'Plant Manager',location:'Austin, TX',sourceUrl:'https://example.test/jobs/'+key,status:'WAITING',firstSeen:'2026-11-06T12:00:00Z',...extra});
test('occurrence is a one-based ordinal, not the total; oldest known row is first',()=>{
 const items=[row('z'),row('a',{firstSeen:null}),row('b',{firstSeen:'2026-11-05T00:00:00Z'})],before=JSON.stringify(items),out=annotate(items);
 assert.deepEqual(out.map(i=>[i.key,i.occurrence,i.occurrences]),[['z',2,3],['a',3,3],['b',1,3]]);
 assert.equal(JSON.stringify(items),before,'does not alter source cards');assert.match(out[0].repeatWarning,/Different source URLs/);
 assert.deepEqual(annotate([...items].reverse()).map(i=>[i.key,i.occurrence]).sort(),out.map(i=>[i.key,i.occurrence]).sort());
});
test('case/whitespace and canonical Unicode normalize; punctuation, sites and role levels do not',()=>{
 const out=annotate([row('a'),row('b',{company:' EXAMPLE   INC. ',title:'plant\tmanager',location:' Austin,  TX '}),row('c',{company:'Example Inc'}),row('d',{location:'Dallas, TX'}),row('e',{title:'Senior Plant Manager'}),row('f',{company:'Café'}),row('g',{company:'Cafe\u0301'})]);
 assert.deepEqual(out.map(i=>i.occurrences),[2,2,1,1,1,2,2]);assert.equal(out[0].occurrence,1);assert.equal(out[1].occurrence,2);
});
test('missing and unknown match fields never create duplicate groups',()=>{
 for(const field of ['company','title','location'])for(const value of [null,'','  ','UNKNOWN','N/A','not provided','—']){
  const out=annotate([row('a',{[field]:value}),row('b',{[field]:value})]);
  for(const item of out){assert.equal(item.occurrence,null);assert.equal(item.occurrences,null);assert.match(item.repeatWarning,/Not counted: missing/);}
 }
});
test('source identity and history/route differences stay explicit, not proof of duplicates',()=>{
 const out=annotate([row('a'),row('b',{sourceUrl:null,status:'IDENTITY_HOLD'}),row('c',{status:'MISSING_PREVIOUSLY_PRESENT'})]);
 assert.match(out[0].repeatWarning,/Source URL missing/);assert.match(out[0].repeatWarning,/Identity\/history hold/);assert.match(out[0].repeatWarning,/Different statuses/);
 assert.match(annotate([row('a'),row('b',{sourceUrl:'https://example.test/jobs/a'})])[0].repeatWarning,/Different source identities/);
});
test('rank tie breaks by key; refresh recalculates and changed members invalidate repeat signature',()=>{
 const items=Array.from({length:120},(_,i)=>row(String(i).padStart(3,'0'))),out=annotate(items.reverse());
 assert.equal(out.find(i=>i.key==='000').occurrence,1);assert.equal(out.find(i=>i.key==='119').occurrence,120);
 const next=annotate(items.filter(i=>i.key!=='000'));assert.equal(next.find(i=>i.key==='001').occurrence,1);assert.notEqual(next[0].repeatSignature,out[0].repeatSignature);
 const changed=annotate(items.map(i=>i.key==='000'?{...i,status:'HELD'}:i));assert.notEqual(changed[0].repeatSignature,out[0].repeatSignature);
});
