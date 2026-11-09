'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const H=require('./shared.cjs'),R=require('./shared-return.cjs'),S=require('../programmed-coordinator/store.cjs');
const tasks=Object.keys(H.TASKS),at='2026-11-09T12:00:00Z',sha='b'.repeat(40);
function work(){return{schema:'forge.shared-helper-work.v1',assignmentId:'TEMPLATE-TEST',enabled:true,routingActive:true,providers:Object.fromEntries(tasks.map(t=>[t,{provider:H.TASKS[t],available:true}])),items:tasks.flatMap(taskKey=>Array.from({length:21},(_,n)=>({primaryId:'V2I-'+taskKey+'-'+n,kind:'ENRICHMENT',provider:H.TASKS[taskKey],taskKey,assignmentVersion:2,sourceVersion:S.hash(n),status:'ASSIGNED',company:'Factory',title:'Plant Manager',location:'Austin, TX',sourceUrls:['https://careers.factory.com/jobs/'+n]})))};}
function start(w,task=tasks[0]){return R.template(w,task,sha,'FORGE-'+H.TASKS[task].toUpperCase()+'-TEST');}
function researched(w){const b=start(w);b.items=b.items.slice(0,1);const i=b.items[0];i.recommendation='ENRICHMENT_EVIDENCE_READY';Object.assign(i.sourceEvidence,{url:'https://careers.factory.com/jobs/0',observedAt:at,quote:'Lead manufacturing production and quality systems across the plant.',capture:{kind:'TEXT_EXTRACT',text:'Lead manufacturing production and quality systems across the plant.\r\n'+('Quality, production and people leadership. '.repeat(10))+'\r\nRésumé evidence is separate.'}});return b;}
test('shared templates copy only current assigned identity/version and cannot invent valid research',()=>{
 const w=work(),original=JSON.stringify(w);
 for(const task of tasks){const b=start(w,task);a.equal(b.items.length,20);a.equal(b.taskKey,task);a.equal(b.provider,H.TASKS[task]);a.equal(b.writerSubmitted,false);
  a.ok(b.items.every(i=>i.primaryId.includes(task)&&i.assignmentVersion===2&&i.writerSubmitted===false&&i.recommendation===null&&i.sourceEvidence.url===null&&i.sourceEvidence.observedAt===null&&i.sourceEvidence.quote===null&&i.sourceEvidence.capture.text===null));
  a.throws(()=>H.validateBatch(b,w),/INVALID_SHARED_RECOMMENDATION/);
  const next=H.next(w,task),second=R.template(w,task,sha,'FORGE-'+H.TASKS[task].toUpperCase()+'-NEXT',next.nextAfter);a.equal(second.items.length,1);
 }
 a.equal(JSON.stringify(w),original);
});
test('templates preserve candidate keys and never silently fall back from invalid cursor or closed work',()=>{
 const w=work(),i=w.items[0];i.key='candidate-key';delete i.primaryId;i.kind='INTAKE';delete i.company;i.sourceEvidence={company:'Original Company',title:'Original Title',location:'Original Location'};
 w.items=[i];const b=start(w),candidate=b.items.find(i=>i.key==='candidate-key');a.ok(candidate);a.equal(candidate.sourceEvidence.company,'Original Company');a.equal(Object.hasOwn(candidate,'primaryId'),false);
 a.throws(()=>R.template(w,tasks[0],sha,'FORGE-CLAUDE-TEST','bad'),/UNKNOWN_SHARED_CURSOR/);
 a.throws(()=>R.template(w,tasks[0],'placeholder','FORGE-CLAUDE-TEST'),/INVALID_SHARED_RETURN_IDENTITY/);
 w.enabled=false;a.throws(()=>start(w),/NO_ELIGIBLE_SHARED_ITEMS/);
});
test('preflight hashes exact UTF-8 file bytes without rewriting whitespace, capture or source provenance',()=>{
 const w=work(),b=researched(w),bytes=Buffer.from(JSON.stringify(b,null,2)+'\r\n'),before=Buffer.from(bytes),result=R.preflight(bytes,w);
 a.equal(result.valid,true);a.equal(result.sha256,S.hash(bytes));a.equal(result.bytes,bytes.length);a.equal(result.productionAuthorized,false);a.equal(result.deliveryVerified,false);
 a.deepEqual(bytes,before);a.equal(result.sourceCaptures[0].sha256,S.hash(b.items[0].sourceEvidence.capture.text));a.equal(result.sourceCaptures[0].independentlyVerified,false);
 const compact=Buffer.from(JSON.stringify(b));a.notEqual(R.preflight(compact,w).sha256,result.sha256);
});
test('placeholder, Markdown, truncated, invalid UTF-8 and oversized files fail before publication',()=>{
 const w=work();for(const text of ['PLACEHOLDER_AGAIN','```json\n{}\n```','{"schema":','"PLACEHOLDER_AGAIN"','{}'])a.throws(()=>R.preflight(Buffer.from(text),w));
 a.throws(()=>R.preflight(Buffer.from([0xff]),w));a.throws(()=>R.preflight(Buffer.alloc(2000001,32),w),/SHARED_BATCH_TOO_LARGE/);
 a.throws(()=>R.preflight(Buffer.from('\ufeff'+JSON.stringify(researched(w))),w),SyntaxError);
 a.throws(()=>R.preflight(JSON.stringify(researched(w)),w),/EXACT_SHARED_RETURN_BYTES_REQUIRED/);
 a.match(R.guidance(new SyntaxError()),/complete JSON object.*placeholder/);
});
test('ready quotes remain contiguous and blocked returns require honest exception accounting',()=>{
 const w=work(),b=researched(w),i=b.items[0];i.sourceEvidence.quote='Lead manufacturing production and quality systems. Quality, production and people leadership.';
 a.throws(()=>R.preflight(Buffer.from(JSON.stringify(b)),w),/SHARED_CAPTURE_QUOTE_REQUIRED/);
 i.recommendation='SOURCE_BLOCKED';i.sourceEvidence={company:'Factory',title:'Plant Manager',location:'Austin, TX'};i.reason='Assigned posting returned HTTP 403';i.researchOwner='Claude';i.retryCondition='Exact posting source becomes accessible';
 a.equal(R.preflight(Buffer.from(JSON.stringify(b)),w).valid,true);delete i.reason;a.throws(()=>R.preflight(Buffer.from(JSON.stringify(b)),w),/SHARED_EXCEPTION_ACCOUNTING_REQUIRED/);
});
test('CLI rejects literal placeholders with actionable guidance and leaves input bytes unchanged',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'shared-return-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'return.json');fs.writeFileSync(file,'PLACEHOLDER_AGAIN');
 const result=cp.spawnSync(process.execPath,[require.resolve('./shared-return.cjs'),'validate',file],{encoding:'utf8'});
 a.equal(result.status,1);a.equal(result.stdout,'');a.match(result.stderr,/complete JSON object.*placeholder/);a.equal(fs.readFileSync(file,'utf8'),'PLACEHOLDER_AGAIN');
});
