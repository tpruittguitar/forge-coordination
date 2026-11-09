'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),P=require('./shared-pages.cjs'),H=require('./shared.cjs'),S=require('../programmed-coordinator/store.cjs');
const now=Date.parse('2026-11-09T12:00:00Z'),tasks=Object.keys(H.TASKS),taskKey=tasks[0];
function work(count=298){return{schema:'forge.shared-helper-work.v1',assignmentId:'shared-test',at:new Date(now).toISOString(),enabled:true,routingActive:true,providers:Object.fromEntries(tasks.map(t=>[t,{provider:H.TASKS[t],available:true}])),items:tasks.flatMap(t=>Array.from({length:count},(_,n)=>({key:t+'-'+n,kind:'INTAKE',lane:n%2?'INTAKE':'DISCOVERY',provider:H.TASKS[t],taskKey:t,assignmentVersion:2,sourceVersion:S.hash(n),status:'ASSIGNED',company:'Company',title:'Title',location:'Remote',sourceUrls:['https://example.com/jobs/'+n],missingFields:['LINKS']})))};}
const bytes=w=>JSON.stringify(w,null,2)+'\n';
function fixture(t,w=work()){const root=fs.mkdtempSync(path.join(os.tmpdir(),'shared-pages-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));S.save(root,H.FILE,w);return root;}
test('both 298-item providers paginate identically to H.next, preserve research fields, no run cap',()=>{
 const w=work(),b=bytes(w),r=P.build(b,{now});a.deepEqual(r,P.build(b,{now}));
 a.equal(r.source.gitBlobSha,cp.execFileSync('git',['hash-object','--stdin'],{input:b,encoding:'utf8'}).trim());
 for(const t of tasks){const index=r.indexes[P.indexPath(t)];a.equal(index.pages.length,15);a.equal(index.total,298);a.equal(index.runItemCap,null);let after=null;const seen=[];
 for(let n=0;n<index.pages.length;n++){const page=P.validatePage(index,bytes(r.files[index.pages[n].file]),n+1,{taskKey:t,workBlobSha:r.source.gitBlobSha,now}),next=H.next(w,t,after,now);a.deepEqual(page.items,next.items);a.deepEqual(page.backlogCounts,next.backlogCounts);seen.push(...page.items.map(H.key));after=next.nextAfter;}
 a.equal(new Set(seen).size,298);a.ok(seen.every(k=>k.startsWith(t)));}
});
test('closed, returned, consumed, invalid/future retries, unavailable and disabled routing match live selector',()=>{
 const w=work(8);['CONSUMED','RETURNED_PENDING_REVIEW','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE'].forEach((s,n)=>w.items[n].status=s);w.items[5].retryAfter='2026-11-10T00:00:00Z';w.items[6].retryAfter='invalid';w.providers[tasks[1]].available=false;
 const r=P.build(bytes(w),{now}),index=r.indexes[P.indexPath(taskKey)];a.equal(index.total,1);a.equal(index.validUntil,w.items[5].retryAfter.replace('Z','.000Z'));a.equal(r.indexes[P.indexPath(tasks[1])].total,0);
 a.throws(()=>P.validateIndex(index,{taskKey,workBlobSha:r.source.gitBlobSha,now:Date.parse(index.validUntil)}),/STALE/);
 w.routingActive=false;a.equal(P.build(bytes(w),{now}).indexes[P.indexPath(taskKey)].total,0);
});
test('exact byte bindings, stale source, tampered/missing page and incomplete index fail closed',t=>{
 const root=fixture(t);P.generate(root,{now,checkLock(){}});a.equal(P.validateStored(root,{now}).valid,true);
 const index=S.read(root,P.indexPath(taskKey)),file=index.pages[0].file,original=fs.readFileSync(path.join(root,file));
 a.throws(()=>P.validateIndex(index,{taskKey,workBlobSha:'a'.repeat(40),now}),/STALE/);
 a.throws(()=>P.validateIndex(index,{taskKey:tasks[1],workBlobSha:index.source.gitBlobSha,now}),/STALE/);
 fs.appendFileSync(path.join(root,file),' ');a.throws(()=>P.validateStored(root,{now}),/TAMPERED/);fs.writeFileSync(path.join(root,file),original);
 fs.unlinkSync(path.join(root,file));a.throws(()=>P.validateStored(root,{now}),/ENOENT/);fs.writeFileSync(path.join(root,file),original);
 fs.appendFileSync(path.join(root,H.FILE),' ');a.throws(()=>P.validateStored(root,{now}),/STALE/);
 P.generate(root,{now,checkLock(){}});a.equal(P.validateStored(root,{now}).valid,true);
 fs.unlinkSync(path.join(root,P.indexPath(tasks[1])));a.throws(()=>P.validateStored(root,{now}),/MISSING/);
});
test('regeneration is deterministic, indexes switch after pages, previous pages remain immutable evidence',t=>{
 const root=fixture(t,work(21)),first=P.generate(root,{now,checkLock(){}}),old=S.read(root,P.indexPath(taskKey)),oldBytes=fs.readFileSync(path.join(root,old.pages[0].file));
 a.deepEqual(P.generate(root,{now,checkLock(){}}),first);const w=S.read(root,H.FILE);w.items[0].status='RETURNED_PENDING_REVIEW';S.save(root,H.FILE,w);P.generate(root,{now,checkLock(){}});
 const index=S.read(root,P.indexPath(taskKey));a.equal(index.total,20);a.notEqual(index.source.gitBlobSha,old.source.gitBlobSha);a.deepEqual(fs.readFileSync(path.join(root,old.pages[0].file)),oldBytes);a.equal(P.validateStored(root,{now}).valid,true);
 a.throws(()=>P.generate(root,{now}),/LOCK/);
});
test('source changes during generation cannot publish a current index',t=>{const root=fixture(t,work(1));let calls=0;a.throws(()=>P.generate(root,{now,checkLock(){if(++calls===4)fs.appendFileSync(path.join(root,H.FILE),' ');}}),/STALE/);a.equal(fs.existsSync(path.join(root,P.indexPath(taskKey))),false);});
test('narrow publication classification rejects arbitrary mutable/provider/path names',()=>{
 const {allowed}=require('../programmed-coordinator/publish.cjs');a.equal(allowed(P.indexPath(taskKey)),true);a.equal(allowed(`${P.BASE}/${taskKey}/${'a'.repeat(64)}.json`),true);
 for(const f of [`${P.BASE}/OTHER/current.json`,`${P.BASE}/${taskKey}/history.json`,`${P.BASE}/${taskKey}/../current.json`,`${P.BASE}/${taskKey}/${'a'.repeat(40)}.json`])a.equal(allowed(f),false);
});
test('unchanged source reuses current pages despite later clock; expired pages block readers but not accounting checks',t=>{
 const w=work(2);w.items[0].retryAfter=new Date(now+10000).toISOString();const root=fixture(t,w);P.generate(root,{now,checkLock(){}});const before=fs.readFileSync(path.join(root,P.indexPath(taskKey)));
 P.generate(root,{now:now+1000,checkLock(){}});a.deepEqual(fs.readFileSync(path.join(root,P.indexPath(taskKey))),before);
 a.throws(()=>P.validateStored(root,{now:now+10000}),/STALE/);a.equal(P.validateStored(root,{now:now+10000,allowExpired:true}).valid,true);
 P.generate(root,{now:now+10000,checkLock(){}});a.equal(S.read(root,P.indexPath(taskKey)).total,2);a.equal(P.validateStored(root,{now:now+10000}).valid,true);
});
test('ownership/source version changes replace indexes without leaking transferred work to old provider',t=>{
 const w=work(1),root=fixture(t,w);P.generate(root,{now,checkLock(){}});const before=S.read(root,P.indexPath(taskKey));
 H.transfer(w,w.items[0].key,tasks[1],{checkpoint:'confirmed-terminal',terminalRun:true,reason:'explicit coordinator handoff'});w.items[0].sourceVersion='new-source';S.save(root,H.FILE,w);
 a.throws(()=>P.validateStored(root,{now}),/STALE/);P.generate(root,{now,checkLock(){}});const left=S.read(root,P.indexPath(taskKey)),right=S.read(root,P.indexPath(tasks[1]));a.equal(left.total,0);a.equal(right.total,2);a.notEqual(left.source.gitBlobSha,before.source.gitBlobSha);
 const item=S.read(root,right.pages[0].file).items.find(i=>i.key===w.items[0].key);a.equal(item.assignmentVersion,3);a.equal(item.sourceVersion,'new-source');
});
