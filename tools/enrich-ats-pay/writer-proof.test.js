'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{verify,notApplied,evidenceKey}=require('./writer-proof');
const batch=[{ruling:{requestId:'RUN-S001',primaryId:'V2I-ONE',fields:{SALARY_BASE_HIGH:240000,SALARY_MODEL_VERSION:'employer-upper-range-v5'}}}];
const index={requests:{'RUN-S001':{s:'COMPLETE'}}};
const good={request_result:{found:true,requestId:'RUN-S001',status:'COMPLETE',durable:true},row_readback:{ok:true,master:{endMarkerPresent:true},rows:[{primaryId:'V2I-ONE',found:true,matches:1,line:'row'}]}};
const parse=()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:'240000',SALARY_MODEL_VERSION:'employer-upper-range-v5'}});
test('compact COMPLETE index plus durable RESULT and exact submitted fields resolves a lost reply',async()=>{
  assert.equal(await verify(batch,{index,read:async a=>good[a],parse}),true);
});
test('no replay fence is cleared on absent aliases, non-durable RESULT or duplicate rows',async()=>{
  let calls=0;assert.equal(await verify(batch,{index:{requests:{}},read:async()=>calls++,parse}),false);assert.equal(calls,0);
  for(const bad of [{request_result:{...good.request_result,durable:false}},{row_readback:{...good.row_readback,rows:[{...good.row_readback.rows[0],matches:2}]}}])assert.equal(await verify(batch,{index,read:async a=>({...good,...bad})[a],parse}),false);
});
test('B: a COMPLETE durable receipt counts as applied when a master cell changed later; the drift is reported',async()=>{
  const drifted=[];assert.equal(await verify(batch,{index,read:async a=>good[a],parse:()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:'200000',SALARY_MODEL_VERSION:'employer-upper-range-v5'}}),onDrift:(id,keys)=>drifted.push([id,keys])}),true);
  assert.deepEqual(drifted,[['V2I-ONE',['SALARY_BASE_HIGH']]]);
  assert.equal(await verify(batch,{index,read:async a=>({...good,row_readback:{...good.row_readback,rows:[{primaryId:'V2I-ONE',found:false}]}})[a],parse}),false,'a missing row still keeps the fence');
});
test('A: Writer evidence-sidecar keys (EXPERIENCE_FIT_BASIS, notes) are not compared against master cells',async()=>{
  for(const k of ['EXPERIENCE_FIT_BASIS','SALARY_NOTE','SCOPE_SUMMARY','FIT_BASIS'])assert.equal(evidenceKey(k),true,k);
  for(const k of ['NOTE','TIM_NOTE','SALARY_BASIS','DEGREE_EVIDENCE_URL','SALARY_BASE_LOW','SCOPE_FIT_RAW','EXPERIENCE_FIT'])assert.equal(evidenceKey(k),false,k);
  const fit=[{ruling:{requestId:'RUN-S001',primaryId:'V2I-ONE',fields:{SCOPE_FIT_RAW:'33',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1',EXPERIENCE_FIT_BASIS:'CODE_FIT rev1: 2/11'}}}],drifted=[];
  assert.equal(await verify(fit,{index,read:async a=>good[a],parse:()=>({PRIMARY_ID:'V2I-ONE',p:{SCOPE_FIT_RAW:'33',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1'}}),onDrift:id=>drifted.push(id)}),true);assert.deepEqual(drifted,[]);
});
test('C: only an old batch with no receipt (or NOT_PERSISTED) and absent values is proven never applied',async()=>{
  const DAY=86400000,now=Date.parse('2026-11-18T15:00:00Z'),old=new Date(now-2*DAY).toISOString();
  const entry=(at,fields={SALARY_BASE_HIGH:240000})=>({at,requests:[{ruling:{requestId:'RUN-S001',primaryId:'V2I-ONE',fields}}]});
  const rb={ok:true,master:{endMarkerPresent:true},rows:[{primaryId:'V2I-ONE',found:true,matches:1,line:'row'}]};
  const reads=r=>async a=>a==='request_result'?{ok:true,requestId:'RUN-S001',...r}:rb,absentRow=()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:''}});
  assert.deepEqual(await notApplied(entry(old),{index:{requests:{}},read:reads({found:false}),parse:absentRow,now}),{reason:'NO_RECEIPT',open:1,complete:0});
  assert.equal((await notApplied(entry(old),{index:{requests:{'RUN-S001':{s:'NOT_PERSISTED'}}},read:reads({found:true,status:'NOT_PERSISTED',durable:false}),parse:absentRow,now})).reason,'NOT_PERSISTED');
  let calls=0;const count=async()=>{calls++;return {};};
  assert.equal(await notApplied(entry(new Date(now-DAY/2).toISOString()),{index:{requests:{}},read:count,parse:absentRow,now}),null,'under 24 h stays fenced');
  assert.equal(await notApplied(entry(undefined),{index:{requests:{}},read:count,parse:absentRow,now}),null,'no send time stays fenced');
  assert.equal(await notApplied(entry(old),{index,read:count,parse:absentRow,now}),null,'all COMPLETE belongs to the applied proof');
  assert.equal(await notApplied(entry(old),{index:{requests:{'RUN-S001':{s:'PENDING'}}},read:count,parse:absentRow,now}),null,'a pending receipt stays fenced');
  assert.equal(calls,0);
  assert.equal(await notApplied(entry(old),{index:{requests:{}},read:reads({found:true,status:'COMPLETE',durable:true}),parse:absentRow,now}),null,'a Writer RESULT keeps it fenced');
  assert.equal(await notApplied(entry(old),{index:{requests:{}},read:reads({found:false}),parse:()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:'240000'}}),now}),null,'values already on master keep it fenced');
  assert.equal(await notApplied(entry(old,{EXPERIENCE_FIT_BASIS:'x'}),{index:{requests:{}},read:reads({found:false}),parse:absentRow,now}),null,'nothing comparable keeps it fenced');
  const bare={at:old,ids:['V2I-ONE'],requestIds:['RUN-S001']};calls=0;
  assert.deepEqual(await notApplied(bare,{index:{requests:{}},read:reads({found:false}),parse:absentRow,now}),{reason:'NO_RECEIPT',open:1,complete:0,payload:'NONE'},'no stored rulings: receipt evidence alone');
  assert.equal(await notApplied(bare,{index:{requests:{}},read:reads({found:true,status:'COMPLETE',durable:true}),parse:absentRow,now}),null,'no stored rulings with a Writer RESULT stays fenced');
  assert.equal(await notApplied({...bare,at:new Date(now-DAY/2).toISOString()},{index:{requests:{}},read:count,parse:absentRow,now}),null,'no stored rulings under 24 h stays fenced');assert.equal(calls,0);
  assert.equal(await notApplied({at:old,requests:[]},{index:{requests:{}},read:count,parse:absentRow,now}),null,'no stored rulings stays fenced');
});
