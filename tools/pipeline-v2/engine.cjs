'use strict';
// Shared engine loop: own queue, own retry, own status record. One bad job never stops the batch.
const S=require('./store.cjs'),St=require('./status.cjs');
const now=()=>new Date().toISOString();
/**
 * runEngine(id,{store,select,work,ctx})
 *  select(job) -> true when this engine has work for the job (fields missing, inputs ready).
 *  work(job,ctx) -> {status:'PASS'|'SKIP'|'DROP'|'HOLD'|'WAIT'|'BLOCKED', reason, fields:{K:{value,source}}}
 * Exceptions count as FAIL and retry on the next run until retry.max, then park with the reason.
 */
async function runEngine(id,{store,select,work,ctx={}}){
 const s=S.step(id),max=s.retry&&s.retry.max||3,startedAt=now();
 const q=store.queue(id),items=new Map(q.items.map(i=>[i.id,i]));
 for(const j of store.jobs())if(j.state==='ENRICHING'&&!items.has(j.id)&&select(j))items.set(j.id,{id:j.id,attempts:0,state:'WAITING'});
 const counts=St.blank(),reasons={},bump=r=>{reasons[r]=(reasons[r]||0)+1;};
 for(const item of items.values()){
  if(item.state==='PARKED'||item.state==='DONE')continue;
  const job=store.getJob(item.id);
  if(!job||job.state!=='ENRICHING'){item.state='DONE';continue;}
  let out;
  try{out=await work(job,ctx);}
  catch(e){out={status:'FAIL',reason:'ERROR: '+String(e&&e.message||e).slice(0,120)};}
  const status=out.status;
  // WAIT and BLOCKED keep the job in this engine's queue; any script-found fields are still saved.
  if(status==='WAIT'||status==='BLOCKED'){
   if(out.fields&&Object.keys(out.fields).length){for(const [k,v] of Object.entries(out.fields))S.setField(job,k,v.value,v.source,startedAt);store.putJob(job);}
   if(status==='WAIT'){counts.wait++;item.state='WAITING';}else{counts.blocked++;item.state='BLOCKED';}
   bump(out.reason||status);continue;
  }
  counts.in++;
  if(status==='FAIL'){item.attempts++;item.lastError=out.reason;if(item.attempts>=max){item.state='PARKED';counts.parked++;}else item.state='RETRYING';counts.fail++;bump(out.reason);}
  else{
   for(const [k,v] of Object.entries(out.fields||{}))S.setField(job,k,v.value,v.source,startedAt);
   job.trail=(job.trail||[]).concat([{step:id,status,reason:out.reason||'',at:startedAt}]);
   if(status==='DROP')job.state='DROPPED';
   store.putJob(job);item.state='DONE';
   counts[status.toLowerCase()]++;bump(out.reason||status);
  }
 }
 const left=[...items.values()].filter(i=>i.state!=='DONE');
 store.putQueue(id,{...q,items:left,updatedAt:now()});
 const queue={waiting:left.filter(i=>i.state==='WAITING'||i.state==='BLOCKED').length,retrying:left.filter(i=>i.state==='RETRYING').length,parked:left.filter(i=>i.state==='PARKED').length};
 const rec=St.build(id,{counts,reasons,queue,startedAt,finishedAt:now(),previous:store.status(id),dryRun:ctx.dryRun!==false,notes:ctx.notes&&ctx.notes[id]||[]});
 store.putStatus(rec);
 return rec;
}
module.exports={runEngine};
