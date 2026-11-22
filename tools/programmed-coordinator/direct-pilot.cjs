'use strict';
// A narrow operation owned by the existing coordinator. Never invokes apply/Writer.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const S=require('./store.cjs'),H=require('../helper-routing/shared.cjs'),T=require('./transactions.cjs');
const A=require('../helper-routing/api-grant.cjs'),N=require('../grant-backlog/native-five.cjs');
const E=require('../grant-backlog/research-eligibility.cjs');
const Serialization=require('./pilot-serialization.cjs'),Public=require('./pilot-public.cjs');
const RELEASE='control/OPENAI_DIRECT_PILOT_RELEASE.json',OWNER='FORGE_APPLICATION_WRITER_GOFER';
const fail=c=>{throw Error(c);};
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&Date.parse(at)<=now&&now-Date.parse(at)<=900000;
function release(root,now=Date.now()){
 const r=S.read(root,RELEASE,null),registry=S.read(root,'control/AI_AUTOMATION_TASKS.json');
 if(r?.schema!=='forge.direct-pilot-release.v1'||r.enabled!==true||r.ownerTask!==OWNER||
    registry.schema!=='forge.ai-automation-tasks.v1'||registry.tasks?.[OWNER]?.route!=='runtime'||registry.tasks[OWNER].owner!==r.ownerProvider||
    r.provider!=='OpenAI'||r.host!=='TIMMAY'||r.purpose!=='FIVE_JOB_LOCAL_EVIDENCE_ONLY'||!r.authorizationReference||
    !Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=now||
    !Number.isSafeInteger(r.maxGrants)||r.maxGrants<1||r.maxGrants>97||
    !Number.isSafeInteger(r.budgetMicrousd)||r.budgetMicrousd<N.CAP||r.budgetMicrousd>1000000)fail('DIRECT_PILOT_RELEASE_DISABLED');
 return r;
}
function published(root,now=Date.now(),git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:16000000,stdio:['ignore','pipe','pipe']}).trim()){
 const remote=git(['remote','get-url','origin']);
 if(!['https://github.com/tpruittguitar/forge-coordination.git','git@github.com:tpruittguitar/forge-coordination.git'].includes(remote))fail('COORDINATION_REMOTE_MISMATCH');
 const commit=git(['rev-parse','HEAD']);
 if(!/^[a-f0-9]{40}$/.test(commit)||git(['ls-remote','origin','refs/heads/main']).split(/\s/)[0]!==commit||git(['status','--porcelain']))fail('PILOT_FRESH_PUBLISHED_STATE_REQUIRED');
 release(root,now);const work=H.load(root);
 return {commit,workSha256:S.hash(work),releaseSha256:S.hash(S.read(root,RELEASE))};
}
function ledger(work){
 Public.validate(work);
 if(!work.directPilot&&work.items?.some(i=>i.taskKey===H.PILOT_TASK))fail('PILOT_ACCOUNTING_MISSING');
 const l=work.directPilot||{schema:'forge.direct-pilot-accounting.v1',reservedMicrousd:0,grants:{}};
 if(l.schema!=='forge.direct-pilot-accounting.v1'||!l.grants||Array.isArray(l.grants)||!Number.isSafeInteger(l.reservedMicrousd)||l.reservedMicrousd<0||
    Object.values(l.grants).some(g=>g.reservedMicrousd!==N.CAP||!Array.isArray(g.ids)||g.ids.length!==5)||
    Object.values(l.grants).reduce((n,g)=>n+g.reservedMicrousd,0)!==l.reservedMicrousd)fail('PILOT_ACCOUNTING_INVALID');
 for(const [id,g] of Object.entries(l.grants)){const items=work.items.filter(i=>i.taskKey===H.PILOT_TASK&&i.pilotGrantId===id);if(items.length!==5||new Set(g.ids).size!==5||items.some(i=>!g.ids.includes(i.primaryId)))fail('PILOT_ACCOUNTING_CLAIM_MISMATCH');}
 for(const i of work.items.filter(i=>i.taskKey===H.PILOT_TASK))if(!l.grants[i.pilotGrantId])fail('PILOT_ACCOUNTING_MISSING');
 return l;
}
function inspect({root,ids,view,now=Date.now(),ownGrant}){
 if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5||ids.some(x=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x)))fail('EXACT_FIVE_REQUIRED');
 const w=H.load(root),snapshot=view?.snapshot,state=view?.state;
 if(!w.enabled||!w.routingActive||!fresh(snapshot?.source?.readAt,now)||snapshot.source.kind!=='CANONICAL_WRITER_MASTER'||state?.schema!=='forge.programmed-coordinator.v1'||!state.items||!state.transactions)fail('CURRENT_CANONICAL_AUTHORITY_REQUIRED');
 require('../helper-routing/enrichment-plan.cjs').fullSnapshot(snapshot);T.healthy(snapshot.status);
 const idx=snapshot.writerReceiptIndex;
 if(!idx?.requests||!Array.isArray(idx.pending))fail('LIVE_RECEIPTS_REQUIRED');
 const pending=[...idx.pending,...Object.values(idx.requests).filter(r=>r.s!=='COMPLETE')],fenced=new Set();
 for(const r of pending){if(!r.items?.length||r.items.some(i=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.pid||'')))fail('UNRESOLVED_RECEIPT_IDENTITY');for(const i of r.items)fenced.add(i.pid);}
 const withoutOwn={...w,items:w.items.filter(i=>!(ownGrant&&i.taskKey===H.PILOT_TASK&&i.pilotGrantId===ownGrant))};
 const occupied=A.claims(root,withoutOwn,state),tx=T.fenceIndex(root,state,{excludePilotGrant:ownGrant});
 return ids.map(id=>{
  if(occupied.has(id)||w.items.some(i=>i.primaryId===id&&i.pilotGrantId!==ownGrant))fail('EXISTING_CLAIM_REQUIRES_RELEASE');
  const rows=snapshot.rows.filter(r=>r.PRIMARY_ID===id);if(rows.length!==1)fail('EXACT_CANONICAL_ID_REQUIRED');const row=rows[0];
  if(T.protectedRow(row)||tx.has(id)||fenced.has(id))fail('PROTECTED_OR_PENDING');
  E.validate(snapshot.neverConsiderById?.[id],row,snapshot);
  const missing=require('../helper-routing/shared-assignments.cjs').needs(row).filter(g=>snapshot.needsById[id]?.includes(g)&&['SALARY','DEGREE','WORK_ARRANGEMENT','REQ_ID','POSTING_DATE','CLIENT_EMPLOYER'].includes(g));
  if(!missing.length)fail('NO_MISSING_PUBLIC_FACTS');
  return {primaryId:id,kind:'ENRICHMENT',lane:'ENRICHMENT',provider:'OpenAI',taskKey:H.PILOT_TASK,worker:'forge-grant-luna',status:'ASSIGNED',assignmentVersion:1,sourceVersion:S.hash(row.line),...T.identity(row),missingFields:missing};
 });
}
function privateGrant(root,dir,ref){
 if(!path.isAbsolute(dir||''))fail('PRIVATE_PILOT_OUTPUT_REQUIRED');
 const real=fs.realpathSync(dir),repo=fs.realpathSync(root),relative=path.relative(repo,real);
 if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))fail('PRIVATE_PILOT_OUTPUT_REQUIRED');
 const value=JSON.parse(fs.readFileSync(path.join(real,'native-five-grant.json'),'utf8'));
 if(value.receiptId!==ref||value.checkpointDir!==dir)fail('PRIVATE_GRANT_MISMATCH');
 return value;
}
async function issue({root,ids,grantId,checkpointDir,checkLock,readView,readFunding,serialization,now=Date.now,verifyPublished=()=>published(root,now()),persist=(w)=>require('../grant-backlog/checkpoint.cjs').save(path.join(root,H.FILE),w)}){
 if(typeof checkLock!=='function'||typeof readView!=='function'||typeof readFunding!=='function')fail('COORDINATOR_CAPABILITIES_REQUIRED');
 if(!/^FORGE-OPENAI-PILOT-[A-Za-z0-9_-]{3,100}$/.test(grantId||'')||!path.isAbsolute(checkpointDir||'')||path.resolve(checkpointDir).startsWith(path.resolve(root)+path.sep)||path.resolve(checkpointDir)===path.resolve(root))fail('PRIVATE_PILOT_OUTPUT_REQUIRED');
 const r=release(root,now());Serialization.check(serialization,{lock:true});checkLock();const proof=verifyPublished(),before=H.load(root),l=ledger(before);
 if(l.grants[grantId])fail('GRANT_ALREADY_EXISTS_USE_RESUME');
 const grants=Object.values(l.grants);
 if(grants.length>=r.maxGrants||l.reservedMicrousd+N.CAP>r.budgetMicrousd)fail('CUMULATIVE_PILOT_BUDGET_STOP');
 // Each subsequent grant needs a published independent review of its predecessor.
 if(grants.length){const last=grants.at(-1),review=r.reviews?.[last.receiptId];
  if(last.status!=='LOCAL_COMPLETE'||!review||review.resultSha256!==last.resultSha256||review.outcome!=='VERIFIED'||!review.reviewer||review.reviewer===last.workIdentity)fail('PRIOR_BATCH_VERIFICATION_REQUIRED');}
 const funding=await readFunding(),v=await readView();const items=inspect({root,ids,view:v,now:now()});
 const g={receiptId:grantId,revision:proof.releaseSha256,ids:[...ids],checkpointDir,release:'AUTHORIZED',purpose:r.purpose,provider:r.provider,
  workIdentity:H.PILOT_TASK,expiresAt:r.expiresAt,readAt:new Date(now()).toISOString(),project:funding.project,credit:funding.credit,expectedSid:funding.expectedSid,reservedMicrousd:N.CAP,status:'RESERVED'};
 N.grantCheck(g,now(),checkpointDir);
 if(funding.credit.balanceMicrousd<10000000+l.reservedMicrousd+N.CAP)fail('CUMULATIVE_CREDIT_HEADROOM_REQUIRED');
 // Fetch again and compare substantive rows/claims immediately before one atomic save.
 const later=await readView();checkLock();
 const compared=inspect({root,ids,view:later,now:now()});
 if(S.hash(items)!==S.hash(compared)||S.hash(H.load(root))!==S.hash(before)||S.hash(release(root,now()))!==S.hash(r))fail('PILOT_INPUTS_CHANGED');
 verifyPublished();checkLock();
 const after=structuredClone(before);after.directPilot=structuredClone(l);after.directPilot.reservedMicrousd+=N.CAP;g.nonce=require('node:crypto').randomBytes(32).toString('hex');
 const localFile=path.join(checkpointDir,'native-five-grant.json');
 if(fs.existsSync(localFile))fail('PRIVATE_GRANT_ALREADY_EXISTS');
 fs.mkdirSync(checkpointDir,{recursive:true,mode:0o700});
 // Reject symlinks resolving inside the public checkout before persisting facts.
 const relative=path.relative(fs.realpathSync(root),fs.realpathSync(checkpointDir));
 if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))fail('PRIVATE_PILOT_OUTPUT_REQUIRED');
 require('../grant-backlog/checkpoint.cjs').save(localFile,g);
 after.directPilot.grants[grantId]=Public.project(g,S.hash(g));
 after.items.push(...items.map(i=>({...i,pilotGrantId:grantId,assignedAt:g.readAt,assignedBy:OWNER})));
 H.validateWork(after);persist(after);return {grantId,ids,assignmentWrites:5,reservedMicrousd:N.CAP,published:false,writerRequests:0};
}
function authority({root,checkpointDir,checkLock,readView,readFunding,readEvidence,serialization,now=Date.now,verifyPublished=()=>published(root,now())}){
 async function verifyGrant(ref,signal){
  signal?.throwIfAborted();Serialization.check(serialization);checkLock();const p=verifyPublished(),r=release(root,now()),w=H.load(root),l=ledger(w),g=l.grants[ref];
  if(!g||g.revision!==p.releaseSha256||g.status!=='RESERVED'||l.reservedMicrousd>r.budgetMicrousd)fail('CURRENT_PILOT_GRANT_REQUIRED');
  const items=w.items.filter(i=>i.pilotGrantId===ref&&i.taskKey===H.PILOT_TASK);
  if(items.length!==5||items.some(i=>i.status!=='ASSIGNED'||i.provider!=='OpenAI'||!g.ids.includes(i.primaryId)))fail('EXACT_PILOT_CLAIMS_REQUIRED');
  const local=privateGrant(root,checkpointDir,ref);if(S.hash(local)!==g.localBindingSha256)fail('PRIVATE_GRANT_MISMATCH');
  const funding=await readFunding();signal?.throwIfAborted();
  const v={...local,readAt:new Date(now()).toISOString(),project:funding.project,credit:funding.credit,expectedSid:funding.expectedSid};N.grantCheck(v,now(),checkpointDir);
  if(S.hash(local.project)!==S.hash(funding.project)||local.expectedSid!==funding.expectedSid||funding.credit.balanceMicrousd<10000000+l.reservedMicrousd)fail('PILOT_FUNDING_CHANGED');
  return v;
 }
 return {verifyGrant,async readCurrent(ref,id,signal){
  const g=await verifyGrant(ref,signal);if(!g.ids.includes(id))fail('OUTSIDE_PILOT');
  const v=await readView(signal);signal?.throwIfAborted();inspect({root,ids:g.ids,view:v,now:now(),ownGrant:ref});
  const row=v.snapshot.rows.find(r=>r.PRIMARY_ID===id),a=H.load(root).items.find(i=>i.primaryId===id);
  if(a.sourceVersion!==S.hash(row.line))fail('PILOT_ROW_CHANGED');
  const captured=await readEvidence(id,signal);signal?.throwIfAborted();Serialization.check(serialization);checkLock();
  if(captured.priorEvidenceReviewed!==true)fail('PRIOR_EVIDENCE_REVIEW_REQUIRED');
  return {receiptId:ref,revision:g.revision,exclusive:true,returned:false,originalRequestsReconciled:true,priorEvidenceReviewed:true,
   snapshot:v.snapshot,row,missingGroups:a.missingFields,admission:v.snapshot.neverConsiderById[id],evidence:captured.evidence,reusableResult:captured.reusableResult};
 }};
}
function recordResult({root,grantId,checkpointDir,report,checkLock}){
 checkLock();const w=H.load(root),g=ledger(w).grants[grantId];if(!g||g.status!=='RESERVED')fail('CURRENT_PILOT_GRANT_REQUIRED');
 if(report.mode!=='live-evidence-only'||report.jobs>5||report.modelAttempts>5||report.writerRequests!==0||report.reservedMicrousd>N.CAP)fail('INVALID_PILOT_RESULT');
 const local=privateGrant(root,checkpointDir,grantId);if(S.hash(local)!==g.localBindingSha256)fail('PRIVATE_GRANT_MISMATCH');
 const checkpoint=fs.readFileSync(path.join(checkpointDir,'native-five-checkpoint.json'));
 const complete=require('./pilot-terminal.cjs').validate(JSON.parse(checkpoint),local,report);
 g.checkpointSha256=S.hash(checkpoint);g.resultSha256=S.hash({report,checkpointSha256:g.checkpointSha256});g.result=report;g.status=complete?'LOCAL_COMPLETE':'LOCAL_HELD';
 // Claims remain fenced until the normal coordinator explicitly reconciles them.
 for(const i of w.items.filter(i=>i.pilotGrantId===grantId))i.status='RETURNED_PENDING_REVIEW';
 require('../grant-backlog/checkpoint.cjs').save(path.join(root,H.FILE),w);return {resultSha256:g.resultSha256,writerRequests:0};
}
async function execute(operation,options){
 if(!['reserve','run'].includes(operation))fail('PILOT_OPERATION_REQUIRED');
 // The host owns the existing single lock and read capabilities; no general apply.
 if(operation==='reserve')return issue(options);
 const a=authority(options),g=await a.verifyGrant(options.grantId);
 const result=await N.run({grantRef:options.grantId,dir:g.checkpointDir,authority:a});
 recordResult({...options,report:result});return result;
}
async function launch(operation,options){
 const {root,grantId,ids,readerOptions,readFunding,readEvidence,sharedWriter}=options;
 // Before taking a lock or loading any authorized reader/secret, require the
 // reviewed release on clean current main and the existing coordinator role.
 published(root);release(root);
 // Cross-host serialization with Ubuntu ATS: reserve holds the shared Writer POST
 // lock until its reservation is on main; ATS rereads main under that lock.
 const serialization=await Serialization.establish({root,capability:sharedWriter,hold:operation==='reserve',owner:'direct-pilot-'+String(grantId||'').slice(0,80)});
 try{
 const contract=fs.readFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'utf8');
 const lockFile=contract.match(/automation-run-lock\.cjs acquire (\S+) <unique-RUN_ID>/)?.[1];
 if(!lockFile||!path.isAbsolute(lockFile))fail('CURRENT_SHARED_PRODUCTION_LOCK_REQUIRED');
 const Lock=require('../automation-run-lock.cjs'),token=require('node:crypto').randomUUID();
 if(!Lock.lock(lockFile,'acquire',token).acquired)fail('PRODUCTION_LOCK_HELD');
 const checkLock=()=>Lock.lock(lockFile,'check',token);
 try{
  const selected=operation==='reserve'?ids:ledger(H.load(root)).grants[grantId]?.ids;
  const readers=require('../grant-backlog/host-readers.cjs').createPilot({...readerOptions,root,admissionIds:selected});
  const result=await execute(operation,{...options,readView:readers.readView,checkLock,readFunding,readEvidence,serialization});
  // Existing accounting publication makes reservations visible to all helpers.
  // A failed publication cannot start a model call or release/recreate a grant.
  // A reservation is published only while this invocation still holds the shared lock.
  if(operation==='reserve')await Serialization.confirmHeld(serialization);
  require('../helper-routing/shared-pages.cjs').generate(root,{checkLock});
  const publication=require('./publish.cjs').publish(root);
  if(!publication.published)fail('PILOT_ACCOUNTING_NOT_PUBLISHED');
  return {...result,publication};
 }finally{Lock.lock(lockFile,'release',token);}
 }finally{await Serialization.end(serialization);}
}
// Retrying a failed accounting publication must also hold the shared lock, or the
// reservation could reach main while an ATS POST that has not seen it is in flight.
async function republish({root,sharedWriter,grantId}){
 const serialization=await Serialization.establish({root,capability:sharedWriter,hold:true,owner:'direct-pilot-republish-'+String(grantId||'').slice(0,80)});
 try{await Serialization.confirmHeld(serialization);const publication=require('./publish.cjs').publish(root);if(!publication.published)fail('PILOT_ACCOUNTING_NOT_PUBLISHED');return publication;}
 finally{await Serialization.end(serialization);}
}
module.exports={republish,launch,RELEASE,OWNER,release,published,ledger,inspect,issue,authority,recordResult,execute};
