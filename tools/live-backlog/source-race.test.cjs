'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {GitStore}=require('./git-store.cjs'),M=require('./model.cjs'),W=require('../pipeline-observability/waiting-queues');
const key='url:'+'1'.repeat(24),other='url:'+'2'.repeat(24);
const requestId='12345678-1234-4123-8123-123456789abc',otherId='22345678-1234-4123-8123-123456789abc';
const at='2026-11-07T07:00:00.000Z';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'worksheet-source-race-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const work=path.join(dir,'work'),background=path.join(dir,'background'),remote=path.join(dir,'remote.git');
 const git=(args,cwd=work)=>cp.execFileSync('git',args,{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const write=(root,file,body)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),body);};
 const writeSource=(root,entries)=>{
  const groups=M.regroup(entries),counts={};for(const g of Object.values(groups))counts[g.status]=(counts[g.status]||0)+1;
  const ledger={schema:'forge.upstream-ledger.v1',at,entries,groups},summary={schema:'forge.upstream-flow.v1',at,waiting:Object.values(groups).filter(g=>M.pending.has(g.status)).length,reconciled:true,counts};
  const built=W.build({states:{},queues:{enrichment:0,readyForReview:0}},{ledger,summary},at);
  for(const [p,value]of [['state/UPSTREAM_LEDGER.json',ledger],['state/UPSTREAM_FLOW.json',summary],['state/ENRICHMENT_FLOW.json',{at,upstream:summary}],['state/PIPELINE_WAITING_QUEUES.json',built.index]])write(root,p,JSON.stringify(value));
  for(const page of built.pages)write(root,page.path,page.body);
 };
 fs.mkdirSync(work);git(['init','-b','main']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
 writeSource(work,{[key]:{key,company:'Example',title:'Manager',location:'CA',sourceUrl:'https://example.test/1',status:'WAITING',preliminaryScreen:{checkedAt:at}},[other]:{key:other,company:'Other',title:'Director',location:'WA',sourceUrl:'https://example.test/2',status:'HELD'}});
 write(work,'tools/pipeline-observability/upstream-flow.js',"require('../live-backlog/model.cjs').activeDeletion(e)");
 git(['add','.']);git(['commit','-m','fixture']);git(['clone','--bare',work,remote],dir);git(['clone',remote,background],dir);
 git(['config','user.name','Background'],background);git(['config','user.email','background@example.invalid'],background);
 const store=new GitStore({root:work,remote,allowTestRemote:true}),originalGit=store.git.bind(store),snapshot=store.snapshot(),pushes=[];
 let beforePush=()=>{},afterPush=()=>{};
 store.git=(args,...rest)=>{
  if(args[0]!=='push')return originalGit(args,...rest);
  pushes.push(args);assert.equal(args.includes('--force'),false);assert.equal(args.some(x=>x.startsWith('+')||x.startsWith('--force')),false);
  beforePush(args,pushes.length);const result=originalGit(args,...rest);afterPush(args,pushes.length);return result;
 };
 const update=change=>{
  git(['fetch','origin','main'],background);git(['reset','--hard','FETCH_HEAD'],background);
  const entries=JSON.parse(fs.readFileSync(path.join(background,'state/UPSTREAM_LEDGER.json'),'utf8')).entries;
  change(entries,background);writeSource(background,entries);git(['add','.'],background);git(['commit','--allow-empty','-m','background update'],background);git(['push','origin','main'],background);
  return git(['rev-parse','HEAD'],background).trim();
 };
 return {dir,work,background,remote,git,write,writeSource,store,snapshot,pushes,update,
  input:{revision:snapshot.revision,requestId,keys:[key]},
  beforePush(fn){beforePush=fn;},afterPush(fn){afterPush=fn;},
  remoteHead(){return git(['rev-parse','main'],remote).trim();},
  remoteSource(){const revision=this.remoteHead();return M.load(p=>git(['show',revision+':'+p],remote));},
  receipts(){const revision=this.remoteHead();return store.receiptsAt(revision);}
 };
}
function fakeFailure(args,options={}){
 const error=Error('simulated push failure');
 return Object.assign(error,{status:1,stdout:'',stderr:''},options);
}
test('checkedAt race rebuilds once from fresh main, preserves unrelated changes and commits one receipt',t=>{
 const f=fixture(t),head=f.git(['rev-parse','HEAD']),status=f.git(['status','--porcelain']);let latest;
 f.beforePush((args,n)=>{if(n===1)latest=f.update((entries,root)=>{entries[key].preliminaryScreen.checkedAt='2026-11-07T07:46:36.003Z';f.write(root,'unrelated.txt','preserve me');});});
 const result=f.store.apply(f.input,'delete');
 assert.equal(f.pushes.length,2);assert.equal(result.ok,true);assert.equal(result.selectionRevision,f.input.revision);assert.equal(result.baseRevision,latest);
 assert.equal(result.removed,1);assert.equal(f.receipts().filter(r=>r.requestId===requestId).length,1);
 assert.equal(f.remoteSource().ledger.entries[key].preliminaryScreen.checkedAt,'2026-11-07T07:46:36.003Z');
 assert.equal(f.git(['show',f.remoteHead()+':unrelated.txt'],f.remote),'preserve me');
 assert.equal(f.git(['rev-parse','HEAD']),head);assert.equal(f.git(['status','--porcelain']),status);
 assert.equal(f.store.apply(f.input,'delete').receiptId,result.receiptId);assert.equal(f.pushes.length,2);
});
test('continuous contention is bounded to three normal pushes and leaves no deletion receipt',t=>{
 const f=fixture(t);f.beforePush((args,n)=>f.update(entries=>{entries[key].preliminaryScreen.checkedAt='race-'+n;}));
 assert.throws(()=>f.store.apply(f.input,'delete'),/SOURCE_CHANGED_OR_PUSH_REJECTED/);
 assert.equal(f.pushes.length,3);assert.equal(f.store.receipt(requestId).definitive,true);assert.equal(f.receipts().length,0);
 assert.equal(f.remoteSource().items.length,2);assert.equal(f.remoteSource().ledger.entries[key].preliminaryScreen.checkedAt,'race-3');
});
for(const field of ['company','title','location','sourceUrl'])test('retry stops when selected '+field+' changes',t=>{
 const f=fixture(t);f.beforePush(()=>f.update(entries=>{entries[key][field]='Changed';}));
 assert.throws(()=>f.store.apply(f.input,'delete'),/SELECTED_ROW_CHANGED/);assert.equal(f.pushes.length,1);
 assert.equal(f.store.receipt(requestId).definitive,true);assert.equal(f.receipts().length,0);
});
test('retry stops when selected row leaves the active backlog',t=>{
 const f=fixture(t);f.beforePush(()=>f.update(entries=>{entries[key].status='PRESENT';}));
 assert.throws(()=>f.store.apply(f.input,'delete'),/SELECTED_ROW_CHANGED/);assert.equal(f.pushes.length,1);assert.equal(f.receipts().length,0);
});
test('retry stops when the repeat group changes even if the selected row is unchanged',t=>{
 const f=fixture(t);f.beforePush(()=>f.update(entries=>Object.assign(entries[other],{company:entries[key].company,title:entries[key].title,location:entries[key].location})));
 assert.throws(()=>f.store.apply(f.input,'delete'),/REPEAT_GROUP_CHANGED/);assert.equal(f.pushes.length,1);assert.equal(f.receipts().length,0);
});
test('retry revalidates snapshot hashes rather than trusting a newer revision',t=>{
 const f=fixture(t);f.beforePush(()=>{
  f.git(['fetch','origin','main'],f.background);f.git(['reset','--hard','FETCH_HEAD'],f.background);
  const index=JSON.parse(fs.readFileSync(path.join(f.background,'state/PIPELINE_WAITING_QUEUES.json'),'utf8'));
  fs.appendFileSync(path.join(f.background,index.intake.pages[0].path),' ');
  f.git(['add','.'],f.background);f.git(['commit','-m','corrupt page'],f.background);f.git(['push','origin','main'],f.background);
 });
 assert.throws(()=>f.store.apply(f.input,'delete'),/SOURCE_PAGE_HASH_MISMATCH/);assert.equal(f.pushes.length,1);
 assert.equal(f.store.receipt(requestId).definitive,true);assert.equal(f.receipts().length,0);
});
test('a remote hook rejection is definitive but never retried',t=>{
 const f=fixture(t);f.write(f.remote,'hooks/pre-receive','#!/bin/sh\necho "protected branch" >&2\nexit 1\n');fs.chmodSync(path.join(f.remote,'hooks/pre-receive'),0o755);
 assert.throws(()=>f.store.apply(f.input,'delete'),/SOURCE_CHANGED_OR_PUSH_REJECTED/);assert.equal(f.pushes.length,1);
 assert.equal(f.store.receipt(requestId).definitive,true);assert.equal(f.remoteSource().items.length,2);
});
for(const kind of ['authentication','stderr rejection text','timeout','different target','multiple statuses'])test(kind+' is not proof that a race can be retried',t=>{
 const f=fixture(t);f.beforePush(args=>{
  const commit=args.at(-1).split(':')[0],line='!\t'+commit+':refs/heads/main\t[rejected] (fetch first)\n';
  const details=kind==='authentication'?{status:128,stderr:'Authentication failed'}:
   kind==='stderr rejection text'?{stderr:'[rejected] main -> main (fetch first)'}:
   kind==='timeout'?{signal:'SIGTERM',stdout:line}:kind==='different target'?{stdout:line.replace('heads/main','heads/other')}:{stdout:line+line};
  throw fakeFailure(args,details);
 });
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED_CHECK_RECEIPT/);assert.equal(f.pushes.length,1);
 assert.equal(f.store.receipt(requestId).status,'unknown');
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED_CHECK_RECEIPT/);assert.equal(f.pushes.length,1,'duplicate HTTP input cannot replay an uncertain attempt');
});
test('receipt lookup failure after rejection keeps the outcome unknown and does not retry',t=>{
 const f=fixture(t),fresh=f.store.fresh.bind(f.store);let failRead=false;
 f.store.fresh=()=>{if(failRead)throw Error('read unavailable');return fresh();};
 f.beforePush(()=>{f.update(entries=>{entries[key].preliminaryScreen.checkedAt='new';});failRead=true;});
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED_CHECK_RECEIPT/);assert.equal(f.pushes.length,1);
 failRead=false;assert.equal(f.store.receipt(requestId).status,'unknown');
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED_CHECK_RECEIPT/);assert.equal(f.pushes.length,1);
});
test('an accepted push with a lost response returns the committed receipt without another push',t=>{
 const f=fixture(t);f.afterPush(()=>{throw fakeFailure([],{status:128,stderr:'connection lost'});});
 const result=f.store.apply(f.input,'delete');assert.equal(result.ok,true);assert.equal(f.pushes.length,1);
 assert.equal(f.receipts().filter(r=>r.requestId===requestId).length,1);assert.equal(f.remoteSource().items.length,1);
});
test('a successful push followed by failed readback is reconciled without replay',t=>{
 const f=fixture(t),fresh=f.store.fresh.bind(f.store);let failRead=false;
 f.store.fresh=()=>{if(failRead)throw Error('read unavailable');return fresh();};f.afterPush(()=>{failRead=true;});
 assert.throws(()=>f.store.apply(f.input,'delete'),/COMMIT_READBACK_UNCONFIRMED/);assert.equal(f.pushes.length,1);
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED/);assert.equal(f.pushes.length,1);
 failRead=false;assert.equal(f.store.apply(f.input,'delete').ok,true);assert.equal(f.pushes.length,1);assert.equal(f.receipts().length,1);
});
test('another process committing the same request is read back, never rebuilt',t=>{
 const f=fixture(t),second=new GitStore({root:f.background,remote:f.remote,allowTestRemote:true});
 f.beforePush(()=>{second.apply(f.input,'delete');});
 assert.equal(f.store.apply(f.input,'delete').ok,true);assert.equal(f.pushes.length,1);assert.equal(f.receipts().length,1);
});
test('a concurrent receipt with the same ID but different selection is not accepted',t=>{
 const f=fixture(t),second=new GitStore({root:f.background,remote:f.remote,allowTestRemote:true});
 f.beforePush(()=>{second.apply({...f.input,keys:[other]},'delete');});
 assert.throws(()=>f.store.apply(f.input,'delete'),/REQUEST_ID_REUSED_FOR_DIFFERENT_EDIT/);assert.equal(f.pushes.length,1);
 assert.equal(f.remoteSource().items.some(x=>x.key===key),true);assert.equal(f.receipts().length,1);
});
test('restore rebuilds after a proven race and preserves newer metadata',t=>{
 const f=fixture(t),deleted=f.store.apply(f.input,'delete');let latest;
 f.beforePush((args,n)=>{if(n===2)latest=f.update(entries=>{entries[key].preliminaryScreen.checkedAt='newer';});});
 const result=f.store.apply({revision:deleted.revision,requestId:otherId,receiptId:deleted.receiptId},'restore');
 assert.equal(f.pushes.length,3);assert.equal(result.restored,1);assert.equal(result.baseRevision,latest);
 assert.equal(f.remoteSource().items.length,2);assert.equal(f.remoteSource().ledger.entries[key].preliminaryScreen.checkedAt,'newer');
 assert.equal(f.receipts().filter(r=>r.requestId===otherId).length,1);
});
test('restore stops if another operation already restored the original deletion',t=>{
 const f=fixture(t),deleted=f.store.apply(f.input,'delete'),second=new GitStore({root:f.background,remote:f.remote,allowTestRemote:true});
 f.beforePush(()=>second.apply({revision:deleted.revision,requestId:'32345678-1234-4123-8123-123456789abc',receiptId:deleted.receiptId},'restore'));
 assert.throws(()=>f.store.apply({revision:deleted.revision,requestId:otherId,receiptId:deleted.receiptId},'restore'),/ROW_CHANGED_OR_ALREADY_RESTORED/);
 assert.equal(f.pushes.length,2);assert.equal(f.receipts().filter(r=>r.requestId===otherId).length,0);
});
test('a rejected push with no observed main advance is not retried',t=>{
 const f=fixture(t);f.beforePush(args=>{const commit=args.at(-1).split(':')[0];throw fakeFailure(args,{stdout:'!\t'+commit+':refs/heads/main\t[rejected] (non-fast-forward)\n'});});
 assert.throws(()=>f.store.apply(f.input,'delete'),/SOURCE_CHANGED_OR_PUSH_REJECTED/);assert.equal(f.pushes.length,1);assert.equal(f.store.receipt(requestId).definitive,true);
});
test('rewritten remote history cannot be fetched safely and is not retried',t=>{
 const f=fixture(t);f.beforePush(()=>{
  const tree=f.git(['rev-parse',f.input.revision+'^{tree}']).trim();
  const unrelated=f.git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,'-m','unrelated replacement'],f.remote).trim();
  f.git(['update-ref','refs/heads/main',unrelated],f.remote);
 });
 assert.throws(()=>f.store.apply(f.input,'delete'),/PUSH_NOT_CONFIRMED_CHECK_RECEIPT/);assert.equal(f.pushes.length,1);assert.equal(f.receipts().length,0);
});

test('restore retry honors a newer underlying tombstone classification',t=>{
 const f=fixture(t),deleted=f.store.apply(f.input,'delete');
 f.beforePush((args,n)=>{if(n===2)f.update(entries=>{entries[key].worksheetDeletion.currentStatus='PRESENT';});});
 const result=f.store.apply({revision:deleted.revision,requestId:otherId,receiptId:deleted.receiptId},'restore');
 assert.equal(f.pushes.length,3);assert.equal(result.restored,0);
 assert.equal(f.remoteSource().ledger.entries[key].status,'PRESENT');assert.equal(f.remoteSource().items.some(x=>x.key===key),false);
 assert.equal(M.activeDeletion(f.remoteSource().ledger.entries[key]),false);
});

for(const change of ['identity','repeat group'])test('second rejection rechecks original selection after a safe first rebuild: '+change,t=>{
 const f=fixture(t);f.beforePush((args,n)=>f.update(entries=>{
  if(n===1)entries[key].preliminaryScreen.checkedAt='newer';
  else if(change==='identity')entries[key].title='Different job';
  else Object.assign(entries[other],{company:entries[key].company,title:entries[key].title,location:entries[key].location});
 }));
 assert.throws(()=>f.store.apply(f.input,'delete'),change==='identity'?/SELECTED_ROW_CHANGED/:/REPEAT_GROUP_CHANGED/);
 assert.equal(f.pushes.length,2);assert.equal(f.receipts().length,0);assert.equal(f.store.receipt(requestId).definitive,true);
});
test('two safe rebuilds retain the original selection and produce only one effect',t=>{
 const f=fixture(t);let latest;f.beforePush((args,n)=>{if(n<3)latest=f.update(entries=>{entries[key].preliminaryScreen.checkedAt='newer-'+n;});});
 const result=f.store.apply(f.input,'delete');assert.equal(f.pushes.length,3);assert.equal(result.selectionRevision,f.input.revision);assert.equal(result.baseRevision,latest);
 assert.equal(f.receipts().length,1);assert.equal(f.remoteSource().items.length,1);
});
