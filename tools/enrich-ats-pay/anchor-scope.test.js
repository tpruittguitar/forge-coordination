'use strict';
const test=require('node:test'),a=require('node:assert/strict'),L=require('./lib'),C=require('./context');
const target={PRIMARY_ID:'TARGET',COMPANY:'Meta',TITLE:'Director, Manufacturing Engineering',LOCATION:'Remote, USA'};
const anchor=(id,co,low=150000,high=180000)=>({id,co,title:target.TITLE,location:'Remote, USA',low,high,asOf:new Date().toISOString(),sourceUrl:'https://employer.example/jobs/'+id});
test('plant operations, manufacturing technology and supply chain cannot cross-anchor',()=>{
 a.equal(L.comparable(target,{title:'Plant Director'}),false);
 a.equal(L.comparable(target,{title:'Director of Manufacturing Operations'}),false);
 a.equal(L.comparable(target,{title:'Director of Manufacturing Technology'}),true);
 a.equal(L.comparable({TITLE:'Director, Supply Chain'},{title:'Director of Operations'}),false);
 a.equal(L.comparable({TITLE:'Chief Manufacturing Officer'},{title:'Vice President, Manufacturing'}),false);
});
test('one dated compatible employer anchor cannot be outvoted by many lower peer salaries',()=>{
 const own=anchor('OWN','Meta',245000,309000),peers=Array.from({length:12},(_,i)=>anchor('PEER'+i,'Other '+i));
 for(const ref of [undefined,{companies:[],roles:[]}]){const e=L.estimate(target,[...peers,own],ref);a.deepEqual(e.ids,['OWN']);a.equal(e.low,245000);a.equal(e.high,309000);a.equal(e.conf,'LOW');}
});
test('employer preference honors explicit responsibility conflicts, staleness and curated aliases',()=>{
 const now=Date.now(),f=value=>({value,status:'CONFIRMED',sourceUrl:'https://employer.example/facts',quote:'Explicit responsibility',asOf:new Date(now).toISOString()}),own=anchor('OWN','Meta'),peer=anchor('PEER','Other');
 const ref={companies:[{company:'Meta',aliases:['Meta Platforms']}],roles:[{primaryId:'TARGET',company:'Meta',title:target.TITLE,location:target.LOCATION,facts:{reach:f('MULTI_SITE')}},{primaryId:'OWN',company:'Meta',title:own.title,location:own.location,facts:{reach:f('SINGLE_SITE')}}]};
 a.deepEqual(C.select(target,[own,peer],ref,now).map(x=>x.id),['PEER']);
 a.deepEqual(C.select(target,[{...own,asOf:'2020-01-01'},peer],{},now).map(x=>x.id),['PEER']);
 a.deepEqual(C.select(target,[{...own,co:'Meta Platforms'},peer],{companies:ref.companies},now).map(x=>x.id),['OWN']);
});
test('missing employer is never silently treated as same employer; saved wrong-family estimates need repair',()=>{
 a.equal(C.rank(target,[anchor('UNKNOWN',undefined)],{})[0].sameEmployer,false);
 const row={...target,p:{SALARY_BASIS:'FORGE-ESTIMATE',SALARY_SOURCE:'comparables:V2I-PLANT'}};
 a.deepEqual(L.invalidSavedAnchors(row,[{PRIMARY_ID:'V2I-PLANT',TITLE:'Plant Director',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:153000,SALARY_BASE_HIGH:180000}}]),['V2I-PLANT']);
});
