'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('./store.cjs'),Source=require('./source.cjs'),Run=require('./run.cjs'),I=require('../routine-handoffs/intake-state.cjs'),P=require('../relevance-screen/prepare.cjs');
const identity={company:'Factory',title:'Director, Manufacturing',location:'Austin, TX'},url='https://www.linkedin.com/jobs/view/4481234567/',key='linkedin:4481234567',old='2020-01-01T00:00:00Z';
const quote='Lead manufacturing production and quality systems across the plant.',description=quote.repeat(8)+' Bachelor degree preferred. Annual base salary USD $100,000 - $150,000 per year.';
function fixture(t,{text=description,source='JOBSPY:linkedin',recommendation='INTAKE_READY',validThrough}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'captured-helper-')),privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'captured-private-'));t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(privateDir,{recursive:true,force:true});});
 const taskKey='FORGE_GROK_INTAKE_HELPER',batch='receipts/captured-helper.json',sourceEvidence={...identity,url,...(text?{quote}:{})},evidence={key,recommendation,sourceEvidence};
 const item={key:'one',itemKey:key,taskKey,batch,status:'RETURNED',attempts:0,version:S.hash(evidence)},state={items:{one:item},batches:{[batch]:{status:'VALIDATED'}},exceptions:{},transactions:{}};
 S.save(root,batch,{runId:'FORGE-TEST',items:[evidence]});S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:{workAssignments:'control/work.json'}}});S.save(root,'control/work.json',{pages:[{path:'control/page.json'}]});S.save(root,'control/page.json',{items:[{key,sourceEvidence:{...identity,url}}]});
 S.save(root,'state/source-trial-report.json',{summary:{at:old},new_roles:[{...identity,url,source,description:text,...(validThrough?{validThrough}:{})}]});
 S.save(root,'control/CLAUDE_HELPER_WORK.json',{schema:'forge.claude-helper-work.v1',enabled:false,assignmentId:'TEST',intake:[],enrichment:[],released:[],transfer:{status:'COMPLETE',to:'ChatGPT',proof:'receipts/transfer.json'}});S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{schema:'forge.email-recovery.v1',sources:{},jobs:{}});
 return{root,privateDir,item,state,evidence,snapshot:{rows:[],archiveRows:[]},sourceAt:new Date().toISOString(),runId:'FORGE-TEST-CAPTURED',rows:[]};
}
const noFetch=async()=>{throw Error('UNEXPECTED_SOURCE_FETCH');};
test('old captured JobSpy, HiringCafe, LinkedIn and recruiter text has equal facts without a fetch',async t=>{
 for(const source of ['JOBSPY:linkedin','HIRINGCAFE','LinkedIn','Recruiting agency']){
  const f=fixture(t,{source}),found=await Source.verify({...f,item:f.evidence,expected:identity,fetchPage:noFetch});
  a.equal(found.sourceCaptured,true);a.equal(found.independentlyVerified,false);a.equal(found.postingStatus,'UNVERIFIED');a.equal(found.observedAt,old);a.equal(found.degree.req,'PREFERRED');a.equal(found.pay.low,100000);a.equal(found.exactLink,undefined);
 }
});
test('metadata-only captured source is an honest intake lead and never fabricated text or enrichment',async t=>{
 const f=fixture(t,{text:''});await Run.inspectReturns({...f,sourceVerify:noFetch});
 a.equal(f.item.status,'SOURCE_CAPTURED');a.equal(f.item.sourceEvidence.independentlyVerified,false);a.equal(f.item.sourceEvidence.fullPosting,false);a.equal(f.item.sourceEvidence.description,undefined);
 S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);a.equal(I.seedVerified(f.root,f.state,true).seeded,1);
 const original=I.original(f.root,I.load(f.root).items[0],{});a.equal(original.sourceEvidence.discoveryEvidence.card.description,'');
 const prepared=P.prepare(f);a.equal(prepared.counts.READY,1);a.equal(prepared.items[0].record.EMPLOYER_PRIMARY_BUSINESS,undefined);a.equal(prepared.items[0].record.SALARY_BASE_LOW,undefined);
});
test('captured source resolves access-only retry and SOURCE_BLOCKED status without a new source request',async t=>{
 const f=fixture(t,{recommendation:'SOURCE_BLOCKED'});Object.assign(f.item,{status:'EXCEPTION',retryAfter:'2999-01-01T00:00:00Z',sourceParserVersion:Source.PARSER_VERSION,sourceRetryVersion:Source.RETRY_VERSION});f.state.exceptions.one={reason:'SOURCE_HTTP_403'};
 await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(f.item.status,'SOURCE_CAPTURED');a.equal(f.item.retryAfter,undefined);a.equal(f.state.exceptions.one,undefined);
 S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);I.seedVerified(f.root,f.state,true);a.equal(P.prepare(f).counts.READY,1);
});
test('captured text cannot clear identity conflict, pending transaction, quarantine or protected canonical guards',async t=>{
 for(const guard of ['conflict','transaction','quarantine']){
  const f=fixture(t);if(guard==='conflict'){Object.assign(f.item,{status:'EXCEPTION',retryAfter:'2999-01-01T00:00:00Z'});f.state.exceptions.one={reason:'SOURCE_IDENTITY_AMBIGUOUS'};}
  if(guard==='transaction')Object.assign(f.item,{status:'POST_IN_FLIGHT_UNKNOWN',transactionId:'ORIGINAL'});
  if(guard==='quarantine')f.state.batches[f.item.batch].status='QUARANTINED';
  const before=JSON.stringify(f.state);await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(JSON.stringify(f.state),before,guard);
 }
 const f=fixture(t),row={PRIMARY_ID:'V2I-PROTECTED',COMPANY:identity.company,TITLE:identity.title,LOCATION:identity.location,BUCKET:'DECLINED_BY_TIM',p:{SOURCE_URL:url}};f.snapshot.rows=[row];await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(f.item.status,'EXISTING_CANONICAL');
});
test('captured quotes and fit claims remain source-bound and explicit posting expiry stays blocked',async t=>{
 const f=fixture(t);await a.rejects(Source.verify({...f,item:{sourceEvidence:{...f.evidence.sourceEvidence,quote:'MBA required'}},expected:identity,fetchPage:noFetch}),/QUOTE/);
 await a.rejects(Source.verify({...f,item:{sourceEvidence:{...f.evidence.sourceEvidence,fit:{requirements:[{quote:'Invented requirement no saved source stated for this role.'}]}}},expected:identity,fetchPage:noFetch}),/FIT_QUOTE/);
 const expired=fixture(t,{validThrough:'2020-02-01T00:00:00Z'});await a.rejects(Source.verify({...expired,item:expired.evidence,expected:identity,fetchPage:noFetch}),/POSTING_EXPIRED/);
});
test('old private source body cache is reparsed without fetching or renewing observation time',async t=>{
 const f=fixture(t),sourceUrl='https://careers.factory.com/jobs/999',item={sourceEvidence:{url:sourceUrl,quote}},expected=identity,cacheKey=S.hash({url:sourceUrl,expected,quote});
 const job={'@type':'JobPosting',title:identity.title,hiringOrganization:{name:identity.company},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description,url:sourceUrl},raw='<script type="application/ld+json">'+JSON.stringify(job)+'</script>';
 S.save(f.privateDir,'sources/'+cacheKey+'.json',{raw,sourceSha256:S.hash(raw),observedAt:old,sourceUrl,finalUrl:sourceUrl,expected,format:'HTML'});
 const found=await Source.verify({...f,item,expected,fetchPage:noFetch});a.equal(found.observedAt,old);a.equal(found.postingStatus,'UNVERIFIED');a.equal(found.degree.req,'PREFERRED');
});
test('new captured facts replace an unfenced legacy programmed binding but never a pending original',async t=>{
 const f=fixture(t);await Run.inspectReturns({...f,sourceVerify:noFetch});S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);
 const legacy={key,provider:'CODE',coordinatorKey:f.item.key,sourceVersion:f.item.version,provenance:'PROGRAMMED_SOURCE_VERIFIED',sourceEvidence:{...identity,url,sourceSha256:'a'.repeat(64)},status:'RETURNED_PENDING_SCREEN'};
 S.save(f.root,'state/CODE_INTAKE_CONSUMPTION.json',{items:[legacy]});a.equal(I.seedVerified(f.root,f.state,true).seeded,1);a.equal(P.prepare(f).counts.READY,1);
 legacy.status='POST_IN_FLIGHT_UNKNOWN';legacy.requestId='ORIGINAL';S.save(f.root,'state/CODE_INTAKE_CONSUMPTION.json',{items:[legacy]});a.equal(I.seedVerified(f.root,f.state,true).seeded,0);a.deepEqual(I.load(f.root).items[0],legacy);
});
test('captured enrichment derives supported degree and salary only and respects field/protected fences',async t=>{
 const f=fixture(t),taskKey='FORGE_GROK_ENRICHMENT',primaryId='V2I-ONE',evidence={primaryId,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:f.evidence.sourceEvidence};
 f.item.taskKey=taskKey;f.item.itemKey=primaryId;f.item.version=S.hash(evidence);S.save(f.root,f.item.batch,{items:[evidence]});
 f.snapshot.rows=[{PRIMARY_ID:primaryId,COMPANY:identity.company,TITLE:identity.title,LOCATION:identity.location,BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:url}}];
 await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(f.item.status,'READY_ENRICHMENT');a.equal(f.item.prepared.fields.DEGREE_REQ,'PREFERRED');a.equal(f.item.prepared.fields.SALARY_BASE_LOW,100000);a.equal(f.item.prepared.fields.SALARY_ASOF,'2020-01-01');a.equal(f.item.prepared.fields.LIVENESS,undefined);a.equal(f.item.prepared.fields.COMPANY_SOURCE_URL,undefined);
 f.item.status='RETURNED';f.snapshot.rows[0].BUCKET='DECLINED_BY_TIM';await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(f.item.status,'PROTECTED_SKIP');
});
test('captured salary metadata forbids relabeling estimates or conflicting currency, period and basis as employer pay',async t=>{
 const Posted=require('../source-trial/posted-pay');
 for(const changes of [{status:'ESTIMATED'},{currency:'CAD'},{period:'HOUR'},{basis:'TOTAL'},{low:90000}]){
  const f=fixture(t),report=S.read(f.root,'state/source-trial-report.json'),card=report.new_roles[0];
  card.postedPay={...Posted.capture({...card,min_amount:100000,max_amount:150000,currency:'USD',interval:'YEAR',salaryText:'Annual base salary USD $100,000 - $150,000 per year.'},{observedAt:old}),basis:'BASE',...changes};S.save(f.root,'state/source-trial-report.json',report);
  const result=await Source.verify({...f,item:f.evidence,expected:identity,fetchPage:noFetch});a.equal(result.pay,null,JSON.stringify(changes));a.equal(result.degree.req,'PREFERRED');
 }
});
test('a positive degree quote from a partial capture does not mark all requirements reviewed',async t=>{
 const f=fixture(t,{text:'Bachelor degree preferred.'}),result=await Source.verify({...f,item:{sourceEvidence:{...identity,url}},expected:identity,fetchPage:noFetch});
 a.equal(result.fullPosting,false);a.equal(result.degree.req,'PREFERRED');
 const fields=Source.enrichmentFields(result,{COMPANY:identity.company,TITLE:identity.title,LOCATION:identity.location,p:{}});a.equal(fields.DEGREE_REQ,'PREFERRED');a.equal(fields.REQUIREMENTS_REVIEWED,undefined);
});
test('ordinary captured intake ignores unused helper quote/fit assertions but enrichment still validates claimed support',async t=>{
 const f=fixture(t);f.evidence.sourceEvidence.quote='An unsupported helper quote unrelated to the recorded job';f.evidence.sourceEvidence.fit={resumeTextSha256:'0'.repeat(64),requirements:[{quote}]};f.item.version=S.hash(f.evidence);S.save(f.root,f.item.batch,{items:[f.evidence]});
 await Run.inspectReturns({...f,sourceVerify:noFetch});a.equal(f.item.status,'SOURCE_CAPTURED');a.equal(f.item.sourceEvidence.fit,undefined);a.equal(f.item.sourceEvidence.fitEvidence,undefined);a.equal(f.item.sourceEvidence.quote,undefined);a.equal(f.item.sourceEvidence.description,description);
 const g=fixture(t),primaryId='V2I-CLAIM',evidence={primaryId,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:f.evidence.sourceEvidence};g.item.taskKey='FORGE_GROK_ENRICHMENT';g.item.itemKey=primaryId;g.item.version=S.hash(evidence);S.save(g.root,g.item.batch,{items:[evidence]});g.snapshot.rows=[{PRIMARY_ID:primaryId,COMPANY:identity.company,TITLE:identity.title,LOCATION:identity.location,BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:url}}];
 await Run.inspectReturns({...g,sourceVerify:noFetch});a.equal(g.item.status,'EXCEPTION');a.match(g.state.exceptions.one.reason,/QUOTE/);a.equal(g.item.prepared,undefined);
});
