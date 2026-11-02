'use strict';
const S=require('../programmed-coordinator/store.cjs'),H=require('../helper-routing/reservations.cjs'),Source=require('../programmed-coordinator/source.cjs');
function load(root){const legacy=S.read(root,'state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]}),code=S.read(root,'state/CODE_INTAKE_CONSUMPTION.json',{schema:'forge.code-intake-consumption.v1',items:[]}),keys=new Set(legacy.items.map(i=>i.key));return{...legacy,items:[...legacy.items,...code.items.filter(i=>!keys.has(i.key))]};}
function find(root,key){const item=load(root).items.find(i=>i.key===key);if(!item)throw Error('INTAKE_SOURCE_BINDING_REQUIRED');return item;}
function save(root,state){
 const legacy={...state,items:state.items.filter(i=>i.provider!=='CODE')},code={schema:'forge.code-intake-consumption.v1',at:state.at||null,items:state.items.filter(i=>i.provider==='CODE')};
 for(const s of [legacy,code]){s.counts={};for(const i of s.items)s.counts[i.status]=(s.counts[i.status]||0)+1;}
 S.save(root,'state/CLAUDE_HELPER_CONSUMPTION.json',legacy);S.save(root,'state/CODE_INTAKE_CONSUMPTION.json',code);
}
function original(root,item,work,cache=new Map()){
 if(item.provider==='CODE'){
  if(item.provenance==='PROGRAMMED_SOURCE_VERIFIED'){
   const coordinator=S.read(root,'state/PROGRAMMED_COORDINATOR.json'),inspection=coordinator.items[item.coordinatorKey];
   if(!inspection||coordinator.batches[inspection.batch]?.status!=='VALIDATED'||inspection.version!==item.sourceVersion||inspection.status!=='SOURCE_VERIFIED'||inspection.sourceEvidence?.sourceSha256!==item.sourceEvidence?.sourceSha256)throw Error('CURRENT_SOURCE_INSPECTION_REQUIRED');
   const batch=S.read(root,inspection.batch),source=batch.items.find(i=>i.key===item.key);
   if(!source||S.hash(source)!==inspection.version)throw Error('IMMUTABLE_SOURCE_RETURN_REQUIRED');
   return source;
  }
  const job=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json').jobs[item.key],evidence=job?.evidence?.find(e=>e.cardHash===item.cardHash&&e.paragraphs?.length>=3);
  if(!evidence||!item.sourceEvidence||item.provenance!=='CAPTURED_SOURCE_CARD')throw Error('CAPTURED_CARD_PROOF_REQUIRED');
  const observed={title:evidence.paragraphs[0].split('\n')[0].replace(/ \(Verified job\)$/,'').trim(),company:evidence.paragraphs[1].trim(),location:evidence.paragraphs[2].replace(/ \((On-site|Hybrid|Remote)\)$/,'').trim()};
  for(const field of ['company','title','location'])if(Source.norm(observed[field])!==Source.norm(item.sourceEvidence[field])||Source.norm(job[field])!==Source.norm(item.sourceEvidence[field]))throw Error('CAPTURED_CARD_IDENTITY_CONFLICT');
  if(job.url!==item.sourceEvidence.url)throw Error('CAPTURED_CARD_URL_CONFLICT');
  return{sourceEvidence:item.sourceEvidence};
 }
 if(!cache.has(item.batch)){const batch=S.read(root,item.batch);H.validateBatch(batch,work);cache.set(item.batch,batch);}
 const source=cache.get(item.batch).items.find(i=>i.key===item.key);if(!source)throw Error('Missing immutable helper item');return source;
}
function seedVerified(root,state,apply){
 const intake=load(root),keys=new Set(intake.items.map(i=>i.key));let seeded=0;
 for(const i of Object.values(state.items)){
  if(i.status!=='SOURCE_VERIFIED'||state.batches[i.batch]?.status!=='VALIDATED'||keys.has(i.itemKey)||/ENRICHMENT|OUTCOME/.test(i.taskKey))continue;
  intake.items.push({key:i.itemKey,provider:'CODE',provenance:'PROGRAMMED_SOURCE_VERIFIED',coordinatorKey:i.key,sourceVersion:i.version,batch:i.batch,helperRunId:S.read(root,i.batch).runId,sourceEvidence:i.sourceEvidence,status:'RETURNED_PENDING_SCREEN'});keys.add(i.itemKey);seeded++;
 }
 if(apply&&seeded)save(root,intake);return{seeded};
}
module.exports={load,find,save,original,seedVerified};
