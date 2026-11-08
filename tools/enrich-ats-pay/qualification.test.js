'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('./qualification'),L=require('./lib'),F=require('../programmed-coordinator/posting-formats.cjs'),S=require('../programmed-coordinator/source.cjs'),R=require('./recovery'),Pay=require('./pay-values');
const fixtures=require('./fixtures/degree-extraction.json');
for(const c of fixtures)test('degree contract: '+c.name,()=>{
 const expected=c.text===null?null:{text:c.text,req:c.req};
 assert.deepEqual(Q.parse(c.input),expected);assert.deepEqual(L.degreeFromText(c.input),expected);
 assert.deepEqual(F.degree(c.input,S.text),c.text==='NOT_STATED'?null:expected);
});
test('late alternatives remain intact beyond both former clipping limits',()=>{
 const input="Bachelor's degree in "+'manufacturing and engineering systems, '.repeat(15)+'required. Equivalent experience is accepted in lieu of a degree.';
 assert.ok(input.length>500);assert.deepEqual(Q.parse(input),{text:input,req:'PREFERRED'});
 const oversized="Bachelor's degree in "+'manufacturing and engineering systems, '.repeat(40)+'required. Equivalent experience accepted.';
 assert.ok(oversized.length>Q.MAX_EVIDENCE_LENGTH);assert.equal(Q.parse(oversized),null);
});
test('degree cache version upgrades even when pay parser is current, without freshening or mutating evidence',()=>{
 const row={PRIMARY_ID:'x',COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin, TX',p:{}},at='2026-11-08T01:00:00Z';
 const text='Lead production and quality operations. '.repeat(12)+fixtures[0].input;
 const old={identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at,fullPosting:true,identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text,degree:{text:"Bachelor's degree in Engineering required.",req:'REQUIRED'},factsVersion:Pay.VERSION,pay:{low:160000,high:200000}};
 const next=R.cached({postingEvidence:{x:old}},row,Date.parse(at)+1000);
 assert.equal(next.qualificationVersion,Q.VERSION);assert.equal(next.degree.req,'PREFERRED');assert.match(next.degree.text,/Equivalent experience/);assert.equal(next.at,at);assert.deepEqual(next.pay,old.pay);assert.equal(old.degree.req,'REQUIRED');
 assert.equal(R.cached({postingEvidence:{x:{...old,text:undefined}}},row,Date.parse(at)+1000),null);
});
test('shared successful-posting cache from PR 312 migrates degree only, preserving rejected pay and freshness',()=>{
 const Cache=require('./posting-cache'),at=Date.parse('2026-11-08T01:00:00Z'),url='https://job-boards.greenhouse.io/acme/jobs/123',row={PRIMARY_ID:'x',COMPANY:'Acme',TITLE:'Director',LOCATION:'Austin, TX',p:{SOURCE_URL:url}};
 const cache={},c=Cache.create({cache,now:()=>at+1000}),e=c.save(row,url,{identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text:'Lead manufacturing operations. '.repeat(20)+fixtures[0].input,payAmbiguous:true,structuredBaseSalary:{currency:'CAD'}},{at:new Date(at).toISOString()});
 e.qualificationVersion='obsolete';e.degree={text:"Bachelor's degree in Engineering required.",req:'REQUIRED'};
 const before=JSON.stringify(cache),got=c.find(row);
 assert.equal(got.degree.req,'PREFERRED');assert.match(got.degree.text,/Equivalent experience/);assert.equal(got.pay,null);assert.equal(got.payAmbiguous,true);assert.equal(got.payStatus,'PAY_UNRESOLVED');assert.equal(got.degreeAt,e.at);assert.equal(got.at,e.at);assert.equal(JSON.stringify(cache),before);
});
