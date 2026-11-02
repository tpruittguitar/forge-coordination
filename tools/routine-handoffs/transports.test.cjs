'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs'),R=require('./reports.cjs'),P=require('./pagination.cjs'),A=require('./assignments.cjs'),I=require('./intake-state.cjs'),L=require('../email-recovery/ledger.cjs');
function dir(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-transports-'));t.after(()=>{a.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});return root;}
function report(t){const root=dir(t),privateDir=dir(t),state=R.empty(),batch={schema:'forge.intake-helper-batch.v1',taskKey:'FORGE_GROK_INTAKE_HELPER',provider:'Grok',assignmentId:'TEST',runId:'GROK-INTAKE-ONE',instructionCommit:'a'.repeat(40),items:[{key:'linkedin:1234',sourceEvidence:{quote:'A brace { inside a quote } with \\" escapes'}}]};S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[batch.taskKey]:{owner:'Grok'}}});return{root,privateDir,state,batch,text:JSON.stringify(batch),source:{id:'report-1',provider:'Grok',taskKey:batch.taskKey,complete:true},commit:'b'.repeat(40),validate:()=>({valid:true}),routing:()=>({})};}
test('full report parser collects multiple complete batches and ignores excerpts or prose counters',t=>{
 const f=report(t),text='Prepared 30; verified 0.\n```json\n'+f.text+'\n```\n'+JSON.stringify({...f.batch,runId:'GROK-INTAKE-TWO'});
 a.equal(R.batches(text).length,2);a.equal(R.batches(f.text.slice(0,-8)).length,0);a.equal(R.batches('{"prepared":30}').length,0);
 a.equal(R.ingest({...f,text}).imported,2);a.equal(fs.existsSync(path.join(f.root,'receipts/GROK_HELPERS/'+f.batch.taskKey+'/'+f.batch.runId+'.json')),true);
 a.equal(R.ingest({...f,text}).duplicate,true);a.throws(()=>R.ingest({...f,source:{...f.source,complete:false}}),/FULL_REPORT/);
});
test('complete JSON string wrappers decode without repairing truncated report text',t=>{const f=report(t);a.deepEqual(R.batches(JSON.stringify(f.text))[0].value,f.batch);a.deepEqual(R.batches(JSON.stringify(JSON.stringify(f.text)))[0].value,f.batch);a.equal(R.batches(JSON.stringify(f.text).slice(0,-1)).length,0);});
test('native receipt references use exact repository artifacts and retain provider validation',t=>{const f=report(t),relative='receipts/GROK_HELPERS/'+f.batch.taskKey+'/'+f.batch.runId+'.json';S.save(f.root,relative,f.batch);let validated=0;const result=R.ingest({...f,text:'Delivered the full batch at `'+relative+'`.',validate:()=>validated++});a.equal(result.imported,0);a.equal(f.state.reports[Object.keys(f.state.reports)[0]].results[0].status,'DUPLICATE');a.equal(validated,0);const g=report(t);S.save(g.root,relative,{...g.batch,provider:'Claude'});a.equal(R.ingest({...g,text:relative}).quarantined,1);});
test('run/report collisions are immutable, correction remains private and does not promote items',t=>{
 const f=report(t);R.ingest(f);const changed=JSON.stringify({...f.batch,items:[]});
 a.equal(R.ingest({...f,text:changed}).quarantined,true);
 const result=R.ingest({...f,text:changed,source:{...f.source,id:'different-report'}});a.equal(result.quarantined,1);
 a.equal(JSON.parse(fs.readFileSync(path.join(f.root,'receipts/GROK_HELPERS/'+f.batch.taskKey+'/'+f.batch.runId+'.json'))).items.length,1);
 a.equal(fs.readdirSync(path.join(f.privateDir,'helper-reports')).length,2);
});
test('provider/task mismatches and invalid envelopes remain pending without public publication',t=>{
 const f=report(t);a.equal(R.ingest({...f,source:{...f.source,provider:'Claude'}}).quarantined,1);a.equal(fs.existsSync(path.join(f.root,'receipts')),false);
 const g=report(t);a.equal(R.ingest({...g,validate:()=>{throw Error('Invalid envelope');}}).quarantined,1);a.equal(fs.existsSync(path.join(g.root,'receipts')),false);
});
test('private outcome correspondence never goes into public receipts',t=>{
 const f=report(t),taskKey='FORGE_GROK_APPLICATION_OUTCOME_HELPER',batch={...f.batch,schema:'forge.outcome-helper-batch.v1',taskKey,runId:'GROK-OUTCOME-ONE',privateBody:'synthetic private message'};
 S.save(f.root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:{owner:'Grok'}}});
 const result=R.ingest({...f,text:JSON.stringify(batch),source:{...f.source,taskKey}});a.equal(result.imported,1);a.equal(fs.existsSync(path.join(f.root,'receipts')),false);a.equal(f.state.privateOutcomeBatches.length,1);
});
test('transport report cursors cannot advance ahead of durable full bodies; retries are idempotent',async t=>{
 const f=report(t);let fail=true,saved=0,reads=0;
 const feed={provider:'Grok',taskKey:f.batch.taskKey,id:'native-automation',list:async({cursor})=>cursor?{reports:[{id:'r2'}],exhausted:true,resumeCursor:'end'}:{reports:[{id:'r1'}],exhausted:false,nextCursor:'p2'},read:async({id})=>{reads++;if(id==='r2'&&fail)throw Error('report unavailable');return{text:JSON.stringify({...f.batch,runId:id==='r1'?'GROK-INTAKE-ONE':'GROK-INTAKE-TWO'}),complete:true};}};
 const args={...f,feed,save:async()=>{saved++;},ingestReport:args=>R.ingest({...args,validate:f.validate,routing:f.routing})};
 await a.rejects(R.collectFeed(args),/unavailable/);a.equal(Object.values(f.state.cursors)[0],'p2');a.ok(saved>0);
 fail=false;await R.collectFeed(args);a.equal(Object.values(f.state.cursors)[0],'end');a.equal(Object.keys(f.state.reports).length,2);a.equal(reads,3);
});
test('report pagination detects cycles and imports all pages without a run quota',async()=>{
 const state=R.empty();let cursor=0,count=0;
 const feed={provider:'Grok',taskKey:'TASK',id:'native',list:async()=>({reports:[{id:String(cursor)}],exhausted:cursor===42,nextCursor:String(++cursor)}),read:async()=>({text:'full',complete:true})};
 const result=await R.collectFeed({feed,state,ingestReport:()=>{count++;return{imported:1};}});a.equal(count,43);a.equal(result.exhausted,true);
 await a.rejects(R.collectFeed({feed:{...feed,list:async()=>({reports:[],exhausted:false,nextCursor:'same'})},state:R.empty()}),/CURSOR_CYCLE/);
});
function page(url,id,next=true){return{schema:'forge.result-page-observation.v1',browser:'Chrome',complete:true,url,at:new Date().toISOString(),jobs:[{jobId:String(id),paragraphs:['Director of Manufacturing','Factory','Austin, TX']}],next:{available:next,kind:next?'RESULTS_NEXT':null,proof:'observed-control'},endConfirmed:!next};}
function pages(t){const privateDir=dir(t),ledger=L.empty();L.seed(ledger,[{gmailId:'m1',advertisedUnseen:0,url:'https://www.linkedin.com/jobs/search-results/?keywords=manufacturing'}]);return{privateDir,ledger,state:{sources:{},exceptions:{}}};}
test('observed empty continuation proves live exhaustion while an initially empty search retains its historical gap',async t=>{for(const continuation of [true,false]){const f=pages(t),empty=url=>({...page(url,1,false),jobs:[],emptyConfirmed:true});await P.drain({...f,adapter:{open:async({url})=>({observe:async()=>continuation?page(url,1,true):empty(url),next:async()=>empty(url+'&start=25'),close:async()=>{}})}});a.equal(f.ledger.sources.m1.nextPageRequired,false);a.equal(f.ledger.sources.m1.exhausted,continuation);a.equal(L.summary(f.ledger).historicalGaps,continuation?0:1);a.equal(f.ledger.sources.m1.historicalCoverage,'UNPROVEN');}});
test('previously captured empty continuations reconcile from exact saved proofs without re-opening the browser',async t=>{const f=pages(t),url=f.ledger.sources.m1.url,before=page(url,1,true),after={...page(url+'&start=25',2,false),jobs:[],emptyConfirmed:true},b=S.hash(before),h=S.hash(after);S.save(f.privateDir,'result-pages/'+b+'.json',before);S.save(f.privateDir,'result-pages/'+h+'.json',after);const source=f.ledger.sources.m1;Object.assign(source,{status:'HISTORICAL_RESULTS_UNAVAILABLE',emptyEvidence:{sha256:h},nextPageRequired:false,exhausted:false});const progress={observedPages:[{position:0,captureSha256:b}],advance:{status:'OBSERVED',fromUrl:url,toUrl:after.url,pageProof:P.pageProof(after)}};a.equal(P.reconcileEmptyContinuation(source,{...progress,advance:{...progress.advance,pageProof:'wrong'}},f.privateDir),false);a.equal(source.exhausted,false);a.equal(P.reconcileEmptyContinuation(source,progress,f.privateDir),true);a.equal(source.exhausted,true);a.equal(source.historicalCoverage,'UNPROVEN');});
test('results engine captures before Next and drains every page, retaining historical uncertainty',async t=>{
 const f=pages(t);let saved=0,nextCalls=0;
 const adapter={open:async({url})=>{let offset=P.position(url);return{observe:async()=>page(url,offset+1,offset<1000),next:async()=>{a.ok(saved>0);a.ok(f.ledger.sources.m1.pages.some(p=>P.position(p.url)===offset));nextCalls++;offset+=25;return page('https://www.linkedin.com/jobs/search-results/?keywords=manufacturing&start='+offset,offset+1,offset<1000);},close:async()=>{}};}};
 const result=await P.drain({...f,adapter,save:async()=>{saved++;}});a.equal(nextCalls,40);a.equal(result.pagesCaptured,41);a.equal(Object.keys(f.ledger.jobs).length,41);a.equal(f.ledger.sources.m1.nextPageRequired,false);a.equal(L.summary(f.ledger).coverageComplete,false);a.equal(result.noProcessingCap,true);
});
test('same IDs at later offsets and changed filters never certify pagination progress',async t=>{
 for(const bad of [url=>page(url,1),url=>page(url.replace('manufacturing','sales'),2)]){
  const f=pages(t),adapter={open:async({url})=>({observe:async()=>page(url,1),next:async()=>bad(url+'&start=25'),close:async()=>{}})};
  await P.drain({...f,adapter});a.equal(f.ledger.sources.m1.nextPagePosition,0);a.equal(f.state.sources.m1.advance.status,'IN_FLIGHT');a.equal(Object.keys(f.state.exceptions).length,1);
 }
});
test('blocked source does not starve independent result sources',async t=>{
 const f=pages(t);L.seed(f.ledger,[{gmailId:'m2',advertisedUnseen:0,url:'https://www.linkedin.com/jobs/search-results/?keywords=quality'}]);
 const adapter={open:async({sourceId,url})=>{if(sourceId==='m1')throw Error('SOURCE_ACCESS_BLOCKED');return{observe:async()=>page(url,2,false),close:async()=>{}};}};
 await P.drain({...f,adapter});a.equal(f.ledger.sources.m2.nextPageRequired,false);a.equal(f.ledger.sources.m1.nextPageRequired,true);a.equal(Object.keys(f.ledger.jobs).length,1);
});
test('uncertain Next resumes the captured page without guessing or losing later cards',async t=>{
 const f=pages(t);let clicked=0,opened=[];
 const adapter={open:async({url})=>{opened.push(url);return{observe:async()=>page(url,1),next:async()=>{clicked++;throw Error('connection lost after click');},close:async()=>{}};}};
 await P.drain({...f,adapter});a.equal(f.state.sources.m1.advance.status,'IN_FLIGHT');a.equal(Object.keys(f.ledger.jobs).length,1);
 delete f.state.sources.m1.retryAfter;
 adapter.open=async({url})=>{opened.push(url);return{observe:async()=>page(url,1),next:async()=>page(url+'&start=25',2,false),close:async()=>{}};};
 await P.drain({...f,adapter});a.equal(P.position(opened.at(-1)),0);a.equal(Object.keys(f.ledger.jobs).length,2);a.equal(f.ledger.sources.m1.nextPageRequired,false);
});
test('unrendered or ambiguous cards cannot move a source cursor or drop an obligation',async t=>{
 const f=pages(t);let clicked=false;
 await P.drain({...f,adapter:{open:async({url})=>({observe:async()=>({...page(url,1),jobs:[{jobId:'1',paragraphs:['missing identity']}]}),next:async()=>{clicked=true;},close:async()=>{}})}});
 a.equal(clicked,false);a.equal(Object.keys(f.ledger.jobs).length,0);a.equal(f.state.exceptions.m1.owner,'AI');a.equal(f.ledger.sources.m1.nextPageRequired,true);
});
function assignment(t,title='Director of Manufacturing'){
 const root=dir(t),ledger=L.empty();L.seed(ledger,[{gmailId:'m',advertisedUnseen:0,url:'https://www.linkedin.com/jobs/search-results/?keywords=manufacturing'}]);L.capture(ledger,{gmailId:'m',url:ledger.sources.m.url,at:new Date().toISOString(),jobs:[{jobId:'1234',paragraphs:[title,'Factory','Austin, TX']}],next:false,endConfirmed:true});
 S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',ledger);S.save(root,'state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]});S.save(root,'control/CLAUDE_HELPER_WORK.json',{schema:'forge.claude-helper-work.v1',assignmentId:'OLD',enabled:false,intake:[],enrichment:[],released:[]});
 S.save(root,'control/GROK_INTAKE_HELPER_WORK.json',{schema:'forge.intake-helper-work.v1',assignmentId:'INTAKE',enabled:true,routingActive:true,taskKey:'FORGE_GROK_INTAKE_HELPER',keys:[],pages:[]});
 S.save(root,'control/CLAUDE_RELEVANCE_WORK.json',{schema:'forge.relevance-helper-work.v1',assignmentId:'RELEVANCE',enabled:true,taskKey:'FORGE_CLAUDE_RELEVANCE_REVIEW',keys:[],pages:[],coordinatorHandoffs:{}});
 S.save(root,'control/ENRICHMENT_HELPER_WORK.json',{schema:'forge.enrichment-helper-work.v1',assignmentId:'ENRICH',enabled:true,routingActive:true,items:[]});
 return{root,state:C.empty(),snapshot:{rows:[],archiveRows:[],source:{readAt:new Date().toISOString()}},runId:'FORGE-CODE-TEST',apply:true,ledger};
}
test('complete captured cards enter code intake directly without fabricated Claude evidence',t=>{
 const f=assignment(t),result=A.replenish(f);a.equal(result.counts.seededCodeIntake,1);a.equal(result.appended.length,0);
 const item=I.find(f.root,'linkedin:1234');a.equal(item.provider,'CODE');a.equal(I.original(f.root,item,{}).sourceEvidence.company,'Factory');
 const plan=require('../relevance-screen/prepare.cjs').prepare({root:f.root,rows:[],sourceAt:new Date().toISOString(),runId:f.runId});a.equal(plan.counts.READY,1);
 const combined=I.load(f.root);combined.items[0].status='POST_IN_FLIGHT_UNKNOWN';I.save(f.root,combined);a.equal(S.read(f.root,'state/CLAUDE_HELPER_CONSUMPTION.json').items.length,0);a.equal(S.read(f.root,'state/CODE_INTAKE_CONSUMPTION.json').items[0].status,'POST_IN_FLIGHT_UNKNOWN');
 f.ledger.jobs['linkedin:1234'].company='Changed';S.save(f.root,'state/EMAIL_RECOVERY_QUEUE.json',f.ledger);a.throws(()=>I.original(f.root,item,{}),/CONFLICT/);
});
test('unclear scope is published to the existing Claude assignment with no overlap or assignment-ID reset',t=>{
 const f=assignment(t,'General Manager'),result=A.replenish(f),w=S.read(f.root,'control/CLAUDE_RELEVANCE_WORK.json');a.equal(result.appended.length,1);a.equal(w.assignmentId,'RELEVANCE');a.deepEqual(w.keys,['linkedin:1234']);a.equal(S.read(f.root,'control/GROK_INTAKE_HELPER_WORK.json').keys.length,0);
 const again=A.replenish({...f,runId:'FORGE-CODE-TEST-2'});a.equal(again.appended.length,0);a.equal(S.read(f.root,'control/CLAUDE_RELEVANCE_WORK.json').pages.length,1);
});
test('pending transactions and canonical protected matches are not assigned or reseeded',t=>{
 const f=assignment(t);f.ledger.jobs['linkedin:1234'].submissions=[{requestId:'ORIGINAL'}];S.save(f.root,'state/EMAIL_RECOVERY_QUEUE.json',f.ledger);a.equal(A.replenish(f).counts.fenced,1);a.equal(I.load(f.root).items.length,0);
 const g=assignment(t);g.snapshot.rows=[{PRIMARY_ID:'V2I-ONE',COMPANY:'Factory',TITLE:'Director of Manufacturing',LOCATION:'Austin, TX',BUCKET:'DECLINED_BY_TIM',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/1234/'}}];a.equal(A.replenish(g).counts.canonical,1);a.equal(I.load(g.root).items.length,0);
 a.equal(S.read(g.root,'state/EMAIL_RECOVERY_QUEUE.json').jobs['linkedin:1234'].status,'VERIFIED_EXISTING');a.equal(S.read(g.root,'state/EMAIL_RECOVERY_SUMMARY.json').pendingJobs,0);a.equal(g.snapshot.rows[0].BUCKET,'DECLINED_BY_TIM');a.equal(S.read(g.root,'receipts/FORGE-CODE-TEST_HANDOFFS.json').canonicalMatches[0].primaryId,'V2I-ONE');a.equal(S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json').jobs['linkedin:1234'].submissions[0].requestId,'ORIGINAL');
 a.throws(()=>A.replenish({...g,snapshot:{...g.snapshot,source:{readAt:'2020-01-01T00:00:00Z'}}}),/FRESH_CANONICAL/);
});
test('a source URL shared by conflicting canonical identities remains an unresolved identity exception',t=>{
 const f=assignment(t),row={PRIMARY_ID:'ONE',COMPANY:'Factory',TITLE:'Director of Manufacturing',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/1234/'}};
 f.snapshot.rows=[row];f.snapshot.archiveRows=[{...row,PRIMARY_ID:'TWO',TITLE:'Different role'}];const r=A.replenish(f);
 a.equal(r.counts.canonical,0);a.equal(r.exceptions[0].reason,'CANONICAL_NEAR_MATCH_REQUIRES_IDENTITY');a.equal(S.read(f.root,'state/EMAIL_RECOVERY_QUEUE.json').jobs['linkedin:1234'].status,'UNSCREENED');a.equal(r.appended.length,0);
});
test('assignment replenishment waits for handed-off research, retains reservations, and adds all eligible keys',t=>{
 const f=assignment(t,'General Manager'),work=S.read(f.root,'control/CLAUDE_RELEVANCE_WORK.json');work.keys=['linkedin:old'];S.save(f.root,'control/CLAUDE_RELEVANCE_WORK.json',work);
 a.equal(A.replenish(f).appended.length,0);
 f.state.batches.batch={status:'VALIDATED'};f.state.items.old={taskKey:'FORGE_CLAUDE_RELEVANCE_REVIEW',itemKey:'linkedin:old',batch:'batch',status:'EXCEPTION'};
 const r=A.replenish({...f,runId:'FORGE-CODE-TEST-2'});a.equal(r.appended.length,1);a.deepEqual(S.read(f.root,'control/CLAUDE_RELEVANCE_WORK.json').keys,['linkedin:old','linkedin:1234']);
});
test('browser adapter refuses remote endpoints and never silently enables a debugger or signs in',async()=>{
 const B=require('./browser.cjs');a.throws(()=>B.endpoint('http://remote.example.com:9222'),/LOCAL_BROWSER/);a.throws(()=>B.sourceUrl('https://unapproved.example.com'),/UNAPPROVED/);await a.rejects(B.connect({}),/SUPPORTED_BROWSER_ROUTE/);
});

test('verified helper source without a legacy intake record enters the existing plan, but changed evidence cannot',t=>{
 const f=assignment(t),key='linkedin:5678',batch='receipts/GROK_HELPERS/FORGE_GROK_INTAKE_HELPER/GROK-INTAKE-VERIFIED.json',sourceEvidence={company:'Factory',title:'Director of Manufacturing',location:'Austin, TX',url:'https://employer.example/job/5678',observedAt:new Date().toISOString(),sourceSha256:'b'.repeat(64),independentlyVerified:true};
 const item={key,recommendation:'INTAKE_READY',sourceEvidence},coordinatorKey='FORGE_GROK_INTAKE_HELPER:'+key;
 S.save(f.root,batch,{runId:'GROK-INTAKE-VERIFIED',items:[item]});f.state.batches[batch]={status:'VALIDATED'};
 f.state.items[coordinatorKey]={key:coordinatorKey,itemKey:key,taskKey:'FORGE_GROK_INTAKE_HELPER',batch,version:S.hash(item),status:'SOURCE_VERIFIED',sourceEvidence};S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);
 a.equal(I.seedVerified(f.root,f.state,true).seeded,1);a.equal(I.seedVerified(f.root,f.state,true).seeded,0);const seeded=I.find(f.root,key);a.equal(I.original(f.root,seeded,{}).key,key);
 const plan=require('../relevance-screen/prepare.cjs').prepare({...f,rows:[],sourceAt:new Date().toISOString(),apply:false});a.equal(plan.counts.READY,1);a.equal(plan.items[0].record.DISCOVERY_SOURCE,'SAVED_SOURCE_EVIDENCE');
 f.state.batches[batch].status='QUARANTINED';S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);a.throws(()=>I.original(f.root,seeded,{}),/CURRENT_SOURCE_INSPECTION/);
});
test('helper next drains completed pages in code without requiring an AI to count or select the next page',t=>{
 const f=assignment(t),w=S.read(f.root,'control/GROK_INTAKE_HELPER_WORK.json');w.keys=['old','next'];w.pages=[{path:'control/p1.json'},{path:'control/p2.json'}];
 S.save(f.root,'control/p1.json',{items:[{key:'old'}]});S.save(f.root,'control/p2.json',{items:[{key:'next'}]});
 const Next=require('./next.cjs'),accepted={items:{old:{status:'RETURNED_PENDING_INSPECTION'}}};a.equal(Next.intake(f.root,w,accepted).page,2);accepted.items.next={status:'SOURCE_BLOCKED'};a.equal(Next.intake(f.root,w,accepted).helperResearchExhausted,true);a.equal(Next.intake(f.root,w,accepted).assignmentComplete,false);
});
test('transport continues inbox processing without a browser and puts only real exceptions in the coordinator report',async t=>{
 const f=assignment(t),privateDir=dir(t);S.save(f.root,'control/AUTOMATION_OPERATING_MODEL.json',{external:[]});
 S.save(f.root,'control/AI_AUTOMATION_TASKS.json',{tasks:{}});
 const result=await require('./run.cjs').run({...f,apply:false,privateDir,commit:'a'.repeat(40),config:{inboxes:[]}});a.equal(result.report.noProcessingCap,true);a.equal(result.report.exceptions[0].reason,'SUPPORTED_BROWSER_ROUTE_UNAVAILABLE');
 const state={...f.state,routineHandoffs:{transport:result.report,assignments:{exceptions:[{key:'identity',owner:'AI',reason:'CANONICAL_NEAR_MATCH_REQUIRES_IDENTITY'}]}}};
 const report=require('../programmed-coordinator/run.cjs').publicReport(state,{},new Date().toISOString());a.equal(report.aiExceptions.length,1);a.equal(report.codeExceptions.length,1);
});
