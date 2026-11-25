'use strict';
const S=require('../programmed-coordinator/store.cjs'),P=require('./worker-partition.cjs');
const TERMINAL_BUCKETS=Object.freeze(['DECLINED_BY_TIM','APPLIED','CLOSED','CLOSED_DEAD','DUPLICATE','REJECTED_BY_EMPLOYER','INVALID_DISCOVERY']);
function terminalBucket(row){return !!row&&TERMINAL_BUCKETS.includes(row.BUCKET);}
function terminalIds(snapshot){
 const ids=new Set();
 for(const row of [...snapshot?.rows||[],...snapshot?.archiveRows||[]])if(terminalBucket(row)&&row.PRIMARY_ID)ids.add(row.PRIMARY_ID);
 return ids;
}
function dropTerminalItems(items,ids){
 const drop=ids instanceof Set?ids:new Set(ids),removed=[],kept=[];
 for(const item of items||[]){
  if(item?.primaryId&&drop.has(item.primaryId))removed.push(item);
  else kept.push(item);
 }
 return {items:kept,removed};
}
function prunePartitionAndReservation(partition,shared,ids,now=Date.now()){
 if(!partition||!ids?.size)return {partition,shared,dropped:[]};
 const current=[...partition.workers[0].primaryIds,...partition.workers[1].primaryIds];
 const dropped=current.filter(id=>ids.has(id));
 if(!dropped.length)return {partition,shared,dropped};
 const next=P.prune(partition,dropped);
 if(shared?.enrichmentPartitionReservations?.workers?.[0]){
  shared.enrichmentPartitionReservations.workers[0].primaryIds=next.workers[0].primaryIds.slice();
  shared.enrichmentPartitionReservations.recordedAt=new Date(now).toISOString();
  shared.enrichmentPartitionReservations.reason='Drop terminal-bucket IDs from the Hermes reservation.';
 }
 return {partition:next,shared,dropped};
}
function applyToWork(work,snapshot,ids=terminalIds(snapshot)){
 const r=dropTerminalItems(work?.items,ids);
 if(work&&r.removed.length)work.items=r.items;
 return r;
}
function applyToRoot(root,snapshot,{apply=false,now=Date.now(),enrichment,shared}={}){
 const ids=terminalIds(snapshot);
 const enrich=enrichment||S.read(root,'control/ENRICHMENT_HELPER_WORK.json',null);
 const share=shared||S.read(root,'control/SHARED_HELPER_WORK.json',null);
 const enrichDrop=applyToWork(enrich,snapshot,ids);
 const sharedDrop=applyToWork(share,snapshot,ids);
 const part=S.read(root,P.FILE,null);
 const pruned=prunePartitionAndReservation(part,share,ids,now);
 if(apply){
  if(enrich&&enrichDrop.removed.length)S.save(root,'control/ENRICHMENT_HELPER_WORK.json',enrich);
  if(share&&(sharedDrop.removed.length||pruned.dropped.length))S.save(root,'control/SHARED_HELPER_WORK.json',share);
  if(pruned.dropped.length)P.write(root,pruned.partition);
 }
 return {ids:[...ids],enrichmentRemoved:enrichDrop.removed.map(i=>i.primaryId),sharedRemoved:sharedDrop.removed.map(i=>i.primaryId),partitionDropped:pruned.dropped,partition:pruned.partition,enrichment:enrich,shared:share};
}
module.exports={TERMINAL_BUCKETS,terminalBucket,terminalIds,dropTerminalItems,prunePartitionAndReservation,applyToWork,applyToRoot};
