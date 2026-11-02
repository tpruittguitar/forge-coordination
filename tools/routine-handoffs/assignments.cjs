'use strict';
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs'),Screen=require('../relevance-screen/screen.cjs');
const fs=require('node:fs'),path=require('node:path'),Source=require('../programmed-coordinator/source.cjs');
const terminal=s=>/^(VERIFIED_|OUT_OF_SCOPE|EXCLUDED_BY_WRITER)/.test(s||''),fenced=j=>(j.submissions||[]).length>0||/POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(j.status||'');
function card(j){return{company:j.company,title:j.title,location:j.location,url:j.url,observedAt:j.observedAt};}
function fullCard(j){return(j.evidence||[]).some(e=>Array.isArray(e.paragraphs)&&e.paragraphs.length>=3&&/^[a-f0-9]{64}$/.test(e.cardHash||''));}
function progress({root,state}){
 const result={schema:'forge.helper-handoffs.v1',tasks:{},writerSubmissions:0,canonicalCompletions:0};
 for(const [taskKey,file] of [['FORGE_GROK_INTAKE_HELPER','control/GROK_INTAKE_HELPER_WORK.json'],['FORGE_CLAUDE_RELEVANCE_REVIEW','control/CLAUDE_RELEVANCE_WORK.json'],['FORGE_GROK_ENRICHMENT','control/ENRICHMENT_HELPER_WORK.json']]){
  const w=S.read(root,file),returned=new Set(Object.values(state.items).filter(i=>i.taskKey===taskKey&&state.batches[i.batch]?.status==='VALIDATED').map(i=>i.itemKey));
  const keys=w.keys||w.items.map(i=>i.primaryId),handed=new Set(Object.keys(w.coordinatorHandoffs||{}));
  const outstanding=keys.filter(k=>!returned.has(k)&&!handed.has(k));
  let nextPage=null;
  for(const page of w.pages||[]){const body=S.read(root,page.path);if(body.items.some(i=>outstanding.includes(i.key))){nextPage=page.path;break;}}
  result.tasks[taskKey]={assignmentId:w.assignmentId,assigned:keys.length,returned:returned.size,coordinatorOwned:handed.size,pendingResearch:outstanding.length,nextPage,nextKey:outstanding[0]||null,returnedKeys:[...returned].sort(),noProcessingCap:true};
 }
 return result;
}
function replenish({root,state,snapshot,runId,apply=false,now=Date.now()}){
 if(!Number.isFinite(Date.parse(snapshot?.source?.readAt))||now-Date.parse(snapshot.source.readAt)>900000||Date.parse(snapshot.source.readAt)>now+120000)throw Error('FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED');
 const queue=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),legacy=S.read(root,'state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]}),code=S.read(root,'state/CODE_INTAKE_CONSUMPTION.json',{schema:'forge.code-intake-consumption.v1',items:[]});
 const intake=S.read(root,'control/GROK_INTAKE_HELPER_WORK.json'),relevance=S.read(root,'control/CLAUDE_RELEVANCE_WORK.json'),enrich=S.read(root,'control/ENRICHMENT_HELPER_WORK.json');
 const owners=new Map(),addOwner=(k,t)=>{if(owners.has(k)&&owners.get(k)!==t)throw Error('OVERLAPPING_ACTIVE_HELPER_OWNERSHIP');owners.set(k,t);};
 if(intake.enabled&&intake.routingActive)for(const k of intake.keys)addOwner(k,intake.taskKey);
 if(relevance.enabled)for(const k of relevance.keys)addOwner(k,relevance.taskKey);
 for(const w of [intake,relevance])for(const p of w.pages||[])for(const i of S.read(root,p.path).items)for(const alias of i.aliases||[])if(w.enabled)addOwner(alias,w.taskKey);
 const canonical=[...snapshot.rows,...snapshot.archiveRows],rules=Screen.guarded(Screen.load(),canonical),knownCode=new Set([...legacy.items,...code.items].map(i=>i.key));
 const identity=x=>[Source.norm(x.company||x.COMPANY),Source.norm(x.title||x.TITLE),Source.location(x.location||x.LOCATION)].join('|'),byIdentity=new Map(),urlKey=require('../pipeline-observability/upstream-flow').key;
 for(const row of canonical){const k=identity(row),list=byIdentity.get(k)||[];list.push(row);byIdentity.set(k,list);}
 const newIntake=[],newRelevance=[],exceptions=[],counts={seededCodeIntake:0,canonical:0,fenced:0,alreadyAssigned:0};
 for(const j of Object.values(queue.jobs).sort((a,b)=>String(a.observedAt||'').localeCompare(String(b.observedAt||''))||a.key.localeCompare(b.key))){
  if(terminal(j.status))continue;
  if(fenced(j)){counts.fenced++;continue;}
  const matches=byIdentity.get(identity(j))||[];
  if(matches.some(r=>(String(r.p?.SOURCE_URL||'').match(/https:\/\/[^ ;|]+/g)||[]).some(u=>urlKey(u)===j.key))){counts.canonical++;continue;}
  if(matches.length){exceptions.push({key:j.key,owner:'AI',reason:'CANONICAL_NEAR_MATCH_REQUIRES_IDENTITY'});continue;}
  if(owners.has(j.key)){counts.alreadyAssigned++;continue;}
  const screen=Screen.evaluate(j,rules),prepared=fullCard(j);
  if(prepared&&!knownCode.has(j.key)){
   const evidence=j.evidence.find(e=>e.cardHash&&e.paragraphs?.length>=3);
   code.items.push({key:j.key,queueKey:j.key,provider:'CODE',helperRunId:runId,provenance:'CAPTURED_SOURCE_CARD',sourceEvidence:card(j),cardHash:evidence.cardHash,status:'RETURNED_PENDING_SCREEN',sourceProof:'state/EMAIL_RECOVERY_QUEUE.json#'+j.key});knownCode.add(j.key);counts.seededCodeIntake++;
  }
  if(screen.outcome==='HOLD_SOURCE_IDENTITY'){exceptions.push({key:j.key,owner:'AI',reason:'CAPTURED_CARD_IDENTITY_INCOMPLETE'});continue;}
  if(screen.outcome==='ADMIT'&&prepared||screen.outcome==='FUNCTION_MISMATCH'&&prepared)continue; // Code/Writer owns these.
  const target=prepared?newRelevance:newIntake;
  target.push({key:j.key,aliases:j.aliases||[],sourceEvidence:{...card(j),references:['state/EMAIL_RECOVERY_QUEUE.json#'+j.key]},sourceDate:j.sourceDate||null,priorScreen:screen,writerSubmitted:false});
 }
 const handoffs=progress({root,state}),appended=[];
 function append(w,items,folder,schema){
  if(!w.enabled||!items.length||handoffs.tasks[w.taskKey].pendingResearch!==0)return;
  const unique=items.filter(i=>![i.key,...i.aliases||[]].some(k=>owners.has(k)));
  for(let n=0;n<unique.length;n+=20){
   const pageItems=unique.slice(n,n+20),file=folder+'/'+runId+'-'+String(n/20+1).padStart(4,'0')+'.json';
   const page={schema,assignmentId:w.assignmentId,items:pageItems.map(i=>({...i,taskKey:w.taskKey}))};
   if(apply)S.immutable(root,file,page);
   w.pages.push({path:file,count:pageItems.length,page:w.pages.length+1,items:pageItems.length});
   for(const i of pageItems){w.keys.push(i.key);for(const k of [i.key,...i.aliases||[]])addOwner(k,w.taskKey);}
   appended.push({taskKey:w.taskKey,path:file,items:pageItems.length,sha256:S.hash(page)});
  }
 }
 append(intake,newIntake,'control/grok-intake','forge.intake-helper-page.v1');
 append(relevance,newRelevance,'control/claude-relevance','forge.relevance-helper-page.v1');
 // Replenish only the existing exact-posting exception scope, with fresh row
 // identity and all old pending Writer/reservation fences intact.
 const returnedIds=new Set(Object.values(state.items).filter(i=>i.taskKey==='FORGE_GROK_ENRICHMENT'&&state.batches[i.batch]?.status==='VALIDATED').map(i=>i.itemKey));
 for(const i of enrich.items)if(returnedIds.has(i.primaryId)&&i.status==='ASSIGNED')i.status='RETURNED_PENDING_REVIEW';
 const recovery=S.read(root,'state/enrich-ats-pay-recovery.json',{rows:[]}),active=enrich.items.filter(i=>!/^CONSUMED|RELEASED|PROTECTED_SKIP|ALREADY_COMPLETE|RETURNED/.test(i.status||''));
 if(enrich.enabled&&enrich.routingActive&&active.length===0){
  const oldIds=new Set(enrich.items.map(i=>i.primaryId));
  for(const r of recovery.rows){const row=snapshot.rows.find(x=>x.PRIMARY_ID===r.id);if(oldIds.has(r.id)||r.status!=='SOURCE_RESEARCH_REQUIRED'||!row||T.protectedRow(row)||T.fenced(root,state,r.id))continue;
   const missing=(r.needs||[]).filter(f=>f==='DEGREE'?!Source.known(row.p?.DEGREE_REQ)&&!Source.known(row.p?.DEGREE_TEXT):f==='SALARY'?!Source.known(row.p?.SALARY_BASE_LOW):false);if(!missing.length)continue;
   enrich.items.push({primaryId:r.id,owner:'Grok',taskKey:'FORGE_GROK_ENRICHMENT',status:'ASSIGNED',...T.identity(row),missingFields:missing,sourceUrls:(r.attempts||[]).map(x=>x.url).filter(Boolean),priorAttempts:r.attempts||[],canonicalObservedAt:snapshot.source.readAt,rowSha256:S.hash(row.line||row),sourceReport:'state/enrich-ats-pay-recovery.json'});oldIds.add(r.id);
  }
 }
 const result={schema:'forge.assignment-replenishment.v1',runId,canonicalSource:snapshot.source,counts,appended,exceptions,writerSubmissions:0,noProcessingCap:true};
 if(apply){
  S.immutable(root,'receipts/'+runId+'_HANDOFFS.json',result);
  S.save(root,'state/CODE_INTAKE_CONSUMPTION.json',code);
  for(const [file,w]of [['control/GROK_INTAKE_HELPER_WORK.json',intake],['control/CLAUDE_RELEVANCE_WORK.json',relevance],['control/ENRICHMENT_HELPER_WORK.json',enrich]])S.save(root,file,w);
  S.save(root,'state/HELPER_HANDOFFS.json',progress({root,state}));
 }
 return result;
}
module.exports={progress,replenish,fullCard,fenced};
