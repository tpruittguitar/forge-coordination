'use strict';
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs'),Source=require('../programmed-coordinator/source.cjs'),H=require('./shared.cjs');
function needs(row){const p=row.p||{},out=[];
 if(!Source.known(p.SALARY_BASE_LOW))out.push('SALARY');
 if(!Source.known(p.DEGREE_REQ)&&!Source.known(p.DEGREE_TEXT))out.push('DEGREE');
 if(!Source.known(p.SCOPE_FIT_RAW)&&!Source.known(p.FIT_EVIDENCE))out.push('FIT');
 if(!Source.known(p.SOURCE_URL))out.push('LINKS');
 return out;
}
function existingOwners(root){
 const keys=new Set();
 for(const file of ['control/ENRICHMENT_HELPER_WORK.json','control/CLAUDE_HELPER_WORK.json','control/CLAUDE_RELEVANCE_WORK.json','control/GROK_INTAKE_HELPER_WORK.json']){
  const w=S.read(root,file,null);if(!w?.enabled)continue;
  if(w.taskKey&&require('./current-owner.cjs').retirement(w.taskKey,w.assignmentId))continue;
  for(const k of w.keys||[])keys.add(k);
  for(const item of w.items||[])if(H.active(item))for(const k of [H.key(item),...item.aliases||[]])if(k)keys.add(k);
 }
 for(const k of require('../intake-drain/queue.cjs').ownedKeys(root))keys.add(k);
 return keys;
}
function replenish({root,state,snapshot,runId,apply=false,now=Date.now(),checkLock}){
 if(apply){if(typeof checkLock!=='function')throw Error('SHARED_COORDINATOR_LOCK_REQUIRED');checkLock();}
 const work=S.read(root,H.FILE,null);if(!work)return{enabled:false,assigned:0};H.validateWork(work);
 const readAt=Date.parse(snapshot?.source?.readAt);
 if(!Number.isFinite(readAt)||now-readAt>900000||readAt>now+120000)throw Error('FRESH_SHARED_ASSIGNMENT_SNAPSHOT_REQUIRED');
 const occupied=existingOwners(root),byId=new Map(snapshot.rows.concat(snapshot.archiveRows||[]).map(r=>[r.PRIMARY_ID,r]));
 // A returned batch is a durable handoff, never permission for repeated research.
 for(const item of work.items){if(!H.active(item))continue;
  const inspection=Object.values(state.items).find(i=>i.taskKey===item.taskKey&&i.itemKey===H.key(item)&&state.batches[i.batch]?.status==='VALIDATED');
  if(inspection){
   const row=item.kind==='ENRICHMENT'?byId.get(item.primaryId):null;
   const remaining=row?needs(row).filter(f=>(item.missingFields||[]).includes(f)):null;
   item.status=inspection.status==='PROTECTED_SKIP'?'PROTECTED_SKIP':row&&remaining.length===0?'CONSUMED':/^EXISTING/.test(inspection.status)?'CONSUMED':/^VERIFIED|^NO_MISSING/.test(inspection.status)?'RETURNED_PARTIALLY_CONSUMED':'RETURNED_PENDING_REVIEW';
   if(remaining)item.remainingFields=remaining;
   item.returnProof=inspection.batch;continue;
  }
  if(item.kind==='ENRICHMENT'){const row=byId.get(item.primaryId);if(row&&T.protectedRow(row)){item.status='PROTECTED_SKIP';continue;}if(row&&!needs(row).length){item.status='ALREADY_COMPLETE';continue;}}
 }
 const reserved=H.reservedKeys(work);for(const k of reserved)occupied.add(k);
 const available=Object.keys(H.TASKS).filter(t=>work.providers[t].available),old=new Set(work.items.map(H.key)),candidates=[];
 for(const row of snapshot.rows){const id=row.PRIMARY_ID,missingFields=needs(row);
  if(!id||old.has(id)||occupied.has(id)||!missingFields.length||T.protectedRow(row)||T.fenced(root,state,id))continue;
  candidates.push({primaryId:id,kind:'ENRICHMENT',...T.identity(row),missingFields,priority:row.BUCKET==='MANUAL_RESEARCH'?0:1,sourceUrls:require('../enrich-ats-pay/lib.js').ATS_URL_KEYS.map(k=>row.p?.[k]).filter(v=>typeof v==='string'&&/^https:\/\/\S+$/.test(v)),sourceVersion:S.hash(row.line||row),canonicalObservedAt:snapshot.source.readAt});
 }
 const queue=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{}});
 const canonical=snapshot.rows.concat(snapshot.archiveRows||[]);
 for(const job of Object.values(queue.jobs||{})){
  const keys=[job.key,...job.aliases||[]];
  if(!job.key||old.has(job.key)||keys.some(k=>occupied.has(k))||/VERIFIED|OUT_OF_SCOPE|EXCLUDED|POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(job.status||'')||(job.submissions||[]).length||!['company','title','location'].every(k=>job[k]))continue;
  // Existing or ambiguous canonical identity remains with current intake code.
  if(canonical.some(row=>T.same(row,job)))continue;
  // Complete cards are already code-owned; AI is for unresolved source research.
  if(require('../routine-handoffs/assignments.cjs').fullCard(job))continue;
  const kind=job.discoveryOnly===true?'DISCOVERY':'INTAKE';
  candidates.push({key:job.key,aliases:job.aliases||[],kind,company:job.company,title:job.title,location:job.location,sourceUrls:[job.url].filter(Boolean),sourceEvidence:{company:job.company,title:job.title,location:job.location,url:job.url,observedAt:job.observedAt},missingFields:['SOURCE_IDENTITY','LINKS'],priority:kind==='INTAKE'?2:3,sourceVersion:S.hash(job),sourceRef:'state/EMAIL_RECOVERY_QUEUE.json#'+job.key});
 }
 const assigned=[];
 if(work.enabled&&work.routingActive&&available.length)for(const item of candidates.sort((a,b)=>a.priority-b.priority||H.key(a).localeCompare(H.key(b)))){
  if([H.key(item),...item.aliases||[]].some(k=>occupied.has(k)))continue;
  const taskKey=available[parseInt(S.hash(H.key(item)).slice(0,8),16)%available.length];
  const assignment={...item,taskKey,provider:H.TASKS[taskKey],assignmentVersion:1,status:'ASSIGNED',assignedBy:runId};
  work.items.push(assignment);assigned.push(H.key(item));for(const k of [H.key(item),...item.aliases||[]])occupied.add(k);
 }
 work.at=new Date(now).toISOString();work.activation='COORDINATOR_ASSIGNMENTS_PUBLISHED';work.canonicalSource=snapshot.source;
 H.validateWork(work);if(apply){checkLock();S.save(root,H.FILE,work);};
 return{enabled:work.enabled,assigned:assigned.length,pending:work.items.filter(i=>i.status==='ASSIGNED').length,byTask:Object.fromEntries(Object.keys(H.TASKS).map(t=>[t,work.items.filter(i=>i.taskKey===t&&i.status==='ASSIGNED').length])),canonicalWrites:0,noProcessingCap:true};
}
module.exports={needs,existingOwners,replenish};
