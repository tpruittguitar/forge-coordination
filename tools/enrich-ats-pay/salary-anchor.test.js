'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('./lib');
const senior={PRIMARY_ID:'V2I-TARGET',COMPANY:'Tesla',TITLE:'Sr. Manager of Quality, Optimus',LOCATION:'Austin, TX'};
const assoc={PRIMARY_ID:'V2I-ANCHOR',COMPANY:'Tesla',TITLE:'Quality Associate Manager, Optimus (Night Shift)',LOCATION:'Fremont, CA',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:96000,SALARY_BASE_HIGH:168000}};
test('Tesla regression: associate/regular/senior managers cannot anchor each other, including stale cached levels',()=>{
 const anchor=L.postedAnchor(assoc,assoc.p);anchor.level=1;
 assert.equal(L.sameEmployerAnchors(senior,[anchor]).length,0);
 assert.equal(L.estimate(senior,[anchor]),null);
 assert.equal(L.sameEmployerEstimate(senior,[{title:assoc.TITLE,state:'CA',pay:{low:96000,high:168000}}]),null);
 assert.equal(L.similarPostings(senior,[{title:assoc.TITLE,state:'CA',pay:{low:96000,high:168000}}]).length,0);
 assert.notEqual(L.level('Quality Manager'),L.level(senior.TITLE));
 assert.equal(L.level('Senior Quality Manager'),L.level(senior.TITLE));
 assert.equal(L.level('Sr Quality Manager'),L.level(senior.TITLE));
});
test('same-level posted evidence remains eligible; site estimates and estimate chains are excluded',()=>{
 const good={...assoc,TITLE:'Senior Manager, Quality'};
 assert.equal(L.sameEmployerAnchors(senior,[L.postedAnchor(good,good.p)]).length,1);
 assert.equal(L.postedAnchor(assoc,{...assoc.p,PAY_POSTED:'$71K-$113K Glassdoor estimate'}),null);
 assert.equal(L.postedAnchor(assoc,{...assoc.p,SALARY_BASIS:'FORGE-ESTIMATE'}),null);
});
test('saved estimates with incompatible anchors enter repair, valid estimates and historical missing references do not',()=>{
 const r={...senior,p:{SALARY_BASIS:'FORGE-ESTIMATE',SALARY_SOURCE:'same-employer:V2I-ANCHOR'}};
 assert.deepEqual(L.invalidSavedAnchors(r,[assoc]),['V2I-ANCHOR']);
 assert.deepEqual(L.invalidSavedAnchors(r,[{...assoc,TITLE:'Senior Quality Manager'}]),[]);
 assert.deepEqual(L.invalidSavedAnchors(r,[]),[]);
 assert.deepEqual(L.invalidSavedAnchors({...r,p:{...r.p,SALARY_BASIS:'EMPLOYER_POSTED'}},[assoc]),[]);
});

test('AI manufacturing leadership cannot inherit generic plant operations pay',()=>{
 const row={PRIMARY_ID:'META',COMPANY:'Meta',TITLE:'Director, AI Manufacturing Enablement',LOCATION:'Remote, USA'};
 for(const title of ['Plant Manager','Plant Director','Director Plant Operations','Director of Manufacturing Operations','Director of Overseas Manufacturing','Director, Value Stream Manufacturing'])assert.equal(L.comparable(row,{title}),false,title);
 assert.equal(L.comparable(row,{title:'Director, AI Manufacturing Systems'}),true);
 const anchors=[{id:'GENERIC',title:'Plant Director',co:'Other',low:153000,high:180000,region:'NE'}];assert.equal(L.estimate(row,anchors),null);
 const old={...row,p:{SALARY_BASIS:'FORGE-ESTIMATE',SALARY_SOURCE:'comparables:V2I-ANCHOR'}};assert.deepEqual(L.invalidSavedAnchors(old,[{PRIMARY_ID:'V2I-ANCHOR',TITLE:'Plant Director',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:153000,SALARY_BASE_HIGH:180000}}]),['V2I-ANCHOR']);
});
