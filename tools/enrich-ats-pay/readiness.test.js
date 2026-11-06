const{test}=require('node:test'),a=require('node:assert/strict'),{wait}=require('./readiness');
test('verified readiness releases the fixed delay early',async()=>{let t=0,n=0;const r=await wait({now:()=>t,sleep:async ms=>{t+=ms},probe:async()=>++n===2,maxMs:130000});a.equal(r.ready,true);a.equal(r.waitedMs,30000);});
test('unavailable proof preserves the bounded delay and never submits anything',async()=>{let t=0;const r=await wait({now:()=>t,sleep:async ms=>{t+=ms},probe:async()=>{throw Error('offline')},maxMs:130000});a.equal(r.ready,false);a.equal(r.waitedMs,130000);});
