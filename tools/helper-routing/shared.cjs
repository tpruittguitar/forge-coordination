'use strict';
// One coordinator-owned reservation pool. Helpers never claim or write canonical jobs.
const path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),HF=require('./helper-fields.cjs');
const FILE='control/SHARED_HELPER_WORK.json',ROOT=path.resolve(__dirname,'../..');
const TASKS={FORGE_CLAUDE_SHARED_HELPER:'Claude',FORGE_GROK_SHARED_HELPER:'Grok',FORGE_SNIFFER_SHARED_HELPER:'Sniffer',FORGE_HERMES_SHARED_HELPER:'Hermes'};
// Explicit API route is intentionally absent from generic auto-allocation/page loops.
const API_TASK='FORGE_API_GRANT_ENRICHMENT';
const PILOT_TASK='FORGE_OPENAI_DIRECT_PILOT';
const providerFor=task=>task===PILOT_TASK?'OpenAI':task===API_TASK?'ChatGPT':TASKS[task];
// Sniffer took over the retired Grok helper's work (Tim, Nov 18 2026, 1:18 AM ET); older work files have no Sniffer provider yet.
const SNIFFER_TASK='FORGE_SNIFFER_SHARED_HELPER',HERMES_TASK='FORGE_HERMES_SHARED_HELPER',OPTIONAL_TASKS=new Set([SNIFFER_TASK,HERMES_TASK]);
// Lanes whose enrichment items carry per-field state (seeded, settled from Writer receipts).
const FIELD_TASKS=new Set(['FORGE_GROK_SHARED_HELPER',SNIFFER_TASK]);
const MAX_ARTIFACT_ITEMS=20;
const CLOSED=new Set(['CONSUMED','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE']);
const active=i=>!CLOSED.has(i.status), key=i=>i.primaryId||i.key;
const proof=x=>typeof x==='string'&&x.trim().length>0;
// Transport integrity only. Submitted text is untrusted evidence, never a
// substitute for the independent source/identity/quote checks before Writer.
function captureProof(e){
 if(!Object.hasOwn(e,'capture'))return null;
 const c=e.capture;
 if(!c||c.kind!=='TEXT_EXTRACT'||typeof c.text!=='string'||c.text.trim().length<300||Buffer.byteLength(c.text,'utf8')>200000||Object.keys(c).some(k=>!['kind','text'].includes(k)))throw Error('SHARED_CAPTURE_REQUIRED');
 const sha256=S.hash(c.text),literal=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 if(!proof(e.quote)||!literal(c.text).includes(literal(e.quote)))throw Error('SHARED_CAPTURE_QUOTE_REQUIRED');
 if(Object.hasOwn(e,'sourceSha256')&&e.sourceSha256!==sha256)throw Error('SHARED_CAPTURE_HASH_MISMATCH');
 return{kind:c.kind,sha256,bytes:Buffer.byteLength(c.text,'utf8'),basis:'SUBMITTED_TEXT_ONLY',independentlyVerified:false};
}
function validateWork(w,opts){
 require('../programmed-coordinator/pilot-public.cjs').validate(w);
 if(w?.schema!=='forge.shared-helper-work.v1'||typeof w.enabled!=='boolean'||typeof w.routingActive!=='boolean'||!proof(w.assignmentId)||!Array.isArray(w.items)||!w.providers)throw Error('INVALID_SHARED_HELPER_WORK');
 const seen=new Set();
 for(const [task,provider]of Object.entries(TASKS))if(!(OPTIONAL_TASKS.has(task)&&!w.providers[task])&&(w.providers[task]?.provider!==provider||typeof w.providers[task]?.available!=='boolean'))throw Error('INVALID_SHARED_HELPER_PROVIDER');
 for(const i of w.items){
  if(!proof(key(i))||seen.has(key(i))||!['ENRICHMENT','INTAKE','DISCOVERY'].includes(i.kind)||providerFor(i.taskKey)!==i.provider||!Number.isSafeInteger(i.assignmentVersion)||i.assignmentVersion<1||!proof(i.status)||!proof(i.sourceVersion))throw Error('INVALID_OR_OVERLAPPING_SHARED_ASSIGNMENT');
  if(i.taskKey===PILOT_TASK&&(i.kind!=='ENRICHMENT'||i.worker!=='forge-grant-luna'||!i.pilotGrantId))throw Error('PILOT_ENRICHMENT_ONLY');
  if(i.taskKey===API_TASK&&(i.kind!=='ENRICHMENT'||i.worker!=='forge-grant-luna'))throw Error('API_ENRICHMENT_ONLY');
  if(i.kind==='ENRICHMENT'&&!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.primaryId||''))throw Error('EXACT_SHARED_JOB_ID_REQUIRED');
  seen.add(key(i));
 }
 if(Object.hasOwn(w,'enrichmentPartitionReservations')){
  const r=w.enrichmentPartitionReservations,P=require('./worker-partition.cjs');
  if(r.schema!=='forge.enrichment-partition-reservations.v1'||r.sourcePath!==P.FILE||r.sourceCommit!==P.SOURCE||!Array.isArray(r.workers)||r.workers.length!==1)throw Error('INVALID_ENRICHMENT_PARTITION_RESERVATIONS');
  const [h]=r.workers,part=opts?.partition?P.validate(opts.partition):P.load(ROOT);
  if(h?.provider!=='Hermes'||!Array.isArray(h.primaryIds)||h.primaryIds.length!==part.hermes.size||h.primaryIds.some(id=>!part.hermes.has(id)))throw Error('INVALID_ENRICHMENT_PARTITION_RESERVATIONS');
 }
 return w;
}
function load(root=ROOT){return validateWork(S.read(root,FILE));}
function partitionReservationIds(w){return (w?.enrichmentPartitionReservations?.workers||[]).flatMap(x=>x.primaryIds||[]);}
function reservedKeys(w){const fromItems=w?.enabled&&w.routingActive?w.items.filter(active).flatMap(i=>[key(i),...i.aliases||[]]):[];return new Set([...fromItems,...partitionReservationIds(w)]);}
// Lanes have no owner (Tim 2026-11-22): any authorized provider may run a shared
// lane. Item provider is the lane's reservation label; the batch records who ran it.
function providerOk(b){
 if(b.taskKey===API_TASK)return providerFor(b.taskKey)===b.provider;
 const L=require('../automation-lanes.cjs');let registry;try{registry=L.read(ROOT);}catch{return false;}
 return !!TASKS[b.taskKey]&&L.receiptProvider(registry,b.taskKey,b.provider);
}
function validateBatch(b,w=load()){
 if(b?.taskKey===PILOT_TASK)throw Error('PILOT_LOCAL_OUTPUT_ONLY');
 validateWork(w);
 if(!w.enabled||!w.routingActive||b?.schema!=='forge.shared-helper-batch.v1'||!providerOk(b)||b.assignmentId!==w.assignmentId||!new RegExp('^FORGE-'+String(b.provider).toUpperCase()+'-[A-Za-z0-9_-]+$').test(b.runId||'')||!/^[a-f0-9]{40}$/.test(b.instructionCommit||'')||!Array.isArray(b.items)||(!b.items.length&&b.mode!=='READINESS_ONLY')||b.items.length>MAX_ARTIFACT_ITEMS)throw Error('INVALID_SHARED_HELPER_ENVELOPE');
 if(b.taskKey===API_TASK)require('./api-grant.cjs').validateBatch(b,w);
 if(b.mode!==undefined&&b.mode!=='READINESS_ONLY')throw Error('INVALID_SHARED_HELPER_MODE');
 if(b.mode==='READINESS_ONLY'){
  // A provider tests its actual return transport before receiving job assignments.
  // It cannot smuggle job effects or claim research/Writer completion in a probe.
  const fields=new Set(['schema','provider','taskKey','assignmentId','runId','instructionCommit','mode','returnTransport','researchPerformed','writerSubmitted','items']);
  if(b.items.length||b.researchPerformed!==false||b.writerSubmitted!==false||!['GITHUB_PR','DRIVE'].includes(b.returnTransport)||Object.keys(b).some(k=>!fields.has(k)))throw Error('INVALID_SHARED_READINESS_PROBE');
  return{valid:true,items:0,readinessOnly:true,productionAuthorized:false};
 }
 if(Buffer.byteLength(JSON.stringify(b),'utf8')>2000000)throw Error('SHARED_BATCH_TOO_LARGE');
 // An explicit batch false may cover omitted item flags. Never infer false
 // from silence, or hide a contradictory/null flag at either level.
 if(Object.hasOwn(b,'writerSubmitted')&&b.writerSubmitted!==false)throw Error('HELPER_WRITER_SUBMISSION_FORBIDDEN');
 const assigned=new Map(w.items.map(i=>[key(i),i])),seen=new Set(),sourceCaptures=[];
 for(const item of b.items){
  const k=key(item),a=assigned.get(k);
  if(!a||seen.has(k)||a.taskKey!==b.taskKey||a.kind!==item.kind||a.assignmentVersion!==item.assignmentVersion||a.sourceVersion!==item.sourceVersion)throw Error('STALE_OR_UNASSIGNED_SHARED_ITEM');
  if(Object.hasOwn(item,'writerSubmitted')?item.writerSubmitted!==false:!Object.hasOwn(b,'writerSubmitted')||b.writerSubmitted!==false)throw Error('HELPER_WRITER_SUBMISSION_FORBIDDEN');
  if(!['ENRICHMENT_EVIDENCE_READY','INTAKE_READY','SOURCE_BLOCKED','RESEARCH_INCOMPLETE','PROTECTED_SKIP','EXISTING_CANONICAL'].includes(item.recommendation))throw Error('INVALID_SHARED_RECOMMENDATION');
  if(item.kind==='ENRICHMENT'&&item.recommendation==='INTAKE_READY'||item.kind!=='ENRICHMENT'&&item.recommendation==='ENRICHMENT_EVIDENCE_READY')throw Error('SHARED_RECOMMENDATION_KIND_MISMATCH');
  const e=item.sourceEvidence;
  if(!e||!['company','title','location'].every(f=>proof(e[f])))throw Error('SHARED_SOURCE_IDENTITY_REQUIRED');
  const capture=captureProof(e);if(capture)sourceCaptures.push({key:k,...capture});
  if(/_READY$/.test(item.recommendation)){
   require('../programmed-coordinator/source.cjs').publicUrl(e.url);
   if(!Number.isFinite(Date.parse(e.observedAt))||!capture&&!/^[a-f0-9]{64}$/.test(e.sourceSha256||'')||!proof(e.quote))throw Error('SHARED_SOURCE_PROOF_REQUIRED');
  }else if(!proof(item.reason)||!proof(item.retryCondition)||!proof(item.researchOwner))throw Error('SHARED_EXCEPTION_ACCOUNTING_REQUIRED');
  // Job-text fields only (helper-fields.cjs). Scores, bookkeeping and identity stay with the Writer.
  if(['bucket','disposition','needsTim','timDecision','score','fields'].some(f=>Object.hasOwn(item,f)))throw Error('HELPER_PROTECTED_FIELDS_FORBIDDEN');
  HF.check(e,{capture:capture?e.capture.text:null});
  seen.add(k);
 }
 return{valid:true,items:seen.size,productionAuthorized:false,...(sourceCaptures.length?{sourceCaptures}:{})};
}
const LANES=['RESEARCH','ENRICHMENT','INTAKE','DISCOVERY'];
const lane=i=>i.lane||i.kind;
function ordering(items,now=Date.now()){
 const actionable=items.filter(i=>i.status==='ASSIGNED'&&(!i.retryAfter||Date.parse(i.retryAfter)<=now)),counts=Object.fromEntries(LANES.map(l=>[l,0])),seen=new Set();
 for(const i of actionable){const keys=[key(i),...i.aliases||[]];if(keys.some(k=>seen.has(k)))continue;for(const k of keys)seen.add(k);counts[lane(i)]=(counts[lane(i)]||0)+1;}
 const lanes=[...LANES].sort((a,b)=>counts[b]-counts[a]||LANES.indexOf(a)-LANES.indexOf(b)),rank=new Map(lanes.map((l,n)=>[l,n]));
 // Counts are distinct eligible jobs, never missing-field counts or historical totals.
 const sort=(a,b)=>(rank.get(lane(a))??99)-(rank.get(lane(b))??99)||String(a.assignedAt||'').localeCompare(String(b.assignedAt||''))||key(a).localeCompare(key(b));
 return{counts,lanes,sort,actionable};
}
function next(w,taskKey,after=null,now=Date.now()){
 validateWork(w);if(!TASKS[taskKey])throw Error('UNKNOWN_SHARED_HELPER_TASK');
 const order=ordering(w.items.filter(i=>i.taskKey!==API_TASK&&w.providers[i.taskKey]?.available),now),mine=w.items.filter(i=>i.taskKey===taskKey).sort(order.sort);
 const cursorVersion=S.hash({assignmentId:w.assignmentId,taskKey,lanes:order.lanes,counts:order.counts,eligible:order.actionable.map(key),items:mine.map(i=>[key(i),i.status,i.assignmentVersion,i.sourceVersion,i.retryAfter||null])});
 let index=-1,cursorReset=false;
 if(after){
  let cursor;try{if(typeof after!=='string'||!after.startsWith('SHARED:')||after.length>2000)throw Error();cursor=JSON.parse(Buffer.from(after.slice(7),'base64url'));}catch{throw Error('UNKNOWN_SHARED_CURSOR');}
  if(cursor.taskKey!==taskKey||!cursor.after||!cursor.version)throw Error('UNKNOWN_SHARED_CURSOR');
  if(cursor.version!==cursorVersion)cursorReset=true; // Changed priority/ownership: resume at current eligible work, never skip it.
  else{index=mine.findIndex(i=>key(i)===cursor.after);if(index<0)throw Error('UNKNOWN_SHARED_CURSOR');}
 }
 const eligible=new Set(order.actionable.map(key)),all=mine.filter(i=>eligible.has(key(i))),remaining=w.enabled&&w.routingActive&&w.providers[taskKey]?.available?mine.slice(index+1).filter(i=>eligible.has(key(i))):[],items=remaining.slice(0,MAX_ARTIFACT_ITEMS);
 // Artifact bounds are transport constraints, never a provider's run budget.
 const continuation={maxArtifactItems:MAX_ARTIFACT_ITEMS,runItemCap:null,remainingAfterPage:remaining.length-items.length,nextAction:remaining.length>items.length?'CONTINUE_THIS_INVOCATION':'RECHECK_FRESH_WORK',advanceCursorAfter:'CHECKPOINT_EVERY_PAGE_ITEM',deliveryBlockScope:'TRANSPORT_ONLY'};
 return{schema:'forge.shared-helper-next.v1',assignmentId:w.assignmentId,provider:TASKS[taskKey],taskKey,mode:'EVIDENCE_ONLY',priorityBasis:'LARGEST_CURRENT_ELIGIBLE_LANE_FIRST',backlogCounts:order.counts,laneOrder:order.lanes,sourceAt:w.at||null,continuation,items,total:all.length,nextAfter:items.length?'SHARED:'+Buffer.from(JSON.stringify({taskKey,after:key(items.at(-1)),version:cursorVersion})).toString('base64url'):null,cursorReset,canonicalCompletion:false};
}
function validateRouting(batch,before,current){
 for(const item of batch.items){const k=key(item),a=before.items.find(i=>key(i)===k),b=current.items.find(i=>key(i)===k);
  if(!a||!b||[a,b].some(i=>i.taskKey!==batch.taskKey||i.assignmentVersion!==item.assignmentVersion||i.sourceVersion!==item.sourceVersion))throw Error('STALE_SHARED_OWNERSHIP');
 }
}
function assertCurrent(root,item,batch){const w=load(root);if(batch.taskKey===API_TASK)require('./api-grant.cjs').assertReturn(root,w,{...batch,items:[item]});validateBatch({...batch,items:[item]},w);const current=w.items.find(i=>key(i)===key(item));if(!active(current))throw Error('SHARED_RESERVATION_CLOSED');return current;}
// Explicit coordinator handoff only; quota reset or elapsed time is never a release.
function transfer(w,itemKey,toTask,{checkpoint,terminalRun,reason,transactionPending=false}={}){
 validateWork(w);const item=w.items.find(i=>key(i)===itemKey);
 if(!item||!active(item)||!TASKS[toTask]||!w.providers[toTask]?.available||!proof(checkpoint)||terminalRun!==true||!proof(reason)||transactionPending||item.status!=='ASSIGNED')throw Error('SAFE_SHARED_HANDOFF_PROOF_REQUIRED');
 const history=item.assignmentHistory||(item.assignmentHistory=[]);history.push({provider:item.provider,taskKey:item.taskKey,assignmentVersion:item.assignmentVersion,checkpoint,reason});
 item.taskKey=toTask;item.provider=TASKS[toTask];item.assignmentVersion++;return item;
}
if(require.main===module){try{const [command,arg,after]=process.argv.slice(2),w=load();console.log(JSON.stringify(command==='validate'?validateBatch(S.read(process.cwd(),arg),w):next(w,command,arg||null)));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={PILOT_TASK,API_TASK,providerFor,SNIFFER_TASK,HERMES_TASK,FIELD_TASKS,FILE,TASKS,LANES,MAX_ARTIFACT_ITEMS,ordering,lane,load,validateWork,validateBatch,captureProof,validateRouting,assertCurrent,next,reservedKeys,transfer,key,active};
