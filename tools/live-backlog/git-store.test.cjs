'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {GitStore}=require('./git-store.cjs'),M=require('./model.cjs'),H=require('./hold-reason.cjs'),W=require('../pipeline-observability/waiting-queues'),U=require('../pipeline-observability/upstream-flow');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'worksheet-batch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const write=(file,body)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),body);};
 git(['init','-b','main']);git(['config','core.autocrlf','false']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
 return{root,git,write,commit(){git(['add','.']);git(['commit','-m','fixture']);return git(['rev-parse','HEAD']).trim();}};
}
test('one batch preserves UTF-8 bytes, skips missing files, deduplicates and stays on the requested revision',t=>{
 const f=fixture(t),first='{"reason":"café 🧭\\nline"}\r\n',second='{"reason":"next"}\n';
 f.write('receipts/first.json',first);f.write('state/second.json',second);const revision=f.commit();f.write('receipts/first.json','{"reason":"new revision"}\n');const current=f.commit();
 const store=new GitStore({root:f.root}),calls=[],git=store.git.bind(store);store.git=(args,...rest)=>{calls.push(args);return git(args,...rest);};
 const paths=['receipts/first.json','state/missing.json','state/second.json','receipts/first.json'],out=store.readMany(revision,paths);
 a.equal(out.get(paths[0]),first);a.equal(out.get(paths[2]),second);a.equal(out.has(paths[1]),false);a.equal(out.size,2);a.deepEqual(calls,[['cat-file','--batch']]);a.equal(f.git(['rev-parse','HEAD']).trim(),current);a.equal(f.git(['status','--porcelain']).trim(),'');
 calls.length=0;a.equal(store.readMany(revision,[]).size,0);a.equal(calls.length,0);
});
test('batch validates all paths and the revision before starting Git',()=>{
 const store=Object.create(GitStore.prototype);store.git=()=>{throw Error('Must not run Git');};const revision='a'.repeat(40);
 for(const file of ['receipts/../secret.json','../state/x.json','state/x.json\nHEAD:secret.json','state/x.txt','tools/x.json',null,{}])a.throws(()=>store.readMany(revision,['state/valid.json',file]),/INVALID_SOURCE_PATH/);
 for(const rev of ['HEAD',revision+'\n','a'.repeat(39)])a.throws(()=>store.readMany(rev,[]),/INVALID_SOURCE_PATH/);
 a.throws(()=>store.readMany(revision,null),/INVALID_SOURCE_PATH/);
});
test('batch rejects malformed framing, wrong object types, truncation and trailing data',()=>{
 const store=Object.create(GitStore.prototype),revision='a'.repeat(40),header='b'.repeat(40);
 for(const raw of ['no newline',header+' tree 2\n{}\n',header+' blob 99\n{}\n',header+' blob 2\n{}X',header+' blob 2\n{}\nextra',header+' blob 9007199254740993\n',revision+':state/other.json missing\n']){
  store.git=()=>Buffer.from(raw);a.throws(()=>store.readMany(revision,['state/a.json']),/INVALID_GIT_BATCH/);
 }
});
test('snapshot batches reviews at the fetched revision and retains source-bound validation',t=>{
 const f=fixture(t),at='2026-11-07T05:00:00.000Z',url='https://example.test/job/1',key=U.key(url),sourceVersion='a'.repeat(64),taskKey='FORGE_INTAKE_HELD_RECONCILIATION';
 const entries={[key]:{key,company:'Example',title:'Manager',location:'TX',sourceUrl:url,status:'HELD'}},ledger={schema:'forge.upstream-ledger.v1',at,entries,groups:M.regroup(entries)},summary={schema:'forge.upstream-flow.v1',at,waiting:1,reconciled:true,counts:{HELD:1}},built=W.build({states:{},queues:{enrichment:0,readyForReview:0}},{ledger,summary},at);
 const review={schema:'forge.intake-drain-review.v1',key,sourceVersion,taskKey,provider:'ChatGPT',writerSubmitted:false,outcome:'RECONCILIATION_REQUIRED',observedAt:at,reason:'Exact original worksite unresolved.',nextAction:'Recover exact original result.',attempts:[{action:'Inspect',result:'Unresolved'}]},hash=M.sha(review),reviewPath='receipts/INTAKE_DRAIN/'+hash+'.json';
 const drain={schema:'forge.intake-drain.v1',at,upstreamAt:at,items:{[key]:{key,aliases:[key],card:{company:'Example',title:'Manager',location:'TX',url},upstreamStatus:'HELD',sourceVersion,taskKey,status:'WAITING_EVIDENCE_CHANGE',review:{path:reviewPath,sha256:hash,observedAt:at,outcome:review.outcome}}}};
 for(const [file,data]of [['state/UPSTREAM_LEDGER.json',ledger],['state/UPSTREAM_FLOW.json',summary],['state/ENRICHMENT_FLOW.json',{at,upstream:summary}],['state/PIPELINE_WAITING_QUEUES.json',built.index],['state/INTAKE_DRAIN.json',drain],[reviewPath,review]])f.write(file,JSON.stringify(data));
 for(const page of built.pages)f.write(page.path,page.body);const revision=f.commit();
 f.write(reviewPath,JSON.stringify({...review,reason:'Tampered newer content'}));const newer=f.commit();
 const store=new GitStore({root:f.root}),reads=[],batch=store.readMany.bind(store);store.fresh=()=>revision;store.readMany=(rev,files)=>{reads.push({rev,files});return batch(rev,files);};
 const snap=store.snapshot(),expected=H.savedIndex(p=>store.read(revision,p),snap.source);
 a.deepEqual(snap.holdIndex,expected);a.equal(snap.holdIndex.get(key).holdReason,review.reason);a.deepEqual(reads,[{rev:revision,files:[reviewPath]}]);
 store.fresh=()=>newer;const changed=store.snapshot();a.match(changed.holdIndex.get(key).holdReviewAvailability,/does not match/);a.notEqual(changed.holdIndex.get(key).holdReason,'Tampered newer content');a.equal(f.git(['status','--porcelain']).trim(),'');
});
test('receipt lookup batches all receipts at exactly the fetched revision',t=>{
 const f=fixture(t),first={requestId:'12345678-1234-4123-8123-123456789abc',receiptId:'a'.repeat(64),items:[]};
 for(let n=0;n<70;n++)f.write('receipts/live-backlog/'+String(n).padStart(3,'0')+'.json',JSON.stringify(n===0?first:{requestId:'other-'+n,items:[]}));
 const revision=f.commit();f.write('receipts/live-backlog/000.json',JSON.stringify({...first,requestId:'newer'}));f.commit();
 const store=new GitStore({root:f.root}),calls=[],git=store.git.bind(store);store.fresh=()=>revision;
 store.git=(args,...rest)=>{calls.push(args);return git(args,...rest);};
 a.equal(store.receipt(first.requestId).receiptId,first.receiptId);
 a.deepEqual(calls,[['ls-tree','-r','--name-only',revision,'receipts/live-backlog'],['cat-file','--batch']]);
});
