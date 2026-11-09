'use strict';
const test=require('node:test'),a=require('node:assert/strict'),{select}=require('./continuation.cjs');
test('an abnormal card is recorded and a later valid candidate is still selected',()=>{
 const plan={items:[{key:'unknown',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'original'},{key:'bad',status:'READY'},{key:'valid',status:'READY'}]};
 const r=select(plan,1,item=>{if(item.key==='bad')throw Error('bad identity');});
 a.deepEqual(r.held,['bad']);a.deepEqual(r.selected.map(x=>x.key),['valid']);a.equal(plan.items[0].requestId,'original');a.equal(plan.items[1].status,'HELD_CARD_REVIEW');
});
test('direct-return selection skips unrelated READY cards without mutating or validating them',()=>{
 const plan={items:[{key:'unrelated',status:'READY',record:{saved:true}},{key:'pending',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'ORIGINAL'},{key:'returned',status:'READY'}]},before=structuredClone(plan.items.slice(0,2)),visited=[];
 const r=select(plan,100,i=>visited.push(i.key),i=>i.key==='returned');
 a.deepEqual(visited,['returned']);a.deepEqual(r.selected.map(i=>i.key),['returned']);a.deepEqual(plan.items.slice(0,2),before);
});
