'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),H=require('./shared.cjs'),A=require('./shared-assignments.cjs'),C=require('../programmed-coordinator/collect.cjs');
const task='FORGE_CLAUDE_SHARED_HELPER',other='FORGE_GROK_SHARED_HELPER',at='2026-11-09T12:00:00Z';
const base=()=>({schema:'forge.shared-helper-work.v1',assignmentId:'SHARED-TEST',enabled:true,routingActive:true,providers:{[task]:{provider:'Claude',available:true},[other]:{provider:'Grok',available:true}},items:[]});
const assigned=(id='V2I-ONE')=>({kind:'ENRICHMENT',primaryId:id,provider:'Claude',taskKey:task,assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'});
const batch=(w)=>({schema:'forge.shared-helper-batch.v1',provider:'Claude',taskKey:task,assignmentId:w.assignmentId,runId:'FORGE-CLAUDE-TEST',instructionCommit:'b'.repeat(40),items:w.items.filter(i=>i.taskKey===task).map(i=>({...i,writerSubmitted:false,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://careers.factory.com/jobs/1',observedAt:at,sourceSha256:'c'.repeat(64),quote:'Lead manufacturing production and quality systems across the plant.'}}))});
function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'shared-routing-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));S.save(root,H.FILE,base());return root;}
const state=()=>({items:{},batches:{},transactions:{},exceptions:{}});
const row=(id,n=0)=>({PRIMARY_ID:id,COMPANY:'Factory '+n,TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'MANUAL_RESEARCH',p:{}});
function captured(b){const i=b.items[0],quote=i.sourceEvidence.quote;i.sourceEvidence.capture={kind:'TEXT_EXTRACT',text:'Exact employer posting: '+quote+'\n'+('Quality, production and people leadership. '.repeat(10))+'\nRésumé evidence is separate.'};delete i.sourceEvidence.sourceSha256;return b;}
test('tool-only providers can return exact captured text; code records real bytes without modifying their receipt',()=>{
 const w=base();w.items=[assigned()];const b=captured(batch(w)),original=JSON.stringify(b),v=H.validateBatch(b,w),text=b.items[0].sourceEvidence.capture.text;
 a.equal(JSON.stringify(b),original);a.equal(Object.hasOwn(b.items[0].sourceEvidence,'sourceSha256'),false);
 a.deepEqual(v.sourceCaptures,[{key:'V2I-ONE',kind:'TEXT_EXTRACT',sha256:S.hash(text),bytes:Buffer.byteLength(text,'utf8'),basis:'SUBMITTED_TEXT_ONLY',independentlyVerified:false}]);
 a.equal(v.productionAuthorized,false);a.notEqual(Buffer.byteLength(text,'utf8'),text.length);
});
test('captures never repair fabricated hashes, summary quotes or malformed/oversized text',()=>{
 const w=base();w.items=[assigned()];const b=captured(batch(w));
 for(const edit of [e=>e.sourceSha256='placeholder_hash_for_captured_bytes',e=>e.sourceSha256='0'.repeat(64),e=>e.quote='An invented requirement absent from captured bytes.',e=>e.capture.kind='INDEPENDENTLY_VERIFIED',e=>e.capture.text='short',e=>e.capture.text='x'.repeat(200001),e=>e.capture.trusted=true]){const bad=structuredClone(b);edit(bad.items[0].sourceEvidence);a.throws(()=>H.validateBatch(bad,w),/SHARED_CAPTURE/);}
 const legacy=batch(w);legacy.items[0].sourceEvidence.sourceSha256='placeholder_hash_for_captured_bytes';a.throws(()=>H.validateBatch(legacy,w),/SHARED_SOURCE_PROOF_REQUIRED/);
});
test('blocked source reports need honest accounting, not invented hashes or NOT_STATED facts',()=>{
 const w=base();w.items=[assigned()];const b=batch(w),i=b.items[0];i.recommendation='SOURCE_BLOCKED';i.reason='Assigned posting returned HTTP 403';i.researchOwner='Grok';i.retryCondition='Source access restored or new exact posting source';delete i.sourceEvidence.sourceSha256;delete i.sourceEvidence.quote;
 a.equal(H.validateBatch(b,w).valid,true);delete i.retryCondition;a.throws(()=>H.validateBatch(b,w),/SHARED_EXCEPTION_ACCOUNTING_REQUIRED/);
});
test('collector preserves computed capture provenance but leaves source trust and original bytes unchanged',t=>{
 const root=setup(t),w=base();w.items=[assigned()];S.save(root,H.FILE,w);S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[task]:{owner:'Claude',workAssignments:H.FILE}}});
 const b=captured(batch(w)),file='receipts/CLAUDE_HELPERS/'+task+'/'+b.runId+'.json';S.save(root,file,b);const before=fs.readFileSync(path.join(root,file),'utf8'),st=state();
 C.collect({root,state:st,commit:'d'.repeat(40),routing:()=>({currentPolicyRecheckRequired:true})});
 a.equal(st.batches[file].status,'VALIDATED');a.equal(st.batches[file].sourceCaptures[0].sha256,S.hash(b.items[0].sourceEvidence.capture.text));
 a.equal(st.batches[file].sourceCaptures[0].independentlyVerified,false);a.equal(st.items[task+':V2I-ONE'].status,'RETURNED');a.equal(fs.readFileSync(path.join(root,file),'utf8'),before);
});
test('submitted capture never substitutes for independent live posting evidence',async t=>{
 const root=setup(t),w=base();w.items=[assigned()];const b=captured(batch(w)),i=b.items[0];a.equal(H.validateBatch(b,w).valid,true);
 await a.rejects(require('../programmed-coordinator/source.cjs').verify({item:i,expected:{company:'Factory',title:'Plant Manager',location:'Austin, TX'},privateDir:root,fetchPage:async url=>({url,raw:'<html>Generic careers homepage without a posting</html>'})}),/STRUCTURED_POSTING_UNAVAILABLE/);
});
test('one routine has disjoint provider slots and no direct Writer or protected fields',()=>{
 const w=base();w.items=[assigned(),{...assigned('V2I-TWO'),taskKey:other,provider:'Grok'}];
 a.deepEqual(H.next(w,task).items.map(H.key),['V2I-ONE']);a.deepEqual(H.next(w,other).items.map(H.key),['V2I-TWO']);
 const b=batch(w);a.equal(H.validateBatch(b,w).productionAuthorized,false);
 for(const edit of [i=>i.writerSubmitted=true,i=>i.sourceEvidence.proposedRawFields={BUCKET:'READY_TO_PURSUE'},i=>i.sourceEvidence.proposedRawFields={SCOPE_FIT_RAW:100},i=>i.needsTim=true]){const bad=structuredClone(b);edit(bad.items[0]);a.throws(()=>H.validateBatch(bad,w));}
 a.throws(()=>H.validateWork({...w,items:[...w.items,w.items[0]]}),/OVERLAPPING/);
});
test('quota availability never steals assignments; explicit terminal transfer rejects late returns',()=>{
 const w=base();w.items=[assigned()];const old=structuredClone(w),b=batch(w);w.providers[task].available=false;
 a.equal(H.next(w,task).items.length,0);a.equal(w.items[0].taskKey,task);a.equal(H.validateBatch(b,w).valid,true);
 for(const options of [{},{terminalRun:false,checkpoint:'proof',reason:'quota'},{terminalRun:true,checkpoint:'proof',reason:'quota',transactionPending:true}])a.throws(()=>H.transfer(w,'V2I-ONE',other,options),/HANDOFF/);
 H.transfer(w,'V2I-ONE',other,{terminalRun:true,checkpoint:'receipts/terminal.json',reason:'Quota exhausted; run stopped'});
 a.equal(w.items[0].assignmentVersion,2);a.throws(()=>H.validateBatch(b,w),/STALE/);a.throws(()=>H.validateRouting(b,old,w),/STALE/);
});
test('coordinator reserves only fresh unowned unprotected jobs; repeated runs retain exact ownership',t=>{
 const root=setup(t),st=state(),rows=Array.from({length:20},(_,n)=>row('V2I-'+n,n));rows.push({...row('V2I-PROTECTED'),p:{TIM_DECISION:'DECLINED'}});
 S.save(root,'control/ENRICHMENT_HELPER_WORK.json',{enabled:true,items:[{primaryId:'V2I-0',status:'ASSIGNED'}]});
 st.transactions.pending={status:'POST_IN_FLIGHT_UNKNOWN',ids:['V2I-1']};
 const options={root,state:st,snapshot:{rows,archiveRows:[],source:{readAt:at}},runId:'TEST',now:Date.parse(at),apply:true,checkLock(){}};
 const first=A.replenish(options);a.equal(first.assigned,18);const w=H.load(root),owners=w.items.map(i=>[H.key(i),i.taskKey]);a.equal(new Set(w.items.map(H.key)).size,18);a.ok(Object.values(first.byTask).every(n=>n>0));
 a.ok(w.items.every(i=>i.missingFields.includes('SALARY')&&i.missingFields.includes('DEGREE')&&i.missingFields.includes('FIT')&&i.missingFields.includes('LINKS')));
 a.equal(A.replenish(options).assigned,0);a.deepEqual(H.load(root).items.map(i=>[H.key(i),i.taskKey]),owners);
 a.throws(()=>A.replenish({...options,checkLock:null}),/LOCK/);a.throws(()=>A.replenish({...options,now:Date.parse(at)+900001}),/FRESH/);
});
test('assigned intake and discovery research preserve current drain ownership and original source cards',t=>{
 const root=setup(t),jobs={};for(const [key,discoveryOnly] of [['intake',false],['discovery',true],['owned',false]])jobs[key]={key,company:'F '+key,title:'Plant Manager',location:'Austin, TX',url:'https://jobs.example.com/'+key,status:'NEEDS_SOURCE',discoveryOnly,aliases:[]};
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs});S.save(root,'state/INTAKE_DRAIN.json',{items:{owned:{key:'owned',aliases:[],status:'ACTION_REQUIRED'}}});
 A.replenish({root,state:state(),snapshot:{rows:[],archiveRows:[],source:{readAt:at}},runId:'TEST',now:Date.parse(at),apply:true,checkLock(){}});
 const w=H.load(root);a.deepEqual(w.items.map(i=>i.kind),['INTAKE','DISCOVERY']);a.ok(w.items.every(i=>i.sourceEvidence.url===jobs[i.key].url));
});
test('immutable returns route both candidate keys and canonical IDs at historical revision',t=>{
 const root=setup(t),w=base();w.items=[{...assigned(),kind:'INTAKE',key:'candidate'}];delete w.items[0].primaryId;S.save(root,H.FILE,w);
 const registry={tasks:{[task]:{owner:'Claude',route:'utility',procedure:'lanes/FORGE_SHARED_HELPER.txt',executionMode:'EVIDENCE_ONLY',workAssignments:H.FILE}}};S.save(root,'control/AI_AUTOMATION_TASKS.json',registry);
 for(const file of ['policy/current/AI_AUTOMATION_COMMON.txt','lanes/FORGE_SHARED_HELPER.txt']){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'contract');}
 const b=batch(w);b.items[0].recommendation='INTAKE_READY';
 const history=(_root,_commit,file)=>file==='control/AI_AUTOMATION_TASKS.json'?JSON.stringify(registry):file===H.FILE?JSON.stringify(w):'contract';
 a.equal(C.validateEnvelope(root,b).valid,true);a.equal(C.routingProof(root,b,'d'.repeat(40),history).currentPolicyRecheckRequired,true);
});
test('shared ENRICHMENT kind reaches existing field preparation instead of intake route',async t=>{
 const root=setup(t),w=base();w.items=[assigned()];S.save(root,H.FILE,w);const b=batch(w),file='receipts/CLAUDE_HELPERS/'+task+'/'+b.runId+'.json';S.save(root,file,b);
 const st=state();st.batches[file]={status:'VALIDATED'};st.items.one={key:'one',itemKey:'V2I-ONE',taskKey:task,batch:file,status:'RETURNED',attempts:0};
 await require('../programmed-coordinator/run.cjs').inspectReturns({root,privateDir:root,state:st,snapshot:{rows:[row('V2I-ONE')],archiveRows:[]},apply:false,sourceVerify:async()=>({degree:{text:'Degree or equivalent experience',req:'PREFERRED'},observedAt:at,sourceUrl:'https://careers.factory.com/jobs/1',sourceSha256:'c'.repeat(64)})});
 // The row identity is deliberately different, so fail closed before source inspection.
 a.equal(st.items.one.status,'EXCEPTION');a.equal(st.exceptions.one.reason,'CONFLICTING_SOURCE_IDENTITY');
 const r={...row('V2I-ONE'),COMPANY:'Factory'};await require('../programmed-coordinator/run.cjs').inspectReturns({root,privateDir:root,state:st,snapshot:{rows:[r],archiveRows:[]},apply:false,sourceVerify:async()=>({degree:{text:'Degree or equivalent experience',req:'PREFERRED'},observedAt:at,sourceUrl:'https://careers.factory.com/jobs/1',sourceSha256:'c'.repeat(64)})});
 a.equal(st.items.one.status,'READY_ENRICHMENT');a.equal(st.items.one.prepared.fields.DEGREE_REQ,'PREFERRED');
});
test('shared intake ownership is checked again before controlled intake consumption',t=>{
 const root=setup(t),w=base();w.items=[{...assigned(),kind:'INTAKE',key:'candidate'}];delete w.items[0].primaryId;S.save(root,H.FILE,w);
 const b=batch(w);b.items[0].recommendation='INTAKE_READY';const file='receipts/CLAUDE_HELPERS/'+task+'/'+b.runId+'.json';S.save(root,file,b);
 const i={provider:'CODE',provenance:'PROGRAMMED_SOURCE_VERIFIED',key:'candidate',coordinatorKey:'coordinator',sourceVersion:S.hash(b.items[0]),sourceEvidence:{sourceSha256:'c'.repeat(64)}};
 const st=state();st.batches[file]={status:'VALIDATED'};st.items.coordinator={batch:file,status:'SOURCE_VERIFIED',version:i.sourceVersion,sourceEvidence:i.sourceEvidence};S.save(root,'state/PROGRAMMED_COORDINATOR.json',st);
 const I=require('../routine-handoffs/intake-state.cjs');a.equal(I.original(root,i,null).key,'candidate');
 w.items[0].assignmentVersion++;S.save(root,H.FILE,w);a.throws(()=>I.original(root,i,null),/STALE/);
});
test('CLI passes its second argument as the resume cursor rather than restarting the first chunk',()=>{
 const result=require('node:child_process').spawnSync(process.execPath,[require.resolve('./shared.cjs'),task,'UNKNOWN-CURSOR'],{encoding:'utf8'});
 a.equal(result.status,1);a.match(result.stderr,/UNKNOWN_SHARED_CURSOR/);
});
test('largest current eligible backlog wins over fixed Research-first priority',()=>{
 const w=base();w.items=[{...assigned('V2I-R'),lane:'RESEARCH'},...Array.from({length:3},(_,n)=>({...assigned('V2I-E'+n),lane:'ENRICHMENT'})),{...assigned('V2I-D'),kind:'DISCOVERY',lane:'DISCOVERY'}];
 let next=H.next(w,task);a.equal(next.laneOrder[0],'ENRICHMENT');a.equal(next.items[0].lane,'ENRICHMENT');a.equal(next.backlogCounts.ENRICHMENT,3);a.equal(next.items.findIndex(i=>i.lane==='RESEARCH'),3);
 w.items[1].status='RETURNED_PENDING_REVIEW';w.items[2].status='CONSUMED';w.items[3].retryAfter='9999-01-01T00:00:00Z';next=H.next(w,task);a.equal(next.backlogCounts.ENRICHMENT,0);a.equal(next.items[0].lane,'RESEARCH');a.ok(next.items.some(i=>i.lane==='DISCOVERY'));
});
test('backlog priority counts jobs once, excludes unavailable slots, and never reassigns their jobs',()=>{
 const w=base();w.items=[{...assigned('V2I-R'),lane:'RESEARCH',missingFields:['SALARY','DEGREE','FIT','LINKS']},...Array.from({length:4},(_,n)=>({...assigned('V2I-G'+n),provider:'Grok',taskKey:other,lane:'INTAKE'}))];w.providers[other].available=false;
 const next=H.next(w,task);a.equal(next.backlogCounts.RESEARCH,1);a.equal(next.backlogCounts.INTAKE,0);a.deepEqual(next.items.map(H.key),['V2I-R']);a.equal(w.items[1].taskKey,other);
});
test('priority changes between pages reset the cursor without dropping the newly largest lane',()=>{
 const w=base();w.items=[...Array.from({length:21},(_,n)=>({...assigned('V2I-E'+String(n).padStart(2,'0')),lane:'ENRICHMENT'})),...Array.from({length:20},(_,n)=>({...assigned('V2I-R'+String(n).padStart(2,'0')),lane:'RESEARCH'}))];
 const first=H.next(w,task);a.equal(first.items.length,20);a.ok(first.items.every(i=>i.lane==='ENRICHMENT'));
 const second=H.next(w,task,first.nextAfter);a.equal(second.items.length,20);a.equal(second.cursorReset,false);
 for(const i of first.items)i.status='RETURNED_PENDING_REVIEW';
 const changed=H.next(w,task,first.nextAfter);a.equal(changed.cursorReset,true);a.equal(changed.items.length,20);a.ok(changed.items.every(i=>i.lane==='RESEARCH'));
 for(const i of changed.items)i.status='RETURNED_PENDING_REVIEW';
 const last=H.next(w,task,changed.nextAfter);a.equal(last.items.length,1);a.equal(last.items[0].lane,'ENRICHMENT');
});
