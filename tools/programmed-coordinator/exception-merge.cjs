'use strict';
// Deliberately not a general JSON merge. Only an observation of an unchanged
// open case may cross an independently evidenced review/attempt update.
const {isDeepStrictEqual:eq}=require('node:util'),path=require('node:path');
const S=require('./store.cjs'),W=require('../routine-handoffs/exception-work.cjs');
const fail=()=>{throw Error('Semantic exception accounting conflict; preserve checkout and lock');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(...xs)=>[...new Set(xs.flatMap(x=>Object.keys(x||{})))];
const changed=(a,b)=>keys(a,b).filter(k=>!eq(a[k],b[k])||Object.hasOwn(a,k)!==Object.hasOwn(b,k));
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function choose(b,l,r){if(eq(l,r))return l;if(eq(l,b))return r;if(eq(r,b))return l;fail();}
function counts(work){const out={};for(const c of Object.values(work.cases)){if(!object(c)||!['ACTION_REQUIRED','WAITING_SOURCE_CHANGE','AWAITING_TIM','NO_LONGER_OPEN'].includes(c.status))fail();out[c.status]=(out[c.status]||0)+1;}return out;}
function validate(work){
 if(!object(work)||work.schema!=='forge.ai-exception-work.v1'||!object(work.cases)||!eq(work.counts,counts(work)))fail();
 for(const [id,c]of Object.entries(work.cases))if(c.exceptionId!==id||!object(c.binding)||S.hash(c.binding)!==id||c.canonicalCompletion!==false)fail();
}
function review(root,c,now){
 const ref=c.review;if(!ref||typeof ref.proof!=='string'||!new RegExp('^'+W.REVIEWS+'/'+c.exceptionId+'-[a-f0-9]{64}\\.json$').test(ref.proof))fail();
 const record=S.read(root,ref.proof,null);if(!record||ref.proof!==W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(record)+'.json')fail();
 W.validateReview(record,{cases:{[c.exceptionId]:c}},now,true);
 const projected=JSON.parse(JSON.stringify({proof:ref.proof,sha256:S.hash(record),disposition:record.disposition,reviewedAt:record.reviewedAt,reason:record.reason,retryCondition:record.retryCondition,retryAfter:record.retryAfter}));
 if(!eq(ref,projected)||record.disposition==='AWAITING_TIM')fail(); // question existence/authority is intentionally outside this resolver
 // A concurrently published newer immutable review must not be hidden by a
 // stale pointer, even if Git happened to merge that receipt without conflict.
 for(const file of S.files(path.join(root,W.REVIEWS)).filter(f=>path.basename(f).startsWith(c.exceptionId+'-'))){
  const other=S.read(root,path.relative(root,file));
  if(path.basename(file)!==c.exceptionId+'-'+S.hash(other)+'.json')fail();
  W.validateReview(other,{cases:{[c.exceptionId]:c}},now,true);
  if(Date.parse(other.reviewedAt)>Date.parse(record.reviewedAt)||Date.parse(other.reviewedAt)===Date.parse(record.reviewedAt)&&S.hash(other)!==S.hash(record))fail();
 }
 return record;
}
function attempt(root,c,now){
 const ref=c.lastAttempt;if(!ref||!/^FORGE-EXCEPTION-CHATGPT-[A-Za-z0-9_-]{3,100}$/.test(ref.runId||'')||ref.proof!=='receipts/AI_EXCEPTION_RUNS/'+ref.runId+'_CHECKPOINT.json')fail();
 const receipt=S.read(root,ref.proof,null),start=S.read(root,'receipts/AI_EXCEPTION_RUNS/'+ref.runId+'_START.json',null);
 if(!receipt||!start||receipt.schema!=='forge.ai-exception-progress-receipt.v1'||start.schema!=='forge.ai-exception-start.v1'||receipt.runId!==ref.runId||start.runId!==ref.runId||receipt.taskKey!==W.OWNER||start.taskKey!==W.OWNER||receipt.selectionSha256!==S.hash(start)||receipt.startedAt!==start.startedAt||Date.parse(receipt.completedAt)<Date.parse(start.startedAt)||receipt.canonicalCompletionsClaimed!==0||!Array.isArray(receipt.attempts)||!Array.isArray(start.selected)||receipt.attempted!==receipt.attempts.length||!time(start.startedAt)||!time(receipt.completedAt)||Date.parse(receipt.completedAt)>now+60000)fail();
 const selected=start.selected.filter(x=>x.exceptionId===c.exceptionId),matches=receipt.attempts.filter(x=>x.exceptionId===c.exceptionId);
 if(selected.length!==1||matches.length!==1||!eq(selected[0].binding,c.binding))fail();
 const a=matches[0];
 if(a.sourceVersion!==c.binding.sourceVersion||!time(a.observedAt)||Date.parse(a.observedAt)<Date.parse(start.startedAt)-60000||Date.parse(a.observedAt)>Date.parse(receipt.completedAt)||!/^[a-f0-9]{64}$/.test(a.evidenceSha256||'')||typeof a.reason!=='string'||!a.reason.trim()||typeof a.nextAction!=='string'||!a.nextAction.trim())fail();
 if(!eq(ref,{runId:ref.runId,sourceVersion:a.sourceVersion,observedAt:a.observedAt,evidenceSha256:a.evidenceSha256,reason:a.reason,nextAction:a.nextAction,proof:ref.proof}))fail();
 if(a.reviewPath){if(!new RegExp('^'+W.REVIEWS+'/'+c.exceptionId+'-[a-f0-9]{64}\\.json$').test(a.reviewPath))fail();const r=S.read(root,a.reviewPath,null);if(!r||a.reviewPath!==W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(r)+'.json'||r.runId!==ref.runId||r.sourceVersion!==c.binding.sourceVersion||Date.parse(r.reviewedAt)>Date.parse(receipt.completedAt)||Date.parse(r.reviewedAt)<Date.parse(start.startedAt)-60000)fail();W.validateReview(r,{cases:{[c.exceptionId]:c}},now,true);}
}
// Lazily evaluate the same coordinator snapshot once, only for the two extra
// event dimensions below. Missing/stale snapshots remain operator conflicts.
function coordinatorEvidence(root,now){
 let cached;
 return work=>{
  if(!cached){
   const report=S.read(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',null),state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',null);
   if(report?.schema!=='forge.programmed-coordinator-report.v1'||state?.schema!=='forge.programmed-coordinator.v1'||!object(state.items)||!time(report.at)||Date.parse(report.at)>now+60000)fail();
   cached={report,state,current:null};
  }
  if(!time(work.at)||!work.runId||cached.report.runId!==work.runId||Math.abs(Date.parse(cached.report.at)-Date.parse(work.at))>1000)fail();
  if(!cached.current)cached.current=new Set(W.candidates(root,cached.report,cached.state,Date.parse(work.at)).map(c=>c.exceptionId));
  return cached;
 };
}
function mergeCase(root,b,l,r,now,leftWork,rightWork,evidence){
 const leftAt=leftWork.at,rightAt=rightWork.at;
 if(!b){if(l&&r&&!eq(l,r))fail();const added=l||r;if(added.review||added.lastAttempt)fail();return added;}
 if(!l||!r||!eq(b.binding,l.binding)||!eq(b.binding,r.binding))fail();
 // Never drop even an old proof or attempt, including on a one-sided change.
 for(const side of [l,r])for(const k of ['review','lastAttempt'])if(b[k]&&!side[k])fail();
 const lc=changed(b,l),rc=changed(b,r);let result;
 // A coordinator may stop observing a case while an independently proved,
 // earlier attempt is published. Preserve both facts without reopening the
 // case or treating NO_LONGER_OPEN as canonical completion. Except for the
 // narrow Writer wait-review branch below, reviews/status changes and unknown
 // fields remain conflicts. Later attempts require a fresh
 // coordinator snapshot proving absence; they remain inert history.
 const closure=(side,at)=>b.status!=='NO_LONGER_OPEN'&&!Object.hasOwn(b,'closedAt')&&side.status==='NO_LONGER_OPEN'&&changed(b,side).length===2&&changed(b,side).every(k=>['status','closedAt'].includes(k))&&time(side.closedAt)&&side.closedAt===at&&Date.parse(at)<=now+60000&&time(b.lastSeen)&&Date.parse(at)>=Date.parse(b.lastSeen);
 const attempted=side=>changed(b,side).length===1&&changed(b,side)[0]==='lastAttempt';
 // A prior immutable Writer wait review remains history after the coordinator
 // independently stops observing the case. Never infer closure from clocks:
 // require the exact current coordinator snapshot and absence from candidates.
 let reviewedClosure,reviewedSide,reviewedClosureWork;
 const reviewOnly=side=>changed(b,side).length===2&&changed(b,side).every(k=>['status','review'].includes(k))&&side.status==='WAITING_SOURCE_CHANGE'&&side.kind==='WRITER';
 if(closure(l,leftAt)&&reviewOnly(r)){reviewedClosure=l;reviewedSide=r;reviewedClosureWork=leftWork;}
 else if(closure(r,rightAt)&&reviewOnly(l)){reviewedClosure=r;reviewedSide=l;reviewedClosureWork=rightWork;}
 if(reviewedClosure){
  const rec=review(root,reviewedSide,now);
  if(rec.disposition!=='WAITING_SOURCE_CHANGE'||rec.retryAfter||b.review&&Date.parse(rec.reviewedAt)<=Date.parse(b.review.reviewedAt)||Date.parse(rec.reviewedAt)>Date.parse(reviewedClosure.closedAt)||evidence(reviewedClosureWork).current.has(b.exceptionId))fail();
  return {...reviewedClosure,review:reviewedSide.review};
 }
 let closed,served,closedWork;
 if(closure(l,leftAt)&&attempted(r)){closed=l;served=r;closedWork=leftWork;}
 else if(closure(r,rightAt)&&attempted(l)){closed=r;served=l;closedWork=rightWork;}
 if(closed){
  attempt(root,served,now);
  if(served.review)review(root,served,now);
  if(Date.parse(served.lastAttempt.observedAt)>Date.parse(closed.closedAt)&&evidence(closedWork).current.has(b.exceptionId))fail();
  if(b.lastAttempt&&Date.parse(served.lastAttempt.observedAt)<=Date.parse(b.lastAttempt.observedAt))fail();
  return {...closed,lastAttempt:served.lastAttempt};
 }
 if(!lc.length||!rc.length||eq(l,r))result=choose(b,l,r);
 else {
  const observation=side=>changed(b,side).every(k=>k==='lastSeen')&&time(side.lastSeen)&&time(b.lastSeen)&&Date.parse(side.lastSeen)>=Date.parse(b.lastSeen);
  const counter=(side,work)=>{
   const fields=changed(b,side);
   if(fields.length!==2||!fields.includes('attempts')||!fields.includes('lastSeen')||side.kind!=='SOURCE'||side.lastSeen!==work.at||!time(b.lastSeen)||!time(side.lastSeen)||Date.parse(side.lastSeen)<Date.parse(b.lastSeen)||!Number.isSafeInteger(b.attempts)||!Number.isSafeInteger(side.attempts)||b.attempts<0||side.attempts<=b.attempts)return false;
   const e=evidence(work),item=e.state.items[b.binding.key];
   if(!item||item.version!==b.binding.sourceVersion||item.attempts!==side.attempts||!e.current.has(b.exceptionId))fail();
   return true;
  };
  const service=side=>changed(b,side).every(k=>['review','lastAttempt','status'].includes(k));
  let observed,served;if(observation(l)&&service(r)){observed=l;served=r;}else if(observation(r)&&service(l)){observed=r;served=l;}else if(counter(l,leftWork)&&service(r)){observed=l;served=r;}else if(counter(r,rightWork)&&service(l)){observed=r;served=l;}else fail();
  if(Object.hasOwn(observed,'attempts')&&!eq(observed.attempts,b.attempts)&&(!served.review||review(root,served,now).disposition!=='SOURCE_EVIDENCE'))fail();
  if(b.status==='NO_LONGER_OPEN'||served.status==='NO_LONGER_OPEN')fail();
  result={...served,lastSeen:observed.lastSeen,...(!eq(observed.attempts,b.attempts)?{attempts:observed.attempts}:{})};
 }
 if(!eq(result.review,b.review)){
  const rec=review(root,result,now);
  if(b.review&&Date.parse(rec.reviewedAt)<=Date.parse(b.review.reviewedAt))fail();
  // Expiring waits need coordinator evaluation, not a publication-time decision.
  if(rec.retryAfter||result.status!==(rec.disposition==='WAITING_SOURCE_CHANGE'?'WAITING_SOURCE_CHANGE':'ACTION_REQUIRED'))fail();
 }else if(!eq(result.status,b.status)&&lc.length&&rc.length)fail();
 if(!eq(result.lastAttempt,b.lastAttempt)){if(result.review)review(root,result,now);attempt(root,result,now);if(b.lastAttempt&&Date.parse(result.lastAttempt.observedAt)<=Date.parse(b.lastAttempt.observedAt))fail();}
 return result;
}
function dispatchEvidence(root,work,cursor,now){
 const c=work.cases[cursor?.exceptionId];
 if(!c||keys(cursor).sort().join(',')!==['lastServedKind','lastReviewedKind','exceptionId','sourceVersion','observedAt','reviewedAt','basis','artifactSizeOnly'].sort().join(',')||cursor.artifactSizeOnly!==true||cursor.sourceVersion!==c.binding.sourceVersion||cursor.lastServedKind!==c.kind)fail();
 if(cursor.basis==='SOURCE_BOUND_ATTEMPT'){
  attempt(root,c,now);if(c.lastAttempt.observedAt!==cursor.observedAt||!time(cursor.reviewedAt)||Date.parse(cursor.reviewedAt)>Date.parse(cursor.observedAt))fail();
  // advanceAttempts changes service fields but retains the last accepted
  // review's kind/time, which may belong to a different case. Prove both
  // independently instead of requiring an attempt to also be a review.
  const reviewed=Object.values(work.cases).filter(item=>item.kind===cursor.lastReviewedKind&&item.review?.reviewedAt===cursor.reviewedAt);
  if(!reviewed.length)fail();for(const item of reviewed)review(root,item,now);
 }else if(cursor.basis==='ACCEPTED_IMMUTABLE_REVIEW'){
  if(cursor.lastReviewedKind!==c.kind||cursor.observedAt!==cursor.reviewedAt)fail();
  const rec=review(root,c,now);if(rec.reviewedAt!==cursor.observedAt)fail();
 }else fail();
}
function mergeDispatch(root,base,left,right,now){
 const b=base.dispatch,l=left.dispatch,r=right.dispatch;
 if(eq(l,r)||eq(b,l)||eq(b,r)){const chosen=choose(b,l,r);if(!eq(chosen,b)){dispatchEvidence(root,eq(chosen,l)?left:right,chosen,now);if(b&&(!time(b.observedAt)||Date.parse(chosen.observedAt)<=Date.parse(b.observedAt))&&!(b.basis==='SOURCE_BOUND_ATTEMPT'&&chosen.basis==='ACCEPTED_IMMUTABLE_REVIEW'&&eq({...b,basis:chosen.basis},chosen)))fail();}return chosen;}
 // sync re-observes the same immutable review and can relabel the cursor's
 // basis without advancing service. Recognize only that exact normalization,
 // with both old and new cursor evidence validated, never an arbitrary clock win.
 const normalization=c=>b?.basis==='SOURCE_BOUND_ATTEMPT'&&c?.basis==='ACCEPTED_IMMUTABLE_REVIEW'&&eq({...b,basis:c.basis},c);
 let observed,advanced;if(normalization(l)){observed=left;advanced=right;}else if(normalization(r)){observed=right;advanced=left;}else fail();
 dispatchEvidence(root,base,b,now);dispatchEvidence(root,observed,observed.dispatch,now);dispatchEvidence(root,advanced,advanced.dispatch,now);
 if(Date.parse(advanced.dispatch.observedAt)<=Date.parse(b.observedAt))fail();
 return advanced.dispatch;
}
function mergeExceptionWork(root,base,left,right,now=Date.now()){
 for(const w of [base,left,right])validate(w);
 const out={};
 // Top-level values are atomic, including dispatch and unknown future fields.
 for(const k of keys(base,left,right).filter(k=>!['cases','counts'].includes(k))){if(Object.hasOwn(base,k)&&(!Object.hasOwn(left,k)||!Object.hasOwn(right,k)))fail();const v=k==='dispatch'?mergeDispatch(root,base,left,right,now):choose(base[k],left[k],right[k]);if(v!==undefined)Object.defineProperty(out,k,{value:v,enumerable:true,writable:true,configurable:true});}
 const evidence=coordinatorEvidence(root,now);
 out.cases={};for(const id of keys(base.cases,left.cases,right.cases))out.cases[id]=mergeCase(root,base.cases[id],left.cases[id],right.cases[id],now,left,right,evidence);
 out.counts=counts(out);validate(out);return out;
}
module.exports={mergeExceptionWork};
