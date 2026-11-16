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
function repositories(t,makeFixture=fixture){const f=makeFixture(t),dir=fs.mkdtempSync(path.join(os.tmpdir(),'exception-publish-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));git(dir,'init','--bare','remote.git');git(dir,'clone','remote.git','local');const local=path.join(dir,'local');git(local,'config','user.name','Test');git(local,'config','user.email','test@example.invalid');git(local,'checkout','-b','main');S.save(local,W.FILE,f.base);for(const [file,value]of f.baseProofs||[])S.immutable(local,file,value);S.save(local,guard,{schema:'forge.relevance-guard.v1',at:f.base.at,policy:'same',disabledRules:[]});commit(local);git(local,'push','-u','origin','main');git(dir,'clone','--branch','main','remote.git','bot');const bot=path.join(dir,'bot');git(bot,'config','user.name','Test');git(bot,'config','user.email','test@example.invalid');return{...f,local,bot};}
for(const races of [0,2])test('real two-file rebase and '+races+' subsequent push races retain original evidence',t=>{
 const f=repositories(t),terminal='receipts/FORGE-CODE-CHATGPT-MERGETEST_CHECKPOINT.json',original={transactions:{originalRequest:{status:'PENDING',payloadSha256:'d'.repeat(64)}}};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,terminal,original);
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 const result=publish(f.local,{beforePush(n){if(n<races){S.save(f.bot,'independent-'+n+'.json',{retained:true});commit(f.bot);git(f.bot,'push','origin','main');}}});
 a.equal(result.attempts,races+1);const merged=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));a.deepEqual(merged.counts,{WAITING_SOURCE_CHANGE:1,ACTION_REQUIRED:1});a.deepEqual(merged.cases[f.id],{...f.left.cases[f.id],lastSeen:f.right.at});a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+terminal)),original);
 for(const file of S.files(path.join(f.root,'receipts'))){const rel=path.relative(f.root,file).replace(/\\/g,'/');a.equal(git(f.local,'show','origin/main:'+rel),fs.readFileSync(file,'utf8').trim());}
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

function mixedDispatchFixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mixed-dispatch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const at='2026-11-09T01:20:00.000Z',work={...W.empty(),at,runId:'original',cases:{},noProcessingCap:true},ids=[];
 for(const [key,kind]of [['source-old','SOURCE'],['writer-old','WRITER'],['source-new','SOURCE'],['writer-new','WRITER']]){
  const binding={key,sourceVersion:S.hash(key),...(kind==='WRITER'?{requestId:'original-'+key}:{})},id=S.hash(binding);ids.push(id);
  work.cases[id]={exceptionId:id,binding,kind,status:'ACTION_REQUIRED',canonicalCompletion:false,firstSeen:at,owner:'ChatGPT',taskKey:W.OWNER,protectedUnknown:{preserve:true},lastSeen:at};
 }
 S.save(root,W.FILE,count(work));
 function serve(source,writer,runId,startedAt,reviewedAt,observedAt){
  const now=Date.parse(observedAt);P.start(root,runId,100,Date.parse(startedAt));
  const record={schema:'forge.ai-exception-review.v1',exceptionId:source,sourceVersion:work.cases[source].binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt,runId,disposition:'SOURCE_EVIDENCE',reason:'SAVED_EXACT_POSTING_SCOPE_EVIDENCE',evidenceSha256:S.hash(runId),sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://example.org/jobs/plant-manager',quote:'Plant Manager leads the factory operations team.',observedAt:reviewedAt}};
  const published=W.publishReview(root,record,now);
  P.checkpoint(root,{runId,completedAt:observedAt,attempts:[{exceptionId:source,sourceVersion:record.sourceVersion,observedAt:reviewedAt,evidenceSha256:record.evidenceSha256,reason:record.reason,nextAction:'Independently validate bound source',reviewPath:published.path},{exceptionId:writer,sourceVersion:work.cases[writer].binding.sourceVersion,observedAt,evidenceSha256:S.hash(writer),reason:'ORIGINAL_NOT_ACCEPTED_FRESH_RECEIPT_CHECK',nextAction:'Preserve original request; no replay or canonical verification claimed'}]},now);
 }
 serve(ids[0],ids[1],'FORGE-EXCEPTION-CHATGPT-MIXED01',at,'2026-11-09T01:28:32.157Z','2026-11-09T01:29:54.620Z');
 const base=S.read(root,W.FILE),baseProofs=S.files(path.join(root,'receipts')).map(file=>[path.relative(root,file),S.read(root,path.relative(root,file))]);
 serve(ids[2],ids[3],'FORGE-EXCEPTION-CHATGPT-MIXED02','2026-11-09T02:20:00.000Z','2026-11-09T02:24:12.268Z','2026-11-09T02:25:01.798Z');
 const left=S.read(root,W.FILE),right=clone(base);right.at='2026-11-09T02:26:00.000Z';right.runId='coordinator';for(const c of Object.values(right.cases))c.lastSeen=right.at;
 return{root,base,left,right,baseProofs,ids,now:Date.parse(right.at)};
}
test('producer mixed WRITER attempt and older SOURCE review cross observation with unchanged dispatch',t=>{
 const f=mixedDispatchFixture(t),m=merge(f.root,f.base,f.left,f.right,f.now);
 a.equal(f.base.dispatch.lastServedKind,'WRITER');a.equal(f.base.dispatch.lastReviewedKind,'SOURCE');
 a.equal(f.base.dispatch.observedAt,'2026-11-09T01:29:54.620Z');a.equal(f.base.dispatch.reviewedAt,'2026-11-09T01:28:32.157Z');
 a.equal(f.left.dispatch.observedAt,'2026-11-09T02:25:01.798Z');a.equal(f.left.dispatch.reviewedAt,'2026-11-09T02:24:12.268Z');
 a.notEqual(f.base.dispatch.exceptionId,f.left.dispatch.exceptionId);a.deepEqual(f.right.dispatch,f.base.dispatch);a.equal(f.left.cases[f.ids[3]].review,undefined);
 a.deepEqual(m.dispatch,f.left.dispatch);for(const id of f.ids)a.deepEqual(m.cases[id],{...f.left.cases[id],lastSeen:f.right.at});
 a.deepEqual(m.counts,{ACTION_REQUIRED:4});a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),m);
});
for(const sameCase of [false,true])test('attempt-only run retains prior SOURCE review metadata while serving '+(sameCase?'same':'another')+' WRITER case',t=>{
 const f=mixedDispatchFixture(t),base=clone(f.left),id=f.ids[sameCase?3:1],runId='FORGE-EXCEPTION-CHATGPT-MIXED03',observedAt='2026-11-09T02:31:00.000Z',now=Date.parse(observedAt);
 P.start(f.root,runId,100,now-60000);
 P.checkpoint(f.root,{runId,completedAt:observedAt,attempts:[{exceptionId:id,sourceVersion:base.cases[id].binding.sourceVersion,observedAt,evidenceSha256:S.hash(runId),reason:'ORIGINAL_NOT_ACCEPTED_FRESH_RECEIPT_CHECK',nextAction:'Preserve original request; no replay'}]},now);
 const left=S.read(f.root,W.FILE),right=clone(base);for(const c of Object.values(right.cases))c.lastSeen=observedAt;
 a.equal(left.dispatch.reviewedAt,base.dispatch.reviewedAt);a.equal(left.dispatch.lastReviewedKind,base.dispatch.lastReviewedKind);
 const m=merge(f.root,base,left,right,now);a.deepEqual(m.dispatch,left.dispatch);a.deepEqual(m.cases[id],{...left.cases[id],lastSeen:observedAt});a.deepEqual(merge(f.root,base,right,left,now),m);
});
for(const [name,mutation]of [
 ['missing attempt checkpoint',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.ids[3]].lastAttempt.proof))],
 ['missing original selection',f=>fs.unlinkSync(path.join(f.root,'receipts/AI_EXCEPTION_RUNS/FORGE-EXCEPTION-CHATGPT-MIXED02_START.json'))],
 ['forged attempt projection',f=>f.left.cases[f.ids[3]].lastAttempt.evidenceSha256='f'.repeat(64)],
 ['wrong served kind',f=>f.left.dispatch.lastServedKind='SOURCE'],
 ['unproved attempt time',f=>f.left.dispatch.observedAt='2026-11-09T02:25:02.000Z'],
 ['missing retained review proof',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.ids[2]].review.proof))],
 ['forged retained review projection',f=>f.left.cases[f.ids[2]].review.reason='invented'],
 ['wrong retained review kind',f=>f.left.dispatch.lastReviewedKind='MAIL'],
 ['unproved retained review time',f=>f.left.dispatch.reviewedAt='2026-11-09T02:24:13.000Z'],
 ['review newer than attempt',f=>f.left.dispatch.reviewedAt='2026-11-09T02:25:02.000Z'],
 ['missing retained review field',f=>delete f.left.dispatch.reviewedAt],
 ['unknown cursor field',f=>f.left.dispatch.unknown=true],
 ['false review normalization',f=>f.right.dispatch.basis='ACCEPTED_IMMUTABLE_REVIEW'],
 ['concurrent close',f=>{f.right.cases[f.ids[3]].status='NO_LONGER_OPEN';count(f.right);}],
 ['concurrent original Writer fence change',f=>f.right.cases[f.ids[3]].binding.requestId='replacement-request'],
 ['two independently proved routing advances',f=>{f.right=clone(f.left);f.right.dispatch={...f.right.dispatch,lastServedKind:'SOURCE',exceptionId:f.ids[2],sourceVersion:f.right.cases[f.ids[2]].binding.sourceVersion,observedAt:f.right.dispatch.reviewedAt};}]
])test('mixed dispatch fails closed: '+name,t=>{const f=mixedDispatchFixture(t);mutation(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('mixed dispatch publication preserves original Writer fence and every immutable proof',t=>{
 const f=repositories(t,mixedDispatchFixture),terminal='receipts/FORGE-CODE-CHATGPT-MIXED_CHECKPOINT.json',original={transactions:{originalRequest:{status:'PENDING',payloadSha256:'d'.repeat(64)}}};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,terminal,original);
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now+1000).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 // The publisher's clock is deliberately later than these fixed incident times.
 const realNow=Date.now;Date.now=()=>f.now+2000;t.after(()=>{Date.now=realNow;});
 a.equal(publish(f.local).published,true);const merged=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));
 a.deepEqual(merged.dispatch,f.left.dispatch);for(const id of f.ids)a.deepEqual(merged.cases[id],{...f.left.cases[id],lastSeen:f.right.at});
 a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+terminal)),original);
 for(const file of S.files(path.join(f.root,'receipts'))){const rel=path.relative(f.root,file).replace(/\\/g,'/');a.equal(git(f.local,'show','origin/main:'+rel),fs.readFileSync(file,'utf8').trim());}
 a.equal(git(f.local,'status','--porcelain'),'');
});

function closureFixture(t){
 const f=mixedDispatchFixture(t),id=f.ids[3];
 f.right.cases[id]= {...clone(f.base.cases[id]),status:'NO_LONGER_OPEN',closedAt:f.right.at};
 count(f.right);return {...f,id};
}
test('earlier proved attempt crosses later coordinator closure without reopening or completing',t=>{
 const f=closureFixture(t),m=merge(f.root,f.base,f.left,f.right,f.now);
 a.deepEqual(m.cases[f.id],{...f.right.cases[f.id],lastAttempt:f.left.cases[f.id].lastAttempt});
 a.equal(m.cases[f.id].canonicalCompletion,false);a.deepEqual(m.counts,{ACTION_REQUIRED:3,NO_LONGER_OPEN:1});
 a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),m);
});
for(const [name,mutation]of [
 ['missing closure time',f=>delete f.right.cases[f.id].closedAt],
 ['closure not matching observation',f=>f.right.cases[f.id].closedAt='2026-11-09T02:25:50.000Z'],
 ['closure before attempt',f=>{f.right.at='2026-11-09T02:24:50.000Z';f.right.cases[f.id].closedAt=f.right.at;}],
 ['closure plus unknown change',f=>f.right.cases[f.id].unknown=true],
 ['closure plus changed fence',f=>f.right.cases[f.id].binding.requestId='replacement'],
 ['closure plus canonical claim',f=>f.right.cases[f.id].canonicalCompletion=true],
 ['attempt plus changed review',f=>f.left.cases[f.id].review={unproved:true}],
 ['attempt missing immutable proof',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].lastAttempt.proof))],
 ['attempt with forged evidence',f=>f.left.cases[f.id].lastAttempt.evidenceSha256='f'.repeat(64)],
 ['closure with previously closed base',f=>{f.base.cases[f.id].status='NO_LONGER_OPEN';count(f.base);}]
])test('closure merge fails closed: '+name,t=>{const f=closureFixture(t);mutation(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});

test('real publication rebase preserves closure, attempts and pending Writer fence',t=>{
 const f=repositories(t,closureFixture),terminal='receipts/FORGE-CODE-CHATGPT-CLOSURE_CHECKPOINT.json',original={transactions:{originalRequest:{status:'PENDING',payloadSha256:'d'.repeat(64)}}};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,terminal,original);
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now+1000).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 a.equal(publish(f.local).published,true);const m=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));
 a.deepEqual(m.cases[f.id],{...f.right.cases[f.id],lastAttempt:f.left.cases[f.id].lastAttempt});
 a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+terminal)),original);
 for(const file of S.files(path.join(f.root,'receipts'))){const rel=path.relative(f.root,file).replace(/\\/g,'/');a.equal(git(f.local,'show','origin/main:'+rel),fs.readFileSync(file,'utf8').trim());}
 a.equal(git(f.local,'status','--porcelain'),'');
});

function dimensionFixture(t,closed=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'exception-dimensions-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const now=Date.now()-10000,at=new Date(now).toISOString(),state={schema:'forge.programmed-coordinator.v1',items:{test:{version:'a'.repeat(64),attempts:2}},transactions:{}};
 const report={schema:'forge.programmed-coordinator-report.v1',runId:'FORGE-CODE-TEST',at,aiExceptions:[{key:'test',owner:'AI',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2}]};
 W.sync({root,state,report,now,apply:true});const base=S.read(root,W.FILE),id=Object.keys(base.cases)[0],runId='FORGE-EXCEPTION-CHATGPT-DIMENSION01';
 P.start(root,runId,1,now+100);
 const rec={schema:'forge.ai-exception-review.v1',exceptionId:id,sourceVersion:state.items.test.version,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now+2000).toISOString(),runId,disposition:'SOURCE_EVIDENCE',reason:'Exact saved source',evidenceSha256:'b'.repeat(64),sourceEvidence:{company:'Example',title:'Manager',location:'Remote',url:'https://example.com/jobs/1',quote:'This is an exact saved source quote for testing.',observedAt:at}};
 let published;if(!closed)published=W.publishReview(root,rec,now+2100);
 P.checkpoint(root,{runId,completedAt:new Date(now+3000).toISOString(),attempts:[{exceptionId:id,sourceVersion:state.items.test.version,observedAt:rec.reviewedAt,evidenceSha256:rec.evidenceSha256,reason:rec.reason,nextAction:'Independent code verification',...(published?{reviewPath:published.path}:{})}]},now+3000);
 const left=S.read(root,W.FILE),right=clone(base);delete left.dispatch;right.at=new Date(now+1000).toISOString();right.runId=report.runId;
 if(closed){right.cases[id].status='NO_LONGER_OPEN';right.cases[id].closedAt=right.at;report.aiExceptions=[];}
 else{right.cases[id].attempts=3;right.cases[id].lastSeen=right.at;state.items.test.attempts=3;report.aiExceptions[0].attempts=3;}
 report.at=right.at;S.save(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',report);S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);count(right);
 return{root,base,left,right,id,now:now+4000,report,state,rec};
}
for(const closed of [false,true])test('source-bound '+(closed?'later inert attempt retains closure':'counter and source review retain independent dimensions'),t=>{
 const f=dimensionFixture(t,closed); const out=merge(f.root,f.base,f.left,f.right,f.now);
 a.deepEqual(out.cases[f.id],{...f.right.cases[f.id],...(closed?{}:{review:f.left.cases[f.id].review}),lastAttempt:f.left.cases[f.id].lastAttempt});
 a.equal(out.cases[f.id].canonicalCompletion,false);a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),out);
});
for(const [name,mutate]of [
 ['missing report',f=>fs.unlinkSync(path.join(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json'))],
 ['different run',f=>f.report.runId='OTHER'],['stale snapshot',f=>f.report.at=new Date(Date.parse(f.right.at)-2000).toISOString()],
 ['unbound state source',f=>f.state.items.test.version='c'.repeat(64)],['counter not in snapshot',f=>f.state.items.test.attempts=4],
 ['counter regression',f=>f.right.cases[f.id].attempts=1],['fractional counter',f=>f.right.cases[f.id].attempts=3.5],
 ['missing original counter',f=>delete f.base.cases[f.id].attempts],['non source case',f=>{for(const w of [f.base,f.left,f.right])w.cases[f.id].kind='IDENTITY';}],
 ['unknown dimension',f=>f.right.cases[f.id].newField='unexpected'],['source no longer active',f=>f.report.aiExceptions=[]],
 ['missing source proof',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].review.proof))],
 ['counter with different review',f=>f.right.cases[f.id].review={wrong:true}],
 ['counter with status decision',f=>{f.right.cases[f.id].status='WAITING_SOURCE_CHANGE';count(f.right);}],
])test('counter/research rejects '+name,t=>{const f=dimensionFixture(t);mutate(f);if(name!=='missing report')S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
for(const [name,mutate]of [
 ['missing snapshot',f=>fs.unlinkSync(path.join(f.root,'state/PROGRAMMED_COORDINATOR.json'))],
 ['active candidate',f=>{f.report.aiExceptions=[{key:'test',owner:'AI',reason:'SOURCE_EVIDENCE_UNAVAILABLE',attempts:2}];S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['new review changes decision',f=>f.left.cases[f.id].review={wrong:true}],
 ['missing attempt proof',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].lastAttempt.proof))]
])test('later inert attempt rejects '+name,t=>{const f=dimensionFixture(t,true);mutate(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
for(const closed of [false,true])test('real rebase preserves '+(closed?'post-closure attempt':'counter plus source research')+' and untouched Writer evidence',t=>{
 const f=repositories(t,t=>dimensionFixture(t,closed)),terminal='receipts/FORGE-CODE-CHATGPT-DIMENSION_CHECKPOINT.json',original={transactions:{originalRequest:{status:'PENDING',payloadSha256:'d'.repeat(64)}}};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,terminal,original);
 for(const file of ['state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json'])S.save(f.local,file,S.read(f.root,file));
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 a.equal(publish(f.local).published,true);const m=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));
 a.deepEqual(m.cases[f.id],{...f.right.cases[f.id],...(closed?{}:{review:f.left.cases[f.id].review}),lastAttempt:f.left.cases[f.id].lastAttempt});
 a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+terminal)),original);
 for(const file of S.files(path.join(f.root,'receipts'))){const rel=path.relative(f.root,file).replace(/\\/g,'/');a.equal(git(f.local,'show','origin/main:'+rel),fs.readFileSync(file,'utf8').trim());}
 a.equal(git(f.local,'status','--porcelain'),'');
});

function closureReviewFixture(t,withAttempt=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'closure-review-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const now=Date.now()-10000,at=new Date(now).toISOString(),state={schema:'forge.programmed-coordinator.v1',items:{},transactions:{}},entry={key:'writer-key',requestId:'ORIGINAL-WRITER',owner:'AI',reason:'WRITER_RECONCILIATION_REQUIRED',sourceSha256:'a'.repeat(64)};
 const report={schema:'forge.programmed-coordinator-report.v1',runId:'FORGE-CODE-CLOSURE-REVIEW',at,aiExceptions:[entry]};
 W.sync({root,state,report,now,apply:true});const base=S.read(root,W.FILE),id=Object.keys(base.cases)[0];
 const rec={schema:'forge.ai-exception-review.v1',exceptionId:id,sourceVersion:base.cases[id].binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now+1000).toISOString(),runId:'FORGE-EXCEPTION-CHATGPT-CLOSURE01',disposition:'WAITING_SOURCE_CHANGE',reason:'ORIGINAL_WRITER_EVIDENCE_INCOMPLETE',retryCondition:'ORIGINAL_WRITER_EVIDENCE_CHANGED',evidenceSha256:'b'.repeat(64)};
 if(withAttempt)P.start(root,rec.runId,1,now+100);
 const published=W.publishReview(root,rec,now+2000);
 if(withAttempt)P.checkpoint(root,{runId:rec.runId,completedAt:new Date(now+2000).toISOString(),attempts:[{exceptionId:id,sourceVersion:rec.sourceVersion,observedAt:rec.reviewedAt,evidenceSha256:rec.evidenceSha256,reason:rec.reason,nextAction:'Wait for original Writer evidence',reviewPath:published.path}]},now+2000);
 const left=S.read(root,W.FILE),right=clone(base);right.at=new Date(now+3000).toISOString();right.runId=report.runId;right.cases[id].status='NO_LONGER_OPEN';right.cases[id].closedAt=right.at;count(right);
 report.at=right.at;report.aiExceptions=[];S.save(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',report);S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);
 return{root,base,left,right,id,rec,report,state,entry,now:now+4000};
}
test('earlier immutable Writer wait review crosses evidenced closure without losing history or reopening',t=>{
 const f=closureReviewFixture(t),out=merge(f.root,f.base,f.left,f.right,f.now);
 a.deepEqual(out.cases[f.id],{...f.right.cases[f.id],review:f.left.cases[f.id].review});a.equal(out.cases[f.id].canonicalCompletion,false);a.deepEqual(out.counts,{NO_LONGER_OPEN:1});a.deepEqual(out.dispatch,f.left.dispatch);
 a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),out);
 // The unchanged historical attempt is retained exactly on all three sides.
 for(const w of [f.base,f.left,f.right])w.cases[f.id].lastAttempt={historical:'unchanged'};
 a.deepEqual(merge(f.root,f.base,f.left,f.right,f.now).cases[f.id].lastAttempt,{historical:'unchanged'});
});
for(const [name,mutate]of [
 ['missing coordinator report',f=>fs.unlinkSync(path.join(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json'))],
 ['wrong coordinator run',f=>{f.report.runId='OTHER';S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['wrong coordinator time',f=>{f.report.at=new Date(f.now-8000).toISOString();S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['still observed candidate',f=>{f.report.aiExceptions=[f.entry];S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['missing immutable review',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].review.proof))],
 ['forged review projection',f=>f.left.cases[f.id].review.reason='FORGED'],
 ['review later than closure',f=>{f.right.at=new Date(Date.parse(f.rec.reviewedAt)-1).toISOString();f.right.cases[f.id].closedAt=f.right.at;f.report.at=f.right.at;S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['review side unknown change',f=>f.left.cases[f.id].unknown='changed'],
 ['closure side unknown change',f=>f.right.cases[f.id].unknown='changed'],
 ['overlapping attempts',f=>f.left.cases[f.id].lastAttempt={unknown:true}],
 ['changed binding',f=>f.right.cases[f.id].binding.requestId='DIFFERENT'],
 ['canonical completion claim',f=>f.right.cases[f.id].canonicalCompletion=true],
 ['newer immutable review exists',f=>{const rec={...f.rec,reviewedAt:new Date(f.now).toISOString()};S.immutable(f.root,W.REVIEWS+'/'+f.id+'-'+S.hash(rec)+'.json',rec);}]
])test('closure/review fails closed: '+name,t=>{const f=closureReviewFixture(t);mutate(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('real publication rebase preserves earlier review, later closure and original pending fences',t=>{
 const f=repositories(t,closureReviewFixture),pending='receipts/FORGE-CODE-CHATGPT-REVIEWCLOSE_CHECKPOINT.json',original={requestId:'UNRELATED',status:'POST_IN_FLIGHT_UNKNOWN',payloadSha256:'e'.repeat(64)};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,pending,original);
 for(const file of ['state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json'])S.save(f.local,file,S.read(f.root,file));
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');
 publish(f.local);const out=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));a.deepEqual(out.cases[f.id],{...f.right.cases[f.id],review:f.left.cases[f.id].review});a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+pending)),original);a.equal(git(f.local,'status','--porcelain'),'');
});
test('timed Writer wait remains a conflict even with valid earlier proof and absence',t=>{
 const f=closureReviewFixture(t),rec={...f.rec,reviewedAt:new Date(Date.parse(f.rec.reviewedAt)+100).toISOString(),retryAfter:new Date(f.now+60000).toISOString()};
 W.publishReview(f.root,rec,f.now);f.left=S.read(f.root,W.FILE);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));
});

test('combined earlier Writer review and attempt retain both proofs across evidenced closure',t=>{
 const f=closureReviewFixture(t,true),out=merge(f.root,f.base,f.left,f.right,f.now);
 a.deepEqual(out.cases[f.id],{...f.right.cases[f.id],review:f.left.cases[f.id].review,lastAttempt:f.left.cases[f.id].lastAttempt});a.equal(out.cases[f.id].canonicalCompletion,false);a.deepEqual(out.counts,{NO_LONGER_OPEN:1});a.deepEqual(out.dispatch,f.left.dispatch);a.deepEqual(merge(f.root,f.base,f.right,f.left,f.now),out);
});
for(const [name,mutate]of [
 ['missing attempt checkpoint',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].lastAttempt.proof))],
 ['missing attempt start',f=>fs.unlinkSync(path.join(f.root,'receipts/AI_EXCEPTION_RUNS/'+f.rec.runId+'_START.json'))],
 ['wrong attempt source binding',f=>f.left.cases[f.id].lastAttempt.sourceVersion='wrong'],
 ['forged attempt projection',f=>f.left.cases[f.id].lastAttempt.evidenceSha256='f'.repeat(64)],
 ['missing immutable review',f=>fs.unlinkSync(path.join(f.root,f.left.cases[f.id].review.proof))],
 ['still observed',f=>{f.report.aiExceptions=[f.entry];S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['unknown served change',f=>f.left.cases[f.id].unknown=true],
 ['unknown closure change',f=>f.right.cases[f.id].unknown=true],
 ['later review and attempt',f=>{f.right.at=new Date(Date.parse(f.rec.reviewedAt)-1).toISOString();f.right.cases[f.id].closedAt=f.right.at;f.report.at=f.right.at;S.save(f.root,'state/PROGRAMMED_COORDINATOR_REPORT.json',f.report);}],
 ['attempt after closure despite earlier review',f=>{
  const c=f.left.cases[f.id],ref=c.lastAttempt,receipt=S.read(f.root,ref.proof),observedAt=new Date(f.now-500).toISOString();receipt.attempts[0].observedAt=observedAt;receipt.completedAt=observedAt;c.lastAttempt.observedAt=observedAt;S.save(f.root,ref.proof,receipt);delete f.left.dispatch;
 }],
 ['prior attempt history regression',f=>{f.base.cases[f.id].lastAttempt=clone(f.left.cases[f.id].lastAttempt);f.base.cases[f.id].lastAttempt.observedAt=new Date(f.now).toISOString();f.right.cases[f.id].lastAttempt=clone(f.base.cases[f.id].lastAttempt);}],
 ['old attempt deletion',f=>{f.base.cases[f.id].lastAttempt=clone(f.left.cases[f.id].lastAttempt);delete f.right.cases[f.id].lastAttempt;}]
])test('combined closure history rejects '+name,t=>{const f=closureReviewFixture(t,true);mutate(f);a.throws(()=>merge(f.root,f.base,f.left,f.right,f.now));});
test('real rebase publishes combined review and attempt without altering pending Writer evidence',t=>{
 const f=repositories(t,t=>closureReviewFixture(t,true)),pending='receipts/FORGE-CODE-CHATGPT-COMBINED_CHECKPOINT.json',original={requestId:'UNRELATED',status:'POST_IN_FLIGHT_UNKNOWN',payloadSha256:'f'.repeat(64)};
 S.save(f.local,W.FILE,f.right);S.save(f.local,guard,{schema:'forge.relevance-guard.v1',at:f.right.at,policy:'same',disabledRules:[]});S.save(f.local,pending,original);
 for(const file of ['state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json'])S.save(f.local,file,S.read(f.root,file));
 fs.cpSync(path.join(f.root,'receipts'),path.join(f.bot,'receipts'),{recursive:true});S.save(f.bot,W.FILE,f.left);S.save(f.bot,guard,{schema:'forge.relevance-guard.v1',at:new Date(f.now).toISOString(),policy:'same',disabledRules:[]});commit(f.bot);git(f.bot,'push','origin','main');publish(f.local);
 const out=JSON.parse(git(f.local,'show','origin/main:'+W.FILE));a.deepEqual(out.cases[f.id],{...f.right.cases[f.id],review:f.left.cases[f.id].review,lastAttempt:f.left.cases[f.id].lastAttempt});a.deepEqual(JSON.parse(git(f.local,'show','origin/main:'+pending)),original);a.equal(git(f.local,'status','--porcelain'),'');
});
