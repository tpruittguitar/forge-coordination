'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Source=require('./source.cjs'),T=require('./transactions.cjs'),S=require('./store.cjs'),Resume=require('../source-trial/resume-match');
const profile=Resume.load(),quote='Lead manufacturing production and quality systems across the plant.',url='https://careers.factory.com/jobs/123';
const row={PRIMARY_ID:'V2I-TEST',COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{}};
const source=()=>({identityVerified:true,sourceIdentity:T.identity(row),description:quote.repeat(10),observedAt:'2026-11-09T12:00:00Z',sourceUrl:url,finalUrl:url,format:'HTML',postingFacts:{url}});
const item=()=>({sourceEvidence:{url,fit:{resumeTextSha256:profile.source.textSha256,requirements:[{quote,competencyIds:['manufacturing_leadership']}]}}});
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-shared-evidence-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('fit is independently grounded per requirement and stores evidence rather than scores',()=>{
 const verified=Source.helperEvidence(source(),item());const fields=Source.enrichmentFields(verified,row);
 a.equal(fields.FIT_EVIDENCE,quote);a.match(fields.FIT_BASIS,/not final fit/);a.equal(fields.FIT_CONF,'LOW');a.equal(fields.SOURCE_URL,url);
 for(const key of ['SCOPE_FIT_RAW','EXPERIENCE_FIT','ADJUSTED_FIT','FLEX_CLASS','INITIATING_URL'])a.equal(fields[key],undefined);
 a.equal(Source.enrichmentFields(verified,{...row,COMPANY:'Other'}).FIT_EVIDENCE,undefined);
 a.equal(Source.enrichmentFields(verified,{...row,p:{FIT_EVIDENCE:'Existing'}}).FIT_EVIDENCE,undefined);
});
test('stale resume, fabricated requirements, and unrelated competencies fail closed',()=>{
 let i=item();i.sourceEvidence.fit.resumeTextSha256='0'.repeat(64);a.throws(()=>Source.helperEvidence(source(),i),/CURRENT_RESUME/);
 i=item();i.sourceEvidence.fit.requirements[0].quote='Requires holding a currently active secret clearance.';a.throws(()=>Source.helperEvidence(source(),i),/QUOTE/);
 i=item();i.sourceEvidence.fit.requirements[0].competencyIds=['invented'];a.throws(()=>Source.helperEvidence(source(),i),/MAPPING/);
 i=item();i.sourceEvidence.fit.requirements[0].quote='Leadmanufacturing production and quality systems across the plant.';a.throws(()=>Source.helperEvidence(source(),i),/QUOTE/);
});
test('exact links require fetched self-binding and preserve all existing provenance',()=>{
 for(const s of [{...source(),postingFacts:{}},{...source(),finalUrl:'https://careers.factory.com/'},{...source(),postingFacts:{url:'https://careers.factory.com/jobs/456'}}])a.equal(Source.helperEvidence(s,{}).exactLink,undefined);
 const verified=Source.helperEvidence(source(),{});a.equal(verified.exactLink,url);a.equal(Source.enrichmentFields(verified,row).COMPANY_SOURCE_URL,undefined);
 const fields=Source.enrichmentFields(verified,{...row,p:{SOURCE_URL:'https://other.example/jobs/1',INITIATING_URL:'https://original.example/jobs/1'}});a.equal(fields.SOURCE_URL,undefined);a.equal(fields.INITIATING_URL,undefined);
});
test('cached source is rechecked against each new helper fit claim',async t=>{
 const privateDir=dir(t),expected=T.identity(row),j={'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description:source().description,url};let calls=0;
 const options={item:item(),expected,privateDir,fetchPage:async()=>{calls++;return{url,raw:'<script type="application/ld+json">'+JSON.stringify(j)+'</script>'};}};
 const first=await Source.verify(options);a.ok(first.fitEvidence);options.item.sourceEvidence.fit.requirements[0].competencyIds=['invented'];await a.rejects(Source.verify(options),/MAPPING/);a.equal(calls,1);
});
test('transactions support evidence and exact link keys but forbid score outputs and provenance rewrites',async t=>{
 const root=dir(t),privateDir=dir(t),state={transactions:{},items:{one:{}}},fields=Source.enrichmentFields(Source.helperEvidence(source(),item()),row);let posts=0;
 const options={root,privateDir,state,jobs:[{itemKey:'one',primaryId:row.PRIMARY_ID,identity:T.identity(row),fields,sourceSha256:'a'.repeat(64)}],runId:'FORGE-SHARED-TEST',deps:{checkLock(){},snapshot:async()=>({rows:[row],status:{freeze:null,level:'OK',errors:[],unverified:{count:0}}}),exists:async()=>false,post:async()=>{posts++;return{};}}};
 for(const key of ['SCOPE_FIT_RAW','ADJUSTED_FIT','EXPERIENCE_FIT','INITIATING_URL','TIM_DECISION']){
  options.jobs[0].fields={[key]:'90'};await a.rejects(T.submit(options),/Unsupported/);
 }
 a.equal(posts,0);options.jobs[0].fields=fields;await T.submit(options);a.equal(posts,1);a.equal(S.read(root,'state/PROGRAMMED_COORDINATOR.json').transactions['FORGE-SHARED-TEST-E00001'].status,'AWAITING_VERIFICATION');
});
test('known canonical requisition binds source and pre-POST identity',()=>{
 const r={...row,REQ_ID:'REQ-123'},expected=T.identity(r);
 a.equal(expected.reqId,'REQ-123');a.equal(T.same({...r,REQ_ID:'REQ-456'},expected),false);
 const posting={title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description:source().description,identifier:{value:'REQ-456'}};
 a.throws(()=>Source.inspectJobs([posting],expected),/REQUISITION/);
 posting.identifier.value='REQ-123';a.equal(Source.inspectJobs([posting],expected).identityVerified,true);
});
test('ATS exact links reject embedded hosts and independently bind returned posting IDs',()=>{
 const F=require('./posting-formats.cjs'),id='12345678-1234-1234-1234-123456789abc',good='https://jobs.lever.co/factory/'+id;
 const make=page=>{const route=F.routes([page])[0];return{...source(),format:'ATS_API',route,finalUrl:route.api,postingFacts:{url:good,reqId:id}};};
 a.equal(Source.helperEvidence(make(good),{}).exactLink,good);
 for(const bad of ['https://attacker.example/jobs.lever.co/factory/'+id,'https://jobs.lever.co.attacker.example/jobs.lever.co/factory/'+id])a.equal(Source.helperEvidence(make(bad),{}).exactLink,undefined);
 const s=make(good);s.postingFacts.url=good.replace(id,'87654321-1234-1234-1234-123456789abc');a.equal(Source.helperEvidence(s,{}).exactLink,undefined);
 s.postingFacts={url:good,reqId:'another-id'};a.equal(Source.helperEvidence(s,{}).exactLink,undefined);
});
test('Workday links require independent external URL and recognized matching requisition',()=>{
 const F=require('./posting-formats.cjs');
 const make=(slug,id)=>{const link='https://factory.wd1.myworkdayjobs.com/External/job/Austin/'+slug,route=F.routes([link])[0];return{...source(),format:'ATS_API',route,finalUrl:route.api,postingFacts:{url:link,reqId:id},raw:JSON.stringify({jobPostingInfo:{externalUrl:link,jobReqId:id,jobPostingId:slug}})};};
 const good=make('Plant-Manager_R123','R123');a.equal(Source.helperEvidence(good,{}).exactLink,good.postingFacts.url);
 for(const s of [make('Plant-Manager','R123'),make('Plant-Manager_R456','R123'),{...good,raw:JSON.stringify({jobPostingInfo:{jobReqId:'R123'}})}])a.equal(Source.helperEvidence(s,{}).exactLink,undefined);
});
test('unmapped requirements retain exact evidence without claiming resume support or blocking independent facts',()=>{
 const unsupported='Requires a currently active specialized aerospace certification.';
 const s={...source(),description:source().description+unsupported,degree:{text:"Bachelor's degree required",req:'REQUIRED'}};
 const i=item();i.sourceEvidence.fit.requirements.push({quote:unsupported,competencyIds:[]});
 const verified=Source.helperEvidence(s,i),fields=Source.enrichmentFields(verified,row);
 a.deepEqual(verified.fitEvidence.requirements[1],{quote:unsupported,competencyIds:[]});
 a.equal(fields.DEGREE_REQ,'REQUIRED');a.match(fields.FIT_EVIDENCE,/aerospace certification/);a.match(fields.FIT_BASIS,/manufacturing_leadership \/ NO_OBSERVED_RESUME_OVERLAP/);a.equal(fields.FIT_CONF,'LOW');
 i.sourceEvidence.fit.requirements=[{quote:unsupported,competencyIds:[]}];a.match(Source.enrichmentFields(Source.helperEvidence(s,i),row).FIT_BASIS,/NO_OBSERVED_RESUME_OVERLAP/);
 for(const ids of [null,'',{},['manufacturing_leadership','manufacturing_leadership'],['invented']]){i.sourceEvidence.fit.requirements=[{quote:unsupported,competencyIds:ids}];a.throws(()=>Source.helperEvidence(s,i),/MAPPING/);}
 i.sourceEvidence.fit.requirements=[{quote:'Invented qualification that is not actually stated in the posting.',competencyIds:[]}];a.throws(()=>Source.helperEvidence(s,i),/QUOTE/);
});
test('omitted fit bindings derive from the current resume only after independent exact quote validation',()=>{
 const i={sourceEvidence:{fit:{requirements:[{quote}]}}},verified=Source.helperEvidence(source(),i);
 a.equal(verified.fitEvidence.resumeTextSha256,profile.source.textSha256);
 a.deepEqual(verified.fitEvidence.requirements[0].competencyIds,Resume.match({description:quote},profile).matches.map(m=>m.competencyId).sort());
 const noOverlap='Requires a currently active specialized aerospace certification.';i.sourceEvidence.fit.requirements=[{quote:noOverlap}];
 a.deepEqual(Source.helperEvidence({...source(),description:source().description+noOverlap},i).fitEvidence.requirements[0].competencyIds,[]);
 a.throws(()=>Source.helperEvidence(source(),i),/QUOTE/);
 i.sourceEvidence.fit.resumeTextSha256=null;a.throws(()=>Source.helperEvidence(source(),i),/CURRENT_RESUME/);
});
