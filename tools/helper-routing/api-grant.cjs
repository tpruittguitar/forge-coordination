'use strict';
// Draft admission extension, not another ledger or a running allocator.
const fs=require('node:fs'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs');
const TASK='FORGE_API_GRANT_ENRICHMENT',WORK='control/SHARED_HELPER_WORK.json';
const PROCEDURE='lanes/FORGE_API_GRANT_ENRICHMENT.txt',PREFIX='receipts/CHATGPT_HELPERS/'+TASK+'/';
const fail=code=>{throw Error(code);};
function binding(work){
 const b=work?.apiGrantBinding;
 if(b?.schema!=='forge.api-grant-binding.v1'||b.enabled!==true||b.worker!=='forge-grant-luna'||b.host!=='TIMMAY'||b.project!=='Default'||
    !/^[a-f0-9]{64}$/.test(b.authorizationSha256||'')||!b.hermes||!b.hermes.taskKey||!b.hermes.provider||
    !/^[a-f0-9]{64}$/.test(b.hermes.acknowledgmentSha256||'')||work.providers?.[TASK]?.provider!=='ChatGPT'||work.providers[TASK].available!==true||
    !work.enabled||!work.routingActive)fail('API_ROUTE_DISABLED_OR_UNBOUND');
 return b;
}
function proof(root,file,sha){
 if(typeof file!=='string'||!/^receipts\/SHARED_HELPER_IDENTITY\/[A-Za-z0-9_-]+\.json$/.test(file))fail('API_IDENTITY_PROOF_PATH');
 const raw=fs.readFileSync(path.join(root,file),'utf8');if(S.hash(raw)!==sha)fail('API_IDENTITY_PROOF_HASH');
 return JSON.parse(raw);
}
function assertBound(root,work){
 const b=binding(work),H=require('./shared.cjs'),r=S.read(root,'control/AI_AUTOMATION_TASKS.json'),t=r.tasks?.[TASK],partner=r.tasks?.[b.hermes.taskKey];
 if(r.schema!=='forge.ai-automation-tasks.v1'||t?.owner!=='ChatGPT'||t.enabled!==true||t.executionIdentity!==b.worker||t.route!=='utility'||
    t.procedure!==PROCEDURE||t.workAssignments!==WORK||t.executionMode!=='WRITE_THROUGH_SUPPORTED_WRITER')fail('API_TASK_NOT_BOUND');
 // Hermes is an acknowledged execution identity of a supported shared slot.
 // Do not invent a Hermes provider alias or accept a free-form registry entry.
 if(!H.TASKS[b.hermes.taskKey]||H.TASKS[b.hermes.taskKey]!==b.hermes.provider||partner?.owner!==b.hermes.provider||
    partner.enabled!==true||partner.executionIdentity!=='Hermes'||partner.workAssignments!==WORK||
    work.providers[b.hermes.taskKey]?.available!==true||work.providers[b.hermes.taskKey]?.provider!==b.hermes.provider||
    S.read(root,'control/CHATGPT_OWNER_CUTOVER.json',{retired:[]}).retired.some(x=>x.taskKey===b.hermes.taskKey))fail('HERMES_IDENTITY_UNSUPPORTED');
 const auth=proof(root,b.authorizationRef,b.authorizationSha256),ack=proof(root,b.hermes.acknowledgmentRef,b.hermes.acknowledgmentSha256);
 if(auth.schema!=='forge.api-grant-authorization.v1'||auth.taskKey!==TASK||auth.worker!==b.worker||auth.assignmentId!==work.assignmentId||
    auth.hermesTaskKey!==b.hermes.taskKey||auth.host!==b.host||auth.project!==b.project||auth.grantOnly!==true)fail('API_AUTHORIZATION_MISMATCH');
 if(ack.schema!=='forge.shared-execution-identity-ack.v1'||ack.identity!=='Hermes'||ack.taskKey!==b.hermes.taskKey||ack.provider!==b.hermes.provider||
    ack.assignmentId!==work.assignmentId||ack.status!=='ACKNOWLEDGED'||!ack.runId)fail('HERMES_IDENTITY_UNACKNOWLEDGED');
 const exact=work.items.filter(i=>i.taskKey===b.hermes.taskKey&&H.active(i)).map(i=>({primaryId:i.primaryId,assignmentVersion:i.assignmentVersion,sourceVersion:i.sourceVersion})).sort((a,b)=>a.primaryId.localeCompare(b.primaryId));
 if(!exact.length||!Array.isArray(ack.assignments)||S.hash(ack.assignments)!==S.hash(exact))fail('HERMES_EXACT_ASSIGNMENT_ACK_REQUIRED');
 return b;
}
function claims(root,work,state){
 const H=require('./shared.cjs'),ids=new Set();
 for(const i of work.items)if(H.active(i))for(const id of [H.key(i),...i.aliases||[]]){if(ids.has(id))fail('OVERLAPPING_SHARED_CLAIMS');ids.add(id);}
 // Disabled native schedules never release these memberships.
 const e=require('./enrichment.cjs').load(path.join(root,'control/ENRICHMENT_HELPER_WORK.json'));
 for(const id of require('./enrichment.cjs').assignedIds({...e,enabled:true}))ids.add(id);
 const c=require('./reservations.cjs').load(path.join(root,'control/CLAUDE_HELPER_WORK.json'));
 for(const i of c.enrichment)ids.add(i.primaryId);
 for(const id of require('./shared-assignments.cjs').existingOwners(root))ids.add(id);
 for(const item of Object.values(state.items||{}))if(!/^(VERIFIED|PROTECTED_SKIP|EXISTING)/.test(item.status||''))ids.add(item.itemKey);
 return ids;
}
function plan({root,ids,hermesIds,snapshot,state,now=Date.now(),apply=false}){
 if(apply)fail('API_DRAFT_ACTUATION_DISABLED');
 const H=require('./shared.cjs'),T=require('../programmed-coordinator/transactions.cjs'),A=require('./shared-assignments.cjs');
 const work=H.load(root),b=assertBound(root,work);
 if(!Array.isArray(ids)||!ids.length||!Array.isArray(hermesIds)||!hermesIds.length||hermesIds.length>=ids.length)fail('EXPLICIT_API_AND_SMALLER_HERMES_IDS_REQUIRED');
 const all=[...ids,...hermesIds];if(all.some(x=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x))||new Set(all).size!==all.length)fail('API_HERMES_ID_OVERLAP');
 const partner=work.items.filter(i=>i.taskKey===b.hermes.taskKey&&H.active(i));
 if(partner.some(i=>i.kind!=='ENRICHMENT'||i.status!=='ASSIGNED')||S.hash(partner.map(i=>i.primaryId).sort())!==S.hash([...hermesIds].sort()))fail('HERMES_EXACT_ALLOCATION_UNPROVEN');
 const at=Date.parse(snapshot?.source?.readAt);
 if(snapshot?.source?.kind!=='CANONICAL_WRITER_MASTER'||!Number.isFinite(at)||at>now||now-at>900000||!Array.isArray(snapshot.rows)||
    state?.schema!=='forge.programmed-coordinator.v1'||!state.transactions||!state.items)fail('FRESH_CANONICAL_ALLOCATION_REQUIRED');
 T.healthy(snapshot.status);
 const index=snapshot.writerReceiptIndex;
 if(!index||!index.requests||Array.isArray(index.requests)||!Array.isArray(index.pending))fail('LIVE_RECEIPT_INDEX_REQUIRED');
 const receiptFences=new Set();
 for(const pending of index.pending){
  if(!Array.isArray(pending.items)||!pending.items.length||pending.items.some(i=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.pid||'')))fail('UNRESOLVED_RECEIPT_IDENTITY');
  for(const item of pending.items)receiptFences.add(item.pid);
 }
 require('./enrichment-plan.cjs').fullSnapshot(snapshot);
 const occupied=claims(root,work,state),fences=T.fenceIndex(root,state),proposed=structuredClone(work);
 for(const id of ids){
  if(occupied.has(id))fail('EXISTING_CLAIM_REQUIRES_EXPLICIT_RELEASE');
  const rows=snapshot.rows.filter(r=>r.PRIMARY_ID===id);if(rows.length!==1)fail('EXACT_CANONICAL_ID_REQUIRED');const row=rows[0];
  const screen=snapshot.neverConsiderById?.[id];
  require('../grant-backlog/research-eligibility.cjs').validate(screen,row,snapshot);
  if(T.protectedRow(row)||fences.has(id)||receiptFences.has(id))fail('PROTECTED_OR_UNRESOLVED_ORIGINAL');
  const missing=A.needs(row).filter(g=>snapshot.needsById[id].includes(g));if(!missing.length)fail('NO_CURRENT_MISSING_FIELDS');
  proposed.items.push({primaryId:id,kind:'ENRICHMENT',lane:'ENRICHMENT',taskKey:TASK,provider:'ChatGPT',worker:b.worker,
   assignmentVersion:1,status:'ASSIGNED',...T.identity(row),sourceVersion:S.hash(row.line),missingFields:missing,
   assignedAt:new Date(now).toISOString(),authorizationRef:b.authorizationRef,canonicalObservedAt:snapshot.source.readAt});
 }
 H.validateWork(proposed);
 return{schema:'forge.api-grant-reservation-plan.v1',baseWorkSha256:S.hash(work),work:proposed,ids:[...ids],hermesIds:[...hermesIds],
  requiresPublishedMembership:true,productionAuthorized:false,canonicalWrites:0,assignmentWrites:0};
}
function validateBatch(batch,work){
 const b=binding(work);if(batch.provider!=='ChatGPT'||batch.items.length>15||batch.mode!==undefined)fail('API_EVIDENCE_ENVELOPE_REQUIRED');
 for(const i of batch.items){const assigned=work.items.find(a=>a.primaryId===i.primaryId);
  if(i.kind!=='ENRICHMENT'||!assigned||assigned.worker!==b.worker||assigned.taskKey!==TASK||assigned.status!=='ASSIGNED'||
     i.worker!==b.worker||i.writerSubmitted!==false)fail('API_EXACT_ACTIVE_RESERVATION_REQUIRED');
  const fields=i.sourceEvidence?.proposedRawFields||{},HF=require('./helper-fields.cjs');
  for(const key of Object.keys(fields)){
   const group=HF.GROUP_OF[key]||({SOURCE_URL:'LINKS',COMPANY_SOURCE_URL:'LINKS',DEGREE_EVIDENCE_URL:'DEGREE',SALARY_SOURCE:'SALARY'})[key];
   if(!group||!assigned.missingFields?.includes(group))fail('API_FIELD_OUTSIDE_ASSIGNMENT');
  }
 }
}
// Only the existing coordinator calls this under its existing mutation lock.
// No CLI, schedule, ownership transfer, publication or Writer call is added.
function reserve(options){
 const {root,checkLock}=options;
 if(typeof checkLock!=='function')fail('EXISTING_COORDINATOR_LOCK_REQUIRED');
 checkLock();const prepared=plan({...options,apply:false});checkLock();
 if(S.hash(S.read(root,WORK))!==prepared.baseWorkSha256)fail('API_RESERVATION_STATE_CHANGED');
 // Recheck all existing claim authorities after the final lock check, not just
 // the shared file. A late legacy claim must prevent this save.
 const compared=plan({...options,apply:false});
 if(S.hash(compared)!==S.hash(prepared))fail('API_RESERVATION_INPUTS_CHANGED');
 S.save(root,WORK,prepared.work);
 require('./shared-pages.cjs').generate(root,{now:options.now,checkLock});
 return {...prepared,assignmentWrites:prepared.ids.length,published:false};
}
function assertReturn(root,work,batch,file){
 assertBound(root,work);validateBatch(batch,work);
 const occupied=claims(root,{...work,items:work.items.filter(i=>i.taskKey!==TASK)},{items:{}});
 if(batch.items.some(i=>occupied.has(i.primaryId)))fail('API_CURRENT_CLAIM_CONFLICT');
 if(file!==undefined&&file!==PREFIX+batch.runId+'.json')fail('API_RETURN_PATH_MISMATCH');
}
function envelope({root,items,runId,instructionCommit}){
 const H=require('./shared.cjs'),work=H.load(root);assertBound(root,work);
 const batch={schema:'forge.shared-helper-batch.v1',provider:'ChatGPT',taskKey:TASK,assignmentId:work.assignmentId,runId,instructionCommit,writerSubmitted:false,items:structuredClone(items)};
 H.validateBatch(batch,work);return{path:PREFIX+runId+'.json',batch,writerSubmitted:false,published:false};
}
module.exports={TASK,WORK,PROCEDURE,PREFIX,binding,assertBound,claims,plan,reserve,validateBatch,assertReturn,envelope};
