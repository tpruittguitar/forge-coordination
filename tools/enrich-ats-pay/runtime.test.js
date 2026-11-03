'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('./runtime');
test('research deadline stops nested work; Writer has a separate finite reserve',async()=>{
  let clock=0,calls=0;const b=create({researchMs:100,totalMs:300,now:()=>clock,pause:async ms=>{clock+=ms;}});
  await b.bounded(async()=>{calls++;clock=100;});
  await assert.rejects(b.bounded(async()=>calls++),{code:'RUN_BUDGET'});
  assert.equal(calls,1);b.setPhase('writer');assert.equal(b.remaining(),200);
  await assert.rejects(b.wait(200),{code:'RUN_BUDGET'});assert.equal(clock,100);
  clock=300;assert.equal(b.canStart(1),false);
});
test('stalled transport or body is aborted and the run can publish its deferred work',async()=>{
  const b=create({researchMs:500,totalMs:600});let signal;
  await assert.rejects(b.bounded(s=>{signal=s;return new Promise(()=>{});},20),{code:'RUN_BUDGET'});
  assert.equal(signal.aborted,true);assert.equal(b.canStart(),true);
});
test('a gap that cannot fit is never started; the next Writer POST stays deferred',async()=>{
  let clock=90,waits=0;const b=create({researchMs:100,totalMs:200,now:()=>clock,pause:async()=>waits++});clock=185;b.setPhase('writer');
  await assert.rejects(b.wait(110),{code:'RUN_BUDGET'});assert.equal(waits,0);
});
