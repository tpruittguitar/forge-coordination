'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('./delivery.cjs'),S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs'),H=require('../helper-routing/shared.cjs');
const repository='tpruittguitar/forge-coordination',base='a'.repeat(40),head='b'.repeat(40);
function fixture(t,provider='Grok'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-branch-delivery-')),privateDir=path.join(root,'private');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const owner=provider.toUpperCase(),taskKey='FORGE_'+owner+'_SHARED_HELPER',branch={name:provider.toLowerCase()+'-shared-helper-batch-20261109-0126',commit:{sha:head}};
 const assigned={kind:'ENRICHMENT',primaryId:'V2I-ONE',provider,taskKey,assignmentVersion:1,sourceVersion:'c'.repeat(64),status:'ASSIGNED'};
 const work={schema:'forge.shared-helper-work.v1',assignmentId:'SHARED-TEST',enabled:true,routingActive:true,providers:{FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:true}},items:[assigned]};
 const batch={schema:'forge.shared-helper-batch.v1',provider,taskKey,assignmentId:work.assignmentId,runId:'FORGE-'+owner+'-TEST',instructionCommit:base,items:[{...assigned,writerSubmitted:false,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://careers.factory.com/jobs/1',observedAt:'2026-11-09T00:00:00Z',quote:'Lead manufacturing production and quality systems across the plant.',capture:{kind:'TEXT_EXTRACT',text:'Lead manufacturing production and quality systems across the plant. '+('Quality, production and people leadership. '.repeat(10))+'Résumé source.'}}}]};
 const filename='receipts/'+owner+'_HELPERS/'+taskKey+'/'+batch.runId+'.json',files=[{filename,status:'added'}],comparison={status:'ahead',ahead_by:1,total_commits:1,base_commit:{sha:base},merge_base_commit:{sha:base},commits:[{sha:head}],files};
 const registry={common:'policy/common.txt',tasks:{[taskKey]:{owner:provider,route:'utility',procedure:'lanes/shared.txt',executionMode:'EVIDENCE_ONLY',workAssignments:H.FILE}}};
 S.save(root,'control/AI_AUTOMATION_TASKS.json',registry);S.save(root,H.FILE,work);
 for(const name of ['policy/common.txt','lanes/shared.txt']){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),'Current evidence-only contract.\n');}
 const calls=[],f={root,privateDir,commit:base,branch,batch,files,comparison,filename,calls};
 f.raw=()=>JSON.stringify(f.batch,null,2).replace(/\n/g,'\r\n')+'\r\n';
 f.api={pages:async route=>{calls.push(['pages',route]);return[];},branches:async()=>[branch],compare:async(b,h)=>{calls.push(['compare',b,h]);return comparison;},contentBytes:async(file,sha)=>{calls.push(['contentBytes',file,sha]);return Buffer.from(f.raw(),'utf8');},head:async name=>{calls.push(['head',name]);return name==='main'?base:branch.commit.sha;},create:async()=>{calls.push(['create']);throw Error('UNEXPECTED_GITHUB_WRITE');}};
 f.routing=(r,b,c)=>C.routingProof(r,b,c,(_root,revision,file)=>{a.equal(revision,base);return fs.readFileSync(path.join(root,file),'utf8');});
 return f;
}
const captures=f=>S.files(path.join(f.privateDir,'helper-delivery')).map(file=>JSON.parse(fs.readFileSync(file,'utf8'))).filter(value=>value.transport==='GITHUB_BRANCH');
const inbox=f=>S.files(path.join(f.privateDir,'helper-inbox'));
test('Claude and Grok shared branches are read-only, immutable, byte-preserving deliveries without a PR or change record',async t=>{
 for(const provider of ['Claude','Grok']){
  const f=fixture(t,provider),before=f.raw(),result=await D.collect(f),r=result.results.find(x=>x.branch===f.branch.name);
  a.equal(r.status,'CAPTURED');a.equal(r.captured,1);a.equal(result.merged,0);a.equal(inbox(f).length,1);
  const capture=captures(f)[0];a.equal(capture.raw,before);a.equal(Buffer.from(capture.rawBase64,'base64').toString('utf8'),before);a.equal(capture.sha256,S.hash(Buffer.from(before)));a.equal(capture.repository,repository);a.equal(capture.branch,f.branch.name);a.equal(capture.commit,head);a.equal(capture.path,f.filename);
  a.deepEqual(f.calls.find(x=>x[0]==='compare'),['compare',base,head]);a.deepEqual(f.calls.find(x=>x[0]==='contentBytes'),['contentBytes',f.filename,head]);a.equal(f.calls.some(x=>x[0]==='create'),false);
  a.equal(Object.hasOwn(S.read(f.privateDir,path.relative(f.privateDir,inbox(f)[0])).items[0].sourceEvidence,'sourceSha256'),false);a.equal(f.raw(),before);
  await D.collect(f);a.equal(captures(f).length,1);a.equal(inbox(f).length,1);a.equal(fs.existsSync(path.join(f.root,f.filename)),false);
 }
});
test('branch listing and immutable compare are optional for existing PR-only readers',async t=>{
 const f=fixture(t);delete f.api.compare;f.api.branches=async()=>{throw Error('SHOULD_NOT_LIST');};a.deepEqual((await D.collect(f)).results,[]);
});
test('only exact allowed branch prefixes from the configured repository are considered',async t=>{
 for(const change of [f=>f.branch.name='grok-other-batch-20261109',f=>f.branch.name='x-grok-shared-helper-batch-20261109',f=>f.branch.name='grok-shared-helper-batch-',f=>f.branch.name='grok-shared-helper-batch-../other',f=>f.branch.repo={full_name:'untrusted/fork'}]){
  const f=fixture(t);change(f);a.equal((await D.harvestBranch(f)).status,'OUTSIDE_SCOPE');a.equal(f.calls.length,0);a.equal(inbox(f).length,0);
 }
});
test('wrong provider, task, run path and current registry ownership remain pending without an inbox delivery',async t=>{
 const cases=[
  [f=>f.batch.provider='Claude','HELPER_BRANCH_TASK_OR_PROVIDER_MISMATCH'],
  [f=>f.batch.taskKey='FORGE_GROK_INTAKE_HELPER','HELPER_BRANCH_TASK_OR_PROVIDER_MISMATCH'],
  [f=>f.batch.runId='FORGE-GROK-OTHER','SOURCE_RUN_PATH_MISMATCH'],
  [f=>{const r=S.read(f.root,'control/AI_AUTOMATION_TASKS.json');r.tasks[f.batch.taskKey].owner='Claude';S.save(f.root,'control/AI_AUTOMATION_TASKS.json',r);},'UNKNOWN_ENVELOPE_OR_PROVIDER'],
  [f=>f.batch.items[0].assignmentVersion=2,'STALE_OR_UNASSIGNED_SHARED_ITEM'],
  [f=>f.routing=()=>{throw Error('STALE_TASK_ROUTING');},'STALE_TASK_ROUTING']
 ];
 for(const [change,reason]of cases){const f=fixture(t);change(f);const r=await D.harvestBranch(f);a.equal(r.status,'PENDING');a.equal(r.pendingArtifacts[0].reason,reason);a.equal(inbox(f).length,0);a.equal(captures(f)[0].raw,f.raw());}
});
test('mixed code, modified or deleted receipts, wrong receipt paths and private outcome paths reject the entire branch',async t=>{
 for(const change of [f=>f.files.push({filename:'tools/arbitrary.cjs',status:'added'}),f=>f.files[0].status='modified',f=>f.files[0].status='removed',f=>f.files[0].filename=f.filename.replace('GROK_HELPERS','CLAUDE_HELPERS'),f=>f.files[0].filename=f.filename.replace('FORGE_GROK_SHARED_HELPER','FORGE_GROK_INTAKE_HELPER'),f=>f.files[0].filename='helper-outcomes/FORGE-GROK-OUTCOME.json',f=>f.files[0].filename='receipts/GROK_HELPERS/FORGE_GROK_APPLICATION_OUTCOME_HELPER/FORGE-GROK-OUTCOME.json']){
  const f=fixture(t);change(f);await a.rejects(D.harvestBranch(f),/HELPER_BRANCH_FILES_OUTSIDE_SCOPE/);a.equal(captures(f).length,0);a.equal(inbox(f).length,0);a.equal(f.calls.some(x=>x[0]==='contentBytes'),false);
 }
});
test('invalid JSON, source hashes, quoted facts and private outcomes are retained verbatim but never repaired or delivered',async t=>{
 const cases=[
  [f=>f.raw=()=>'{broken','HELPER_JSON_INVALID'],
  [f=>f.batch.items[0].sourceEvidence.sourceSha256='placeholder_hash_for_captured_bytes','SHARED_CAPTURE_HASH_MISMATCH'],
  [f=>f.batch.items[0].sourceEvidence.sourceSha256='0'.repeat(64),'SHARED_CAPTURE_HASH_MISMATCH'],
  [f=>f.batch.items[0].sourceEvidence.quote='Invented degree requirement.','SHARED_CAPTURE_QUOTE_REQUIRED'],
  [f=>f.batch.schema='forge.outcome-helper-batch.v1','PRIVATE_OUTCOME_DELIVERY_REQUIRED']
 ];
 for(const [change,reason]of cases){const f=fixture(t);change(f);const raw=f.raw(),r=await D.harvestBranch(f);a.equal(r.pendingArtifacts[0].reason,reason);a.equal(inbox(f).length,0);a.equal(captures(f)[0].raw,raw);a.equal(f.raw(),raw);}
});
test('a valid sibling can be delivered without concealing a malformed sibling',async t=>{
 const f=fixture(t),bad=f.filename.replace('TEST.json','BAD.json');f.files.push({filename:bad,status:'added'});f.api.contentBytes=async name=>Buffer.from(name===bad?'{broken':f.raw());const r=await D.harvestBranch(f);
 a.equal(r.captured,1);a.equal(r.status,'PENDING');a.deepEqual(r.pendingArtifacts.map(p=>[p.path,p.reason]),[[bad,'HELPER_JSON_INVALID']]);a.equal(captures(f).length,2);a.equal(inbox(f).length,1);
});
test('a stale branch head writes neither archival capture nor inbox bytes',async t=>{
 const f=fixture(t);f.api.head=async name=>name==='main'?base:'d'.repeat(40);await a.rejects(D.harvestBranch(f),/HELPER_BRANCH_HEAD_CHANGED/);a.equal(captures(f).length,0);a.equal(inbox(f).length,0);
});
test('truncated or inconsistent comparisons cannot hide mixed files or be treated as an immutable head',async t=>{
 const cases=[f=>f.comparison.truncated=true,f=>f.comparison.incomplete=true,f=>f.comparison.total_commits=2,f=>f.comparison.ahead_by=2,f=>f.comparison.files=Array.from({length:300},()=>f.files[0]),f=>delete f.comparison.files,f=>f.comparison.base_commit.sha='e'.repeat(40),f=>f.comparison.commits[0].sha='e'.repeat(40),f=>delete f.comparison.merge_base_commit];
 for(const change of cases){const f=fixture(t);change(f);await a.rejects(D.harvestBranch(f),/HELPER_BRANCH_COMPARE_/);a.equal(f.calls.some(x=>x[0]==='contentBytes'),false);a.equal(captures(f).length,0);a.equal(inbox(f).length,0);}
});
test('diverged branches still compare only receipt additions against the pinned current main',async t=>{
 const f=fixture(t);f.comparison.status='diverged';f.comparison.merge_base_commit.sha='e'.repeat(40);a.equal((await D.harvestBranch(f)).captured,1);
});
test('same immutable branch commit or receipt path cannot replace captured evidence',async t=>{
 for(const move of [false,true]){
  const f=fixture(t);await D.harvestBranch(f);const firstInbox=fs.readFileSync(inbox(f)[0],'utf8'),first=captures(f)[0];
  f.batch.items[0].sourceEvidence.observedAt='2026-11-09T01:00:00Z';
  if(move){f.branch.commit.sha='e'.repeat(40);f.comparison.commits=[{sha:f.branch.commit.sha}];}
  const r=await D.harvestBranch(f);a.equal(r.captured,0);a.equal(r.pendingArtifacts[0].reason,'IMMUTABLE_BRANCH_CAPTURE_COLLISION');a.equal(inbox(f).length,1);a.equal(fs.readFileSync(inbox(f)[0],'utf8'),firstInbox);a.ok(captures(f).some(c=>c.raw===first.raw));
 }
});
test('malformed UTF-8 cannot be silently normalized and its original bytes remain private',async t=>{
 const f=fixture(t),bytes=Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d]);f.api.contentBytes=async()=>bytes;const r=await D.harvestBranch(f);
 a.equal(r.pendingArtifacts[0].reason,'HELPER_JSON_ENCODING_INVALID');a.deepEqual(Buffer.from(captures(f)[0].rawBase64,'base64'),bytes);a.equal(inbox(f).length,0);
});
test('branch failures are isolated from other branches and PR behavior, and cannot alias delivery exceptions',async t=>{
 const f=fixture(t),second={name:'grok-shared-helper-batch-20261109-second',commit:{sha:'e'.repeat(40)}};f.api.branches=async()=>[f.branch,second];f.api.compare=async()=>{throw Error('HELPER_BRANCH_COMPARE_INCOMPLETE');};
 const result=await D.collect(f),state={exceptions:{}},Run=require('./run.cjs');Run.deliveryExceptions(state,[...result.results,{status:'PENDING',pullRequest:170,reason:'OLD_PR_PENDING'}]);
 const keys=Object.keys(state.exceptions);a.equal(keys.length,3);a.ok(keys.includes('delivery:170'));a.equal(keys.some(k=>k==='delivery:undefined'),false);
 const first=result.results.find(r=>r.branch===f.branch.name);Run.deliveryExceptions(state,[{...first,status:'CAPTURED'}]);a.equal(Object.keys(state.exceptions).length,2);a.equal(state.exceptions['delivery:170'].reason,'OLD_PR_PENDING');a.ok(Object.values(state.exceptions).some(x=>x.branch===second.name));
});
test('branch list failures retain PR results and clear their own exception after recovery',async t=>{
 const f=fixture(t),state={exceptions:{}};f.api.branches=async()=>{throw Error('GITHUB_DELIVERY_HTTP_503');};const Run=require('./run.cjs');Run.deliveryExceptions(state,(await D.collect(f)).results);a.equal(Object.values(state.exceptions)[0].reason,'GITHUB_DELIVERY_HTTP_503');f.api.branches=async()=>({truncated:true});Run.deliveryExceptions(state,(await D.collect(f)).results);a.equal(Object.values(state.exceptions)[0].reason,'INVALID_GITHUB_DELIVERY_PAGE');f.api.branches=async()=>[];Run.deliveryExceptions(state,(await D.collect(f)).results);a.deepEqual(state.exceptions,{});
});
test('the native branch reader lists, compares and reads only with GET using fixed repository and immutable SHA routes',async t=>{
 const f=fixture(t),requests=[],original=global.fetch;t.after(()=>{global.fetch=original;});
 global.fetch=async(url,options)=>{requests.push([url,options.method||'GET']);let value;
  if(url.includes('/pulls?'))value=[];else if(url.includes('/branches?'))value=[f.branch];else if(url.includes('/compare/'))value=f.comparison;else if(url.includes('/git/ref/heads/'))value={object:{sha:url.endsWith('/main')?base:head}};else if(url.includes('/contents/'))value={encoding:'base64',content:Buffer.from(f.raw()).toString('base64'),size:Buffer.byteLength(f.raw())};else throw Error('UNEXPECTED_URL');
  return{ok:true,json:async()=>value};
 };
 const r=await D.collect({...f,api:D.github('synthetic-test-token')});a.equal(r.results.find(x=>x.branch).captured,1);a.ok(requests.every(([url,method])=>url.startsWith('https://api.github.com/repos/'+repository+'/')&&method==='GET'));a.ok(requests.some(([url])=>url.includes('/compare/'+base+'...'+head)));a.ok(requests.some(([url])=>url.includes('/contents/')&&url.endsWith('?ref='+head)));
});
