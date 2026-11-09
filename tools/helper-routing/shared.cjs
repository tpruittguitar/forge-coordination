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
 if(!w.enabled||!w.routingActive||b?.schema!=='forge.shared-helper-batch.v1'||TASKS[b.taskKey]!==b.provider||b.assignmentId!==w.assignmentId||!new RegExp('^FORGE-'+String(b.provider).toUpperCase()+'-[A-Za-z0-9_-]+$').test(b.runId||'')||!/^[a-f0-9]{40}$/.test(b.instructionCommit||'')||!Array.isArray(b.items)||!b.items.length||b.items.length>20)throw Error('INVALID_SHARED_HELPER_ENVELOPE');
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
function next(w,taskKey,after=null){
 validateWork(w);if(!TASKS[taskKey])throw Error('UNKNOWN_SHARED_HELPER_TASK');
 const mine=w.items.filter(i=>i.taskKey===taskKey),index=after?mine.findIndex(i=>key(i)===after):-1;
 if(after&&index<0)throw Error('UNKNOWN_SHARED_CURSOR');
 const eligible=i=>active(i)&&i.status==='ASSIGNED',all=mine.filter(eligible),items=w.enabled&&w.routingActive&&w.providers[taskKey].available?mine.slice(index+1).filter(eligible).slice(0,20):[];
 return{schema:'forge.shared-helper-next.v1',assignmentId:w.assignmentId,provider:TASKS[taskKey],taskKey,mode:'EVIDENCE_ONLY',items,total:all.length,nextAfter:items.length?key(items.at(-1)):null,canonicalCompletion:false};
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
module.exports={FILE,TASKS,load,validateWork,validateBatch,validateRouting,assertCurrent,next,reservedKeys,transfer,key,active};
