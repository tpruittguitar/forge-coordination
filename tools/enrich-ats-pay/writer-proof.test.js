'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{verify}=require('./writer-proof');
const batch=[{ruling:{requestId:'RUN-S001',primaryId:'V2I-ONE',fields:{SALARY_BASE_HIGH:240000,SALARY_MODEL_VERSION:'employer-upper-range-v5'}}}];
const index={requests:{'RUN-S001':{s:'COMPLETE'}}};
const good={request_result:{found:true,requestId:'RUN-S001',status:'COMPLETE',durable:true},row_readback:{ok:true,master:{endMarkerPresent:true},rows:[{primaryId:'V2I-ONE',found:true,matches:1,line:'row'}]}};
const parse=()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:'240000',SALARY_MODEL_VERSION:'employer-upper-range-v5'}});
test('compact COMPLETE index plus durable RESULT and exact submitted fields resolves a lost reply',async()=>{
  assert.equal(await verify(batch,{index,read:async a=>good[a],parse}),true);
});
test('no replay fence is cleared on absent aliases, non-durable RESULT, duplicate rows or changed salary',async()=>{
  let calls=0;assert.equal(await verify(batch,{index:{requests:{}},read:async()=>calls++,parse}),false);assert.equal(calls,0);
  for(const bad of [{request_result:{...good.request_result,durable:false}},{row_readback:{...good.row_readback,rows:[{...good.row_readback.rows[0],matches:2}]}}])assert.equal(await verify(batch,{index,read:async a=>({...good,...bad})[a],parse}),false);
  assert.equal(await verify(batch,{index,read:async a=>good[a],parse:()=>({PRIMARY_ID:'V2I-ONE',p:{SALARY_BASE_HIGH:'200000'}})}),false);
});
