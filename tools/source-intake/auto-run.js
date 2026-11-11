#!/usr/bin/env node
'use strict';
/* AUTO source intake (Tim 2026-10-23): run by .github/workflows/source-intake-auto.yml after each source trial on main.
 * Does nothing unless control/SOURCE_INTAKE_RELEASE.json is armed as AUTO and FORGE_WRITER_KEY is set.
 * 1. Reconciles captured, completed prior writes without POSTing; preserves untouched candidates for fresh admission.
 *    If independent proof is unavailable, the unresolved latch fails this run and remains on attention/NEEDS_TIM.json.
 * 2. Ranks saved cards through the shared relevance screen, preserves all prior request fences,
 *    and sends eligible work in successive maxBatch transactions (not a daily/pass quota).
 * 3. snapshot before -> auto (one insert at a time, waits for each receipt) -> snapshot after -> finalize, with the same
 *    executor gates as the stage. The Writer decides Never Consider; what it declines without writing is SKIPPED.
 * State and outcome go to receipts/auto-intake/<run>.json (Writer responses only, never the key).
 * Exit 1 = THIS run halted and needs a person (halt or reconcile HOLD); the workflow commits the state first.
 * Exit 0 = done or explicitly switched off. A prior unresolved latch is not success.
 * Run: node tools/source-intake/auto-run.js [--report state/source-trial-report.json] [--dry-run] */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {snapshot,auto,finalize}=require('./intake-cli');
const {read,fetchAuthenticatedMaster,fetchAuthenticatedArchive}=require('./writer-reader');
const {requestId,releaseRules}=require('./production-executor');
const {DIR,previous,latch,identityKey}=require('./auto-latch');
const {normalizeCompany}=require('./record-normalize');
const {carryForwardRoles}=require('./carry-forward');
const {knownRequestIds}=require('./known-requests');
const Relevance=require('../relevance-screen/screen.cjs');
const HelperRouting=require('../helper-routing/reservations.cjs'),Upstream=require('../pipeline-observability/upstream-flow');

const CatchUp=require('./catch-up'),Drain=require('../intake-drain/queue.cjs'),DiscoveryInputs=require('./discovery-inputs'),Captured=require('./captured-discovery');
const SWITCH='control/SOURCE_INTAKE_RELEASE.json';
// Eligibility comes only from the centrally configured relevance screen.
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const strip=h=>String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const meta=(h,n)=>(h.match(new RegExp('<meta[^>]+(?:name|property)=["\']'+n+'["\'][^>]+content=["\']([^"\']{20,})','i'))||[])[1];

function discoveryNotes(r){const audit=r.discoveryReview,reason=r.selectionReason||Drain.selection(r);return [r.drainReview?'review='+r.drainReview:audit?.sourceSha256?'discoverySHA='+audit.sourceSha256:'',audit?.resumeMatch?.resumeTextSha256?'resumeSHA='+audit.resumeMatch.resumeTextSha256:'',reason,audit?.scopeHits?.length?'ATS hits='+audit.scopeHits.join(', '):'',audit?.sourceSha256?'sourceSHA='+audit.sourceSha256:'',r.scopeReason?'Role review='+r.scopeReason:''].filter(Boolean).join(' | ').slice(0,400);}
function screenReason(r,config){const s=Relevance.evaluate(r,config);return s.outcome==='ADMIT'?null:s.outcome;}
function pick(report,{max,sent,blockedIdentities=new Set(),blockedRecords=[],config=Relevance.load(),reviewed=new Map(),screenContext,discoveryEvidence,capturedInputs,heldKeys=new Set(),dismissedKeys=new Set()}){
 const per={},out=[];
 for(const r of Relevance.rank(report.new_roles||[],config)){
  if(dismissedKeys.has(Upstream.key(r.url))||heldKeys.has(Upstream.key(r.url)))continue;
  const captured=capturedInputs?.find(r);if(captured?.blocked)continue;
  const saved=discoveryEvidence?.forIntake?discoveryEvidence.forIntake(r):discoveryEvidence?.find(r);
  if(captured?.card.validThrough&&Date.parse(captured.card.validThrough)<=Date.now())continue;
  const sourceCard=captured?captured.card:saved?{...r,description:saved.doc.text,contentBasis:saved.doc.contentBasis||'CAPTURED_ROLE_CONTENT',fullPosting:saved.fullPosting??saved.doc.fullPosting}:null;
  if(screenContext){
   const Screen=require('../source-trial/preliminary-screen');
   // Reusing partial business evidence must neither invent a new zero-hit
   // exclusion nor erase the current exclusion on the original direct card.
   if(sourceCard&&!sourceCard.fullPosting&&r.description&&Screen.excluded(Screen.screen(r,screenContext)))continue;
   if(Screen.excluded(Screen.screen(sourceCard?{...r,...sourceCard,discoveryReview:{...r.discoveryReview,fullPosting:sourceCard.fullPosting===true}}:r,screenContext)))continue;
  }
  if(out.length>=max)break;
  const proof=reviewed.get(Upstream.key(r.url));
  const reviewedScope=proof&&['company','title','location'].every(k=>String(proof.role[k]||'')===String(r[k]||''));
  const outcome=screenReason(r,config);
  if(outcome&&!(reviewedScope&&outcome==='RANKED_DISCOVERY'))continue;
  if(!/^https:\/\/[^\s/]+\//i.test(r.url||'')||!r.location)continue;
  // Employer as the Writer compares it (text before " | "); the raw name's request ID is still checked so a role an
  // earlier run sent under the raw name is never sent again under the normalized one.
  const company=normalizeCompany(r.company).company;
  const k=company.toLowerCase(); // No per-employer throughput cap.
  const identityFields=require('./writer-identity-fields').writerIdentityFields(r);
  const record={...identityFields,COMPANY:company,TITLE:r.title,LOCATION:r.location,SOURCE_URL:r.url,INITIATING_URL:r.initiatingUrl||identityFields.INITIATING_URL||r.url,SCOUT_NOTES:discoveryNotes(r)};
  Object.assign(record,require('../source-trial/posted-pay').fields(r));
  if(record.SALARY_BASE_LOW)record.INITIAL_UNKNOWN_FIELDS=['DEGREE','FLEX'];
  if(blockedIdentities.has(identityKey(record))||blockedRecords.some(original=>require('../source-trial/job-identity').fenceApplies({...r,...record},original)))continue; // a changed URL cannot bypass an uncertain prior write
  if(sent.has(requestId(record))||sent.has(requestId({...record,COMPANY:r.company})))continue;
  per[k]=(per[k]||0)+1;out.push({r,record});
 }
 return out;
}
// Discovery-only closure. Never turn canonical presence into proof of a prior Writer transaction.
function partitionExisting(roles,{master,archive,sent=new Set(),blockedIdentities=new Set(),blockedRecords=[],writerFences=[],now=Date.now()}={}){
 for(const snapshot of [master,archive])if(snapshot?.authenticated!==true||snapshot.source!=='WRITER'||!Array.isArray(snapshot.rows)||!Number.isFinite(Date.parse(snapshot.writerReadAt))||now-Date.parse(snapshot.writerReadAt)>900000||Date.parse(snapshot.writerReadAt)>now+120000)throw Error('Fresh authenticated canonical snapshots required');
 const Identity=require('../source-trial/job-identity'),index=Identity.index([...master.rows,...archive.rows]),remaining=[],existing=[],held=[];
 for(const role of roles){
  const record={COMPANY:normalizeCompany(role.company).company,TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url};
  if(blockedIdentities.has(identityKey(record))||blockedRecords.some(original=>Identity.fenceApplies(role,original))||sent.has(requestId(record))||sent.has(requestId({...record,COMPANY:role.company}))){remaining.push(role);continue;}
  const fence=writerFences.find(f=>f.key&&f.key===Upstream.key(role.url)||Identity.fenceApplies(role,f.record));
  if(fence){held.push({key:Upstream.key(role.url),source:role,status:'ORIGINAL_WRITER_FENCE',fence,writerSubmissions:0});continue;}
  const found=Identity.match(index,role);
  if(['AMBIGUOUS','UNRESOLVED'].includes(found.status)){held.push({key:Upstream.key(role.url),source:role,status:'IDENTITY_HOLD',reason:found.status,basis:found.basis,canonicalIds:[...new Set(found.rows.map(r=>r.PRIMARY_ID).filter(Boolean))],writerSubmissions:0});continue;}
  if(found.status!=='PRESENT'||!found.primaryId){remaining.push(role);continue;}
  existing.push({key:Upstream.key(role.url),source:role,primaryId:found.primaryId,basis:found.basis,canonicalReadAt:{master:master.writerReadAt,archive:archive.writerReadAt},rowSha256:found.rows.map(row=>sha(row.RAW_ROW||JSON.stringify(row))),status:'EXISTING_NO_WRITE',writerSubmissions:0,writeCompletionClaimed:false});
 }
 return {remaining,existing,held};
}
// The posting must load and name the employer; its description is the employer-business evidence the Writer screens.
async function evidence(url,company,fetcher=globalThis.fetch){
 try{
  const res=await fetcher(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (forge-source-intake)'}});
  if(!res.ok)return null;
  const html=await res.text(),text=strip(html);
  if(!text.toLowerCase().includes(company.toLowerCase().split(/[ ,]/)[0]))return null;
  // Never-Consider is adjudicated by Writer from sourced employer facts.
  const d=meta(html,'og:description')||meta(html,'description')||text;
  const at=d.toLowerCase().indexOf(company.toLowerCase().split(/[ ,]/)[0]);
  return strip(d.slice(Math.max(0,at>=0?at:0),(at>=0?at:0)+300))||null;
 }catch{return null}
}
async function sourceEvidence(card,{store,capturedInputs,fetchEvidence=evidence}={}){
 const captured=capturedInputs?.find(card);
 if(captured?.blocked)return {blocked:captured,captured:null,cached:null,business:null,provenance:null};
 if(captured)return {captured,business:captured.card.description,provenance:captured,cached:null};
 const cached=store?.forIntake?store.forIntake(card):store?.find(card),business=cached?.doc.text||await fetchEvidence(card.url,card.company);
 return {cached,business,provenance:cached?{...cached.ref,textSha256:cached.doc.textSha256,identity:cached.doc.identity,fullPosting:cached.fullPosting??cached.doc.fullPosting,contentBasis:cached.doc.contentBasis||'CAPTURED_ROLE_CONTENT'}:null};
}
// Current policy is re-evaluated against the same captured facts. An old capture
// date is provenance, not a reason to fetch the employer site or invent liveness.
async function refreshCapturedReview(candidate,expectedHash,{context}={}){
 if(!Captured.validate(candidate))return null;
 const Screen=require('../source-trial/preliminary-screen'),fresh=await context();
 if(!fresh?.rules?.raw||sha(fresh.rules.raw)!==expectedHash)return null;
 const card=candidate.discoveryEvidence.card;
 if(Screen.excluded(Screen.screen({...card,discoveryReview:{fullPosting:card.fullPosting}},fresh)))return null;
 return {rulesHash:expectedHash,discoveryEvidence:candidate.discoveryEvidence,primaryBusiness:card.description,businessEvidenceApproved:false,evidenceVerified:false};
}

async function prepareCandidate(r,record,{discoveryEvidence,capturedInputs,rulesHash,reportRun,fetchEvidence=evidence}={}){
 const {captured,cached,business,provenance,blocked}=await sourceEvidence(r,{store:discoveryEvidence,capturedInputs,fetchEvidence});if(blocked)return null;
  const savedPay=discoveryEvidence.find(r,{payOnly:true,maxAgeMs:Infinity});
  const posted=require('../source-trial/posted-pay'),salaryCard=savedPay&&!(Date.parse(r.postedPay?.observedAt)>Date.parse(savedPay.doc.postedPay?.observedAt||savedPay.ref.observedAt))?savedPay.doc:r;
  for(const k of Object.keys(posted.fields(r)))delete record[k];Object.assign(record,posted.fields(salaryCard));record.INITIAL_UNKNOWN_FIELDS=record.SALARY_BASE_LOW?['DEGREE','FLEX']:['PAY','DEGREE','FLEX'];
  if(captured)record.SCOUT_NOTES=('Captured '+captured.card.source+'; observed '+(captured.observedAt||'UNKNOWN')+'; posting status UNVERIFIED; '+(business?'job text':'employer business UNKNOWN')+'; proof '+captured.proof.path+' | '+record.SCOUT_NOTES).slice(0,400);
  if(cached)record.SCOUT_NOTES=('discoveryEvidence='+cached.ref.path+(cached.ref.reportSha256?'#sha256='+cached.ref.reportSha256:'')+' | '+record.SCOUT_NOTES).slice(0,400);
  if(!business&&!captured)return null;
  return {...require('../source-trial/posted-pay').carry(salaryCard),...(provenance?{discoveryEvidence:provenance}:{}),record,expectedOutcome:'NEW',evidenceVerified:!captured,evidenceSource:captured?'CAPTURED_DISCOVERY':'INDEPENDENT_VERIFIED',evidenceUrl:r.url,primaryBusiness:business,
   reviewedNeverConsider:false,rulesHash,businessEvidenceApproved:!captured,source:captured?.card.source||r.source,family:r.family,level:r.level,
   approval:{by:'AUTO',basis:'SOURCE_INTAKE_AUTO_V1 armed by Tim; report '+(reportRun||'')}};
}
async function main(argv=process.argv.slice(2)){
 const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null},dry=argv.includes('--dry-run');
 const rules=releaseRules(JSON.parse(fs.readFileSync(SWITCH,'utf8')));
 if(!dry&&(!rules||rules.mode!=='AUTO'))return console.log('AUTO intake off: release switch is not armed as AUTO');
 const key=process.env.FORGE_WRITER_KEY;
 if(!key)throw Error('AUTO intake blocked: FORGE_WRITER_KEY is not set');
 let prior=previous();const recover=!argv.includes('--skip-recovery');
 if(recover&&!dry&&prior.some(p=>p.state.quarantine||p.state.continuation)){const index=await require('../writer-verify/recovery').loadIndex({token:process.env.GITHUB_TOKEN||process.env.GH_TOKEN});for(const p of prior.filter(x=>x.state.quarantine||x.state.continuation)){try{console.log('READ_ONLY reconciliation',JSON.stringify(await require('./reconcile-pending').reconcile('.',p.file,{key,index})));}catch(e){console.error('GOFER reconciliation: '+e.message);}}prior=previous();}
 // One bounded transport recovery per scheduled pass; same workflow concurrency and Writer locks apply.
 if(recover&&!dry){for(const p of prior)require("./unknown-recovery").contain(p.file);prior=previous();for(const unresolved of prior.filter(p=>p.state.quarantine&&!(p.resolvedRequestIds||[]).includes(p.state.quarantine.requestId)&&!require("./unknown-recovery").resolved(p.state))){try{console.log("UNKNOWN recovery",JSON.stringify(await require("./unknown-recovery").recover(unresolved.file,{key})));}catch(e){console.error('GOFER_RECONCILIATION_REQUIRED: '+unresolved.file+' '+e.message);} }prior=previous();}
 // Reconcile accepted writes read-only before deciding whether a prior interruption
 // still blocks. Uncertain responses retain their existing fences and are never replayed here.
 // A single, DURABLY captured identity mismatch may be isolated from unrelated future work (quarantined below).
 if(recover&&!dry){
  for(const pending of latch(prior).blocking){
   try{console.log('INTERRUPTED recovery',JSON.stringify(await require('./interrupted-recovery').recover(pending.file,{key})));}
   catch(e){console.error('INTERRUPTED recovery blocked: '+e.message);}
  }
  prior=previous();
 }
 const {blocking,quarantined}=latch(prior);
 if(blocking.length){
  for(const b of blocking){
   const msg='NEEDS TIM: AUTO intake latched by earlier unfinished run '+b.file+' ('+b.message+(b.requestId?'; request '+b.requestId:'')+'). No Writer call was made. Reconcile that run, then later runs resume.';
   console.log('::warning title=AUTO intake latched::'+msg);
   console.error(msg);
  }
  throw Error('AUTO intake blocked by '+blocking.length+' unresolved prior run(s); no new intake submitted');
 }
 if(argv.includes('--recover-only'))return console.log(JSON.stringify({mode:'RECOVERY_ONLY',blocking:blocking.length,quarantined:quarantined.length,newCandidateSubmissions:0}));
 if(quarantined.length)console.error('NEEDS TIM: isolated identity HOLD(s), NOT resolved: '+JSON.stringify(quarantined));
 // Count only attempts actually recorded; unattempted tail candidates are safe to
 // consider again. Quarantined and all other attempted requests remain excluded.
 const sent=knownRequestIds(prior);
 const capturedInputs=DiscoveryInputs.index('.');
 const drainWork=Drain.sync('.',{apply:!dry}),heldKeys=Drain.admissionHolds('.',{work:drainWork});
 const reviewed=Drain.approved('.');
 const drainSeeds=Drain.seeds('.');
 const report=JSON.parse(fs.readFileSync(opt('--report')||'state/source-trial-report.json','utf8'));
 const carried=carryForwardRoles(prior);
 let catchUp=null;
 if(argv.includes('--catch-up')){
  catchUp=CatchUp.load();const reports=[report,{new_roles:[...drainSeeds,...reviewed.roles]}];
  for(const file of ['state/source-trial-report.json','state/board-discovery-report.json'])if(fs.existsSync(file))reports.push(JSON.parse(fs.readFileSync(file)));
  CatchUp.ingest(catchUp,[...reports,{new_roles:carried}]);CatchUp.releaseSourceHolds(catchUp,r=>capturedInputs.find(r));catchUp.progress=CatchUp.report(catchUp,{sent,quarantined,blocking});
  if(!dry)CatchUp.save('.',catchUp);
  report.new_roles=CatchUp.due(catchUp);
 }
 // A rolled-over discovery report must not lose a reconciled run's untouched candidates.
 const uniqueRoles=new Map();
 for(const r of [...(catchUp?[]:carried),...(report.new_roles||[])]){
  const id=requestId({COMPANY:normalizeCompany(r.company).company,TITLE:r.title,LOCATION:r.location,SOURCE_URL:r.url});
  if(!uniqueRoles.has(id))uniqueRoles.set(id,r);
 }
 report.new_roles=[...uniqueRoles.values()];
 const screenContext=await require('../source-trial/preliminary-screen').context({key});
 const rulesHash=sha(screenContext.rules?.raw||(await read('rules',{key})).data.rules.raw);
 const blockedRecords=[...quarantined.map(q=>q.record).filter(Boolean),...Drain.fences('.')];
 // Keep a legacy family fence only when its original worksite evidence is unavailable.
 const blockedIdentities=new Set(quarantined.filter(q=>q.identityKey&&!q.record).map(q=>q.identityKey));
 const helperWork=HelperRouting.load(),deferred=report.new_roles.filter(r=>HelperRouting.intakeOwner(Upstream.key(r.url),helperWork));report.new_roles=report.new_roles.filter(r=>!HelperRouting.intakeOwner(Upstream.key(r.url),helperWork));if(deferred.length)console.log(JSON.stringify({claudeHelperReserved:deferred.length,assignmentId:helperWork.assignmentId}));
 const [master,archive]=await Promise.all([fetchAuthenticatedMaster({key}),fetchAuthenticatedArchive({key})]);
 const config=Relevance.guarded(Relevance.load(),master.rows),represented=partitionExisting(report.new_roles,{master,archive,sent,blockedIdentities,blockedRecords,writerFences:[...[...Drain.writerFences('.')].map(([key,f])=>({key,...f})),...Drain.fences('.').map(record=>({record}))]});
 report.new_roles=represented.remaining;
 const discoveryEvidence=require('../source-trial/evidence-store').index('.');
 const picked=pick(report,{max:report.new_roles.length,sent,blockedIdentities,blockedRecords,config,reviewed:reviewed.proofs,screenContext,discoveryEvidence,capturedInputs,heldKeys,dismissedKeys:require('../manual-backlog/decisions.cjs').dismissedKeys('.')}),candidates=[];
 for(const {r,record} of picked){
  if(candidates.length>=(rules?.maxBatch||25))break;
  const candidate=await prepareCandidate(r,record,{discoveryEvidence,capturedInputs,rulesHash,reportRun:report.summary?.run});
  if(candidate)candidates.push(candidate);else if(catchUp&&!dry){CatchUp.defer(catchUp,r);CatchUp.save('.',catchUp);}
 }
 const run='FORGE-AUTO-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 console.log(JSON.stringify({run,carriedForward:carried.length,newRoles:(report.new_roles||[]).length,existingNoWrite:represented.existing.length,identityHeld:represented.held.length,filtered:picked.length,candidates:candidates.length}));
 if(dry){fs.writeFileSync('/tmp/auto-candidates.json',JSON.stringify(candidates,null,1));return}
 fs.mkdirSync(DIR,{recursive:true});
 const statePath=path.join(DIR,run+'.json');
 if(catchUp&&!dry){const presentIds=new Set(represented.existing.map(x=>CatchUp.id(x.source))),pendingInventory={...catchUp,roles:Object.fromEntries(Object.entries(catchUp.roles).filter(([id])=>!presentIds.has(id)))};catchUp.progress={...CatchUp.report(pendingInventory,{sent,quarantined,blocking}),existingNoWrite:represented.existing.length,identityHeld:represented.held.length,eligibleBeforeSourceCheck:picked.length,preparedThisBatch:candidates.length,status:candidates.length?'ACTIVE':quarantined.length||represented.held.length?'WAITING_RECONCILIATION':Object.values(pendingInventory.roles).some(x=>x.retryAfter&&Date.parse(x.retryAfter)>Date.now())?'WAITING_SOURCE_RETRY':'NO_ACTIONABLE_WORK'};CatchUp.save('.',catchUp);}
 if(!candidates.length){fs.writeFileSync(statePath,JSON.stringify({run,noCandidates:true,at:new Date().toISOString(),existingNoWrite:represented.existing,identityHeld:represented.held}));return}
 fs.writeFileSync(path.join(DIR,run+'.candidates.json'),JSON.stringify(candidates,null,1));
 await snapshot('before',{statePath,candidates,sourceRunId:run,key,mode:'AUTO'});
 const initialState=JSON.parse(fs.readFileSync(statePath));initialState.existingNoWrite=represented.existing;initialState.identityHeld=represented.held;fs.writeFileSync(statePath,JSON.stringify(initialState,null,1));
 const refreshReview=async(candidate,expectedHash)=>{
  if(candidate.evidenceSource==='CAPTURED_DISCOVERY')return refreshCapturedReview(candidate,expectedHash,{context:()=>require('../source-trial/preliminary-screen').context({key})});
  // Re-read the actual posting and rules; never merely stamp the old review
  // with a new hash. Writer remains the canonical Never Consider adjudicator.
  const business=await evidence(candidate.record.SOURCE_URL,candidate.record.COMPANY);
  if(!business)return null;
  const fresh=sha((await read('rules',{key})).data.rules.raw);
  if(fresh!==expectedHash)return null;
  return {rulesHash:fresh,businessEvidenceApproved:true,primaryBusiness:business,evidenceUrl:candidate.record.SOURCE_URL};
 };
 const r=await auto({statePath,candidates,key,refreshReview});
 console.log(JSON.stringify({status:r.status,message:r.message||'',outcomes:(r.outcomes||[]).map(o=>o.status)}));
 if(r.status==='PROGRESS_WITH_PENDING'){console.log('GOFER_RECONCILIATION_REQUIRED: '+JSON.stringify(r.pending));if(!argv.includes('--one-transaction'))return main(argv);return r;}
 if(r.status!=='ALL_CASES_ACCOUNTED'&&r.status!=='ALREADY_COMPLETE')throw Error('NEEDS TIM: AUTO run halted: '+r.message);
 await snapshot('after',{statePath,candidates,key});
 const rec=finalize({statePath,candidates});
 console.log(JSON.stringify(rec));
 if(rec.status==='HOLD')throw Error('NEEDS TIM: AUTO reconcile HOLD '+rec.reason);
 // maxBatch is a transaction size, not a pass/day quota. Continue eligible work.
 if(!argv.includes('--one-transaction'))return main(argv);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={pick,evidence,sourceEvidence,refreshCapturedReview,prepareCandidate,main,screenReason,discoveryNotes,partitionExisting};
