'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const S=require('./store.cjs'),W=require('../routine-handoffs/exception-work.cjs'),{plan}=require('./exception-reconcile.cjs');
const git=(root,...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const count=w=>{w.counts={};for(const c of Object.values(w.cases))w.counts[c.status]=(w.counts[c.status]||0)+1;return w;};
function fixture(t,mutate=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'closure-plan-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));git(root,'init');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
 const base={...W.empty(),cases:{},at:'2026-01-01T00:00:00Z',runId:'initial',noProcessingCap:true};
 const ids=['writer-one','writer-two','interview'].map((key,i)=>{const binding={key,requestId:i<2?'original-request':null,sourceVersion:S.hash(key)},id=S.hash(binding);base.cases[id]={exceptionId:id,binding,kind:i<2?'WRITER':'INTERVIEW',status:'ACTION_REQUIRED',canonicalCompletion:false,firstSeen:base.at,lastSeen:base.at};return id;});
 const commit=w=>{S.save(root,W.FILE,count(w));git(root,'add','.');git(root,'commit','-m','synthetic');const commit=git(root,'rev-parse','HEAD'),raw=cp.execFileSync('git',['show',commit+':'+W.FILE],{cwd:root,encoding:'utf8'});return{commit,blob:git(root,'rev-parse',commit+':'+W.FILE),sha256:S.hash(raw)};};
 S.save(root,'state/PROGRAMMED_COORDINATOR.json',{transactions:{'original-request':{status:'PENDING',payloadSha256:S.hash('original')}}});
 const pins={base:commit(base)};
 function serve(work,n){const runId='FORGE-EXCEPTION-CHATGPT-SYNTHETIC'+n,startedAt=`2026-01-01T0${n}:00:00Z`,observedAt=`2026-01-01T0${n}:01:00Z`,start={schema:'forge.ai-exception-start.v1',taskKey:W.OWNER,runId,startedAt,selected:ids.map(id=>({exceptionId:id,binding:work.cases[id].binding}))},attempts=ids.map(id=>({exceptionId:id,sourceVersion:work.cases[id].binding.sourceVersion,observedAt,evidenceSha256:S.hash(id+n),reason:'SYNTHETIC_EXAMINATION',nextAction:'Preserve original request'}));
  S.immutable(root,'receipts/AI_EXCEPTION_RUNS/'+runId+'_START.json',start);const file='receipts/AI_EXCEPTION_RUNS/'+runId+'_CHECKPOINT.json';S.immutable(root,file,{schema:'forge.ai-exception-progress-receipt.v1',taskKey:W.OWNER,runId,startedAt,completedAt:observedAt,selectionSha256:S.hash(start),canonicalCompletionsClaimed:0,attempted:attempts.length,attempts});
  for(const x of attempts){const {exceptionId,...p}=x;work.cases[exceptionId].lastAttempt={runId,...p,proof:file};}
 }
 const left=structuredClone(base);serve(left,1);pins.left=commit(left);
 const current=structuredClone(left);serve(current,3);
 for(const id of ids.slice(0,2)){const c=current.cases[id],r={schema:'forge.ai-exception-review.v1',exceptionId:id,sourceVersion:c.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:'2026-01-01T03:47:00Z',runId:'FORGE-EXCEPTION-CHATGPT-SYNTHETIC3',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_WRITER_EVIDENCE_INCOMPLETE',retryCondition:'ORIGINAL_WRITER_EVIDENCE_CHANGED',evidenceSha256:S.hash(id+'review')},sha256=S.hash(r),proof=W.REVIEWS+'/'+id+'-'+sha256+'.json';S.immutable(root,proof,r);c.review={proof,sha256,disposition:r.disposition,reviewedAt:r.reviewedAt,reason:r.reason,retryCondition:r.retryCondition};c.status='WAITING_SOURCE_CHANGE';}
 mutate({root,base,left,current,ids});pins.current=commit(current);
 git(root,'checkout','--detach',pins.base.commit);const right=structuredClone(base);for(const c of Object.values(right.cases)){c.status='NO_LONGER_OPEN';c.closedAt='2026-01-01T01:41:00Z';}pins.right=commit(right);
 return{root,pins,exceptionIds:ids,now:Date.parse('2026-01-01T04:00:00Z'),current};
}
test('private read-only escrow retains three cases, every snapshot and immutable attempt/review; never claims completion',t=>{
 const f=fixture(t),before=git(f.root,'status','--porcelain'),head=git(f.root,'rev-parse','HEAD'),out=plan(f);
 a.equal(out.sha256,S.hash(out.body));a.equal(out.body.executable,false);a.equal(out.body.canonicalCompletionsClaimed,0);a.equal(out.body.disputes.length,3);a.equal(out.body.evidence.length,6);
 for(const d of out.body.disputes){a.deepEqual(d.retainedCase,f.current.cases[d.exceptionId]);a.equal(d.historicalClosure.status,'NO_LONGER_OPEN');a.equal(d.canonicalCompletion,false);}
 for(const [k,s]of Object.entries(out.body.snapshots)){a.equal(S.hash(s.raw),f.pins[k].sha256);a.equal(s.blob,f.pins[k].blob);}
 a.deepEqual(plan(f),out);a.equal(git(f.root,'status','--porcelain'),before);a.equal(git(f.root,'rev-parse','HEAD'),head);
 a.deepEqual(JSON.parse(git(f.root,'show',head+':state/PROGRAMMED_COORDINATOR.json')),{transactions:{'original-request':{status:'PENDING',payloadSha256:S.hash('original')}}});
});
for(const [name,mutate]of [
 ['missing proof',f=>fs.unlinkSync(path.join(f.root,f.current.cases[f.ids[0]].lastAttempt.proof))],
 ['forged attempt pointer',f=>f.current.cases[f.ids[0]].lastAttempt.evidenceSha256='f'.repeat(64)],
 ['changed binding',f=>f.current.cases[f.ids[0]].binding.requestId='replacement'],
 ['unknown case field',f=>f.current.cases[f.ids[0]].newPolicy=true],
 ['expired wait',f=>{const c=f.current.cases[f.ids[0]],p=c.review.proof,r=S.read(f.root,p);fs.unlinkSync(path.join(f.root,p));r.retryAfter='2026-01-01T03:48:00Z';c.review.sha256=S.hash(r);c.review.proof=W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(r)+'.json';c.review.retryAfter=r.retryAfter;S.immutable(f.root,c.review.proof,r);}],
 ['newer hidden review',f=>{const c=f.current.cases[f.ids[0]],r=S.read(f.root,c.review.proof);r.reviewedAt='2026-01-01T03:49:00Z';S.immutable(f.root,W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(r)+'.json',r);}],
 ['equal-time divergent review',f=>{const c=f.current.cases[f.ids[0]],r=S.read(f.root,c.review.proof);r.evidenceSha256='d'.repeat(64);S.immutable(f.root,W.REVIEWS+'/'+c.exceptionId+'-'+S.hash(r)+'.json',r);}],
 ['stale attempt pointer',f=>f.current.cases[f.ids[0]].lastAttempt=structuredClone(f.left.cases[f.ids[0]].lastAttempt)],
 ['canonical claim',f=>f.current.cases[f.ids[0]].canonicalCompletion=true]
])test('fails closed: '+name,t=>{const f=fixture(t,mutate);a.throws(()=>plan(f));});
test('pin tampering and unlisted conflicts fail closed',t=>{const f=fixture(t);const bad=structuredClone(f);bad.pins.current.sha256='a'.repeat(64);a.throws(()=>plan(bad),/pin mismatch/);const partial=plan({...f,exceptionIds:f.exceptionIds.slice(1)});a.ok(partial.body.residualChanges.some(x=>x.exceptionId===f.exceptionIds[0]));a.ok(partial.body.blockers.includes('UNRELATED_CHANGES_REQUIRE_SEPARATE_REVIEW'));});

test('unrelated additions and routing changes are explicit unassessed blockers, never merged',t=>{const f=fixture(t,f=>{f.current.newPolicy=true;f.current.dispatch={invented:true};const binding={key:'unrelated'},id=S.hash(binding);f.current.cases[id]={...f.current.cases[f.ids[2]],binding,exceptionId:id};});const out=plan(f);a.equal(out.body.executable,false);a.equal(out.body.residualChanges.length,3);a.ok(out.body.blockers.includes('UNRELATED_CHANGES_REQUIRE_SEPARATE_REVIEW'));a.ok(out.body.snapshots.current.raw.includes('newPolicy'));});
for(const newer of [false,true])test('unpointed '+(newer?'newer':'equal-time divergent')+' source-bound attempt is rejected',t=>{
 const f=fixture(t,f=>{const c=f.current.cases[f.ids[0]],old=c.lastAttempt.runId,runId='FORGE-EXCEPTION-CHATGPT-HIDDEN',s=S.read(f.root,'receipts/AI_EXCEPTION_RUNS/'+old+'_START.json'),r=S.read(f.root,c.lastAttempt.proof);s.runId=runId;r.runId=runId;r.selectionSha256=S.hash(s);if(newer){r.completedAt='2026-01-01T03:59:00Z';for(const x of r.attempts)x.observedAt=r.completedAt;}S.immutable(f.root,'receipts/AI_EXCEPTION_RUNS/'+runId+'_START.json',s);S.immutable(f.root,'receipts/AI_EXCEPTION_RUNS/'+runId+'_CHECKPOINT.json',r);});a.throws(()=>plan(f),/hidden or divergent attempt/);
});
test('changed bytes at an original immutable receipt path are rejected',t=>{const f=fixture(t,f=>{const file=f.left.cases[f.ids[0]].lastAttempt.proof,r=S.read(f.root,file);r.attempts[0].reason='rewritten';S.save(f.root,file,r);});a.throws(()=>plan(f),/immutable evidence rewritten/);});
