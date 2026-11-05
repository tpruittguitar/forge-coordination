'use strict';
// Work inventory only. Canonical completion comes from the independently built upstream ledger.
const fs=require('node:fs'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const Screen=require('../relevance-screen/screen.cjs'),U=require('../pipeline-observability/upstream-flow');
const Resume=require('../source-trial/resume-match');
const FILE='state/INTAKE_DRAIN.json',REVIEWS='receipts/INTAKE_DRAIN',TASKS={REVIEW_SCOPE:'FORGE_INTAKE_SCOPE_REVIEW',RECOVER_SOURCE:'FORGE_INTAKE_SOURCE_RECOVERY',RESOLVE_IDENTITY:'FORGE_INTAKE_HELD_RECONCILIATION',RECONCILE_WRITER:'FORGE_INTAKE_HELD_RECONCILIATION',INTAKE:'CODE'};
const pending=new Set(['WAITING','HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT']);
const empty=()=>({schema:'forge.intake-drain.v1',items:{},reviewErrors:{}});
const read=(root,file,fallback)=>S.read(root,file,fallback);
function selection(card){return card.selectionReason||[card.family&&'title family='+card.family,card.level&&'title level='+card.level,card.place&&'location='+card.place,card.source&&'source='+card.source].filter(Boolean).join('; ')||'Original discovery rationale not recorded; do not invent it';}
function safeUrl(raw){try{const key=U.key(raw);if(key?.startsWith('indeed:'))return 'https://www.indeed.com/viewjob?jk='+key.slice(7);if(key?.startsWith('linkedin:'))return 'https://www.linkedin.com/jobs/view/'+key.slice(9)+'/';const u=new URL(raw);if(u.protocol!=='https:')return '';for(const k of [...u.searchParams.keys()])if(/^(utm_|trk|tracking|token|sig|auth|lipi|eid|ref|source|tk$|alid$|bb$|qd$|rd$)/i.test(k))u.searchParams.delete(k);u.hash='';return u.href;}catch{return '';}}
function sourceCard(e){return{company:e.company||'',title:e.title||'',location:e.location||'',url:safeUrl(e.sourceUrl||(/^linkedin:\d+$/.test(e.key)?'https://www.linkedin.com/jobs/view/'+e.key.slice(9)+'/':''))};}
function sync(root,{now=Date.now(),apply=false,config=Screen.load()}={}){
 const up=read(root,'state/UPSTREAM_LEDGER.json'),old=read(root,FILE,empty()),mail=read(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{}}),present=new Set(),at=new Date(now).toISOString();
 if(old.schema!=='forge.intake-drain.v1'||!old.items||Array.isArray(old.items))throw Error('VALID_DURABLE_DRAIN_INVENTORY_REQUIRED');
 if(up.schema!=='forge.upstream-ledger.v1'||!up.entries||!up.groups||!Number.isFinite(Date.parse(up.at))||Date.parse(up.at)>now+120000||now-Date.parse(up.at)>24*3600000)throw Error('CURRENT_UPSTREAM_INVENTORY_REQUIRED');
 const resumeVersion=Resume.load().source.textSha256;
 const reports=['state/source-trial-report.json','state/board-discovery-report.json'].map(f=>read(root,f,{new_roles:[]}));
 const reasons=new Map();for(const report of reports)for(const card of [...report.new_roles||[],...report.existing_roles||[]])reasons.set(U.key(card.url),selection(card));
 const saved=require('./saved-card.cjs'),savedIndex=saved.index(root,up,mail,reports);
 const fences=new Map();
 for(const job of Object.values(mail.jobs))if(job.submissions?.length||/POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(job.status||''))for(const k of [job.key,...job.aliases||[]])fences.set(k,{requestIds:(job.submissions||[]).map(s=>s.requestId).filter(Boolean),proof:'state/EMAIL_RECOVERY_QUEUE.json#'+job.key});
 for(const i of read(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[]}).items)if(i.requestId&&/POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(i.status||''))fences.set(i.key,{requestIds:[i.requestId],proof:'state/RELEVANCE_INTAKE_PLAN.json'});
 const prior=require('../source-intake/auto-latch').previous(root),latched=require('../source-intake/auto-latch').latch(prior);
 for(const q of latched.quarantined){const key=U.key(q.record?.SOURCE_URL);if(key)fences.set(key,{requestIds:[q.requestId],proof:q.file});}
 // Every recorded attempt fences its original source, including accepted but not independently reconciled writes.
 for(const p of prior)if(!p.state.reconciliation&&!p.state.noCandidates)for(const [requestId,result] of Object.entries(p.state.results||{})){
  const record=result?.source||result?.record||result?.results?.[0]?.source;const k=U.key(record?.SOURCE_URL);if(k)fences.set(k,{requestIds:[requestId],proof:p.file});
 }
 for(const [key,g] of Object.entries(up.groups)){
  if(!pending.has(g.status)&&!old.items[key])continue;
  const aliases=g.aliases||[key];present.add(key);const es=aliases.map(k=>up.entries[k]).filter(Boolean);if(!es.length)throw Error('UPSTREAM_GROUP_WITHOUT_SOURCE');
  const e=es[0],recovered=saved.recover(sourceCard(e),aliases,savedIndex),card={...recovered.card,url:safeUrl(recovered.card.url)},screen=Screen.evaluate(card,config),fence=aliases.map(k=>fences.get(k)).find(Boolean);
  const action=fence?'RECONCILE_WRITER':recovered.conflict?'RESOLVE_IDENTITY':g.status==='IDENTITY_HOLD'||g.status==='MISSING_PREVIOUSLY_PRESENT'?'RESOLVE_IDENTITY':screen.outcome==='HOLD_SOURCE_IDENTITY'?'RECOVER_SOURCE':g.status==='HELD'?'RESOLVE_IDENTITY':screen.outcome==='RANKED_DISCOVERY'?'REVIEW_SCOPE':'INTAKE';
  const sourceVersion=S.hash({aliases:[...aliases].sort(),card,status:g.status,evidence:es.map(e=>({evidenceStatus:e.evidenceStatus,proof:e.proof,screenRuleId:e.screenRuleId,sourceSha256:e.discoveryReview?.sourceSha256,sources:e.sources})),resumeVersion,fence:fence||null});
  const previous=old.items[key],unchanged=previous?.sourceVersion===sourceVersion;
  const item={...(unchanged?previous:{}),key,aliases,sourceVersion,card,sourceRecovery:recovered.recovery||null,sourceConflict:recovered.conflict||null,upstreamStatus:g.status,action,taskKey:TASKS[action],owner:action==='INTAKE'?'CODE':'ChatGPT',firstSeen:previous?.firstSeen||g.firstSeen||at,sourceReferences:[...new Set(es.flatMap(e=>e.sources||[]))],discoveryReview:e.discoveryReview||null,selectionReason:e.selectionReason||reasons.get(e.key)||previous?.selectionReason||selection(e),screen,fence:fence||null,nextAction:{INTAKE:'Feed existing controlled intake; verify canonical outcome',REVIEW_SCOPE:'Read saved role content, then one targeted lookup for actual function and responsibility',RECOVER_SOURCE:'Recover exact missing identity fields from original source, then targeted employer posting',RESOLVE_IDENTITY:'Investigate original hold and exact role identity; retain all protected decisions',RECONCILE_WRITER:'Reconcile original request and independently COMPLETE receipt plus exact row effects; never replay'}[action],canonicalCompletion:false,status:pending.has(g.status)?(unchanged&&previous.status||'ACTION_REQUIRED'):'ACCOUNTED_UPSTREAM'};
  if(!pending.has(g.status)){item.status='ACCOUNTED_UPSTREAM';item.outcome={status:g.status,proof:'state/UPSTREAM_LEDGER.json',observedAt:up.at};}
  old.items[key]=item;
 }
 // Missing inventory is an error, never an invented completion.
 for(const [key,item]of Object.entries(old.items))if(!present.has(key)&&item.status!=='ACCOUNTED_UPSTREAM'){item.status='INVENTORY_RECONCILIATION_REQUIRED';item.nextAction='Recover missing upstream group before processing';}
 old.at=at;old.upstreamAt=up.at;old.reviewErrors={};
 for(const file of S.files(path.join(root,REVIEWS))){try{const review=JSON.parse(fs.readFileSync(file,'utf8')),item=old.items[review.key];if(!item||item.sourceVersion!==review.sourceVersion||item.status==='ACCOUNTED_UPSTREAM')continue;validate(review,item,now);if(path.relative(root,file).split(path.sep).join('/')!==reviewPath(review))throw Error('IMMUTABLE_DRAIN_REVIEW_REQUIRED');
  if(item.review&&Date.parse(item.review.observedAt)>Date.parse(review.observedAt))continue;
  item.review={path:reviewPath(review),sha256:S.hash(review),observedAt:review.observedAt,outcome:review.outcome};
  item.nextAction=review.nextAction||item.nextAction;
  item.status=review.outcome==='SOURCE_READY'?'PENDING_INDEPENDENT_VALIDATION':review.retryAfter&&Date.parse(review.retryAfter)<=now?'ACTION_REQUIRED':'WAITING_EVIDENCE_CHANGE';
  if(item.validation?.reviewSha256===S.hash(review))item.status=item.validation.status==='READY_FOR_CONTROLLED_INTAKE'&&now-Date.parse(item.validation.observedAt)>=86400000?'PENDING_INDEPENDENT_VALIDATION':item.validation.status;
 }catch(e){old.reviewErrors[path.relative(root,file).split(path.sep).join('/')]={reason:e.message};}}
 old.counts={};old.actions={};for(const item of Object.values(old.items)){old.counts[item.status]=(old.counts[item.status]||0)+1;if(item.status!=='ACCOUNTED_UPSTREAM')old.actions[item.action]=(old.actions[item.action]||0)+1;}
 old.noProcessingCap=true;if(apply)S.save(root,FILE,old);return old;
}
function reviewPath(review){return REVIEWS+'/'+S.hash(review)+'.json';}
function validate(r,item,now=Date.now()){
 if(r.schema!=='forge.intake-drain-review.v1'||r.key!==item.key||r.sourceVersion!==item.sourceVersion||r.provider!=='ChatGPT'||r.taskKey!==item.taskKey||!/^FORGE-DRAIN-[A-Za-z0-9_-]+$/.test(r.runId||'')||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>now+60000||!['SOURCE_READY','WAITING_SOURCE_CHANGE','RECONCILIATION_REQUIRED'].includes(r.outcome)||typeof r.reason!=='string'||!r.reason.trim()||typeof r.nextAction!=='string'||!r.nextAction.trim()||r.writerSubmitted!==false||!Array.isArray(r.attempts)||!r.attempts.length)throw Error('SOURCE_BOUND_DRAIN_REVIEW_REQUIRED');
 if(!Object.values(TASKS).includes(r.taskKey)||r.taskKey==='CODE')throw Error('AI_RESEARCH_TASK_REQUIRED');
 if(r.outcome==='SOURCE_READY'){
  if(item.fence||item.action==='RECONCILE_WRITER')throw Error('ORIGINAL_WRITER_REQUEST_MUST_BE_RECONCILED');
  const e=r.sourceEvidence;if(!e||!['company','title','location','url','quote'].every(k=>typeof e[k]==='string'&&e[k].trim())||e.quote.length<30||e.quote.length>12000)throw Error('COMPLETE_EXACT_POSTING_EVIDENCE_REQUIRED');Source.publicUrl(e.url);if(safeUrl(e.url)!==e.url)throw Error('PUBLIC_UNSIGNED_POSTING_URL_REQUIRED');
  for(const k of ['company','title','location'])if(item.card[k]&&(k==='location'?Source.location(item.card[k])!==Source.location(e[k]):Source.norm(item.card[k])!==Source.norm(e[k])))throw Error('CONFLICTING_ORIGINAL_IDENTITY_REQUIRES_RECONCILIATION');
  const profile=Resume.load();if(r.scope?.resumeTextSha256!==profile.source.textSha256||!Array.isArray(r.scope.resumeCompetencyIds)||!r.scope.resumeCompetencyIds.length||r.scope.resumeCompetencyIds.some(id=>!profile.competencies.some(c=>c.id===id)))throw Error('CURRENT_RESUME_EVIDENCE_REQUIRED');
  if(r.scope?.verdict!=='PLAUSIBLE_TARGET_FUNCTION'||typeof r.scope.reason!=='string'||!r.scope.reason.trim()||!r.scope.quote||!Source.norm(e.quote).includes(Source.norm(r.scope.quote))||r.scope.quote.length<30)throw Error('POSITIVE_SOURCE_BOUND_FUNCTION_REVIEW_REQUIRED');
 }else if(typeof r.retryCondition!=='string'||!r.retryCondition.trim()||r.retryAfter&&(!Number.isFinite(Date.parse(r.retryAfter))||Date.parse(r.retryAfter)<=Date.parse(r.observedAt)))throw Error('EXPLICIT_RETRY_CONDITION_REQUIRED');
 return true;
}
function publish(root,review,now=Date.now()){
 const work=sync(root,{now,apply:true}),item=work.items[review.key];if(!item||item.status==='ACCOUNTED_UPSTREAM')throw Error('CURRENT_OPEN_DRAIN_ITEM_REQUIRED');validate(review,item,now);S.immutable(root,reviewPath(review),review);return{path:reviewPath(review),canonicalWrites:0,pendingIndependentValidation:review.outcome==='SOURCE_READY'};
}
function next(root,taskKey,{limit=10,now=Date.now()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('BOUNDED_ARTIFACT_SIZE_REQUIRED');const work=sync(root,{now});
 return{schema:'forge.intake-drain-work.v1',at:work.at,taskKey,items:Object.values(work.items).filter(i=>i.taskKey===taskKey&&(i.status==='ACTION_REQUIRED'||i.status==='SOURCE_VALIDATION_REQUIRED'&&Date.parse(i.validation.retryAfter)<=now)).sort((a,b)=>a.firstSeen.localeCompare(b.firstSeen)||a.key.localeCompare(b.key)).slice(0,limit),counts:work.counts,actions:work.actions,artifactSizeOnly:true,canonicalWrites:0};
}
async function verify(root,{privateDir,now=Date.now(),verifySource=Source.verify,apply=false}={}){
 if(!privateDir||!path.isAbsolute(privateDir)||path.resolve(privateDir)===path.resolve(root)||path.resolve(privateDir).startsWith(path.resolve(root)+path.sep))throw Error('PRIVATE_SOURCE_DIRECTORY_REQUIRED');
 const work=sync(root,{now}),result={verified:0,failed:0};
 for(const item of Object.values(work.items)){
  if(item.status!=='PENDING_INDEPENDENT_VALIDATION')continue;const review=read(root,item.review.path);validate(review,item,now);
  try{
   // Re-fetch and parse the exact structured employer/ATS posting. Helper prose alone never admits a role.
   const source=await verifySource({item:{sourceEvidence:review.sourceEvidence},expected:review.sourceEvidence,privateDir,now});
   const overlap=Resume.match({title:review.sourceEvidence.title,description:source.description});if(review.scope.resumeCompetencyIds.some(id=>!overlap.matches.some(m=>m.competencyId===id)))throw Error('RESUME_OVERLAP_NOT_IN_INDEPENDENT_POSTING');
   if(!Source.norm(source.description).includes(Source.norm(review.scope.quote)))throw Error('SCOPE_QUOTE_NOT_IN_INDEPENDENT_POSTING');
   item.validation={status:'READY_FOR_CONTROLLED_INTAKE',reviewSha256:S.hash(review),observedAt:new Date(now).toISOString(),resumeMatch:overlap,sourceSha256:source.sourceSha256,sourceUrl:source.sourceUrl};item.status=item.validation.status;result.verified++;
  }catch(e){item.validation={status:'SOURCE_VALIDATION_REQUIRED',reviewSha256:S.hash(review),observedAt:new Date(now).toISOString(),reason:e.message,retryAfter:new Date(now+6*3600000).toISOString()};item.status=item.validation.status;result.failed++;}
 }
 if(apply)S.save(root,FILE,work);return{...result,canonicalWrites:0};
}
function approved(root,now=Date.now()){
 const work=read(root,FILE,empty()),roles=[],proofs=new Map();
 for(const item of Object.values(work.items)){
  const v=item.validation;if(item.status!=='READY_FOR_CONTROLLED_INTAKE'||item.fence||!v||now-Date.parse(v.observedAt)>=86400000||Date.parse(v.observedAt)>now)continue;
  const r=read(root,item.review.path);validate(r,item,now);if(v.reviewSha256!==S.hash(r)||item.review.path!==reviewPath(r)||r.outcome!=='SOURCE_READY')throw Error('DRAIN_VALIDATION_BINDING_REQUIRED');
  const role={...r.sourceEvidence,discoveryReview:item.discoveryReview,initiatingUrl:item.card.url,source:'INTAKE_DRAIN',selectionReason:item.selectionReason,scopeReason:r.scope.reason+'; resume='+r.scope.resumeTextSha256+'; competencies='+r.scope.resumeCompetencyIds.join(','),drainKey:item.key,drainReview:item.review.path};roles.push(role);proofs.set(U.key(role.url),{role,review:r,validation:v});
 }
 return{roles,proofs};
}
function ownedKeys(root){return new Set(Object.values(read(root,FILE,empty()).items).filter(i=>i.status!=='ACCOUNTED_UPSTREAM').flatMap(i=>[i.key,...i.aliases]));}
function owned(root,key){return ownedKeys(root).has(key);}
function fences(root){return Object.values(read(root,FILE,empty()).items).filter(i=>i.fence).map(i=>({COMPANY:i.card.company,TITLE:i.card.title,LOCATION:i.card.location,SOURCE_URL:i.card.url}));}
function seeds(root){const work=read(root,FILE,empty());return Object.values(work.items).filter(i=>i.status==='ACTION_REQUIRED'&&i.action==='INTAKE'&&!i.fence&&i.screen.outcome==='ADMIT').map(i=>({...i.card,discoveryReview:i.discoveryReview,source:'SAVED_DISCOVERY',selectionReason:i.selectionReason,drainKey:i.key}));}
if(require.main===module)(async()=>{
 const [command,arg]=process.argv.slice(2),root=path.resolve(__dirname,'../..');let result;
 if(command==='sync')result=sync(root,{apply:true});
 else if(command==='next')result=next(root,arg);
 else if(command==='review')result=publish(root,JSON.parse(fs.readFileSync(arg,'utf8')));
 else if(command==='verify')result=await verify(root,{privateDir:arg,apply:true});
 else throw Error('Use sync, next <taskKey>, review <json>, or verify <privateDir>');
 console.log(JSON.stringify(command==='sync'?{counts:result.counts,actions:result.actions,reviewErrors:result.reviewErrors}:result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={FILE,REVIEWS,TASKS,empty,selection,sync,validate,publish,next,verify,approved,seeds,fences,owned,ownedKeys,reviewPath};
