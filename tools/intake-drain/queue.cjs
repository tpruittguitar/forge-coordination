'use strict';
// Work inventory only. Canonical completion comes from the independently built upstream ledger.
const fs=require('node:fs'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const Screen=require('../relevance-screen/screen.cjs'),U=require('../pipeline-observability/upstream-flow');
const Resume=require('../source-trial/resume-match'),PostedPay=require('../source-trial/posted-pay');
const FILE='state/INTAKE_DRAIN.json',REVIEWS='receipts/INTAKE_DRAIN',TASKS={REVIEW_SCOPE:'FORGE_INTAKE_SCOPE_REVIEW',RECOVER_SOURCE:'FORGE_INTAKE_SOURCE_RECOVERY',RESOLVE_IDENTITY:'FORGE_INTAKE_HELD_RECONCILIATION',RECONCILE_WRITER:'FORGE_INTAKE_HELD_RECONCILIATION',INTAKE:'CODE'};
const pending=new Set(['WAITING','HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT']);
const dismissed=e=>e?.manualDecision?.scope==='DISCOVERY_CARD_DISMISSAL'||require('../live-backlog/model.cjs').activeDeletion(e);
const empty=()=>({schema:'forge.intake-drain.v1',items:{},reviewErrors:{}});
const read=(root,file,fallback)=>S.read(root,file,fallback);
const sharedKeys=root=>require('../helper-routing/shared.cjs').reservedKeys(read(root,'control/SHARED_HELPER_WORK.json',null));
const sharedBlocked=(item,keys)=>!item.fence&&[item.key,...item.aliases||[]].some(k=>keys.has(k));
function selection(card){return card.selectionReason||[card.family&&'title family='+card.family,card.level&&'title level='+card.level,card.place&&'location='+card.place,card.source&&'source='+card.source].filter(Boolean).join('; ')||'Original discovery rationale not recorded; do not invent it';}
function safeUrl(raw){try{const key=U.key(raw);if(key?.startsWith('indeed:'))return 'https://www.indeed.com/viewjob?jk='+key.slice(7);if(key?.startsWith('linkedin:'))return 'https://www.linkedin.com/jobs/view/'+key.slice(9)+'/';const u=new URL(raw);if(u.protocol!=='https:')return '';for(const k of [...u.searchParams.keys()])if(/^(utm_|trk|tracking|token|sig|auth|lipi|eid|ref|source|tk$|alid$|bb$|qd$|rd$)/i.test(k))u.searchParams.delete(k);u.hash='';return u.href;}catch{return '';}}
function sourceCard(e){return{...require('./saved-card.cjs').identityMetadata(e,e.sourceUrl),...PostedPay.carry({...e,url:e.sourceUrl}),company:e.company||'',title:e.title||'',location:e.location||'',url:safeUrl(e.sourceUrl||(/^linkedin:\d+$/.test(e.key)?'https://www.linkedin.com/jobs/view/'+e.key.slice(9)+'/':''))};}
function rekeyedRepresentation(item,up){
 const aliases=item.aliases?.length?item.aliases:[item.key],matches=Object.entries(up.groups).filter(([k,g])=>g.status==='PRESENT'&&/^pid:V2[A-Z]-[A-Za-z0-9_-]+$/.test(k)&&aliases.every(a=>g.aliases?.includes(a)));
 if(matches.length!==1)return null;
 return {groupKey:matches[0][0],primaryId:matches[0][0].slice(4),status:'PRESENT',aliases,proof:'state/UPSTREAM_LEDGER.json',observedAt:up.at};
}
// Keep original identity/scope evidence intact. Aliases only adapt legacy consumers.
function fenceRecord(source={}){return {...source,COMPANY:source.COMPANY||source.company,TITLE:source.TITLE||source.title,LOCATION:source.LOCATION||source.location,SOURCE_URL:source.SOURCE_URL||source.url||source.sourceUrl};}
function writerFences(root){
 const mail=read(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{}}),fences=new Map();
 for(const job of Object.values(mail.jobs))if(job.submissions?.length||/POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(job.status||''))for(const k of [job.key,...job.aliases||[]])fences.set(k,{requestIds:(job.submissions||[]).map(s=>s.requestId).filter(Boolean),proof:'state/EMAIL_RECOVERY_QUEUE.json#'+job.key,record:fenceRecord(job)});
 for(const i of read(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[]}).items)if(i.requestId&&/POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(i.status||''))fences.set(i.key,{requestIds:[i.requestId],proof:'state/RELEVANCE_INTAKE_PLAN.json',record:i.record||i.sourceEvidence});
 const prior=require('../source-intake/auto-latch').previous(root),latched=require('../source-intake/auto-latch').latch(prior);
 for(const q of latched.quarantined){const key=U.key(q.record?.SOURCE_URL);if(key)fences.set(key,{requestIds:[q.requestId],proof:q.file,record:q.record});}
 // Every recorded attempt fences its original source, including accepted but not independently reconciled writes.
 for(const p of prior)if(!p.state.reconciliation&&!p.state.noCandidates)for(const [requestId,result] of Object.entries(p.state.results||{})){
  const record=result?.source||result?.record||result?.results?.[0]?.source;const k=U.key(record?.SOURCE_URL);if(k)fences.set(k,{requestIds:[requestId],proof:p.file,record});
 }
 return fences;
}
// Scope-task ownership does not prove that a historical wait was about fit.
// Keep explicit identity/conflict obligations until a newer source review has
// actually passed its independent identity check via approved(), not merely
// been published. The historical hold never becomes an unreviewed seed.
function scopeReviewHold(item){
 if(!item)return null;
 const reason=/IDENTITY|CONFLICT/.test(item.validation?.reason||'')?item.validation.reason:['RECONCILIATION_REQUIRED','EXCLUSION_CANDIDATE'].includes(item.review?.outcome)?item.review.outcome:null;
 return item.scopeReviewHold||(item.action==='REVIEW_SCOPE'&&reason?{reason,reviewPath:item.review?.path||null}:null);
}
function sync(root,{now=Date.now(),apply=false,config=Screen.load()}={}){
 const up=read(root,'state/UPSTREAM_LEDGER.json'),old=read(root,FILE,empty()),mail=read(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{}}),present=new Set(),at=new Date(now).toISOString();
 if(old.schema!=='forge.intake-drain.v1'||!old.items||Array.isArray(old.items))throw Error('VALID_DURABLE_DRAIN_INVENTORY_REQUIRED');
 if(up.schema!=='forge.upstream-ledger.v1'||!up.entries||!up.groups||!Number.isFinite(Date.parse(up.at))||Date.parse(up.at)>now+120000||now-Date.parse(up.at)>24*3600000)throw Error('CURRENT_UPSTREAM_INVENTORY_REQUIRED');
 const resumeVersion=Resume.load().source.textSha256;
 const reports=['state/source-trial-report.json','state/board-discovery-report.json'].map(f=>read(root,f,{new_roles:[]}));
 const reasons=new Map();for(const report of reports)for(const card of [...report.new_roles||[],...report.existing_roles||[],...report.identity_held_roles||[]])reasons.set(U.key(card.url),selection(card));
 const saved=require('./saved-card.cjs'),savedIndex=saved.index(root,up,mail,reports);
 const discoveryInputs=require('../source-intake/discovery-inputs').index(root);
 const sourceFailures=new Map();for(const x of Object.values(read(root,'receipts/auto-intake/catch-up/state.json',{roles:{}}).roles))if(x.status==='WAITING_SOURCE_RETRY'&&(x.attempts||0)>=2)sourceFailures.set(U.key(x.role.url),x);
 const fences=writerFences(root),sharedReserved=require('../helper-routing/shared.cjs').reservedKeys(read(root,'control/SHARED_HELPER_WORK.json',null));
 for(const [key,g] of Object.entries(up.groups)){
  const currentFence=(g.aliases||[key]).some(k=>fences.has(k)),priorAlias=(g.aliases||[key]).some(k=>old.items[k]);
  if(!pending.has(g.status)&&!old.items[key]&&(!currentFence||priorAlias))continue;
  if(!currentFence&&!old.items[key]&&!priorAlias&&[key,...g.aliases||[]].some(k=>sharedReserved.has(k)))continue; // Already assigned evidence-only research; original Writer reconciliation still wins.
  const aliases=g.aliases||[key];present.add(key);const es=aliases.map(k=>up.entries[k]).filter(Boolean);if(!es.length)throw Error('UPSTREAM_GROUP_WITHOUT_SOURCE');
  const e=es[0],recovered=saved.recover(sourceCard(e),aliases,savedIndex),card={...recovered.card,url:safeUrl(recovered.card.url)},screen=Screen.evaluate(card,config),fence=aliases.map(k=>fences.get(k)).find(Boolean);
  const priorSourceFailure=aliases.map(k=>sourceFailures.get(k)).find(Boolean);
  const capturedSourceAvailable=priorSourceFailure?.reason==='SOURCE_EVIDENCE_UNAVAILABLE'&&!!discoveryInputs.find(card,{now});
  const sourceFailure=capturedSourceAvailable?null:priorSourceFailure,identityHold=scopeReviewHold(old.items[key]);
  // Exact saved alert facts with opaque tracking links need source recovery,
  // not a fabricated URL or a generic identity-reconciliation dead end.
  const alertSourceGap=!card.url&&es.some(x=>x.discoveryReview?.contentBasis==='EXACT_ORIGINAL_ALERT_CARD'&&
   x.discoveryReview?.pendingFacts?.includes('SOURCE_URL')&&/^state\/EMAIL_RECOVERY_QUEUE\.json#alert-card:[a-f0-9]{64}$/.test(x.discoveryReview.sourceProof||''));
  const action=fence?'RECONCILE_WRITER':sourceFailure?'RECOVER_SOURCE':recovered.conflict?'RESOLVE_IDENTITY':alertSourceGap?'RECOVER_SOURCE':g.status==='IDENTITY_HOLD'||g.status==='MISSING_PREVIOUSLY_PRESENT'?'RESOLVE_IDENTITY':screen.outcome==='HOLD_SOURCE_IDENTITY'?'RECOVER_SOURCE':g.status==='HELD'?'RESOLVE_IDENTITY':(identityHold||screen.outcome==='RANKED_DISCOVERY'||require('./title-exclusions.cjs').matches(root,card).length===1)?'REVIEW_SCOPE':'INTAKE';
  const sourceVersion=S.hash({aliases:[...aliases].sort(),card,status:g.status,evidence:es.map(e=>({evidenceStatus:e.evidenceStatus,proof:e.proof,screenRuleId:e.screenRuleId,sourceSha256:e.discoveryReview?.sourceSha256,sources:e.sources})),resumeVersion,sourceFailure:!!sourceFailure,fence:fence||null});
  const previous=old.items[key],scopeReleased=previous?.action==='REVIEW_SCOPE'&&action==='INTAKE',unchanged=previous?.sourceVersion===sourceVersion&&!scopeReleased;
  const item={...(unchanged?previous:{}),key,aliases,sourceVersion,card,sourceRecovery:recovered.recovery||null,sourceConflict:recovered.conflict||null,...(capturedSourceAvailable?{sourceFailureHistory:{reason:priorSourceFailure.reason,attempts:priorSourceFailure.attempts,lastAttempt:priorSourceFailure.lastAttempt,retryAfter:priorSourceFailure.retryAfter,releaseBasis:'CAPTURED_DISCOVERY_AVAILABLE'}}:{}),sourceFailure:sourceFailure?{reason:sourceFailure.reason,attempts:sourceFailure.attempts,lastAttempt:sourceFailure.lastAttempt,retryAfter:sourceFailure.retryAfter}:null,upstreamStatus:g.status,action,taskKey:TASKS[action],owner:action==='INTAKE'?'CODE':'ChatGPT',firstSeen:previous?.firstSeen||g.firstSeen||at,sourceReferences:[...new Set(es.flatMap(e=>e.sources||[]))],discoveryReview:e.discoveryReview||null,selectionReason:e.selectionReason||reasons.get(e.key)||previous?.selectionReason||selection(e),screen,fence:fence||null,scopeReviewHold:identityHold,scopeReviewHistory:scopeReleased?{sourceVersion:previous.sourceVersion,review:previous.review||null,validation:previous.validation||null}:previous?.scopeReviewHistory||null,nextAction:{INTAKE:'Feed existing controlled intake; verify canonical outcome',REVIEW_SCOPE:identityHold?'Resolve the recorded identity or exclusion obligation before intake; a fit-only verdict does not clear it':'Check the exact captured-title exclusion against current canonical policy; uncertain fit alone does not block intake',RECOVER_SOURCE:'Recover exact missing identity fields from original source, then targeted employer posting',RESOLVE_IDENTITY:'Investigate original hold and exact role identity; retain all protected decisions',RECONCILE_WRITER:'Reconcile original request and independently COMPLETE receipt plus exact row effects; never replay'}[action],canonicalCompletion:false,status:pending.has(g.status)?(unchanged&&previous.status||'ACTION_REQUIRED'):'ACCOUNTED_UPSTREAM'};
  if(!pending.has(g.status)){item.status='ACCOUNTED_UPSTREAM';item.outcome={status:g.status,proof:'state/UPSTREAM_LEDGER.json',observedAt:up.at};}
  // A Writer attempt discovered after dismissal still needs independent reconciliation.
  if(fence&&(es.some(dismissed)||g.status==='PRESENT')){item.status='ACTION_REQUIRED';item.action='RECONCILE_WRITER';item.taskKey=TASKS.RECONCILE_WRITER;item.nextAction='Reconcile original Writer request; discovery dismissal does not cancel or complete it. Never replay.';delete item.outcome;}
  old.items[key]=item;
 }
 // Missing inventory is an error, never an invented completion.
 for(const [key,item]of Object.entries(old.items))if(!present.has(key)&&(item.status!=='ACCOUNTED_UPSTREAM'||(item.aliases||[key]).some(k=>fences.has(k)))){
  const represented=rekeyedRepresentation(item,up);
  if(represented){
   item.currentRepresentation=represented;
   const fence=(item.aliases||[key]).map(k=>fences.get(k)).find(Boolean)||item.fence;
   if(fence){item.fence=fence;item.status='ACTION_REQUIRED';item.action='RECONCILE_WRITER';item.taskKey=TASKS.RECONCILE_WRITER;item.nextAction='Job already represented; reconcile the original Writer request independently. Never replay or infer write completion from presence.';}
   else{item.status='ACCOUNTED_UPSTREAM';item.outcome=represented;item.nextAction='Already represented in master/archive; no new intake.';}
  }else{delete item.currentRepresentation;item.status='INVENTORY_RECONCILIATION_REQUIRED';item.nextAction='Recover missing upstream group before processing';}
 }
 old.at=at;old.upstreamAt=up.at;old.reviewErrors={};
 for(const file of S.files(path.join(root,REVIEWS))){try{const review=JSON.parse(fs.readFileSync(file,'utf8')),item=old.items[review.key];
  // A historical scope-only review must not put a now-admissible card back
  // behind AI review or a second fetch. Keep the immutable review as history.
  if(item?.action==='INTAKE'&&review.taskKey===TASKS.REVIEW_SCOPE){
   if(!['RECONCILIATION_REQUIRED','EXCLUSION_CANDIDATE'].includes(review.outcome)||item.sourceVersion!==review.sourceVersion)continue;
   const history=item.scopeReviewHistory;
   if(history?.sourceVersion===item.sourceVersion&&history.validation?.status==='READY_FOR_CONTROLLED_INTAKE'&&history.validation.reviewSha256===history.review?.sha256&&Date.parse(history.review?.observedAt)>Date.parse(review.observedAt))continue;
   // A newly published immutable conflict review may not yet be reflected in
   // cached item.review. Bind and consume identity or exclusion obligations
   // before releasing the old scope wait.
   const held={...item,action:'REVIEW_SCOPE',taskKey:TASKS.REVIEW_SCOPE,owner:'ChatGPT'};
   validate(review,held,now);
   if(path.relative(root,file).split(path.sep).join('/')!==reviewPath(review))throw Error('IMMUTABLE_DRAIN_REVIEW_REQUIRED');
   Object.assign(item,{action:held.action,taskKey:held.taskKey,owner:held.owner,scopeReviewHold:{reason:review.outcome,reviewPath:reviewPath(review)}});
  }
  if(!item||item.sourceVersion!==review.sourceVersion||item.status==='ACCOUNTED_UPSTREAM'||item.status==='INVENTORY_RECONCILIATION_REQUIRED'||item.currentRepresentation)continue;validate(review,item,now);if(path.relative(root,file).split(path.sep).join('/')!==reviewPath(review))throw Error('IMMUTABLE_DRAIN_REVIEW_REQUIRED');
  if(item.review&&Date.parse(item.review.observedAt)>Date.parse(review.observedAt))continue;
  item.review={path:reviewPath(review),sha256:S.hash(review),observedAt:review.observedAt,outcome:review.outcome,retryCondition:review.retryCondition,retryAfter:review.retryAfter};
  item.nextAction=review.nextAction||item.nextAction;
  item.status=['SOURCE_READY','EXCLUSION_CANDIDATE'].includes(review.outcome)?'PENDING_INDEPENDENT_VALIDATION':review.retryAfter&&Date.parse(review.retryAfter)<=now?'ACTION_REQUIRED':'WAITING_EVIDENCE_CHANGE';
  if(item.validation?.reviewSha256===S.hash(review))item.status=item.validation.status==='READY_FOR_CONTROLLED_EXCLUSION'&&now-Date.parse(item.validation.observedAt)>=86400000?'PENDING_INDEPENDENT_VALIDATION':item.validation.status;
 }catch(e){old.reviewErrors[path.relative(root,file).split(path.sep).join('/')]={reason:e.message};}}
 old.counts={};old.actions={};for(const item of Object.values(old.items)){old.counts[item.status]=(old.counts[item.status]||0)+1;if(item.status!=='ACCOUNTED_UPSTREAM')old.actions[item.action]=(old.actions[item.action]||0)+1;}
 old.noProcessingCap=true;if(apply)S.save(root,FILE,old);return old;
}
function reviewPath(review){return REVIEWS+'/'+S.hash(review)+'.json';}
function validate(r,item,now=Date.now()){
 if(r.schema!=='forge.intake-drain-review.v1'||r.key!==item.key||r.sourceVersion!==item.sourceVersion||r.provider!=='ChatGPT'||r.taskKey!==item.taskKey||!/^FORGE-DRAIN-[A-Za-z0-9_-]+$/.test(r.runId||'')||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>now+60000||!['SOURCE_READY','EXCLUSION_CANDIDATE','WAITING_SOURCE_CHANGE','RECONCILIATION_REQUIRED'].includes(r.outcome)||typeof r.reason!=='string'||!r.reason.trim()||typeof r.nextAction!=='string'||!r.nextAction.trim()||r.writerSubmitted!==false||!Array.isArray(r.attempts)||!r.attempts.length)throw Error('SOURCE_BOUND_DRAIN_REVIEW_REQUIRED');
 if(!Object.values(TASKS).includes(r.taskKey)||r.taskKey==='CODE')throw Error('AI_RESEARCH_TASK_REQUIRED');
 if(r.outcome==='EXCLUSION_CANDIDATE'){require('./exclusions.cjs').validate(r,item);}
 else if(r.outcome==='SOURCE_READY'){
  if(item.fence||item.action==='RECONCILE_WRITER')throw Error('ORIGINAL_WRITER_REQUEST_MUST_BE_RECONCILED');
  const e=r.sourceEvidence;if(!e||!['company','title','location','url','quote'].every(k=>typeof e[k]==='string'&&e[k].trim())||e.quote.length<30||e.quote.length>12000)throw Error('COMPLETE_EXACT_POSTING_EVIDENCE_REQUIRED');Source.publicUrl(e.url);if(safeUrl(e.url)!==e.url)throw Error('PUBLIC_UNSIGNED_POSTING_URL_REQUIRED');
  for(const k of ['company','title','location'])if(item.card[k]&&(k==='location'?Source.location(item.card[k])!==Source.location(e[k]):Source.norm(item.card[k])!==Source.norm(e[k])))throw Error('CONFLICTING_ORIGINAL_IDENTITY_REQUIRES_RECONCILIATION');
  const profile=Resume.load();if(r.scope?.resumeTextSha256!==profile.source.textSha256||!Array.isArray(r.scope.resumeCompetencyIds)||!r.scope.resumeCompetencyIds.length||r.scope.resumeCompetencyIds.some(id=>!profile.competencies.some(c=>c.id===id)))throw Error('CURRENT_RESUME_EVIDENCE_REQUIRED');
  if(r.scope?.verdict!=='PLAUSIBLE_TARGET_FUNCTION'||typeof r.scope.reason!=='string'||!r.scope.reason.trim()||!r.scope.quote||!Source.norm(e.quote).includes(Source.norm(r.scope.quote))||r.scope.quote.length<30)throw Error('POSITIVE_SOURCE_BOUND_FUNCTION_REVIEW_REQUIRED');
 }else if(typeof r.retryCondition!=='string'||!r.retryCondition.trim()||r.retryAfter&&(!Number.isFinite(Date.parse(r.retryAfter))||Date.parse(r.retryAfter)<=Date.parse(r.observedAt)))throw Error('EXPLICIT_RETRY_CONDITION_REQUIRED');
 return true;
}
function publish(root,review,now=Date.now()){
 const work=sync(root,{now,apply:true}),item=work.items[review.key];if(item&&sharedBlocked(item,sharedKeys(root)))throw Error('SHARED_HELPER_OWNS_RESEARCH');if(!item||item.status==='ACCOUNTED_UPSTREAM')throw Error('CURRENT_OPEN_DRAIN_ITEM_REQUIRED');validate(review,item,now);S.immutable(root,reviewPath(review),review);return{path:reviewPath(review),canonicalWrites:0,pendingIndependentValidation:['SOURCE_READY','EXCLUSION_CANDIDATE'].includes(review.outcome)};
}
function researchEligible(item,now=Date.now()){return item.status==='ACTION_REQUIRED'||item.status==='SOURCE_VALIDATION_REQUIRED'&&Date.parse(item.validation?.retryAfter)<=now;}
function next(root,taskKey,{limit=10,now=Date.now()}={}){
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('BOUNDED_ARTIFACT_SIZE_REQUIRED');const work=sync(root,{now}),shared=sharedKeys(root);
 return{schema:'forge.intake-drain-work.v1',at:work.at,taskKey,items:Object.values(work.items).filter(i=>i.taskKey===taskKey&&!sharedBlocked(i,shared)&&researchEligible(i,now)).sort((a,b)=>a.firstSeen.localeCompare(b.firstSeen)||a.key.localeCompare(b.key)).slice(0,limit),counts:work.counts,actions:work.actions,artifactSizeOnly:true,canonicalWrites:0};
}
async function verify(root,{privateDir,now=Date.now(),verifySource=Source.verify,verifyExclusion=require('./exclusions.cjs').verify,exclusionContext,apply=false}={}){
 if(!privateDir||!path.isAbsolute(privateDir)||path.resolve(privateDir)===path.resolve(root)||path.resolve(privateDir).startsWith(path.resolve(root)+path.sep))throw Error('PRIVATE_SOURCE_DIRECTORY_REQUIRED');
 const work=sync(root,{now}),result={verified:0,failed:0,exclusionsVerified:0},cache=new Map(),shared=sharedKeys(root),discovery=require('../source-intake/discovery-inputs').index(root);
 let context=exclusionContext;
 for(const item of Object.values(work.items)){
  if(sharedBlocked(item,shared)||item.status!=='PENDING_INDEPENDENT_VALIDATION')continue;const review=read(root,item.review.path);validate(review,item,now);
  try{
   if(review.outcome==='EXCLUSION_CANDIDATE'){
    context=context||await require('../source-trial/preliminary-screen').context({key:process.env.FORGE_WRITER_KEY});
    item.validation=await verifyExclusion(root,review,item,{...context,cache,now});item.status=item.validation.status;result.exclusionsVerified++;continue;
   }
   // Reuse bound captured facts before source retrieval. Helper claims alone do not resolve a recorded identity or quoted scope obligation.
   const source=await verifySource({root,discovery,item:{sourceEvidence:review.sourceEvidence},expected:review.sourceEvidence,privateDir,now});
   const overlap=Resume.match({title:review.sourceEvidence.title,description:source.description});if(review.scope.resumeCompetencyIds.some(id=>!overlap.matches.some(m=>m.competencyId===id)))throw Error('RESUME_OVERLAP_NOT_IN_INDEPENDENT_POSTING');
   if(!Source.norm(source.description).includes(Source.norm(review.scope.quote)))throw Error('SCOPE_QUOTE_NOT_IN_INDEPENDENT_POSTING');
   const payCard={company:review.sourceEvidence.company,title:review.sourceEvidence.title,location:review.sourceEvidence.location,url:source.sourceUrl,payFacts:source.payFacts,source:'INTAKE_DRAIN',observedAt:source.observedAt||new Date(now).toISOString()};payCard.postedPay=PostedPay.capture(payCard);
   item.validation={...PostedPay.carry(payCard),status:'READY_FOR_CONTROLLED_INTAKE',reviewSha256:S.hash(review),observedAt:new Date(now).toISOString(),resumeMatch:overlap,sourceSha256:source.sourceSha256,sourceUrl:source.sourceUrl};item.status=item.validation.status;result.verified++;
  }catch(e){item.validation={status:'SOURCE_VALIDATION_REQUIRED',reviewSha256:S.hash(review),observedAt:new Date(now).toISOString(),reason:e.message,retryAfter:new Date(now+6*3600000).toISOString()};item.status=item.validation.status;result.failed++;}
 }
 if(apply)S.save(root,FILE,work);return{...result,canonicalWrites:0};
}
function approved(root,now=Date.now()){
 const work=read(root,FILE,empty()),roles=[],proofs=new Map(),shared=sharedKeys(root);
 for(const item of Object.values(work.items)){
  const v=item.validation;if(sharedBlocked(item,shared)||item.status!=='READY_FOR_CONTROLLED_INTAKE'||item.fence||!v||!Number.isFinite(Date.parse(v.observedAt))||Date.parse(v.observedAt)>now)continue;
  const r=read(root,item.review.path);validate(r,item,now);if(v.reviewSha256!==S.hash(r)||item.review.path!==reviewPath(r)||r.outcome!=='SOURCE_READY')throw Error('DRAIN_VALIDATION_BINDING_REQUIRED');
  const trustedPay=v.postedPay?PostedPay.carry({...r.sourceEvidence,...v,url:v.postedPay.sourceUrl}):PostedPay.carry(item.card);const role={...r.sourceEvidence,postedPay:undefined,payFacts:undefined,pay:undefined,...trustedPay,...(trustedPay.postedPay?{url:trustedPay.postedPay.sourceUrl}:{}),discoveryReview:item.discoveryReview,initiatingUrl:item.card.url,source:'INTAKE_DRAIN',selectionReason:item.selectionReason,scopeReason:r.scope.reason+'; resume='+r.scope.resumeTextSha256+'; competencies='+r.scope.resumeCompetencyIds.join(','),drainKey:item.key,drainReview:item.review.path};roles.push(role);proofs.set(U.key(role.url),{role,review:r,validation:v});
 }
 return{roles,proofs};
}
// Catch-up may already contain cards omitted by seeds(). Keep the same explicit
// holds/reservations on that route; saved details do not resolve an identity or
// previous-transaction obligation. Currently validated positive reviews can pass.
function admissionHolds(root,{work=read(root,FILE,empty()),now=Date.now()}={}){
 const allowed=new Set(approved(root,now).roles.flatMap(r=>[U.key(r.url),U.key(r.initiatingUrl)].filter(Boolean))),held=new Map();
 for(const item of Object.values(work.items)){
  const keys=[...new Set([item.key,...item.aliases||[]])];
  if(!item.fence&&!item.sourceConflict&&item.status==='READY_FOR_CONTROLLED_INTAKE'&&keys.some(k=>allowed.has(k)))continue;
  if(item.fence||item.scopeReviewHold||item.sourceConflict||item.action!=='INTAKE'||['ACCOUNTED_UPSTREAM','INVENTORY_RECONCILIATION_REQUIRED'].includes(item.status))for(const k of keys)held.set(k,item.fence?'ORIGINAL_WRITER_FENCE':['ACCOUNTED_UPSTREAM','INVENTORY_RECONCILIATION_REQUIRED'].includes(item.status)?item.status:item.scopeReviewHold?.reason||item.sourceConflict||item.action||item.status);
 }
 for(const key of sharedKeys(root))held.set(key,'SHARED_HELPER_RESERVED');
 return held;
}
function ownedKeys(root){const shared=sharedKeys(root);return new Set(Object.values(read(root,FILE,empty()).items).filter(i=>i.status!=='ACCOUNTED_UPSTREAM'&&!sharedBlocked(i,shared)).flatMap(i=>[i.key,...i.aliases||[]]));}
function owned(root,key){return ownedKeys(root).has(key);}
function fences(root){return Object.values(read(root,FILE,empty()).items).filter(i=>i.fence).map(i=>fenceRecord(i.fence.record||i.card));}
function seeds(root){const work=read(root,FILE,empty()),shared=sharedKeys(root);return Object.values(work.items).filter(i=>!sharedBlocked(i,shared)&&i.status==='ACTION_REQUIRED'&&i.action==='INTAKE'&&!i.fence&&i.screen.outcome==='ADMIT').map(i=>({...i.card,discoveryReview:i.discoveryReview,source:'SAVED_DISCOVERY',selectionReason:i.selectionReason,drainKey:i.key}));}
if(require.main===module)(async()=>{
 const [command,arg]=process.argv.slice(2),root=path.resolve(__dirname,'../..');let result;
 if(command==='sync')result=sync(root,{apply:true});
 else if(command==='next')result=next(root,arg);
 else if(command==='review')result=publish(root,JSON.parse(fs.readFileSync(arg,'utf8')));
 else if(command==='verify')result=await verify(root,{privateDir:arg,apply:true});
 else throw Error('Use sync, next <taskKey>, review <json>, or verify <privateDir>');
 console.log(JSON.stringify(command==='sync'?{counts:result.counts,actions:result.actions,reviewErrors:result.reviewErrors}:result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={writerFences,FILE,REVIEWS,TASKS,empty,selection,sync,validate,publish,researchEligible,next,verify,approved,seeds,fences,admissionHolds,owned,ownedKeys,reviewPath};
