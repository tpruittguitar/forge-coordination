'use strict';
const test=require('node:test'),a=require('node:assert/strict'),{select}=require('./continuation.cjs');
test('an abnormal card is recorded and a later valid candidate is still selected',()=>{
 const plan={items:[{key:'unknown',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'original'},{key:'bad',status:'READY'},{key:'valid',status:'READY',record:{TITLE:'Director, Manufacturing'}}]};
 const r=select(plan,1,item=>{if(item.key==='bad')throw Error('bad identity');});
 a.deepEqual(r.held,['bad']);a.deepEqual(r.selected.map(x=>x.key),['valid']);a.equal(plan.items[0].requestId,'original');a.equal(plan.items[1].status,'HELD_CARD_REVIEW');
});
test('direct-return selection skips unrelated READY cards without mutating or validating them',()=>{
 const plan={items:[{key:'unrelated',status:'READY',record:{saved:true}},{key:'pending',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'ORIGINAL'},{key:'returned',status:'READY',record:{TITLE:'Head of Quality'}}]},before=structuredClone(plan.items.slice(0,2)),visited=[];
 const r=select(plan,100,i=>visited.push(i.key),i=>i.key==='returned');
 a.deepEqual(visited,['returned']);a.deepEqual(r.selected.map(i=>i.key),['returned']);a.deepEqual(plan.items.slice(0,2),before);
});
test('email recovery and other saved intake records must pass the discovery seniority screen',()=>{
 const items=['Manufacturing Manager','VP Manufacturing','Quality Engineer','Head of Quality'].map((TITLE,i)=>({key:String(i),queueKey:i<2?'linkedin:'+i:null,status:'READY',record:{TITLE}}));
 const result=select({items},2,()=>{});
 a.deepEqual(result.selected.map(i=>i.record.TITLE),['VP Manufacturing','Head of Quality']);
 for(const i of [items[0],items[2]]){a.equal(i.status,'OUT_OF_SCOPE');a.equal(i.reason,'OUT_OF_SCOPE:NOT_LEADERSHIP_LEVEL');}
});
