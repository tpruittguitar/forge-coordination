'use strict';
// Coordinator-owned read-only admission report. No ledger, key read or launch.
const H=require('../helper-routing/shared.cjs');
const A=require('./timmay-adapter.cjs'),W=require('./worker.cjs'),S=require('../programmed-coordinator/store.cjs');
const C=require('./windows-credential.cjs');
const RESERVED_FIVE=5*W.LIMITS.reservationMicrousd;
const code=e=>/^[A-Z][A-Z0-9_]+$/.test(e?.message)?e.message:'PREFLIGHT_READ_FAILED';
function funding(g,now=Date.now()){
 const b=[];const fresh=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=now&&now-Date.parse(x)<=300000;
 // This is an observation contract for an authorized host verifier, not a way
 // for a JSON label or a project budget to grant spending authority.
 if(g?.schema!=='forge.grant-funding-observation.v1'||g.source!=='AUTHORIZED_ACCOUNT_VERIFIER'||!fresh(g.observedAt)||!/^[a-f0-9]{64}$/.test(g.evidenceSha256||''))b.push('FRESH_FUNDING_OBSERVATION_REQUIRED');
 if(g?.project?.name!=='Default'||!/^proj_[A-Za-z0-9_-]+$/.test(g?.project?.id||'')||g.project.responsesOnly!==true||g.project.credentialTarget!==C.TARGET)b.push('RESTRICTED_DEFAULT_PROJECT_REQUIRED');
 if(g?.funding?.kind!=='PROMOTIONAL_ONLY'||g.funding.paidFallbackEnabled!==false||g.funding.autoRechargeEnabled!==false||g.funding.noPaidFallbackVerified!==true)b.push('NO_PAID_FALLBACK_NOT_PROVEN');
 const amount=g?.funding?.availableMicrousd,other=g?.funding?.otherConsumersReservedMicrousd;
 if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(other)||other<0||amount-other<W.LIMITS.balanceFloorMicrousd+RESERVED_FIVE)b.push('GRANT_HEADROOM_OR_OTHER_CONSUMERS_UNPROVEN');
 if(now>=Date.parse(W.LIMITS.stopAt)||!Number.isFinite(Date.parse(g?.funding?.expiresAt))||Date.parse(g.funding.expiresAt)<=now+86400000)b.push('GRANT_EXPIRY_CUTOFF');
 if(g?.funding?.budgetOnly===true)b.push('BUDGET_IS_NOT_GRANT_ONLY_PROOF');
 return b;
}
async function inspect({root,ids,readView,readFundingObservation,expectedSid,readNativeContext,credentialObservation,now=Date.now}){
 const result={schema:'forge.five-launch-preflight.v1',worker:W.NAME,launchEnabled:false,blockers:['LIVE_RELEASE_DISABLED'],jobs:[],
  maximumAttempts:5,reservationMicrousd:RESERVED_FIVE,inputTokenCap:W.LIMITS.inputTokens,outputTokenCap:W.LIMITS.outputTokens,
  credentialReads:0,modelCalls:0,assignmentWrites:0,writerSubmissions:0};
 if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5||ids.some(id=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(id))){result.blockers.push('EXACTLY_FIVE_DISTINCT_IDS_REQUIRED');return result;}
 let view;
 try{
  view=await readView();const authority=A.authority(root,view,now());
  if(authority.ids.size!==5||ids.some(id=>!authority.ids.has(id)))throw Error('EXACT_FIVE_WORKER_PARTITION_REQUIRED');
  result.instructionCommit=view.instructionCommit;result.membershipSha256=S.hash(H.load(root));
 }catch(e){result.blockers.push(code(e));return result;}
 for(const id of ids){
  try{const current=A.current(root,id,view,now());if(!current.missingGroups.length)throw Error('NO_MISSING_FIELDS');
   result.jobs.push({primaryId:id,status:'ELIGIBLE',missingGroups:current.missingGroups});
  }catch(e){result.jobs.push({primaryId:id,status:'SKIP',reason:code(e)});}
 }
 // Do not replace held jobs with another worker's work. Fewer eligible jobs may
 // execute only within the same five-ID authority after live release is reviewed.
 if(!result.jobs.some(j=>j.status==='ELIGIBLE'))result.blockers.push('NO_ELIGIBLE_ASSIGNED_JOBS');
 try{const g=await readFundingObservation();result.blockers.push(...funding(g,now()));}catch{result.blockers.push('FUNDING_VERIFIER_UNAVAILABLE');}
 try{
  const context=await readNativeContext();
  if(!/^S-1-5-21-(?:\d+-){3}\d+$/.test(expectedSid||'')||context.host!==C.HOST||context.sid!==expectedSid||context.impersonating!==false)throw Error('WINDOWS_HOST_OR_ACCOUNT_MISMATCH');
 }catch{result.blockers.push('WINDOWS_HOST_OR_ACCOUNT_UNVERIFIED');}
 const at=Date.parse(credentialObservation?.observedAt);
 if(credentialObservation?.target!==C.TARGET||credentialObservation.installed!==true||credentialObservation.sid!==expectedSid||!Number.isFinite(at)||at>now()||now()-at>300000)result.blockers.push('RESTRICTED_CREDENTIAL_INSTALLATION_UNVERIFIED');
 return result;
}
function launch(){throw Error('LIVE_RELEASE_DISABLED');}
module.exports={RESERVED_FIVE,funding,inspect,launch};
