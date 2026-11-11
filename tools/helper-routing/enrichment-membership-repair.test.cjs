'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('./enrichment-membership-repair.cjs'),E=require('./enrichment.cjs'),S=require('../programmed-coordinator/store.cjs');
function fixture(){
 const items=R.IDS.map((primaryId,index)=>({primaryId,provider:'ChatGPT',owner:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',status:'ASSIGNED',company:'Example '+index,title:'Manufacturing Director',location:'Town, ST',missingFields:['SALARY'],sourceUrls:['https://example.com/job/'+index],priorAttempts:[],canonicalObservedAt:'2026-11-10T21:39:04.816Z',rowSha256:'a'.repeat(64),sourceReport:'CANONICAL_WRITER_MASTER',researchProvenance:{schema:'forge.enrichment-research-provenance.v1',canonicalSourceSha256:'b'.repeat(64),recoveryRun:null,sourceFingerprint:'c'.repeat(64),retryAt:null}}));
 const protectedItems=['PROTECTED_SKIP','CONSUMED','RETURNED_PENDING_REVIEW','RETURNED_PARTIALLY_CONSUMED','ALREADY_COMPLETE'].map((status,n)=>({primaryId:'V2I-OTHER'+n,owner:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',status,requestId:'original-'+n,unknownFuture:{preserve:true},coordinatorConsumption:{proof:'old-proof'}}));
 return {schema:'forge.enrichment-helper-work.v1',assignmentId:'GROK-ENRICH-20261101-V1',provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',enabled:true,routingActive:true,unknownRoot:{preserve:'all'},items:[...protectedItems,...items,...items.map(i=>({...i,canonicalObservedAt:'2026-11-10T21:41:34.612Z'}))]};
}
function prepared(work=fixture()){const raw=JSON.stringify(work,null,2)+'\n';return {raw,expectedBlobSha:R.blob(raw)};}
function temporary(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-membership-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('pure repair preserves all other membership, original states and both duplicate observations',()=>{
 const original=fixture(),before=structuredClone(original),p=R.plan(...(()=>{const x=prepared(original);return[x.raw,x];})());
 a.deepEqual(original,before);a.equal(p.beforeEntries,13);a.equal(p.afterEntries,9);a.equal(p.uniqueIds,9);
 a.deepEqual(p.work,{...original,items:original.items.slice(0,9)});a.deepEqual(p.observations.map(o=>o.removed),original.items.slice(9));
 a.deepEqual(p.observations.map(o=>o.kept),original.items.slice(5,9));E.validateWork(p.work);a.deepEqual(E.researchIds(p.work),new Set());
 a.equal(p.canonicalWrites,0);a.equal(p.writerSubmissions,0);a.equal(p.canonicalCompletion,false);a.equal(R.blob(p.output),p.afterBlobSha);
 a.throws(()=>E.validateWork(original),/overlapping/);a.throws(()=>R.plan(p.output,{expectedBlobSha:p.afterBlobSha}),/EXACT_FOUR/);
});
test('requires the concrete current content blob and known ownership',()=>{
 const x=prepared();for(const expectedBlobSha of [null,'a'.repeat(40),'not-a-sha'])a.throws(()=>R.plan(x.raw,{expectedBlobSha}),/EXACT_MEMBERSHIP_BLOB/);
 for(const update of [w=>w.provider='Grok',w=>w.enabled=false,w=>w.routingActive=false,w=>w.assignmentId='different']){const w=fixture();update(w);const p=prepared(w);a.throws(()=>R.plan(p.raw,p),/CURRENT_CHATGPT/);}
});
test('all semantic disagreement, unknown duplicate fields, pending work and protected duplicates stay untouched',()=>{
 const changes=[i=>i.company='other',i=>i.rowSha256='f'.repeat(64),i=>i.status='PROTECTED_SKIP',i=>i.status='RETURNED_PENDING_REVIEW',i=>i.priorAttempts.push({requestId:'unknown'}),i=>i.pendingOriginal=true,i=>i.missingFields.push('DEGREE'),i=>i.canonicalObservedAt='bad',i=>i.researchProvenance.retryAt='2026-11-12T00:00:00Z',i=>i.researchProvenance.unknown='preserve'];
 for(const change of changes){const w=fixture();change(w.items.at(-1));const p=prepared(w),before=p.raw;a.throws(()=>R.plan(p.raw,p),/UNSUPPORTED|DIVERGENT/);a.equal(p.raw,before);}
 const unknownBoth=fixture();unknownBoth.items[5].unknown=unknownBoth.items[9].unknown='even equal';let p=prepared(unknownBoth);a.throws(()=>R.plan(p.raw,p),/UNSUPPORTED/);
 for(const change of [w=>w.items.pop(),w=>w.items.push(structuredClone(w.items.at(-1))),w=>w.items.push({...w.items[5],primaryId:'V2I-OTHER0'})]){const w=fixture();change(w);p=prepared(w);a.throws(()=>R.plan(p.raw,p),/EXACT_/);}
});
test('write is opt-in, lock-checked, hash-bound, audited before mutation and leaves unrelated files intact',t=>{
 const root=temporary(t),work=fixture(),x=prepared(work),runId='FORGE-MEMBERSHIP-CHATGPT-TEST';S.save(root,R.FILE,work);
 S.save(root,'state/PROGRAMMED_COORDINATOR.json',{transactions:{UNKNOWN:{status:'POST_IN_FLIGHT'}}});S.save(root,'control/SHARED_HELPER_WORK.json',{grokCohort:322});
 const untouched=['state/PROGRAMMED_COORDINATOR.json','control/SHARED_HELPER_WORK.json'].map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]);
 a.throws(()=>R.writeRepair(root,{...x,runId}),/LOCK_AND_RUN/);let checks=0;
 const result=R.writeRepair(root,{...x,runId,checkLock(){checks++;}});a.equal(checks,3);a.equal(result.published,false);a.equal(result.afterEntries,9);
 const audit=S.read(root,result.auditFile);a.equal(audit.beforeBlobSha,x.expectedBlobSha);a.deepEqual(audit.observations.map(o=>o.removed),work.items.slice(9));
 a.equal(R.blob(fs.readFileSync(path.join(root,R.FILE))),result.afterBlobSha);for(const[f,raw]of untouched)a.equal(fs.readFileSync(path.join(root,f),'utf8'),raw);
 a.throws(()=>R.writeRepair(root,{...x,runId,checkLock(){}}),/EXACT_MEMBERSHIP_BLOB/);
});
test('lock loss and concurrent file changes never overwrite evidence',t=>{
 for(const at of [1,2,3]){const root=temporary(t),x=prepared(),work=fixture();S.save(root,R.FILE,work);let n=0;
  a.throws(()=>R.writeRepair(root,{...x,runId:'FORGE-MEMBERSHIP-CHATGPT-LOCK',checkLock(){if(++n===at)throw Error('LOCK_LOST');}}),/LOCK_LOST/);a.equal(fs.readFileSync(path.join(root,R.FILE),'utf8'),x.raw);
 }
 for(const at of [2,3]){const root=temporary(t),x=prepared();S.save(root,R.FILE,fixture());let n=0;const changed={...fixture(),anotherObservation:true};
  a.throws(()=>R.writeRepair(root,{...x,runId:'FORGE-MEMBERSHIP-CHATGPT-RACE',checkLock(){if(++n===at)S.save(root,R.FILE,changed);}}),/MEMBERSHIP_CHANGED_REPLAN/);a.deepEqual(S.read(root,R.FILE),changed);
 }
});
test('immutable audit collision cannot overwrite the original membership',t=>{
 const root=temporary(t),x=prepared(),runId='FORGE-MEMBERSHIP-CHATGPT-COLLISION';S.save(root,R.FILE,fixture());S.save(root,R.AUDITS+'/'+runId+'.json',{original:'preserve'});
 a.throws(()=>R.writeRepair(root,{...x,runId,checkLock(){}}),/Immutable evidence collision/);a.equal(fs.readFileSync(path.join(root,R.FILE),'utf8'),x.raw);
});
module.exports={fixture,prepared};

function applyHarness(t,{publishError,retainedError,saveError}={}){
 const root=temporary(t),lockFile=path.join(root,'shared.lock'),events=[],x=prepared();S.save(root,R.FILE,fixture());fs.mkdirSync(path.join(root,'policy/current'),{recursive:true});fs.writeFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'automation-run-lock.cjs acquire '+lockFile+' <unique-RUN_ID>');
 const realLock=require('../automation-run-lock.cjs'),module={exports:{}},source=fs.readFileSync(__filename.replace('.test.cjs','.cjs'),'utf8');
 const customRequire=name=>{
  if(name==='node:child_process')return{execFileSync(command,args){if(args[0]==='rev-parse'||args[0]==='ls-remote')return'a'.repeat(40);if(args[0]==='status')return'';throw Error('Unexpected Git '+args);}};
  if(name==='../automation-run-lock.cjs')return{lock(...args){events.push(args[1]);return realLock.lock(...args);}};
  if(name==='../programmed-coordinator/publish.cjs')return{retainedSafe(){if(retainedError)throw Error(retainedError);},publish(){if(publishError)throw Error(publishError);return{published:true,commit:'a'.repeat(40)};}};
  if(name==='../programmed-coordinator/store.cjs'&&saveError)return{...S,save(){throw Error(saveError);}};
  return require(name);
 };
 require('node:vm').runInNewContext(source,{require:customRequire,module,exports:module.exports,__dirname:path.join(root,'tools/helper-routing'),process,Buffer,structuredClone});
 return {root,lockFile,events,x,apply:()=>module.exports.apply(root,{...x,runId:'FORGE-MEMBERSHIP-CHATGPT-APPLY',lockFile})};
}
for(const [stage,options]of [['save',{saveError:'SAVE_FAILED'}],['publication',{publishError:'PUSH_FAILED'}]])test('apply keeps the shared lock and immutable observations after '+stage+' uncertainty',t=>{
 const h=applyHarness(t,options);a.throws(h.apply,/preserve checkout and shared lock/);a.equal(fs.existsSync(h.lockFile),true);a.equal(h.events.includes('release'),false);
 const audit=S.read(h.root,R.AUDITS+'/FORGE-MEMBERSHIP-CHATGPT-APPLY.json');a.equal(audit.observations.length,4);a.equal(audit.canonicalWrites,0);
});
test('apply releases only after confirmed publication, or before any mutation',t=>{
 const success=applyHarness(t);a.equal(success.apply().published,true);a.equal(fs.existsSync(success.lockFile),false);a.equal(success.events.at(-1),'release');
 const blocked=applyHarness(t,{retainedError:'OLD_RETAINED_COMMIT'});a.throws(blocked.apply,/OLD_RETAINED_COMMIT/);a.equal(fs.existsSync(blocked.lockFile),false);a.equal(fs.readFileSync(path.join(blocked.root,R.FILE),'utf8'),blocked.x.raw);a.equal(fs.existsSync(path.join(blocked.root,R.AUDITS)),false);
});

test('approved Git blob and audit bytes survive a real CRLF-configured checkout',t=>{
 const root=temporary(t),cp=require('node:child_process'),g=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 g('init');g('config','user.name','Test');g('config','user.email','test@example.invalid');g('config','core.autocrlf','true');g('config','core.eol','crlf');
 fs.copyFileSync(path.resolve(__dirname,'../../.gitattributes'),path.join(root,'.gitattributes'));S.save(root,R.FILE,fixture());
 const auditFile=R.AUDITS+'/FORGE-MEMBERSHIP-CHATGPT-CRLF.json';S.immutable(root,auditFile,{observations:[],canonicalWrites:0});
 const before=new Map([R.FILE,auditFile].map(f=>[f,fs.readFileSync(path.join(root,f))]));g('add','.');g('commit','-m','LF-bound inputs');
 for(const file of before.keys())fs.unlinkSync(path.join(root,file));g('checkout','--',...before.keys());
 for(const[file,raw]of before){a.deepEqual(fs.readFileSync(path.join(root,file)),raw);a.equal(R.blob(raw),g('rev-parse','HEAD:'+file));}
 const planned=R.plan(fs.readFileSync(path.join(root,R.FILE),'utf8'),{expectedBlobSha:g('rev-parse','HEAD:'+R.FILE)});a.equal(planned.afterEntries,9);
});
