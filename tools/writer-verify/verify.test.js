'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validate,verifyOne,due,processFile}=require('./verify');

const line=(id,co='Acme',t='Director Quality',loc='Austin, TX')=>`1 | ${id} | ${co} | ${t} | SCOUT_INTAKE | OPEN | P | R | ${loc} | N`;
// Mock Writer: state per requestId; logs actions so tests can prove no write and the read order.
function writer(state,log=[]){
 return async url=>{
  const u=new URL(url),action=u.searchParams.get('action'),rid=u.searchParams.get('requestId');log.push(action);
  const s=state[rid]||{};let data={ok:true};
  if(action==='receipt_index')data={ok:true,source:'GITHUB',exists:true,sha:'abc',updatedAt:'2026-10-26T10:00:00Z',request:s.index||null};
  else if(action==='request_result')data={ok:true,requestId:rid,found:true,source:'index',status:'COMPLETE',durable:true,...(s.result||{})};
  else if(action==='row_readback'){const ids=u.searchParams.get('ids').split(',');data={ok:true,master:{endMarkerPresent:true},requested:ids.length,found:ids.length,rows:ids.map(id=>(s.rows||{})[id]||{primaryId:id,found:false,matches:0})}}
  return {ok:true,status:200,json:async()=>data};
 };
}
const opts=(state,log)=>({key:'k',transport:writer(state,log)});

test('validate rejects bad schema, IDs and sizes',()=>{
 assert.match(validate({}),/schema/);
 assert.match(validate({schema:'forge.writer-verify-request.v1',requested_by:'X',requests:[{requestId:'a b'}]}),/bad requestId/);
 assert.match(validate({schema:'forge.writer-verify-request.v1',requested_by:'X',requests:[{requestId:'R-1',primaryIds:['nope']}]}),/bad primaryIds/);
 assert.equal(validate({schema:'forge.writer-verify-request.v1',requested_by:'X',requests:[{requestId:'R-1',primaryIds:['V2I-1']}]}),null);
});
test('COMPLETE + durable result + exact rows = VERIFIED, with row identity returned',async()=>{
 const log=[];
 const r=await verifyOne({requestId:'R-1',primaryIds:['V2I-1']},opts({'R-1':{index:{s:'COMPLETE'},rows:{'V2I-1':{primaryId:'V2I-1',found:true,matches:1,line:line('V2I-1')}}}},log));
 assert.equal(r.verdict,'VERIFIED');
 assert.deepEqual(r.rows[0].row,{PRIMARY_ID:'V2I-1',COMPANY:'Acme',TITLE:'Director Quality',BUCKET:'SCOUT_INTAKE',LOCATION:'Austin, TX'});
 assert.deepEqual(log,['receipt_index','request_result','row_readback']);
});
test('pending index never calls request_result',async()=>{
 const log=[];
 const r=await verifyOne({requestId:'R-2',primaryIds:['V2I-2']},opts({'R-2':{index:{s:'PROCESSING'}}},log));
 assert.equal(r.verdict,'PENDING');assert.deepEqual(log,['receipt_index']);
});
test('no index entry, terminal bad state, non-durable result, missing rows, no IDs',async()=>{
 assert.equal((await verifyOne({requestId:'R-3'},opts({}))).verdict,'NOT_IN_INDEX');
 assert.equal((await verifyOne({requestId:'R-4'},opts({'R-4':{index:{s:'FALSE_COMPLETE'}}}))).verdict,'HELD');
 assert.equal((await verifyOne({requestId:'R-5',primaryIds:['V2I-5']},opts({'R-5':{index:{s:'COMPLETE'},result:{durable:false}}}))).verdict,'HELD');
 assert.equal((await verifyOne({requestId:'R-6',primaryIds:['V2I-6']},opts({'R-6':{index:{s:'COMPLETE'}}}))).verdict,'ROWS_MISSING');
 assert.equal((await verifyOne({requestId:'R-7'},opts({'R-7':{index:{s:'COMPLETE'}}}))).verdict,'COMPLETE_UNBOUND');
});
test('processFile writes results, keeps settled verdicts, rechecks PENDING, rejects bad files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wv-'));fs.mkdirSync(path.join(root,'verify/requests'),{recursive:true});
 const req={schema:'forge.writer-verify-request.v1',requested_by:'CHATGPT FORGE-EMAIL-CHATGPT-20261026-0800ET',requests:[{requestId:'R-1',primaryIds:['V2I-1']},{requestId:'R-2',primaryIds:['V2I-2']}]};
 fs.writeFileSync(path.join(root,'verify/requests/CHATGPT-20261026-0800-email.json'),JSON.stringify(req));
 fs.writeFileSync(path.join(root,'verify/requests/bad name.json'),'{}');
 const state={'R-1':{index:{s:'COMPLETE'},rows:{'V2I-1':{primaryId:'V2I-1',found:true,matches:1,line:line('V2I-1')}}},'R-2':{index:{s:'PROCESSING'}}};
 const now=new Date('2026-10-26T13:00:00Z');
 assert.deepEqual(due(root,now.getTime()),['CHATGPT-20261026-0800-email.json','bad name.json']);
 const r1=await processFile(root,'CHATGPT-20261026-0800-email.json',{...opts(state),now});
 assert.deepEqual(r1.results.map(x=>x.verdict),['VERIFIED','PENDING']);
 const bad=await processFile(root,'bad name.json',{...opts(state),now});assert.equal(bad.status,'REJECTED');
 // Still due only because R-2 is PENDING; on recheck R-1 is not re-read.
 assert.deepEqual(due(root,now.getTime()+60e3),['CHATGPT-20261026-0800-email.json']);
 state['R-2']={index:{s:'COMPLETE'},rows:{'V2I-2':{primaryId:'V2I-2',found:true,matches:1,line:line('V2I-2')}}};
 const log=[];
 const r2=await processFile(root,'CHATGPT-20261026-0800-email.json',{...opts(state,log),now:new Date(now.getTime()+60e3)});
 assert.deepEqual(r2.results.map(x=>x.verdict),['VERIFIED','VERIFIED']);
 assert.equal(log.filter(a=>a==='receipt_index').length,1,'settled R-1 not re-read');
 assert.equal(r2.firstCheckedAt,now.toISOString());
 assert.deepEqual(due(root,now.getTime()+120e3),[]);
 // Old PENDING results remain due; after that check they use a six-hour cadence.
 state['R-9']={index:{s:'PROCESSING'}};
 fs.writeFileSync(path.join(root,'verify/requests/GROK-20261026-0900.json'),JSON.stringify({...req,requests:[{requestId:'R-9'}]}));
 await processFile(root,'GROK-20261026-0900.json',{...opts(state),now});
 assert.deepEqual(due(root,now.getTime()+25*3600e3),['GROK-20261026-0900.json']);
 await processFile(root,'GROK-20261026-0900.json',{...opts(state),now:new Date(now.getTime()+25*3600e3)});
 assert.deepEqual(due(root,now.getTime()+26*3600e3),[]);
 assert.deepEqual(due(root,now.getTime()+31*3600e3),['GROK-20261026-0900.json']);
});
