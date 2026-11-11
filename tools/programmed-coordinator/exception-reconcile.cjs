'use strict';
// Read-only forensic planner. Deliberately not imported by the publisher.
const cp=require('node:child_process'),crypto=require('node:crypto'),{isDeepStrictEqual:eq}=require('node:util');
const S=require('./store.cjs'),W=require('../routine-handoffs/exception-work.cjs');
const fail=message=>{throw Error('Exception escrow refused: '+message);};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const blob=x=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
const clone=structuredClone;
const keys=(...xs)=>[...new Set(xs.flatMap(x=>Object.keys(x||{})))];
const delta=(a,b)=>keys(a,b).filter(k=>!eq(a[k],b[k])||Object.hasOwn(a,k)!==Object.hasOwn(b,k));
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function plan({root,pins,exceptionIds,now=Date.now()}){
 const git=(...args)=>cp.execFileSync('git',['-c','core.longpaths=true',...args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
 if(!pins||keys(pins).sort().join()!=='base,current,left,right'||!Array.isArray(exceptionIds)||!exceptionIds.length||new Set(exceptionIds).size!==exceptionIds.length||exceptionIds.some(id=>! /^[a-f0-9]{64}$/.test(id)))fail('exact pins and distinct case IDs required');
 const snapshots={},evidence=new Map();
 const read=(commit,file)=>{const raw=git('show',commit+':'+file),oid=git('rev-parse',commit+':'+file).trim();if(blob(raw)!==oid)fail('unsupported Git object format');return{commit,path:file,blob:oid,sha256:sha(raw),raw};};
 for(const name of ['base','left','right','current']){
  const pin=pins[name];if(!pin||keys(pin).sort().join()!=='blob,commit,sha256'||! /^[a-f0-9]{40}$/.test(pin.commit)||! /^[a-f0-9]{40}$/.test(pin.blob)||! /^[a-f0-9]{64}$/.test(pin.sha256))fail('full immutable pins required');
  const record=read(pin.commit,W.FILE);if(record.blob!==pin.blob||record.sha256!==pin.sha256)fail('snapshot pin mismatch');
  const work=JSON.parse(record.raw),counts={};if(work.schema!=='forge.ai-exception-work.v1'||!work.cases||Array.isArray(work.cases))fail('work schema');
  for(const [id,c]of Object.entries(work.cases)){if(id!==c.exceptionId||S.hash(c.binding)!==id||c.canonicalCompletion!==false||!['ACTION_REQUIRED','WAITING_SOURCE_CHANGE','AWAITING_TIM','NO_LONGER_OPEN'].includes(c.status))fail('case identity/status');counts[c.status]=(counts[c.status]||0)+1;}
  if(!eq(counts,work.counts))fail('counts');snapshots[name]={...record,work};
  for(const file of git('ls-tree','-r','--name-only',pin.commit,'--',W.REVIEWS,'receipts/AI_EXCEPTION_RUNS').trim().split('\n').filter(Boolean)){
   if(!/\.json$/.test(file))fail('unexpected evidence file');const r=read(pin.commit,file),old=evidence.get(file);
   if(old&&old.raw!==r.raw)fail('immutable evidence rewritten');if(old)old.origins.push({commit:r.commit,blob:r.blob});else evidence.set(file,{...r,origins:[{commit:r.commit,blob:r.blob}]});
  }
 }
 for(const name of ['left','right','current'])try{git('merge-base','--is-ancestor',pins.base.commit,pins[name].commit);}catch{fail('base ancestry');}
 // A nominated current snapshot must descend from one side; dates cannot confer authority.
 if(!['left','right'].some(name=>{try{git('merge-base','--is-ancestor',pins[name].commit,pins.current.commit);return true;}catch{return false;}}))fail('current ancestry');
 const get=file=>{const r=evidence.get(file);if(!r)fail('missing proof '+file);return JSON.parse(r.raw);};
 function review(c,ref){
  if(!ref||ref.proof!==W.REVIEWS+'/'+c.exceptionId+'-'+ref.sha256+'.json')fail('review path');const r=get(ref.proof);
  if(S.hash(r)!==ref.sha256)fail('review hash');W.validateReview(r,{cases:{[c.exceptionId]:c}},now,true);
  const projected=JSON.parse(JSON.stringify({proof:ref.proof,sha256:S.hash(r),disposition:r.disposition,reviewedAt:r.reviewedAt,reason:r.reason,retryCondition:r.retryCondition,retryAfter:r.retryAfter}));if(!eq(ref,projected))fail('review projection');return r;
 }
 function attempt(c,ref){
  if(!ref||!/^FORGE-EXCEPTION-CHATGPT-[A-Za-z0-9_-]{3,100}$/.test(ref.runId||'')||ref.proof!=='receipts/AI_EXCEPTION_RUNS/'+ref.runId+'_CHECKPOINT.json')fail('attempt path');
  const r=get(ref.proof),s=get('receipts/AI_EXCEPTION_RUNS/'+ref.runId+'_START.json');
  if(r.schema!=='forge.ai-exception-progress-receipt.v1'||s.schema!=='forge.ai-exception-start.v1'||r.runId!==ref.runId||s.runId!==ref.runId||r.taskKey!==W.OWNER||s.taskKey!==W.OWNER||r.selectionSha256!==S.hash(s)||r.startedAt!==s.startedAt||!time(s.startedAt)||!time(r.completedAt)||Date.parse(r.completedAt)<Date.parse(s.startedAt)||Date.parse(r.completedAt)>now+60000||r.canonicalCompletionsClaimed!==0||!Array.isArray(r.attempts)||r.attempted!==r.attempts.length||!Array.isArray(s.selected))fail('attempt receipt');
  const selected=s.selected.filter(x=>x.exceptionId===c.exceptionId),matches=r.attempts.filter(x=>x.exceptionId===c.exceptionId);if(selected.length!==1||matches.length!==1||!eq(selected[0].binding,c.binding))fail('selection binding');const a=matches[0];
  if(a.sourceVersion!==c.binding.sourceVersion||!time(a.observedAt)||Date.parse(a.observedAt)<Date.parse(s.startedAt)-60000||Date.parse(a.observedAt)>Date.parse(r.completedAt)||! /^[a-f0-9]{64}$/.test(a.evidenceSha256||'')||!a.reason?.trim()||!a.nextAction?.trim())fail('attempt evidence');
  if(!eq(ref,{runId:ref.runId,sourceVersion:a.sourceVersion,observedAt:a.observedAt,evidenceSha256:a.evidenceSha256,reason:a.reason,nextAction:a.nextAction,proof:ref.proof}))fail('attempt projection');
  if(a.reviewPath){const rev=get(a.reviewPath);if(a.reviewPath!==W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(rev)+'.json'||rev.runId!==ref.runId||Date.parse(rev.reviewedAt)<Date.parse(s.startedAt)-60000||Date.parse(rev.reviewedAt)>Date.parse(r.completedAt))fail('attempt review');W.validateReview(rev,{cases:{[c.exceptionId]:c}},now,true);}
 }
 const {base,left,right,current}=Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,v.work]));
 // Preserve but do not resolve unrelated changes. Full original bytes remain in escrow.
 const residualChanges=[];
 for(const [side,w]of Object.entries({left,right,current}))for(const field of delta(base,w).filter(k=>!['cases','counts','at','runId'].includes(k)))residualChanges.push({side,scope:'TOP_LEVEL',field,resolution:'UNASSESSED'});
 const wanted=new Set(exceptionIds);
 for(const id of keys(base.cases,left.cases,right.cases,current.cases))if(!wanted.has(id))for(const [side,w]of Object.entries({left,right,current}))if(!eq(base.cases[id],w.cases[id]))residualChanges.push({side,scope:'CASE',exceptionId:id,resolution:'UNASSESSED'});
 const disputes=[];
 for(const id of [...wanted].sort()){
  const b=base.cases[id],l=left.cases[id],r=right.cases[id],c=current.cases[id];if(!b||!l||!r||!c||b.status!=='ACTION_REQUIRED'||[l,r,c].some(x=>!eq(x.binding,b.binding)))fail('case/binding changed');
  const closed=[l,r].filter(x=>x.status==='NO_LONGER_OPEN'),served=[l,r].filter(x=>x.status!=='NO_LONGER_OPEN');if(closed.length!==1||served.length!==1)fail('exact closure/service conflict required');
  if(!time(closed[0].closedAt)||delta(b,closed[0]).some(k=>!['status','closedAt','lastSeen'].includes(k)))fail('closure changes');
  for(const x of [served[0],c])if(delta(b,x).some(k=>!['status','lastAttempt','review','lastSeen'].includes(k))||!['ACTION_REQUIRED','WAITING_SOURCE_CHANGE'].includes(x.status)||x.closedAt)fail('service changes');
  if(eq(b.lastAttempt,served[0].lastAttempt)&&eq(b.review,served[0].review))fail('no concurrent service');
  for(const x of [b,l,r,c]){if(x.lastAttempt)attempt(x,x.lastAttempt);if(x.review)review(x,x.review);for(const k of ['review','lastAttempt'])if(b[k]&&!x[k])fail('dropped evidence');}
  if(!c.lastAttempt)fail('current attempt required');
  if(c.review){const rev=review(c,c.review);if(rev.retryAfter||rev.disposition!=='WAITING_SOURCE_CHANGE'||c.status!=='WAITING_SOURCE_CHANGE')fail('unsupported current disposition');}else if(c.status!=='ACTION_REQUIRED')fail('unproved wait');
  // Scan the complete retained inventory, including receipts not pointed to by a snapshot.
  for(const [file,rec]of evidence){const v=JSON.parse(rec.raw);
   if(file.startsWith(W.REVIEWS+'/'+id+'-')){if(file!==W.REVIEWS+'/'+id+'-'+S.hash(v)+'.json')fail('immutable review filename');W.validateReview(v,{cases:{[id]:c}},now,true);if(!c.review||Date.parse(v.reviewedAt)>Date.parse(c.review.reviewedAt)||Date.parse(v.reviewedAt)===Date.parse(c.review.reviewedAt)&&S.hash(v)!==c.review.sha256)fail('hidden or divergent review');}
   if(file.endsWith('_CHECKPOINT.json'))for(const a of v.attempts||[])if(a.exceptionId===id){const ref={runId:v.runId,sourceVersion:a.sourceVersion,observedAt:a.observedAt,evidenceSha256:a.evidenceSha256,reason:a.reason,nextAction:a.nextAction,proof:file};attempt(c,ref);if(Date.parse(a.observedAt)>Date.parse(c.lastAttempt.observedAt)||Date.parse(a.observedAt)===Date.parse(c.lastAttempt.observedAt)&&!eq(ref,c.lastAttempt))fail('hidden or divergent attempt');}
  }
  disputes.push({exceptionId:id,binding:clone(c.binding),retainedCase:clone(c),historicalClosure:clone(closed[0]),canonicalCompletion:false,decision:'UNRESOLVED_CLOSURE_ESCROW'});
 }
 const body={schema:'forge.exception-reconciliation-plan.v1',executable:false,residualChanges,blockers:['CURRENT_CANDIDATE_COVERAGE_UNPROVEN','SHARED_LOCK_AND_APPLY_PROTOCOL_NOT_IMPLEMENTED',...(residualChanges.length?['UNRELATED_CHANGES_REQUIRE_SEPARATE_REVIEW']:[])],canonicalCompletionsClaimed:0,requiredBeforeApply:'Independent current candidate coverage and shared-lock/apply protocol are not established by this plan.',pins:clone(pins),disputes,snapshots:Object.fromEntries(Object.entries(snapshots).map(([k,{work,...v}])=>[k,v])),evidence:[...evidence.values()].sort((a,b)=>a.path.localeCompare(b.path))};
 return{sha256:S.hash(body),body};
}
module.exports={plan};
