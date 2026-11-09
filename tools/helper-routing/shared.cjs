'use strict';
// One coordinator-owned reservation pool. Helpers never claim or write canonical jobs.
const path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
const FILE='control/SHARED_HELPER_WORK.json',ROOT=path.resolve(__dirname,'../..');
const TASKS={FORGE_CLAUDE_SHARED_HELPER:'Claude',FORGE_GROK_SHARED_HELPER:'Grok'};
const CLOSED=new Set(['CONSUMED','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE']);
const active=i=>!CLOSED.has(i.status), key=i=>i.primaryId||i.key;
const proof=x=>typeof x==='string'&&x.trim().length>0;
function validateWork(w){
 if(w?.schema!=='forge.shared-helper-work.v1'||typeof w.enabled!=='boolean'||typeof w.routingActive!=='boolean'||!proof(w.assignmentId)||!Array.isArray(w.items)||!w.providers)throw Error('INVALID_SHARED_HELPER_WORK');
 const seen=new Set();
 for(const [task,provider]of Object.entries(TASKS))if(w.providers[task]?.provider!==provider||typeof w.providers[task]?.available!=='boolean')throw Error('INVALID_SHARED_HELPER_PROVIDER');
 for(const i of w.items){
  if(!proof(key(i))||seen.has(key(i))||!['ENRICHMENT','INTAKE','DISCOVERY'].includes(i.kind)||TASKS[i.taskKey]!==i.provider||!Number.isSafeInteger(i.assignmentVersion)||i.assignmentVersion<1||!proof(i.status)||!proof(i.sourceVersion))throw Error('INVALID_OR_OVERLAPPING_SHARED_ASSIGNMENT');
  if(i.kind==='ENRICHMENT'&&!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.primaryId||''))throw Error('EXACT_SHARED_JOB_ID_REQUIRED');
  seen.add(key(i));
 }
 return w;
}
function load(root=ROOT){return validateWork(S.read(root,FILE));}
function reservedKeys(w){return new Set(w?.enabled&&w.routingActive?w.items.filter(active).flatMap(i=>[key(i),...i.aliases||[]]):[]);}
function validateBatch(b,w=load()){
 validateWork(w);
 if(!w.enabled||!w.routingActive||b?.schema!=='forge.shared-helper-batch.v1'||TASKS[b.taskKey]!==b.provider||b.assignmentId!==w.assignmentId||!new RegExp('^FORGE-'+String(b.provider).toUpperCase()+'-[A-Za-z0-9_-]+$').test(b.runId||'')||!/^[a-f0-9]{40}$/.test(b.instructionCommit||'')||!Array.isArray(b.items)||(!b.items.length&&b.mode!=='READINESS_ONLY')||b.items.length>20)throw Error('INVALID_SHARED_HELPER_ENVELOPE');
 if(b.mode!==undefined&&b.mode!=='READINESS_ONLY')throw Error('INVALID_SHARED_HELPER_MODE');
 if(b.mode==='READINESS_ONLY'){
  // A provider tests its actual return transport before receiving job assignments.
  // It cannot smuggle job effects or claim research/Writer completion in a probe.
  const fields=new Set(['schema','provider','taskKey','assignmentId','runId','instructionCommit','mode','returnTransport','researchPerformed','writerSubmitted','items']);
  if(b.items.length||b.researchPerformed!==false||b.writerSubmitted!==false||!['GITHUB_PR','DRIVE'].includes(b.returnTransport)||Object.keys(b).some(k=>!fields.has(k)))throw Error('INVALID_SHARED_READINESS_PROBE');
  return{valid:true,items:0,readinessOnly:true,productionAuthorized:false};
 }
 const assigned=new Map(w.items.map(i=>[key(i),i])),seen=new Set();
 for(const item of b.items){
  const k=key(item),a=assigned.get(k);
  if(!a||seen.has(k)||a.taskKey!==b.taskKey||a.provider!==b.provider||a.kind!==item.kind||a.assignmentVersion!==item.assignmentVersion||a.sourceVersion!==item.sourceVersion)throw Error('STALE_OR_UNASSIGNED_SHARED_ITEM');
  if(item.writerSubmitted!==false)throw Error('HELPER_WRITER_SUBMISSION_FORBIDDEN');
  if(!['ENRICHMENT_EVIDENCE_READY','INTAKE_READY','SOURCE_BLOCKED','RESEARCH_INCOMPLETE','PROTECTED_SKIP','EXISTING_CANONICAL'].includes(item.recommendation))throw Error('INVALID_SHARED_RECOMMENDATION');
  if(item.kind==='ENRICHMENT'&&item.recommendation==='INTAKE_READY'||item.kind!=='ENRICHMENT'&&item.recommendation==='ENRICHMENT_EVIDENCE_READY')throw Error('SHARED_RECOMMENDATION_KIND_MISMATCH');
  const e=item.sourceEvidence;
  if(!e||!['company','title','location'].every(f=>proof(e[f])))throw Error('SHARED_SOURCE_IDENTITY_REQUIRED');
  if(/_READY$/.test(item.recommendation)){
   require('../programmed-coordinator/source.cjs').publicUrl(e.url);
   if(!Number.isFinite(Date.parse(e.observedAt))||!/^[a-f0-9]{64}$/.test(e.sourceSha256||'')||!proof(e.quote))throw Error('SHARED_SOURCE_PROOF_REQUIRED');
  }else if(!proof(item.reason)||!proof(item.retryCondition)||!proof(item.researchOwner))throw Error('SHARED_EXCEPTION_ACCOUNTING_REQUIRED');
  const raw=e.proposedRawFields||{};
  const allowed=new Set(['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_BASIS','SALARY_SOURCE','SOURCE_URL']);
  if(Object.keys(raw).some(f=>!allowed.has(f))||['bucket','disposition','needsTim','timDecision','score','fields'].some(f=>Object.hasOwn(item,f)))throw Error('HELPER_PROTECTED_FIELDS_FORBIDDEN');
  seen.add(k);
 }
 return{valid:true,items:seen.size,productionAuthorized:false};
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
 const order=ordering(w.items.filter(i=>w.providers[i.taskKey]?.available),now),mine=w.items.filter(i=>i.taskKey===taskKey).sort(order.sort);
 const cursorVersion=S.hash({assignmentId:w.assignmentId,taskKey,lanes:order.lanes,counts:order.counts,eligible:order.actionable.map(key),items:mine.map(i=>[key(i),i.status,i.assignmentVersion,i.sourceVersion,i.retryAfter||null])});
 let index=-1,cursorReset=false;
 if(after){
  let cursor;try{if(typeof after!=='string'||!after.startsWith('SHARED:')||after.length>2000)throw Error();cursor=JSON.parse(Buffer.from(after.slice(7),'base64url'));}catch{throw Error('UNKNOWN_SHARED_CURSOR');}
  if(cursor.taskKey!==taskKey||!cursor.after||!cursor.version)throw Error('UNKNOWN_SHARED_CURSOR');
  if(cursor.version!==cursorVersion)cursorReset=true; // Changed priority/ownership: resume at current eligible work, never skip it.
  else{index=mine.findIndex(i=>key(i)===cursor.after);if(index<0)throw Error('UNKNOWN_SHARED_CURSOR');}
 }
 const eligible=new Set(order.actionable.map(key)),all=mine.filter(i=>eligible.has(key(i))),items=w.enabled&&w.routingActive&&w.providers[taskKey].available?mine.slice(index+1).filter(i=>eligible.has(key(i))).slice(0,20):[];
 return{schema:'forge.shared-helper-next.v1',assignmentId:w.assignmentId,provider:TASKS[taskKey],taskKey,mode:'EVIDENCE_ONLY',priorityBasis:'LARGEST_CURRENT_ELIGIBLE_LANE_FIRST',backlogCounts:order.counts,laneOrder:order.lanes,sourceAt:w.at||null,items,total:all.length,nextAfter:items.length?'SHARED:'+Buffer.from(JSON.stringify({taskKey,after:key(items.at(-1)),version:cursorVersion})).toString('base64url'):null,cursorReset,canonicalCompletion:false};
}
function validateRouting(batch,before,current){
 for(const item of batch.items){const k=key(item),a=before.items.find(i=>key(i)===k),b=current.items.find(i=>key(i)===k);
  if(!a||!b||[a,b].some(i=>i.taskKey!==batch.taskKey||i.provider!==batch.provider||i.assignmentVersion!==item.assignmentVersion||i.sourceVersion!==item.sourceVersion))throw Error('STALE_SHARED_OWNERSHIP');
 }
}
function assertCurrent(root,item,batch){const w=load(root);validateBatch({...batch,items:[item]},w);const current=w.items.find(i=>key(i)===key(item));if(!active(current))throw Error('SHARED_RESERVATION_CLOSED');return current;}
// Explicit coordinator handoff only; quota reset or elapsed time is never a release.
function transfer(w,itemKey,toTask,{checkpoint,terminalRun,reason,transactionPending=false}={}){
 validateWork(w);const item=w.items.find(i=>key(i)===itemKey);
 if(!item||!active(item)||!TASKS[toTask]||!w.providers[toTask].available||!proof(checkpoint)||terminalRun!==true||!proof(reason)||transactionPending||item.status!=='ASSIGNED')throw Error('SAFE_SHARED_HANDOFF_PROOF_REQUIRED');
 const history=item.assignmentHistory||(item.assignmentHistory=[]);history.push({provider:item.provider,taskKey:item.taskKey,assignmentVersion:item.assignmentVersion,checkpoint,reason});
 item.taskKey=toTask;item.provider=TASKS[toTask];item.assignmentVersion++;return item;
}
if(require.main===module){try{const [command,arg,after]=process.argv.slice(2),w=load();console.log(JSON.stringify(command==='validate'?validateBatch(S.read(process.cwd(),arg),w):next(w,command,arg||null)));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={FILE,TASKS,LANES,ordering,lane,load,validateWork,validateBatch,validateRouting,assertCurrent,next,reservedKeys,transfer,key,active};
