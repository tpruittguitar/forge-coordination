'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {recover}=require('./interrupted-recovery'),{requestId}=require('./production-executor');
const {latch}=require('./auto-latch'),{carryForwardRoles}=require('./carry-forward');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'intake-recovery-')),file='receipts/auto-intake/FORGE-AUTO-20261104T051757Z.json';
 const candidates=['New','Rejected','Untouched'].map(COMPANY=>({expectedOutcome:'NEW',record:{COMPANY,TITLE:'Plant Manager',LOCATION:'Dayton, OH',SOURCE_URL:'https://example.com/'+COMPANY}}));
 const ids=candidates.map(c=>requestId(c.record)),pid='V2I-RECOVERED',writeId='W-original';
 const state={version:1,mode:'AUTO',sourceRunId:'FORGE-AUTO-20261104T051757Z',candidatesHash:crypto.createHash('sha256').update(JSON.stringify(candidates)).digest('hex'),requestIds:ids,
  results:{[ids[0]]:{ok:true,WRITE_ACCEPTED:true,writeId,COMPLETION_STATUS:'PENDING_VERIFICATION',results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:pid}],receipt:{REQUEST_ID:ids[0],NEW_PRIMARY_IDS:[pid]}},
   [ids[1]]:{ok:true,COMPLETION_STATUS:'COMPLETE',results:[{result:'WRITE_FAILED'}],receipt:{REQUEST_ID:ids[1],NEW_PRIMARY_IDS:[]}}},
  snapshots:{before:{master:{authenticated:true,source:'WRITER',rows:[]},archive:{authenticated:true,source:'WRITER',rows:[]}}},halts:[{message:'BLOCKED: Writer freeze/health'}]};
 fs.mkdirSync(path.join(root,'receipts/auto-intake'),{recursive:true});
 const save=()=>fs.writeFileSync(path.join(root,file),JSON.stringify(state));save();
 fs.writeFileSync(path.join(root,file.replace('.json','.candidates.json')),JSON.stringify(candidates));
 const log=[],options={pending:false,wrongWrite:false,wrongResultWrite:false,wrongRow:false,frozen:false,concurrent:false};
 const line='1 | '+pid+' | '+(options.wrongRow?'Wrong':'New')+' | Plant Manager | SCOUT_INTAKE | OPEN | P1 | - | Dayton, OH | NOTES';
 const transport=async(url,request)=>{
  assert.equal(request.method,'GET','recovery must never POST');
  const u=new URL(url),action=u.searchParams.get('action'),rid=u.searchParams.get('requestId');log.push({action,rid});
  const entry={s:options.pending?'PENDING':'COMPLETE',w:options.wrongWrite?'W-other':writeId,items:[{pid,op:'INSERT'}]};
  let data;
  if(action==='receipt_index')data={source:'GITHUB',exists:true,sha:'index',request:rid===ids[0]?entry:null};
  else if(action==='request_result')data={found:true,source:'index',requestId:rid,status:'COMPLETE',durable:true,entry:{...entry,w:options.wrongResultWrite?'W-other':writeId}};
  else if(action==='row_readback')data={requested:1,found:1,master:{endMarkerPresent:true},rows:[{primaryId:pid,found:true,matches:1,line:options.wrongRow?line.replace(' | New |',' | Wrong |'):line}]};
  else if(action==='ping')data={build:{commit:'test'}};
  else if(action==='writer_status')data={freeze:options.frozen?{reason:'maintenance'}:null,level:'ok',errors:[]};
  else if(action==='master')data={text:line+'\nEND V2_CURRENT_POPULATION_MASTER',fetchedAt:new Date().toISOString()};
  else if(action==='archive')data={mode:'NOT_MIGRATED',text:''};
  else throw Error('unexpected read '+action);
  if(options.concurrent&&action==='master')fs.appendFileSync(path.join(root,file),' ');
  return {ok:true,json:async()=>({ok:true,...data})};
 };
 return {root,file,state,candidates,ids,log,options,save,transport,read:()=>JSON.parse(fs.readFileSync(path.join(root,file)))};
}
test('interrupted accepted batch recovers without POST, preserves responses, and carries only untouched work',async()=>{
 const f=fixture(),original=structuredClone(f.state.results);
 const r=await recover(f.file,{root:f.root,key:'fixture',transport:f.transport});
 assert.equal(r.status,'RECOVERED');assert.equal(r.verified,1);assert.equal(r.noWrite,1);assert.equal(r.carriedForward,1);assert.equal(r.writerSubmissions,0);
 const s=f.read();assert.deepEqual(s.results,original);assert.equal(s.completedAt,undefined);
 assert.deepEqual(s.reconciliation.carryForwardRequestIds,[f.ids[2]]);
 assert.equal(latch([{file:f.file,state:s}]).blocking.length,0);
 assert.equal(carryForwardRoles([{file:f.file,state:s}],{root:f.root})[0].company,'Untouched');
 assert.ok(fs.existsSync(path.join(f.root,r.proof)));
 assert.ok(f.log.findIndex(x=>x.action==='request_result')>f.log.findIndex(x=>x.action==='receipt_index'));
 assert.equal((await recover(f.file,{root:f.root,key:'fixture',transport:f.transport})).status,'NOT_NEEDED');
});
test('pending receipt remains latched and never calls request_result',async()=>{
 const f=fixture();f.options.pending=true;
 assert.equal((await recover(f.file,{root:f.root,key:'fixture',transport:f.transport})).status,'WAITING_FOR_COMPLETE');
 assert.equal(f.log.some(x=>x.action==='request_result'),false);assert.equal(f.read().reconciliation,undefined);
});
for(const [name,option,pattern] of [['index write','wrongWrite',/write ID mismatch/],['result write','wrongResultWrite',/RECEIPT_WRITE_ID_MISMATCH/],['row identity','wrongRow',/INSERT_IDENTITY_MISMATCH/],['health','frozen',/not healthy/],['concurrent state','concurrent',/changed during recovery/]]){
 test(name+' mismatch never releases the latch',async()=>{
  const f=fixture();f.options[option]=true;
  await assert.rejects(recover(f.file,{root:f.root,key:'fixture',transport:f.transport}),pattern);
  assert.equal(f.read().reconciliation,undefined);
 });
}
test('an unknown transport response is fenced without any network calls',async()=>{
 const f=fixture();f.state.results[f.ids[0]]={status:'POST_IN_FLIGHT_UNKNOWN'};f.save();
 assert.equal((await recover(f.file,{root:f.root,key:'fixture',transport:f.transport})).status,'UNKNOWN_REMAINS');
 assert.equal(f.log.length,0);assert.equal(f.read().reconciliation,undefined);
});
test('changed candidate bytes or extra results cannot release a batch',async()=>{
 const f=fixture();f.state.candidatesHash='changed';f.save();
 await assert.rejects(recover(f.file,{root:f.root,key:'fixture',transport:f.transport}),/binding changed/);
 assert.equal(f.log.length,0);
});
