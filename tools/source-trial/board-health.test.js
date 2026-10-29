'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('./board-health');
const board={kind:'workday',key:'workday:acme.wd1.myworkdayjobs.com/Careers',host:'acme.wd1.myworkdayjobs.com',tenant:'acme',site:'Careers',companies:new Set(['Acme'])};
const ok=j=>({ok:true,status:200,json:async()=>j});
test('transient read failures retry with a bound; permanent access/request failures do not',async()=>{
 let calls=0;const waits=[];
 const r=await H.jsonRequest({url:'https://example.com/jobs'},{fetcher:async()=>++calls<3?{ok:false,status:503}:ok({jobs:[]}),wait:async n=>waits.push(n)});
 assert.equal(r.attempts,3);assert.deepEqual(waits,[500,1000]);
 for(const code of [403,404,422]){calls=0;await assert.rejects(H.jsonRequest({url:'https://example.com/jobs'},{fetcher:async()=>{calls++;return {ok:false,status:code}},wait:async()=>{}}),new RegExp('HTTP '+code));assert.equal(calls,1);}
});
test('Workday 422 can recover public tenant configuration without guessing or executing scripts',async()=>{
 const b={...board,tenant:'vhr-otsuka'},calls=[];
 const r=await H.readBoard(b,['Quality'],{wait:async()=>{},fetcher:async(url,opts)=>{
  calls.push(url);if(opts.method==='POST')return url.includes('/vhr_otsuka/')?ok({jobPostings:[]}):{ok:false,status:422};
  return {ok:true,text:async()=>`tenant: "vhr_otsuka", siteId: "Careers"`};
 }});
 assert.equal(r.status,'OK');assert.equal(r.board.tenant,'vhr_otsuka');assert.equal(r.tenantRecovered,true);assert.equal(calls.length,3);
});
test('failed source survives later passes, preserves last success, and is removed from recovery after success',()=>{
 const s=H.loadState(),pass={status:'OK',jobs:[{}],attempts:1,succeeded:1,failed:0,error:''};
 H.record(s,board,pass,'2026-10-28T12:00:00Z');
 H.record(s,board,{...pass,status:'TEMPORARY_FAILURE',error:'HTTP 500',httpStatus:500,jobs:[],succeeded:0,failed:1},'2026-10-28T16:00:00Z');
 const saved=H.loadState(JSON.stringify(s));assert.equal(saved.boards[board.key].lastSuccessAt,'2026-10-28T12:00:00Z');
 assert.equal(H.recoveryBoards(saved,new Set(),Date.parse('2026-10-28T16:01:00Z')).length,0);
 assert.equal(H.recoveryBoards(saved,new Set(),Date.parse('2026-10-28T17:00:00Z')).length,1);
 assert.equal(H.recoveryBoards(saved,new Set(['acme']),Date.parse('2026-10-28T17:00:00Z')).length,0);
 H.record(saved,board,pass,'2026-10-28T20:00:00Z');assert.equal(H.recoveryBoards(saved,new Set(),Date.parse('2026-10-29T00:00:00Z')).length,0);
});
test('partial searches and malformed responses cannot erase an outstanding failure',async()=>{
 let calls=0;const r=await H.readBoard(board,['Quality','Manufacturing'],{wait:async()=>{},fetcher:async()=>++calls===1?ok({jobPostings:[{title:'Director Quality',externalPath:'/job/1',locationsText:'Austin, TX'}]}):{ok:false,status:403}});
 assert.equal(r.status,'PARTIAL');assert.equal(r.jobs.length,1);assert.equal(r.failed,1);
 const bad=await H.readBoard({...board,kind:'ashby',board:'acme'},[],{wait:async()=>{},fetcher:async()=>ok({message:'maintenance'})});assert.equal(bad.status,'INVALID_RESPONSE');assert.notEqual(bad.error,'');
});
test('reviewed address repairs preserve the real employer and do not select the unrelated Radiant board',()=>{
 assert.equal(H.repair({key:'greenhouse:radiant'}).board,'radiant-industries');
 assert.equal(H.repair({key:'workday:atotech.wd3.myworkdayjobs.com/Atotech'}).site,'MKSCareersAmericas');
 assert.equal(H.repair({key:'workday:challengemfg.wd12.myworkdayjobs.com/Challenge'}).host,'challengemfg.wd503.myworkdayjobs.com');
 assert.equal(H.repair({key:'workday:vhr-otsuka.wd1.myworkdayjobs.com/External'}).tenant,'vhr_otsuka');
 assert.throws(()=>H.loadState('{"schema":"wrong","boards":{}}'),/history/);
});
