'use strict';
// Intake gate: one scheduled gate that runs the 7 step modules in order (06 to 12). Each step records its
// own pass, drop, hold or skip per job and publishes its own status record. A held or failed job retries on
// the next gate run; after retry.max it parks with its reason. One bad job never stops the batch.
const S=require('./store.cjs'),St=require('./status.cjs');
const STEP_IDS=['06','07','08','09','10','11','12'];
const MODULES={'06':require('./gate/06-required-fields.cjs'),'07':require('./gate/07-description-fetch.cjs'),'08':require('./gate/08-duplicate.cjs'),'09':require('./gate/09-declined.cjs'),'10':require('./gate/10-scope.cjs'),'11':require('./gate/11-onsite-default.cjs'),'12':require('./gate/12-coordinates.cjs')};
const now=()=>new Date().toISOString();
/** Discovery handoff -> gate queue. Known job ids are not queued twice. */
function intake(store,records){
 const q=store.queue('gate'),have=new Set(q.items.map(i=>i.id));let added=0,known=0;
 for(const r of records){
  if(store.getJob(r.id)||have.has(r.id)){known++;continue;}
  store.putJob({...r,state:'INTAKE',fields:{},trail:[]});q.items.push({id:r.id,attempts:0,state:'WAITING'});have.add(r.id);added++;
 }
 store.putQueue('gate',q);
 return {added,known};
}
async function runGate({store,ctx={},modules=MODULES}){
 const startedAt=now(),q=store.queue('gate'),max=S.step('06').retry.max;
 const counts=Object.fromEntries(STEP_IDS.map(id=>[id,St.blank()])),reasons=Object.fromEntries(STEP_IDS.map(id=>[id,{}]));
 const waitingAt=Object.fromEntries(STEP_IDS.map(id=>[id,{waiting:0,retrying:0,parked:0}]));
 const left=[];
 for(const item of q.items){
  if(item.state==='PARKED'){left.push(item);waitingAt[item.at||'06'].parked++;continue;}
  const job=store.getJob(item.id);if(!job||!['INTAKE','HELD'].includes(job.state))continue;
  let stopped=null;
  for(const id of STEP_IDS){
   const c=counts[id];c.in++;
   let out;
   try{out=await modules[id](job,ctx);}catch(e){out={status:'FAIL',reason:'ERROR: '+String(e&&e.message||e).slice(0,120)};}
   reasons[id][out.reason]=(reasons[id][out.reason]||0)+1;
   job.trail.push({step:id,status:out.status,reason:out.reason,...(out.detail?{detail:out.detail}:{}),at:startedAt});
   if(out.status==='PASS'||out.status==='SKIP'){c[out.status.toLowerCase()]++;for(const [k,v] of Object.entries(out.fields||{}))S.setField(job,k,v.value,v.source,startedAt);continue;}
   if(out.status==='DROP'){c.drop++;job.state='DROPPED';job.dropped={step:id,reason:out.reason,at:startedAt};stopped='DROP';break;}
   // HOLD or FAIL: the job waits at this step and retries next run.
   item.attempts=(item.attempts||0)+1;item.at=id;item.lastReason=out.reason;
   if(out.status==='FAIL')c.fail++;else c.hold++;
   // park:true means a retry cannot change the outcome (missing identity, ambiguous match): park now.
   if(out.park||item.attempts>=max){item.state='PARKED';job.state='PARKED';c.parked++;waitingAt[id].parked++;}
   else{item.state='RETRYING';job.state='HELD';waitingAt[id].retrying++;}
   stopped='WAIT';break;
  }
  if(!stopped){job.state='ENRICHING';job.gatePassedAt=startedAt;}
  store.putJob(job);
  if(stopped==='WAIT')left.push(item);
 }
 store.putQueue('gate',{...q,items:left,updatedAt:now()});
 const finishedAt=now(),records=[];
 for(const id of STEP_IDS){
  const rec=St.build(id,{counts:counts[id],reasons:reasons[id],queue:waitingAt[id],startedAt,finishedAt,previous:store.status(id),dryRun:ctx.dryRun!==false,notes:ctx.notes&&ctx.notes[id]||[]});
  store.putStatus(rec);records.push(rec);
 }
 return records;
}
module.exports={STEP_IDS,MODULES,intake,runGate};
