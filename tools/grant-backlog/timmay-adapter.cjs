'use strict';
// Read-only host boundary. No transport, credential read, publication or Writer.
const H=require('../helper-routing/shared.cjs');
const API=require('../helper-routing/api-grant.cjs');
const S=require('../programmed-coordinator/store.cjs');
const T=require('../programmed-coordinator/transactions.cjs');
const A=require('../helper-routing/shared-assignments.cjs');
const W=require('./worker.cjs');
const fail=code=>{throw Error(code);};
function authority(root, view, now){
 const at=Date.parse(view?.readAt);
 if(!Number.isFinite(at)||at>now||now-at>900000||!/^[a-f0-9]{40}$/.test(view?.instructionCommit||''))fail('FRESH_AUTHORITY_REQUIRED');
 const work=H.load(root);API.assertBound(root,work);
 // The trusted host must verify the checkout against the published revision.
 // An arbitrary local file or self-reported timestamp cannot establish that.
 if(view.publishedWorkSha256!==S.hash(work)||view.publishedInstructionCommit!==view.instructionCommit)fail('PUBLISHED_MEMBERSHIP_REQUIRED');
 const items=work.items.filter(i=>i.taskKey===API.TASK&&H.active(i));
 if(!items.length||items.some(i=>i.status!=='ASSIGNED'||i.worker!==W.NAME||i.kind!=='ENRICHMENT'))fail('API_EXACT_ACTIVE_RESERVATION_REQUIRED');
 const occupied=API.claims(root,{...work,items:work.items.filter(i=>i.taskKey!==API.TASK)},view.state||{});
 if(view.state?.schema!=='forge.programmed-coordinator.v1'||!view.state.items||!view.state.transactions)fail('CURRENT_COORDINATOR_STATE_REQUIRED');
 if(items.some(i=>occupied.has(i.primaryId)))fail('API_CURRENT_CLAIM_CONFLICT');
 return {work:{...work,items},ids:new Set(items.map(i=>i.primaryId))};
}
function current(root,id,view,now){
 const {work,ids}=authority(root,view,now),snapshot=view.snapshot;
 if(!ids.has(id))fail('OUTSIDE_SUPPORTED_ASSIGNMENT');
 if(snapshot?.source?.kind!=='CANONICAL_WRITER_MASTER'||snapshot.source.readAt!==view.readAt)fail('FRESH_CANONICAL_ALLOCATION_REQUIRED');
 require('../helper-routing/enrichment-plan.cjs').fullSnapshot(snapshot);T.healthy(snapshot.status);
 const rows=snapshot.rows.filter(r=>r.PRIMARY_ID===id);if(rows.length!==1)fail('EXACT_CANONICAL_ID_REQUIRED');
 const row=rows[0],assigned=work.items.find(i=>i.primaryId===id);
 if(S.hash(row.line)!==assigned.sourceVersion||!T.same(row,assigned))fail('ASSIGNMENT_SOURCE_CHANGED');
 const screen=snapshot.neverConsiderById?.[id];
 if(screen?.status!=='CLEAR'||screen.rowSha256!==S.hash(row.line)||screen.readAt!==view.readAt||!/^[a-f0-9]{64}$/.test(screen.policySha256||''))fail('CURRENT_NEVER_CONSIDER_PROOF_REQUIRED');
 if(T.protectedRow(row)||T.fenceIndex(root,view.state).has(id))fail('PROTECTED_OR_UNRESOLVED_ORIGINAL');
 const index=snapshot.writerReceiptIndex;
 if(!index?.requests||Array.isArray(index.requests)||!Array.isArray(index.pending))fail('LIVE_RECEIPT_INDEX_REQUIRED');
 for(const p of index.pending){
  if(!Array.isArray(p.items)||!p.items.length||p.items.some(i=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.pid||'')))fail('UNRESOLVED_RECEIPT_IDENTITY');
  if(p.items.some(i=>i.pid===id))fail('PROTECTED_OR_UNRESOLVED_ORIGINAL');
 }
 const missingGroups=A.needs(row).filter(g=>snapshot.needsById[id]?.includes(g)&&assigned.missingFields.includes(g));
 return {authority:view,readAt:view.readAt,row,missingGroups,neverConsider:'CLEAR',originalRequestsReconciled:true,writerFenced:false};
}
function create({root,readView,readPublicEvidence,simulate,reuse,now=Date.now}){
 if([readView,readPublicEvidence,simulate,reuse].some(f=>typeof f!=='function'))fail('OFFLINE_HOST_DEPENDENCIES_REQUIRED');
 const route={key:API.TASK,allocation:(v,n)=>authority(root,v,n),batch({item,assigned,view}){
  authority(root,view,now());
  // Construct only the existing shared return contract; never include host data.
  const evidence={...item.sourceEvidence,quote:Object.values(item.sourceEvidence.fieldQuotes)[0]};
  const shared={primaryId:item.primaryId,kind:'ENRICHMENT',worker:W.NAME,
   assignmentVersion:assigned.assignmentVersion,sourceVersion:assigned.sourceVersion,
   writerSubmitted:false,recommendation:item.recommendation,sourceEvidence:evidence};
  const result=API.envelope({root,items:[shared],runId:'FORGE-CHATGPT-API-DRY-'+W.hash([assigned,shared]).slice(0,24),instructionCommit:view.instructionCommit});
  API.assertReturn(root,H.load(root),result.batch,result.path);return result.batch;
 }};
 const adapter={authority:readView,async current(id,signal){
  const v=await readView(signal);signal.throwIfAborted();const c=current(root,id,v,now());
  const e=await readPublicEvidence(id,signal);signal.throwIfAborted();c.evidence=W.publicEvidence(e,c.row);return c;
 },reuse,simulate};
 return Object.freeze({runDry:dir=>W.run({dir,adapter,route,now}),
  // Global release gate deliberately precedes native loading/credential access.
  launch(){fail('LIVE_RELEASE_DISABLED');}});
}
function bindReaders(options){
 const readers=require('./host-readers.cjs').create(options);
 return create({...options,readView:readers.readView});
}
module.exports={authority,current,create,bindReaders};
