'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('./store.cjs'),W=require('../routine-handoffs/exception-work.cjs'),P=require('../routine-handoffs/exception-progress.cjs'),{mergeExceptionWork:merge}=require('./exception-merge.cjs');
const clone=structuredClone;
function count(w){w.counts={};for(const c of Object.values(w.cases))w.counts[c.status]=(w.counts[c.status]||0)+1;return w;}
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'exception-merge-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const now=Date.now()-10000,at=new Date(now).toISOString(),binding={key:'test',sourceVersion:'a'.repeat(64)},id=S.hash(binding);
 const c={exceptionId:id,binding,kind:'SOURCE',status:'ACTION_REQUIRED',canonicalCompletion:false,firstSeen:at,lastSeen:at,owner:'ChatGPT',taskKey:W.OWNER,protectedUnknown:{preserve:true}};
 const base=count({...W.empty(),cases:{[id]:c},at,runId:'original',noProcessingCap:true,unknown:{retain:'all fields'}});S.save(root,W.FILE,base);
 const runId='FORGE-EXCEPTION-CHATGPT-MERGE01';P.start(root,runId,1,now);
 const rec={schema:'forge.ai-exception-review.v1',exceptionId:id,sourceVersion:binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now+1000).toISOString(),runId,disposition:'WAITING_SOURCE_CHANGE',reason:'SOURCE_EVIDENCE_UNAVAILABLE',retryCondition:'NEW_ORIGINAL_SOURCE_EVIDENCE',evidenceSha256:'b'.repeat(64)};
 const published=W.publishReview(root,rec,now+2000);
 P.checkpoint(root,{runId,completedAt:new Date(now+2000).toISOString(),attempts:[{exceptionId:id,sourceVersion:binding.sourceVersion,observedAt:rec.reviewedAt,evidenceSha256:rec.evidenceSha256,reason:rec.reason,nextAction:'Wait for new source',reviewPath:published.path}]},now+2000);
 const left=S.read(root,W.FILE),right=clone(base);right.at=new Date(now+3000).toISOString();right.runId='coordinator';right.cases[id].lastSeen=right.at;
 const binding2={key:'new-case',sourceVersion:'c'.repeat(64)},id2=S.hash(binding2);right.cases[id2]={...clone(c),exceptionId:id2,binding:binding2};count(right);
 return{root,base,left,right,id,id2,now:now+4000,rec};
}
test('independent observation and actual producer review/progress preserve all fields and recompute counts',t=>{
 const f=fixture(t),m=merge(f.root,f.base,f.left,f.right,f.now);
 a.deepEqual(m.cases[f.id],{...f.left.cases[f.id],lastSeen:f.right.at});a.deepEqual(m.cases[f.id2],f.right.cases[f.id2]);a.deepEqual(m.dispatch,f.left.dispatch);a.deepEqual(m.counts,{WAITING_SOURCE_CHANGE:1,ACTION_REQUIRED:1});a.deepEqual(m.unknown,f.base.unknown);
 a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),m);
});
for(const [name,mutate]of [
 ['invalid counts',f=>f.left.counts.ACTION_REQUIRED=999],
 ['case deletion',f=>{delete f.right.cases[f.id];count(f.right);}],
 ['changed binding',f=>f.left.cases[f.id].binding.sourceVersion='different'],
 ['divergent status',f=>{f.right.cases[f.id].status='NO_LONGER_OPEN';count(f.right);}],
 ['protected field',f=>f.right.cases[f.id].protectedUnknown.preserve=false],
 ['attempt counter overlap',f=>f.right.cases[f.id].attempts=1],
 ['dispatch overlap',f=>f.right.dispatch={invented:true}],
 ['unknown top-level overlap',f=>{f.left.unknown={a:1};f.right.unknown={b:1};}],
 ['missing review proof',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].review.proof))],
 ['forged review projection',f=>f.left.cases[f.id].review.reason='invented'],
 ['missing checkpoint',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].lastAttempt.proof))],
 ['forged attempt projection',f=>f.left.cases[f.id].lastAttempt.evidenceSha256='f'.repeat(64)],
 ['changed original selection',f=>{const p='receipts/AI_EXCEPTION_RUNS/'+f.rec.runId+'_START.json',v=S.read(f.root,p);v.selected=[];S.save(f.root,p,v);}],
 ['canonical completion claim',f=>f.left.cases[f.id].canonicalCompletion=true],
 ['unknown schema',f=>f.left.schema='future'],
 ['review deletion',f=>{f.base.cases[f.id].review=clone(f.left.cases[f.id].review);delete f.right.cases[f.id].review;}],
 ['attempt deletion',f=>{f.base.cases[f.id].lastAttempt=clone(f.left.cases[f.id].lastAttempt);delete f.right.cases[f.id].lastAttempt;}],
 ['older observation',f=>f.right.cases[f.id].lastSeen='2000-01-01T00:00:00Z'],
 ['two different reviews',f=>f.right.cases[f.id].review={...f.left.cases[f.id].review,reason:'different'}]
])test('fails closed: '+name,t=>{const f=fixture(t);mutate(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('one-sided closure remains an observation, never a canonical completion',t=>{const f=fixture(t);f.right.cases[f.id2].status='NO_LONGER_OPEN';f.right.cases[f.id2].closedAt=f.right.at;count(f.right);const m=merge(f.root,f.base,f.left,f.right,f.now);a.equal(m.cases[f.id2].canonicalCompletion,false);a.equal(m.cases[f.id2].status,'NO_LONGER_OPEN');});
test('newer immutable review cannot be hidden by a stale pointer',t=>{const f=fixture(t),newer={...f.rec,reviewedAt:new Date(f.now).toISOString()};S.immutable(f.root,W.REVIEWS+'/'+f.id+'-'+S.hash(newer)+'.json',newer);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
const cp=require('node:child_process'),{publish}=require('./publish.cjs');
const git=(root,...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const commit=root=>{git(root,'add','.');git(root,'commit','-m','test accounting');};
const guard='state/RELEVANCE_SCREEN_GUARD.json';
function repositories(t){const f=fixture(t),dir=fs.mkdtempSync(path.join(os.tmpdir(),'exception-publish-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));git(dir,'init','--bare','remote.git');git(dir,'clone','remote.git','local');const local=path.join(dir,'local');git(local,'config','user.name','Test');git(local,'config','user.email','test@example.invalid');git(local,'checkout','-b','main');S.save(local,W.FILE,f.base);S.save(local,guard,{schema:'forge.relevance-guard.v1',at:f.base.at,policy:'same',disabledRules:[]});commit(local);git(local,'push','-u','origin','main');git(dir,'clone','--branch','main','remote.git','bot');const bot=path.join(dir,'bot');git(bot,'config','user.name','Test');git(bot,'config','user.email','test@example.invalid');return{...f,local,bot};}
for(const races of [0,2])test('real two-file rebase and '+races+' subsequent push races retain original evidence',t=>{
 const f=repositories(t),terminal='receipts/FORGE-CODE-CHATGPT-MERGETEST_CHECKPOINT.json',original={transactions:{originalRequest:{status:'PENDING',payloadSha256:'d'.repeat(64)}}};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,terminal,original);
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 const result=publish(f.local,{beforePush(n){if(n<races){S.save(f.bot,'independent-'+n+'.json',{retained:true});commit(f.bot);git(f.bot,'push','origin','main');}}});
 a.equal(result.attempts,races+1);const merged=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));a.deepEqual(merged.counts,{WAITING_SOURCE_CHANGE:1,ACTION_REQUIRED:1});a.deepEqual(merged.cases[f.id],{...f.left.cases[f.id],lastSeen:f.right.at});a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+terminal)),original);
 for(const file of S.files(path.join(f.root,'receipts'))){const rel=path.relative(f.root,file);a.equal(git(f.local,'show','origin/main:'+rel),fs.readFileSync(file,'utf8').trim());}
 a.equal(git(f.local,'status','--porcelain'),'');
});
for(const failure of ['guard policy','guard disabled','unrelated'])test('two-file recovery stages nothing when '+failure+' is ambiguous',t=>{
 const f=repositories(t);S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:failure==='guard policy'?'changed':'same',disabledRules:failure==='guard disabled'?['new']:[]});
 if(failure==='unrelated'){S.save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{value:'local'});S.save(f.bot,'state/PROGRAMMED_COORDINATOR_REPORT.json',{value:'remote'});}
 commit(f.bot);git(f.bot,'push','origin','main');a.throws(()=>publish(f.local));a.ok(git(f.local,'diff','--name-only','--diff-filter=U').includes(W.FILE));a.ok(git(f.local,'diff','--name-only','--diff-filter=U').includes(guard));
});
function dispatchFixture(t){
 const f=fixture(t),base=clone(f.left);base.cases[f.id2]=clone(f.right.cases[f.id2]);count(base);S.save(f.root,W.FILE,base);
 const runId='FORGE-EXCEPTION-CHATGPT-MERGE02';P.start(f.root,runId,1,f.now);
 const rec={...f.rec,exceptionId:f.id2,sourceVersion:base.cases[f.id2].binding.sourceVersion,runId,reviewedAt:new Date(f.now+1000).toISOString()},published=W.publishReview(f.root,rec,f.now+2000);
 P.checkpoint(f.root,{runId,completedAt:new Date(f.now+2000).toISOString(),attempts:[{exceptionId:f.id2,sourceVersion:rec.sourceVersion,observedAt:rec.reviewedAt,evidenceSha256:rec.evidenceSha256,reason:rec.reason,nextAction:'Wait for new source',reviewPath:published.path}]},f.now+2000);
 const left=S.read(f.root,W.FILE),right=clone(base);right.dispatch.basis='ACCEPTED_IMMUTABLE_REVIEW';for(const c of Object.values(right.cases))c.lastSeen=new Date(f.now+3000).toISOString();
 return{...f,base,left,right,now:f.now+4000};
}
test('same-observation basis normalization crosses a separately evidenced service advance',t=>{const f=dispatchFixture(t),m=merge(f.root,f.base,f.left,f.right,f.now);a.deepEqual(m.dispatch,f.left.dispatch);a.deepEqual(m.counts,{WAITING_SOURCE_CHANGE:2});a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),m);});
for(const [name,mutation]of [
 ['fake dispatch case',f=>f.left.dispatch.exceptionId='a'.repeat(64)],
 ['fake dispatch binding',f=>f.left.dispatch.sourceVersion='b'.repeat(64)],
 ['future dispatch',f=>f.left.dispatch.observedAt='2099-01-01T00:00:00Z'],
 ['extra dispatch key',f=>f.left.dispatch.unknown=true],
 ['normalization with another change',f=>{f.right.dispatch.basis='ACCEPTED_IMMUTABLE_REVIEW';f.right.dispatch.lastReviewedKind='MAIL';}],
 ['checkpoint start mismatch',f=>{const p=f.left.cases[f.id2].lastAttempt.proof,r=S.read(f.root,p);r.startedAt='1999-01-01T00:00:00Z';S.save(f.root,p,r);}],
 ['checkpoint ends before start',f=>{const p=f.left.cases[f.id2].lastAttempt.proof,r=S.read(f.root,p);r.completedAt='1999-01-01T00:00:00Z';S.save(f.root,p,r);}],
 ['old basis missing proof',f=>fs.unlinkSync(path.join(f.root,f.base.cases[f.id].lastAttempt.proof))]
])test('dispatch provenance fails closed: '+name,t=>{const f=dispatchFixture(t);mutation(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('one-sided fake cursor cannot bypass proof validation',t=>{const f=fixture(t);f.left.dispatch.exceptionId='f'.repeat(64);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('valid older service evidence cannot regress a one-sided dispatch cursor',t=>{const f=dispatchFixture(t),older=clone(f.base.dispatch);f.base=clone(f.left);f.left=clone(f.base);f.right=clone(f.base);f.left.dispatch=older;f.right.cases[f.id].lastSeen=new Date(f.now).toISOString();a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
