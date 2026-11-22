'use strict';
// Credential-free binding to existing, already-authorized read capabilities.
// Never loads connection files, auth stores, environment keys or Writer POSTs.
const cp=require('node:child_process');
const H=require('../helper-routing/shared.cjs'),API=require('../helper-routing/api-grant.cjs');
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs');
const Canon=require('../pipeline-observability/canonical-snapshot');
const fail=c=>{throw Error(c);};
const REMOTE='https://github.com/tpruittguitar/forge-coordination.git';
function gitReader(root){return args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();}
function published(root,git=gitReader(root)){
 try {
  const url=git(['remote','get-url','origin']);
  if(![REMOTE,'git@github.com:tpruittguitar/forge-coordination.git'].includes(url))fail('COORDINATION_REMOTE_MISMATCH');
  const head=git(['rev-parse','HEAD']),remote=git(['ls-remote','origin','refs/heads/main']).split(/\s/)[0];
  if(!/^[a-f0-9]{40}$/.test(head)||head!==remote||git(['status','--porcelain']))fail('FRESH_CLEAN_MERGED_CHECKOUT_REQUIRED');
  const work=H.load(root);API.assertBound(root,work);
  const pinned=JSON.parse(git(['show',head+':'+H.FILE]));
  if(S.hash(pinned)!==S.hash(work))fail('PUBLISHED_MEMBERSHIP_REQUIRED');
  return {commit:head,workSha256:S.hash(work)};
 }catch(e){if(/^[A-Z][A-Z0-9_]+$/.test(e.message))throw e;fail('PUBLISHED_REVISION_READ_FAILED');}
}
const statusVersion=s=>({build:s.build,freeze:s.freeze,level:s.level,errors:s.errors,unverified:s.unverified,migration:s.migration,queue:s.queue&&{...s.queue,processing:s.queue.processing?.map(({ageMs,...p})=>p)}});
function createBound({root,W,writerRead,readReceiptIndex,readPolicy,readAdmissionEvidence,classifyNeverConsider,writerSourceRoot,admissionIds,now=Date.now,git},publication){
 if(!W||['parseRows','build','render'].some(k=>typeof W[k]!=='function')||typeof writerRead!=='function'||typeof readReceiptIndex!=='function'||typeof readPolicy!=='function')fail('AUTHORIZED_READ_CAPABILITIES_REQUIRED');
 function fresh(at){const t=Date.parse(at);if(!Number.isFinite(t)||t>now()||now()-t>900000)fail('STALE_AUTHORIZED_READ');}
 async function read(action,signal){
  signal?.throwIfAborted();
  // Deliberately exclude documents, resume, profile, evidence and write actions.
  if(!['master','writer_status','rules'].includes(action))fail('READ_SCOPE_FORBIDDEN');
  let r;try{r=await writerRead(action);}catch{fail('AUTHORIZED_WRITER_READ_FAILED');}
  signal?.throwIfAborted();if(r?.data?.ok!==true)fail('AUTHORIZED_WRITER_READ_REQUIRED');
  fresh(r.startedAt);fresh(r.completedAt);
  if(Date.parse(r.completedAt)<Date.parse(r.startedAt))fail('READ_CLOCK_INVALID');
  return r;
 }
 async function policyRead(signal){
  let r;try{r=await readPolicy();}catch{fail('AUTHORIZED_POLICY_READ_FAILED');}
  signal?.throwIfAborted();fresh(r?.proof?.readAt);return r;
 }
 async function index(signal){
  signal?.throwIfAborted();let r;try{r=await readReceiptIndex();}catch{fail('AUTHORIZED_RECEIPT_READ_FAILED');}
  signal?.throwIfAborted();
  if(!/^[a-f0-9]{40}$/.test(r?.sha||'')||r.index?.version!==1||!r.index.requests||Array.isArray(r.index.requests)||!Array.isArray(r.index.pending))fail('LIVE_RECEIPT_INDEX_REQUIRED');
  // Freshness is the just-completed read, not updatedAt (idle indices may be old).
  for(const entry of [...r.index.pending,...Object.values(r.index.requests).filter(e=>e?.s!=='COMPLETE')]){
   if(!Array.isArray(entry?.items)||!entry.items.length||entry.items.some(i=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.pid||'')))fail('UNRESOLVED_RECEIPT_IDENTITY');
  }
  return r;
 }
 return Object.freeze({async readView(signal){
  const started=now(),before=publication();
  const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',null);
  if(state?.schema!=='forge.programmed-coordinator.v1'||!state.items||!state.transactions)fail('CURRENT_COORDINATOR_STATE_REQUIRED');
  const status=await read('writer_status',signal);T.healthy(status.data);
  if(writerSourceRoot)classifyNeverConsider=require('./verified-classifier.cjs').load({root:writerSourceRoot,writerStatus:status.data}).classifyNeverConsider;
  const receipts=await index(signal),rules=await read('rules',signal);
  const policy=await policyRead(signal);
  if(policy.proof.repo!=='tpruittguitar/forge-policy'||policy.proof.path!=='rules/TIM_PIPELINE_RULES_CANONICAL.txt'||policy.proof.branch!=='main'||!/^[a-f0-9]{40}$/.test(policy.proof.commit||'')||!/^[a-f0-9]{40}$/.test(policy.proof.blob||'')||policy.proof.rawSha256!==S.hash(policy.raw)||rules.data.rules?.raw!==policy.raw||rules.data.rules?.policySource!=='GITHUB'||rules.data.rules?.id!=='tpruittguitar/forge-policy/rules/TIM_PIPELINE_RULES_CANONICAL.txt')fail('WRITER_POLICY_SOURCE_CHAIN_MISMATCH');
  if(rules.data.rules?.source!=='TIM_PIPELINE_RULES_CANONICAL'||rules.data.rules.status!=='ACTIVE'||typeof rules.data.rules.raw!=='string'||!rules.data.rules.raw)fail('CURRENT_RULES_REQUIRED');
  let masterReply;
  const master=await Canon.readCanonical({W,reader:async action=>{masterReply=await read(action,signal);return masterReply;}});
  fresh(masterReply.data.fetchedAt);
  if(masterReply.data.bytes!==undefined&&masterReply.data.bytes!==masterReply.data.text.length)fail('CANONICAL_LENGTH_MISMATCH');
  if(masterReply.data.modifiedTime!==undefined&&(!Number.isFinite(Date.parse(masterReply.data.modifiedTime))||Date.parse(masterReply.data.modifiedTime)>Date.parse(masterReply.data.fetchedAt)))fail('CANONICAL_MODIFIED_TIME_INVALID');
  if(masterReply.data.rowCount!==undefined&&masterReply.data.rowCount!==master.rows.length)fail('CANONICAL_COUNT_MISMATCH');
  const built=W.build(master.rows.map(r=>r.line).join('\n')),needsById=Object.fromEntries(master.rows.map(r=>[r.PRIMARY_ID,[]]));
  if(!Array.isArray(built.lanes?.FORGE_ENRICH_FEASIBILITY))fail('CANONICAL_WORKLIST_REQUIRED');
  for(const r of built.lanes.FORGE_ENRICH_FEASIBILITY){
   if(!Object.hasOwn(needsById,r.PRIMARY_ID))fail('WORKLIST_ID_MISMATCH');
   needsById[r.PRIMARY_ID]=(W.render('FORGE_ENRICH_FEASIBILITY',{lanes:{FORGE_ENRICH_FEASIBILITY:[r]}},{generatedAt:'snapshot'}).match(/NEED=([A-Z,]*)/)?.[1]||'').split(',').filter(Boolean);
  }
  // Bracket mutable sources: no cross-revision composite is accepted.
  const later=await read('master',signal),laterRules=await read('rules',signal),laterStatus=await read('writer_status',signal),laterIndex=await index(signal);
  T.healthy(laterStatus.data);fresh(later.data.fetchedAt);
  if(S.hash(later.data.text)!==master.source.sha256||S.hash(laterRules.data.rules)!==S.hash(rules.data.rules)||S.hash(statusVersion(laterStatus.data))!==S.hash(statusVersion(status.data))||laterIndex.sha!==receipts.sha||S.hash(laterIndex.index)!==S.hash(receipts.index))fail('CANONICAL_STATE_CHANGED_DURING_READ');
  const finalPolicy=await policyRead(signal);
  if(finalPolicy.proof.commit!==policy.proof.commit||finalPolicy.proof.blob!==policy.proof.blob||finalPolicy.raw!==policy.raw)fail('POLICY_CHANGED_DURING_READ');
  const after=publication();
  if(S.hash(after)!==S.hash(before)||S.hash(S.read(root,'state/PROGRAMMED_COORDINATOR.json',null))!==S.hash(state))fail('COORDINATION_CHANGED_DURING_READ');
  if(now()<started||now()-started>45000)fail('HOST_READ_DEADLINE');
  const pending=[...receipts.index.pending,...Object.values(receipts.index.requests).filter(e=>e.s!=='COMPLETE')];
  const snapshot={...master,policyProof:policy.proof,status:status.data,needsById,writerReceiptIndex:{...receipts.index,pending},neverConsiderById:{}};
  require('../helper-routing/enrichment-plan.cjs').fullSnapshot(snapshot);
  // Reuse already captured, reviewed public evidence; never fetch or research
  // sources to get around the first gate. Missing captures stay held.
  if(readAdmissionEvidence){
   const ids=admissionIds||H.load(root).items.filter(i=>i.taskKey===API.TASK&&H.active(i)).map(i=>i.primaryId);
   for(const id of ids){
    signal?.throwIfAborted();const rows=master.rows.filter(r=>r.PRIMARY_ID===id);
    if(rows.length!==1)throw Error('EXACT_CANONICAL_ID_REQUIRED');
    try{
     const evidence=await readAdmissionEvidence(id);signal?.throwIfAborted();
     snapshot.neverConsiderById[id]=require('./research-eligibility.cjs').evaluate({root,row:rows[0],rules:rules.data.rules,policyProof:policy.proof,evidence,readAt:master.source.readAt,now:now(),classifyNeverConsider});
    }catch(e){
     signal?.throwIfAborted();snapshot.neverConsiderById[id]={status:'HOLD',reason:/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'RESEARCH_ADMISSION_HOLD'};
    }
   }
  }
  return {readAt:master.source.readAt,instructionCommit:before.commit,publishedInstructionCommit:before.commit,publishedWorkSha256:before.workSha256,state,snapshot,
   readerProof:{rulesSha256:S.hash(rules.data.rules.raw),receiptBlob:receipts.sha,checkedAt:new Date(now()).toISOString(),eligibility:readAdmissionEvidence?'SOURCE_BOUND_EARLY_RESEARCH_ONLY':'ADMISSION_EVIDENCE_UNAVAILABLE'}};
 }});
}
function create(options){return createBound(options,()=>published(options.root,options.git));}
function createPilot(options){
 if(!Array.isArray(options.admissionIds)||options.admissionIds.length!==5||new Set(options.admissionIds).size!==5)fail('EXACT_FIVE_REQUIRED');
 return createBound(options,()=>require('../programmed-coordinator/direct-pilot.cjs').published(options.root,(options.now||Date.now)(),options.git));
}
module.exports={REMOTE,published,create,createPilot};
