'use strict';
const S=require('../programmed-coordinator/store.cjs');
// Only validated, source-bound reports hand research to the coordinator. This
// means handed off, including a blocked-source exception, never canonical done.
function returned(root,w){
 const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{items:{},batches:{}}),keys=new Set();
 for(const i of Object.values(state.items))if(i.taskKey===w.taskKey&&state.batches[i.batch]?.status==='VALIDATED'){
  const batch=S.read(root,i.batch);if(batch.assignmentId===w.assignmentId)keys.add(i.itemKey);
 }
 return keys;
}
function intake(root,w,accepted,start=1){
 if(!Number.isInteger(start)||start<1||start>Math.max(1,w.pages.length))throw Error('Invalid page; do not restart');
 const done=returned(root,w);for(const k of Object.keys(accepted.items))done.add(k);
 const handoffs=require('../helper-routing/relevance-progress.cjs').handoffs(w);
 for(let n=start;n<=w.pages.length;n++){
  const page=S.read(root,w.pages[n-1].path),items=page.items.filter(i=>!done.has(i.key)&&!handoffs[i.key]).map(i=>({...i,sourceEvidence:require('./source-card.cjs').recover(root,i.key,i.sourceEvidence||i)}));
  if(items.length)return{...page,items,page:n,pagePath:w.pages[n-1].path,pageComplete:false};
 }
 return{assignmentId:w.assignmentId,items:[],helperResearchExhausted:true,assignmentComplete:false,reason:'Returned evidence and code-owned exceptions stay pending until canonical verification'};
}
module.exports={returned,intake};
