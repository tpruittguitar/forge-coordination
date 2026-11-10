'use strict';
// REV-116 end-to-end dry run on a synthetic master: posting pay (ATS, then aggregator) before any estimate.
// Needs a foreman-cockpit checkout: ENRICH_FC_DIR (default ../foreman-cockpit next to this repo).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), FC = process.env.ENRICH_FC_DIR || path.resolve(ROOT, '../foreman-cockpit');
const row = (n, id, title, loc, payload) => `${n} | ${id} | Acme | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
const sourceRunOwners = new WeakSet();
function sourceRun(t,lines,responses,config={},cache,ledger){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-source-fetch-')),master=path.join(dir,'master.txt'),sources=path.join(dir,'sources.json'),reads=path.join(dir,'reads.txt');
 const outputs=['state/enrich-ats-pay-report.json','state/enrich-ats-pay-products.json','state/enrich-ats-pay-recovery.json','state/enrich-ats-pay-calibration.json'].map(p=>path.join(ROOT,p));
 // One baseline per test, not per invocation. after hooks run in registration
 // order, so multiple snapshots would restore an earlier synthetic report last.
 if(!sourceRunOwners.has(t)){
  const before=outputs.map(p=>fs.existsSync(p)?fs.readFileSync(p):null);sourceRunOwners.add(t);
  t.after(()=>outputs.forEach((p,i)=>{if(before[i]!==null)fs.writeFileSync(p,before[i]);else fs.rmSync(p,{force:true});}));
 }
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(master,lines.join('\n'));fs.writeFileSync(sources,JSON.stringify(responses));if(ledger)fs.writeFileSync(path.join(dir,'ledger.json'),JSON.stringify(ledger));if(cache)fs.writeFileSync(path.join(dir,'emp.json'),JSON.stringify(cache));
 cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_SOURCE_RESPONSES:sources,ENRICH_TEST_FETCHES:reads,ENRICH_TEST_CONFIG:JSON.stringify(config)},stdio:'pipe'});
 return {cache:require('./employer-cache-store').read(path.join(dir,'emp.json')),report:JSON.parse(fs.readFileSync(outputs[0])),reads:fs.existsSync(reads)?fs.readFileSync(reads,'utf8').trim().split('\n'):[]};
}
const exactPosting=()=>'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Director of Quality',hiringOrganization:{name:'Acme'},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH'}},description:'Lead manufacturing quality and production operations. '.repeat(12)+'Bachelor degree required.',baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}})+'</script>';
test('multiple source runs restore the original report after the owning test completes',async t=>{
 const outputs=['report','products','recovery','calibration'].map(name=>path.join(ROOT,'state/enrich-ats-pay-'+name+'.json')),before=outputs.map(p=>fs.existsSync(p)?fs.readFileSync(p):null);
 await t.test('two fixture runs share one cleanup baseline',child=>{
  for(const id of ['V2I-ISOLATION-FIRST','V2I-ISOLATION-SECOND']){
   const url='https://careers.example.org/isolation';
   const out=sourceRun(child,[row(1,id,'Director of Quality','Dayton, OH','SOURCE_URL='+url)],{[url]:{body:exactPosting()}});
   assert.equal(out.report.sample[0].id,id);
  }
 });
 outputs.forEach((p,i)=>assert.deepEqual(fs.existsSync(p)?fs.readFileSync(p):null,before[i],p));
});
test('failed ATS aliases fetch one endpoint and do not crowd out a genuinely different fallback',t=>{
 const api='https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true',other='https://careers.example.org/exact';
 const line=row(1,'V2I-DEDUP','Director of Quality','Dayton, OH',`ATS_POSTING_URL=https://boards.greenhouse.io/acme/jobs/111; DIRECT_JOB_URL=https://job-boards.greenhouse.io/acme/jobs/111; LIVENESS_EVIDENCE_URL=${api}; SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111#pay; COMPANY_SOURCE_URL=${other}`);
 const out=sourceRun(t,[line],{[api]:{status:404},[other]:{body:exactPosting()}});
 assert.deepEqual(out.reads,[api,other]);assert.equal(out.report.source_reads,2);assert.equal(out.report.source_retries,0);assert.ok(out.report.source_duplicate_skips>=4);assert.equal(out.report.public_tried,1);
 assert.equal(out.report.sample[0].fields.SALARY_BASE_LOW,180000);assert.equal(out.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
});
test('exhausted transient retry cannot restart from fallback; a different posting still works',t=>{
 const api='https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true',other='https://careers.example.org/exact';
 const out=sourceRun(t,[row(1,'V2I-RETRY','Director of Quality','Dayton, OH',`ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/111; SOURCE_URL=${api}; DIRECT_JOB_URL=${other}`)],{[api]:{status:503},[other]:{body:exactPosting()}});
 assert.deepEqual(out.reads,[api,api,other]);assert.equal(out.report.source_retries,1);assert.equal(out.report.public_tried,1);assert.equal(out.report.sample[0].fields.SALARY_BASE_LOW,180000);
});
test('provider circuit breaker also gates distinct raw guest URLs in fallback, not other employers',t=>{
 const lines=[],responses={},guests=[];for(let i=0;i<4;i++){
  const id='501234567'+i,guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'+id,alternate=guest+'0',employer='https://careers.example.org/job/'+i;
  guests.push(guest,alternate);responses[guest]={status:403};responses[alternate]={status:403};responses[employer]={body:i===3?exactPosting():'No complete posting'};
  lines.push(row(i+1,'V2I-CIRCUIT'+i,'Director of Quality','Dayton, OH',`SOURCE_URL=https://www.linkedin.com/jobs/view/${id}; LIVENESS_EVIDENCE_URL=${alternate}; COMPANY_SOURCE_URL=${employer}; DATE_ADDED=2026-11-0${7-i}`));
 }
 const out=sourceRun(t,lines,responses),providerReads=out.reads.filter(u=>u.includes('linkedin.com'));
 assert.equal(providerReads.length,3);assert.equal(new Set(providerReads).size,3);assert.equal(out.report.agg_failed.linkedin,3);assert.equal(out.report.agg_tried.linkedin,3);
 assert.ok(out.report.sample.some(x=>x.id==='V2I-CIRCUIT3'&&x.fields.SALARY_BASE_LOW===180000));
});
test('aggregator request cap counts the explicit retry and cannot be bypassed by fallback',t=>{
 const page='https://www.linkedin.com/jobs/view/5012345678',guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/5012345678',alternate=guest+'0';
 const out=sourceRun(t,[row(1,'V2I-CAP','Director of Quality','Dayton, OH',`SOURCE_URL=${page}; LIVENESS_EVIDENCE_URL=${alternate}`)],{[guest]:{status:503},[alternate]:{status:200,body:exactPosting()}},{maxAggregatorFetches:1});
 assert.deepEqual(out.reads,[guest]);assert.equal(out.report.source_retries,0);assert.equal(out.report.agg_tried.linkedin,1);assert.equal(out.report.public_tried,0);
});
test('raw provider guest walls cannot reset the primary provider circuit breaker',t=>{
 const lines=[],responses={};for(let i=0;i<4;i++){
  const id='501234567'+i,guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'+id,alternate=guest+'0';
  responses[guest]={status:403};responses[alternate]={body:'<div>Sign in to view this job</div>'};
  lines.push(row(i+1,'V2I-WALL'+i,'Director of Quality','Dayton, OH',`SOURCE_URL=https://www.linkedin.com/jobs/view/${id}; LIVENESS_EVIDENCE_URL=${alternate}; DATE_ADDED=2026-11-0${7-i}`));
 }
 const out=sourceRun(t,lines,responses);
 assert.equal(out.reads.length,3);assert.equal(out.report.agg_tried.linkedin,3);assert.equal(out.report.agg_failed.linkedin,2);assert.equal(out.report.agg_wall.linkedin,1);assert.equal(out.report.submitted,0);
});
test('public request budget bounds retries across genuinely different fallback URLs',t=>{
 const first='https://careers.example.org/job/first',second='https://careers.example.org/job/second';
 const out=sourceRun(t,[row(1,'V2I-PUBLIC-CAP','Director of Quality','Dayton, OH',`SOURCE_URL=${first}; COMPANY_SOURCE_URL=${second}`)],{[first]:{status:503},[second]:{body:exactPosting()}},{maxPublicFetches:1});
 assert.deepEqual(out.reads,[first]);assert.equal(out.report.public_tried,1);assert.equal(out.report.source_retries,0);
});
test('structured aggregator fallback reuses the first response without a second guest fetch',t=>{
 const page='https://www.linkedin.com/jobs/view/5012345678',guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/5012345678';
 const out=sourceRun(t,[row(1,'V2I-HTML','Director of Quality','Dayton, OH','SOURCE_URL='+page)],{[guest]:{body:'<div>Sign in to view this job</div>'+exactPosting()}});
 assert.deepEqual(out.reads,[guest]);assert.equal(out.report.sample[0].fields.SALARY_BASE_LOW,180000);assert.equal(out.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
});
test('deadline inside decision salary repair stops nested research and preserves the Writer/report reserve',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-deadline-')),master=path.join(dir,'master.txt'),context=path.join(dir,'context.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 fs.writeFileSync(context,JSON.stringify({schema:'forge.company-site-context.v1',companies:[],roles:[]}));
 const stale='SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=BLS_OEWS; SALARY_BASE_LOW=100000; SALARY_BASE_HIGH=150000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED';
 fs.writeFileSync(master,[row(1,'V2I-TIM','Director of Quality','Dayton, OH',stale).replace('READY_TO_PURSUE','TIM_DECISION_REQUIRED'),row(2,'V2I-OTHER','Director of Quality','Dayton, OH',stale)].join('\n'));
 try{const stdout=cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_CONTEXT_FILE:context,ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_FAST:'1',ENRICH_TEST_CONFIG:JSON.stringify({maxRunMs:100,totalRunMs:1000}),ENRICH_TEST_CLOCK_STEP:'100',ENRICH_TEST_CLOCK_MATCH:'api.bls.gov'},encoding:'utf8',timeout:5000});
 const out=JSON.parse(fs.readFileSync(report));assert.equal(out.research_budget_exhausted,true);assert.equal(out.salary_repairs,0);assert.equal(out.submitted,0);assert.match(stdout,/"phase":"salary_repair".*"id":"V2I-TIM"/);assert.doesNotMatch(stdout,/"phase":"salary_repair".*"id":"V2I-OTHER"/);assert.match(stdout,/"phase":"complete"/);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
test('Writer deadline prevents a fenced batch from being posted again and still publishes a report',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-fence-deadline-')),master=path.join(dir,'master.txt'),writer=path.join(dir,'writer.json'),posts=path.join(dir,'posts.jsonl'),ledger=path.join(dir,'ledger.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const line=row(1,'V2I-TIM','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111');fs.writeFileSync(master,line);fs.writeFileSync(writer,JSON.stringify({'V2I-TIM':line}));
 try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_LEDGER:ledger,ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_FAST:'1',ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:writer,ENRICH_TEST_POSTS:posts,ENRICH_TEST_WRITER_MODE:'FENCE',ENRICH_TEST_CONFIG:JSON.stringify({maxRunMs:100000,totalRunMs:100000}),ENRICH_TEST_CLOCK_STEP:'40000',ENRICH_TEST_CLOCK_MATCH:'script.google.com'},stdio:'pipe',timeout:5000});
 assert.equal(fs.readFileSync(posts,'utf8').trim().split('\n').length,1);const out=JSON.parse(fs.readFileSync(report));assert.equal(out.writer_deferred,1);assert.equal(out.writer_not_accepted,1);assert.equal(out.writer_failed,0);assert.equal(Object.keys(JSON.parse(fs.readFileSync(ledger)).pendingWrites).length,0);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
test('live estimation route connects the shared source selector after target checks and caches public comparable reads',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-source-live-')),master=path.join(dir,'master.txt'),profile=path.join(dir,'profile.json'),pages=path.join(dir,'pages.json'),reads=path.join(dir,'reads.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const sourceRows=['Dayton','Cleveland','Akron'].map((city,i)=>({PRIMARY_ID:'V2I-SOURCE'+i,COMPANY:'Payco',TITLE:'Director of Quality',LOCATION:city+', OH',store:'MASTER',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:150000,SALARY_BASE_HIGH:200000,SALARY_SOURCE:'https://payco.example/jobs/'+i,SALARY_ASOF:'2026-07-01'}}));
 fs.writeFileSync(profile,JSON.stringify(require('./source-profile').build(sourceRows)));
 fs.writeFileSync(pages,JSON.stringify(Object.fromEntries(sourceRows.map((r,i)=>[r.p.SALARY_SOURCE,'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:r.TITLE,hiringOrganization:{name:r.COMPANY},jobLocation:{address:{addressLocality:['Dayton','Cleveland','Akron'][i],addressRegion:'OH',addressCountry:'US'}},description:'Full description of this quality leadership role. '.repeat(12),baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:220000,maxValue:260000}}})+'</script>']))));
 const env={...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_PAY_SOURCE_FILE:profile,ENRICH_TEST_PUBLIC_PAGES:pages,ENRICH_TEST_PUBLIC_READS:reads,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')};
 const run=()=>{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env,stdio:'pipe'});return JSON.parse(fs.readFileSync(report));};
 try{
  fs.writeFileSync(master,row(1,'V2I-TARGET','Director of Quality','Dayton, OH','ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/333; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED'));
  let out=run();const full=Object.values(require('./employer-cache-store').read(path.join(dir,'emp.json')).postingEvidence);assert.equal(full.length,3,'target ATS and both comparable full postings retained');assert.ok(full.every(e=>e.identityVerified&&e.text.length>=300&&e.url&&e.at));assert.equal(out.pay_source_search.found,2);assert.equal(out.pay_source_search.estimates_with_profile_sources,1);assert.equal(out.sample[0].fields.SALARY_BASE_HIGH,260000);assert.equal(out.sample[0].fields.SALARY_BASIS,'FORGE-ESTIMATE','other company pay is a comparable, never target posted pay');
  out=run();assert.equal(out.pay_source_search.cache_hits,2);assert.equal(out.pay_source_search.reads,1,'only the third uncached candidate is read on the second run');
  const beforeReads=fs.readFileSync(reads,'utf8');fs.writeFileSync(master,row(1,'V2I-TARGET','Director of Quality','Dayton, OH','ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/111; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED'));out=run();assert.equal(out.sample[0].fields.SALARY_BASIS,'EMPLOYER_POSTED');assert.equal(out.sample[0].fields.SALARY_BASE_HIGH,210000);assert.equal(out.pay_source_search.reads,0);assert.equal(fs.readFileSync(reads,'utf8'),beforeReads);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
test('production context route migrates filled estimates, keeps missing size nonblocking and records model without rewriting reference in dry run',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'salary-context-')),master=path.join(dir,'master.txt'),context=path.join(dir,'context.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const ref=JSON.stringify({schema:'forge.company-site-context.v1',companies:[],roles:[]});fs.writeFileSync(context,ref);
 fs.writeFileSync(master,[row(1,'V2I-00000000T001','Sr. Manager of Quality','Austin, TX','SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=MED; SALARY_SOURCE=BLS_OEWS; SALARY_BASE_LOW=96000; SALARY_BASE_HIGH=168000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED'),row(2,'V2I-00000000A002','Senior Quality Manager','Austin, TX','SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=180000; SALARY_BASE_HIGH=240000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED')].join('\n'));
 try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_CONTEXT_FILE:context,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'employer.json')},stdio:'pipe'});
 const out=JSON.parse(fs.readFileSync(report));const a=out.sample[0].fields;assert.equal(out.salary_repairs,1);assert.equal(a.SALARY_MODEL_VERSION,'employer-upper-range-v5');assert.equal(a.SALARY_CONF,'LOW');assert.equal(a.SALARY_BASE_HIGH,240000);assert.equal(a.SALARY_CONTEXT_KEY.length,64);assert.equal(fs.readFileSync(context,'utf8'),ref);
 }finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}
});
test('salary repair reaches already-filled rows, preserves protected jobs and drops concurrent salary changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'salary-repair-')),master=path.join(dir,'master.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const bad='SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=MED; SALARY_SOURCE=same-employer:V2I-00000000A001; SALARY_BASE_LOW=96000; SALARY_BASE_HIGH=168000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED';
 const target=row(1,'V2I-00000000T001','Sr. Manager of Quality','Austin, TX',bad);
 const input=[target,row(2,'V2I-00000000T002','Sr. Manager of Quality','Austin, TX',bad).replace('READY_TO_PURSUE','DECLINED_BY_TIM'),row(3,'V2I-00000000A001','Quality Associate Manager','Austin, TX','SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=96000; SALARY_BASE_HIGH=168000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED'),row(4,'V2I-00000000A002','Senior Quality Manager','Austin, TX','SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=180000; SALARY_BASE_HIGH=240000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED')];
 fs.writeFileSync(master,input.join('\n'));const current=path.join(dir,'current.json'),posts=path.join(dir,'posts.jsonl');
 fs.writeFileSync(current,JSON.stringify(Object.fromEntries(input.map(l=>[l.split(' | ')[1],l.replace('SALARY_CONF=MED','SALARY_CONF=HIGH')]))));
 try{const env={...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'employer.json')};
 cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env,stdio:'pipe'});
 let out=JSON.parse(fs.readFileSync(report));assert.equal(out.salary_repairs,1);assert.deepEqual(out.salary_invalid.map(x=>x.id),['V2I-00000000T001']);assert.equal(out.sample[0].fields.SALARY_BASE_HIGH,240000);
 cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...env,ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:current,ENRICH_TEST_POSTS:posts},stdio:'pipe'});
 out=JSON.parse(fs.readFileSync(report));assert.equal(out.guard_dropped,1);assert.equal(fs.existsSync(posts),false,'no POST when salary changed after snapshot');
 }finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}
});
const MASTER = [
  row(1, 'V2I-00000000000A', 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19'),
  row(2, 'V2I-00000000000B', 'Director of Quality', 'Akron, OH', 'SOURCE_URL=https://www.linkedin.com/jobs/view/director-quality-4012345678; DATE_ADDED=2026-10-18'),
  row(3, 'V2I-00000000000C', 'Director of Quality', 'Toledo, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333; DATE_ADDED=2026-10-17'),
  row(4, 'V2I-00000000000D', 'Director of Quality', 'Canton, OH', 'SOURCE_URL=https://example.com/careers/9; DATE_ADDED=2026-10-16'),
  row(5, 'V2I-00000000000E', 'Director, Quality', 'Detroit, MI', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=150000; SALARY_BASE_HIGH=190000; SALARY_MIDPOINT=170000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  row(6, 'V2I-00000000000F', 'Director, Quality', 'Columbus, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; SALARY_MIDPOINT=180000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  row(8, 'V2I-00000000000H', 'Director of Quality', 'Kent, OH', 'ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/888; ATS_CHECK_RESULT=CLOSED; LIVENESS=CLOSED_EMPLOYER_404; DATE_ADDED=2026-10-14'),
  row(7, 'V2I-00000000000G', 'Director of Quality', 'Lima, OH', 'SOURCE_URL=https://www.linkedin.com/jobs/view/9; ATS_POSTING_URL=https://job-boards.greenhouse.io/acme/jobs/404; DATE_ADDED=2026-10-15'),
].join('\n') + '\n';

test('live-source dry path uses the canonical snapshot without reading the structured mirror',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-canonical-')),writerRows=path.join(dir,'rows.json'),paths=['state/enrich-ats-pay-report.json','state/enrich-ats-pay-products.json','state/enrich-ats-pay-recovery.json','state/enrich-ats-pay-calibration.json'].map(p=>path.join(ROOT,p)),prior=paths.map(p=>fs.existsSync(p)?fs.readFileSync(p):null);fs.writeFileSync(writerRows,JSON.stringify({'V2I-00000000000A':row(1,'V2I-00000000000A','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19')}));try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:'',ENRICH_TEST_WRITER_ROWS:writerRows,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')},stdio:'pipe'});const out=JSON.parse(fs.readFileSync(paths[0]));assert.equal(out.masterSource.kind,'CANONICAL_WRITER_MASTER');assert.equal(out.rows,1);assert.equal(out.sample[0].fields.DEGREE_REQ,'REQUIRED');assert.equal(out.submitted,0);}finally{paths.forEach((p,i)=>{if(prior[i])fs.writeFileSync(p,prior[i]);else fs.rmSync(p,{force:true});});fs.rmSync(dir,{recursive:true,force:true});}});

test('blocked alert source reuses the exact saved employer posting instead of getting stranded',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-alternate-')),master=path.join(dir,'master.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;fs.writeFileSync(master,row(1,'V2I-00000000000A','Director of Quality','Dayton, OH','SOURCE_URL=https://www.indeed.com/viewjob?jk=111111111111; LIVENESS_EVIDENCE_URL=https://careers.example.org/job/quality; DATE_ADDED=2026-10-19'));try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'employer.json')},stdio:'pipe'});const out=JSON.parse(fs.readFileSync(report));assert.equal(out.public_read,1);assert.equal(out.sample[0].fields.DEGREE_REQ,'REQUIRED');assert.equal(out.sample[0].fields.SALARY_BASIS,'EMPLOYER_POSTED');}finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}});

test('uncertain Writer response remains durable and cannot be posted again next run',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-no-replay-')),master=path.join(dir,'master.txt'),rows=path.join(dir,'rows.json'),posts=path.join(dir,'posts.jsonl'),ledger=path.join(dir,'ledger.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;const line=row(1,'V2I-00000000000A','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19');fs.writeFileSync(master,line);fs.writeFileSync(rows,JSON.stringify({'V2I-00000000000A':line}));const run=()=>cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:ledger,ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:rows,ENRICH_TEST_POSTS:posts,ENRICH_TEST_WRITER_MODE:'REPLY_LOST_UNSAVED'},stdio:'pipe'});try{run();assert.equal(Object.keys(JSON.parse(fs.readFileSync(ledger)).pendingWrites).length,1);const sent=fs.readFileSync(posts,'utf8');run();assert.equal(fs.readFileSync(posts,'utf8'),sent);assert.equal(JSON.parse(fs.readFileSync(report)).pending[0].status,'WRITER_REQUEST_PENDING_NO_REPLAY');}finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}});

test('custom employer JobPosting supplies missing pay and degree without inventing identity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-public-')),master=path.join(dir,'master.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 fs.writeFileSync(master,row(1,'V2I-00000000000A','Director of Quality','Dayton, OH','SOURCE_URL=https://careers.example.org/job/quality; DATE_ADDED=2026-10-19'));
 try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'employer.json')},stdio:'pipe'});
 const out=JSON.parse(fs.readFileSync(report));assert.equal(out.public_read,1);assert.equal(out.sample[0].fields.DEGREE_REQ,'REQUIRED');assert.equal(out.sample[0].fields.SALARY_BASIS,'EMPLOYER_POSTED');assert.equal(out.sample[0].fields.SALARY_BASE_LOW,170000);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});

test('shared site products fill jobs without repeating source research and never overwrite a fresh Tim product',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-products-')),master=path.join(dir,'master.txt'),reference=path.join(dir,'reference.json'),writer=path.join(dir,'writer.json'),posts=path.join(dir,'posts.jsonl'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const id='V2I-00000000000A',line=row(1,id,'Director of Quality','Dayton, OH','SCOPE_FIT_RAW=80');fs.writeFileSync(master,line);fs.writeFileSync(reference,JSON.stringify({schema:'forge.company-site-products.v1',entries:[{id:'acme-dayton',company:'Acme',location:'Dayton, OH',status:'CONFIRMED',verifiedAt:new Date().toISOString().slice(0,10),products:['Industrial pumps'],sources:['https://example.org/factory']}]}));
 const run=live=>cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),...(live?[]:['--dry'])],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_PRODUCTS_REFERENCE:reference,ENRICH_PRODUCTS_ONLY:'1',ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'employer.json'),ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:writer,ENRICH_TEST_POSTS:posts},stdio:'pipe'});
 try{run(false);let r=JSON.parse(fs.readFileSync(report));assert.equal(r.products_planned,1);assert.equal(r.sample[0].fields.PRODUCT,'Industrial pumps');assert.deepEqual(r.agg_tried,{});fs.writeFileSync(writer,JSON.stringify({[id]:line+'; PRODUCT=Tim confirmed compressor'}));run(true);r=JSON.parse(fs.readFileSync(report));assert.equal(r.guard_dropped,1);assert.equal(fs.existsSync(posts),false,'no write after newer product evidence');}
 finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});

test('dry run: ATS pay, then aggregator pay, estimate only after the posting was read', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev116-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8')), by = {};
    out.sample.forEach(s => { by[s.id] = s.fields; });
    assert.strictEqual(out.dry, true); assert.strictEqual(out.writer_ok, 0);
    assert.deepStrictEqual([by['V2I-00000000000A'].SALARY_BASIS, by['V2I-00000000000A'].SALARY_BASE_LOW, by['V2I-00000000000A'].DEGREE_REQ], ['EMPLOYER_POSTED', 170000, 'REQUIRED']);
    assert.deepStrictEqual([by['V2I-00000000000B'].SALARY_BASIS, by['V2I-00000000000B'].SALARY_BASE_HIGH, by['V2I-00000000000B'].SALARY_SOURCE], ['EMPLOYER_POSTED', 190000, 'https://www.linkedin.com/jobs/view/4012345678']);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_BASIS, 'FORGE-ESTIMATE');
    // REV-138: the comparables are the same employer (Acme), so step 1 applies; BLS is offline in the test (NO_BLS, conf unchanged)
    assert.strictEqual(by['V2I-00000000000C'].SALARY_CONF, 'HIGH');
    assert.match(by['V2I-00000000000C'].SALARY_SOURCE, /^same-employer:V2I-00000000000F,V2I-00000000000E$/);
    assert.match(by['V2I-00000000000C'].SALARY_NOTE, /FORGE-ESTIMATE from 2 same-employer posted range\(s\) \[V2I-00000000000F, V2I-00000000000E\]; same employer, 2 posted range\(s\).*BLS state wage n\/a; this posting read, no pay stated; uncertainty: narrow/);
    assert.strictEqual(by['V2I-00000000000C'].SALARY_ESTIMATE_BASIS, undefined);
    assert.deepStrictEqual(out.estimate_samples.map(x => [x.id, x.basis, x.source, x.bls]), [['V2I-00000000000C', 'POSTING_READ', 'SAME_EMPLOYER', 'NO_BLS']]);
    assert.strictEqual(by['V2I-00000000000D'], undefined, 'posting never read: no estimate');
    assert.strictEqual(out.estimate_waiting_for_posting, 2, 'D (never read) and G (ATS 404 unconfirmed, no aggregator read): Tim 2026-10-20 rule, an estimate only after a posting was read');
    // REV-136 (Grok Bot QA #19): the ATS link is found in ATS_POSTING_URL; a taken-down posting is reported, not retried or estimated
    // Grok Bot re-QA: a 404 is not proof the posting is gone (a bad address answers 404 too); it is reported, and the row still
    // gets its aggregator read and estimate. Closing belongs to the Writer's ATS checker.
    assert.strictEqual(out.ats_candidates, 4); assert.strictEqual(out.ats_unconfirmed, 1);
    assert.deepStrictEqual(out.ats_unconfirmed_rows.map(x => [x.id, x.status, x.checker]), [['V2I-00000000000G', 404, 'not checked']]);
    assert.strictEqual(out.skipped_closed, 1, 'a row the checker closed is skipped');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Tim 2026-10-21 02:15 ET: 2 failed posting reads on different days allow an estimate marked NO_POSTING_READ; 1 does not', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev136-')), master = path.join(dir, 'master.txt'), ledger = path.join(dir, 'ledger.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = () => { cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_LEDGER: ledger }), stdio: 'pipe', timeout: 60000 }); return JSON.parse(fs.readFileSync(report, 'utf8')); };
  try {
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: {} }));
    let out = run();
    assert.ok(!out.estimate_samples.some(x => x.id === 'V2I-00000000000G'), '1 failed read: still waiting'); assert.strictEqual(out.estimates_no_posting_read, undefined);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: { 'V2I-00000000000G': { dates: [yesterday], n: 1 } } }));
    out = run();
    const g = out.estimate_samples.find(x => x.id === 'V2I-00000000000G');
    assert.ok(g, '2 failed reads on different days: estimated'); assert.strictEqual(g.basis, 'NO_POSTING_READ'); assert.strictEqual(out.estimates_no_posting_read, 1);
    fs.writeFileSync(ledger, JSON.stringify({ submitted: {}, tried: {}, failedReads: { 'V2I-00000000000G': { dates: [new Date().toISOString().slice(0, 10)], n: 1 } } }));
    out = run();
    assert.ok(!out.estimate_samples.some(x => x.id === 'V2I-00000000000G'), 'two reads on the same day count once');
    assert.strictEqual(out.skipped_closed, 1, 'a CLOSED row is still skipped');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Tim 2026-10-21 03:10 ET: a comparables range shared by 3+ eligible roles goes in at LOW; same-employer estimates are unaffected', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev139-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const r2 = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
  const read = 'FEASIBILITY_ATTEMPT_ASOF=2026-10-20; DATE_ADDED=2026-10-19';   // posting already checked by a lane: estimate allowed
  fs.writeFileSync(master, [
    r2(1, 'V2I-0000000000S1', 'Zeta', 'Plant Manager', 'Akron, OH', read), r2(2, 'V2I-0000000000S2', 'Kappa', 'Plant Manager', 'Toledo, OH', read),
    r2(3, 'V2I-0000000000S3', 'Lambda', 'Plant Manager', 'Dayton, OH', read),
    r2(4, 'V2I-0000000000P1', 'Omega', 'Plant Manager', 'Columbus, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
    r2(5, 'V2I-0000000000P2', 'Sigma', 'Plant Manager', 'Detroit, MI', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=170000; SALARY_BASE_HIGH=210000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  ].join('\n') + '\n');
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(dir, 'bls.json'), ENRICH_EMPLOYER_CACHE: path.join(dir, 'emp.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.strictEqual(out.est_shared_low, 3);
    out.estimate_samples.filter(x => /^V2I-0000000000S/.test(x.id)).forEach(x => { assert.strictEqual(x.est[2], 'LOW'); assert.match(x.basis_detail, /range shared by 3 eligible roles/); });
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('REV-140: archived posted pay stays a comparable; remembered same-employer postings are reused; weak LOW estimates are upgraded', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev140-')), master = path.join(dir, 'master.txt'), archive = path.join(dir, 'archive.txt'), emp = path.join(dir, 'employer.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const r2 = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
  const read = 'FEASIBILITY_ATTEMPT_ASOF=2026-10-20; DATE_ADDED=2026-10-19';
  fs.writeFileSync(master, [
    r2(1, 'V2I-00000000Z001', 'Zeta Corp', 'Plant Manager', 'Akron, OH', read),                                                  // remembered Zeta posting
    r2(2, 'V2I-00000000U001', 'Upsilon', 'Plant Manager', 'Toledo, OH', 'SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=comparables:V2I-X; SALARY_BASE_LOW=150000; SALARY_BASE_HIGH=190000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
    r2(3, 'V2I-00000000U002', 'Upsilon', 'Plant Manager', 'Lima, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=175000; SALARY_BASE_HIGH=215000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  ].join('\n') + '\n');
  fs.writeFileSync(archive, r2(9, 'V2I-00000000A001', 'Archived Co', 'Plant Manager', 'Canton, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=165000; SALARY_BASE_HIGH=205000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS') + '\n');
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(emp, JSON.stringify({ employers: { zeta: [{ title: 'Plant Manager', location: 'Seattle, WA', state: 'WA', pay: { low: 190000, high: 240000 }, page: 'https://example.com/zeta/1', seen: today }], oldco: [{ title: 'Plant Manager', location: 'Austin, TX', state: 'TX', pay: { low: 150000, high: 180000 }, page: 'https://example.com/old/1', seen: '2026-01-01' }] } }));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_ARCHIVE_FILE: archive, ENRICH_EMPLOYER_CACHE: emp, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(dir, 'bls.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8')), by = {}; out.estimate_samples.forEach(x => { by[x.id] = x; });
    assert.strictEqual(out.archive_anchors, 1, 'archived posted pay is a comparable');
    assert.strictEqual(by['V2I-00000000Z001'].source, 'SAME_EMPLOYER'); assert.match(by['V2I-00000000Z001'].basis_detail, /Plant Manager \(WA\) \$190K-\$240K/);
    assert.strictEqual(out.salary_review.estimate_planned, 1); assert.strictEqual(by['V2I-00000000U001'].basis, 'ACTIVE_REVIEW'); assert.strictEqual(by['V2I-00000000U001'].source, 'COMPARABLES');
    assert.strictEqual(require('./employer-cache-store').read(emp).employers.zeta.length, 1, 'cache kept, not duplicated');
    assert.strictEqual(require('./employer-cache-store').read(emp).employers.oldco, undefined, 'entries older than 60 days are pruned');
    assert.strictEqual(out.est_same_employer, 2, 'one missing-pay estimate and one active estimate review');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Grok QA #23: a same-employer estimate the BLS check drops to LOW does not replace a comparables LOW', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev140b-')), master = path.join(dir, 'master.txt'), bls = path.join(dir, 'bls.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const r2 = (n, id, co, title, loc, payload) => `${n} | ${id} | ${co} | ${title} | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | ${loc} | ${payload}`;
  fs.writeFileSync(master, [
    r2(2, 'V2I-00000000U001', 'Upsilon', 'Plant Manager', 'Toledo, OH', 'SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=comparables:V2I-X; SALARY_BASE_LOW=150000; SALARY_BASE_HIGH=190000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
    r2(3, 'V2I-00000000U002', 'Upsilon', 'Plant Manager', 'Lima, OH', 'SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=175000; SALARY_BASE_HIGH=215000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'),
  ].join('\n') + '\n');
  const at = new Date().toISOString(), s = id => ({ v: id.endsWith('12') ? 60000 : id.endsWith('13') ? 80000 : 100000, year: '2025', at });   // OH P90 $100K: a $195K mid is > 1.5x P90
  fs.writeFileSync(bls, JSON.stringify({ series: Object.fromEntries(['12', '13', '15'].map(d => ['OEUS3900000000000113051' + d, s('OEUS3900000000000113051' + d)])) }));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: bls, ENRICH_EMPLOYER_CACHE: path.join(dir, 'emp.json') }), stdio: 'pipe', timeout: 60000 });
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.strictEqual(out.upgraded, 0, 'LOW for LOW is no upgrade');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('submit: rows are re-read from the Writer first; pay a lane wrote meanwhile is never overwritten', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev119-')), master = path.join(dir, 'master.txt'), rows = path.join(dir, 'writer.json'), posts = path.join(dir, 'posts.jsonl'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const lines = MASTER.trim().split('\n'), byId = {}; lines.forEach(l => { byId[l.split(' | ')[1]] = l; });
  byId['V2I-00000000000C'] += '; SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=181000; SALARY_BASE_HIGH=222000; SALARY_MIDPOINT=201500';   // a lane posted pay after the read
  delete byId['V2I-00000000000B'];                                                                                                          // row gone (archived) since the read
  fs.writeFileSync(rows, JSON.stringify(byId));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  try {
    cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')],
      { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: path.join(dir, 'ledger.json') }), stdio: 'pipe', timeout: 60000 });
    const sent = fs.readFileSync(posts, 'utf8').trim().split('\n').map(JSON.parse), reqs = sent.flatMap(b => b.requests), by = {};
    reqs.forEach(q => { by[q.ruling.primaryId] = q.ruling.fields; });
    assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].action, 'batch');
    assert.strictEqual(by['V2I-00000000000A'].SALARY_BASIS, 'EMPLOYER_POSTED');
    assert.strictEqual(by['V2I-00000000000B'], undefined, 'row no longer in the master: dropped');
    assert.ok(by['V2I-00000000000C'], 'degree still goes'); assert.strictEqual(by['V2I-00000000000C'].SALARY_BASIS, undefined, 'lane pay kept');
    const out = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.strictEqual(out.guard_dropped, 1); assert.strictEqual(out.submitted, reqs.length); assert.strictEqual(out.writer_ok, reqs.length);
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('typed optimistic refusal is not a write; rows retry only after backoff with new request identities', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev139-retry-')), master = path.join(dir, 'master.txt'), rows = path.join(dir, 'writer.json'), posts = path.join(dir, 'posts.jsonl'), ledger = path.join(dir, 'ledger.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const byId = {}; MASTER.trim().split('\n').forEach(l => { byId[l.split(' | ')[1]] = l; });
  fs.writeFileSync(rows, JSON.stringify(byId));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = (mode,now) => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json'), ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: ledger, ENRICH_TEST_WRITER_MODE: mode,...(now?{ENRICH_TEST_NOW:String(now)}:{}) }), stdio: 'pipe', timeout: 60000 });
  const ids = () => fs.readFileSync(posts, 'utf8').trim().split('\n').map(JSON.parse).flatMap(b => b.requests).map(q => q.ruling.primaryId).sort();
  try {
    run('RETRY');
    const first = ids(), out = JSON.parse(fs.readFileSync(report, 'utf8')), led = JSON.parse(fs.readFileSync(ledger, 'utf8'));
    assert.ok(first.length > 0);
    assert.strictEqual(out.writer_ok, 0, 'nothing was written'); assert.strictEqual(out.writer_not_accepted, first.length); assert.strictEqual(out.writer_deferred, first.length);assert.strictEqual(Object.keys(led.pendingWrites).length,0);
    first.forEach(id => assert.strictEqual(led.submitted[id], undefined, id + ' must not be marked submitted'));
    fs.rmSync(posts, { force: true });
    run('COMMIT',Date.now()+61000);
    assert.deepStrictEqual(ids(), first, 'the same rows go again on the next run instead of waiting 48 h');
    const out2 = JSON.parse(fs.readFileSync(report, 'utf8')), led2 = JSON.parse(fs.readFileSync(ledger, 'utf8'));
    assert.strictEqual(out2.writer_ok, first.length); first.forEach(id => assert.ok(led2.submitted[id], id + ' saved after a committed batch'));
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('typed WRITE_FENCE preserves volume and retries only after backoff under new request identities', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rev153-')),master=path.join(dir,'master.txt'),rows=path.join(dir,'writer.json'),posts=path.join(dir,'posts.jsonl'),ledger=path.join(dir,'ledger.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master,MASTER);const byId={};MASTER.trim().split('\n').forEach(l=>{byId[l.split(' | ')[1]]=l;});fs.writeFileSync(rows,JSON.stringify(byId));const before=fs.existsSync(report)?fs.readFileSync(report):null;
  const run=(mode,now)=>{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:rows,ENRICH_TEST_POSTS:posts,ENRICH_LEDGER:ledger,ENRICH_TEST_WRITER_MODE:mode,...(now?{ENRICH_TEST_NOW:String(now)}:{})},stdio:'pipe',timeout:60000});return{out:JSON.parse(fs.readFileSync(report)),led:JSON.parse(fs.readFileSync(ledger)),posts:fs.readFileSync(posts,'utf8').trim().split('\n').map(JSON.parse)};};
  try{
    let r=run('FENCE_ONCE');const n=r.posts[0].requests.length;assert.ok(n>0);assert.equal(r.posts.length,1,'no same-pass replay');assert.equal(r.out.writer_not_accepted,n);assert.equal(r.out.writer_deferred,n);assert.equal(r.out.writer_failed,0);assert.equal(Object.keys(r.led.pendingWrites).length,0);
    r=run('FENCE_ONCE');assert.equal(r.posts.length,1,'no post while refusal backoff is active');
    r=run('COMMIT',Date.now()+61000);assert.equal(r.posts.length,2);assert.notEqual(r.posts[0].requestId,r.posts[1].requestId);assert.notEqual(r.posts[0].requests[0].ruling.requestId,r.posts[1].requests[0].ruling.requestId);assert.deepEqual(r.posts[1].requests.map(q=>q.ruling.primaryId),r.posts[0].requests.map(q=>q.ruling.primaryId));assert.equal(r.out.writer_ok,n);assert.equal(r.out.writer_failed,0);
    fs.rmSync(posts);fs.rmSync(ledger);r=run('FENCE');assert.equal(r.posts.length,1);assert.equal(r.out.writer_failed,0);assert.equal(r.out.writer_ok,0);assert.equal(r.out.writer_deferred,n);assert.equal(r.out.writer_not_accepted,n);r.posts[0].requests.forEach(q=>assert.equal(r.led.submitted[q.ruling.primaryId],undefined));
    assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'))).batchGapMs>=125000,true);
  }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});

test('an unchanged dry run leaves the report byte for byte (no hourly commit)', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rev121-')), master = path.join(dir, 'master.txt'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  fs.writeFileSync(master, MASTER);
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = () => cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js'), '--dry'],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(os.tmpdir(), 'rev138-bls-' + process.pid + '.json'), ENRICH_EMPLOYER_CACHE: path.join(os.tmpdir(), 'rev140-emp-' + process.pid + '.json') }), stdio: 'pipe', timeout: 60000 });
  try {
    fs.rmSync(report, { force: true }); run(); const first = fs.readFileSync(report, 'utf8');
    run(); assert.strictEqual(fs.readFileSync(report, 'utf8'), first);
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});


test('lost Writer reply (HTTP 404 after the save): the receipt index decides; saved batches count and the run goes on', { skip: !fs.existsSync(path.join(FC, 'apps-script/PipelineWorklists.gs')) && 'no foreman-cockpit checkout' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-lost-')), master = path.join(dir, 'master.txt'), rows = path.join(dir, 'writer.json'), posts = path.join(dir, 'posts.jsonl'), ledger = path.join(dir, 'ledger.json'), report = path.join(ROOT, 'state/enrich-ats-pay-report.json');
  const many = Array.from({ length: 30 }, (_, i) => row(i + 1, 'V2I-0000000001' + String(i).padStart(2, '0'), 'Director of Quality', 'Dayton, OH', 'SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19')).join('\n') + '\n';
  fs.writeFileSync(master, many);
  const byId = {}; many.trim().split('\n').forEach(l => { byId[l.split(' | ')[1]] = l; });
  fs.writeFileSync(rows, JSON.stringify(byId));
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const run = mode => { fs.rmSync(posts, { force: true }); fs.rmSync(ledger, { force: true }); cp.execFileSync(process.execPath, ['--require', path.join(__dirname, 'test/mock-fetch.js'), path.join(__dirname, 'run.js')],
    { env: Object.assign({}, process.env, { ENRICH_FC_DIR: FC, ENRICH_MASTER_FILE: master, ENRICH_TEST_FAST: '1', ENRICH_BLS_CACHE: path.join(dir, 'bls.json'), ENRICH_EMPLOYER_CACHE: path.join(dir, 'emp.json'), ENRICH_TEST_SUBMIT: '1', ENRICH_TEST_WRITER_ROWS: rows, ENRICH_TEST_POSTS: posts, ENRICH_LEDGER: ledger, ENRICH_TEST_WRITER_MODE: mode }), stdio: 'pipe', timeout: 60000 });
    return { out: JSON.parse(fs.readFileSync(report, 'utf8')), led: JSON.parse(fs.readFileSync(ledger, 'utf8')), posts: fs.readFileSync(posts, 'utf8').trim().split('\n').map(JSON.parse) }; };
  try {
    let r = run('REPLY_LOST');
    assert.strictEqual(r.posts.length, 2, 'the second batch is still sent');
    assert.strictEqual(r.out.writer_ok, 30); assert.strictEqual(r.out.writer_failed, 0); assert.strictEqual(r.out.writer_reply_lost, 2);
    Object.keys(byId).forEach(id => assert.ok(r.led.submitted[id], id + ' saved per its receipt'));
    r = run('REPLY_LOST_UNSAVED');
    assert.strictEqual(r.posts.length, 2, 'unconfirmed: the run continues to the next batch');
    assert.strictEqual(r.out.writer_ok, 0); assert.strictEqual(r.out.writer_failed, 0); assert.strictEqual(r.out.writer_unconfirmed, 30);
    assert.match(r.out.writer_error, /HTTP 404; receipt NO_ENTRY/);
    assert.deepStrictEqual(r.led.submitted, {}, 'unconfirmed rows are not marked saved; the row_readback guard settles them next run');
  } finally { if (before) fs.writeFileSync(report, before); else fs.rmSync(report, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('active estimate review is bounded, promotes exact pay, skips protected jobs and rejects concurrent changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'salary-active-')),master=path.join(dir,'master.txt'),pages=path.join(dir,'pages.json'),writer=path.join(dir,'writer.json'),posts=path.join(dir,'posts.jsonl'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const lines=[],responses={},original={};for(let i=1;i<=7;i++){
  const id='V2I-REVIEW'+i,url='https://job-boards.greenhouse.io/acme/jobs/'+(900+i);
  const line=row(i,id,'Director of Quality','Dayton, OH','ATS_POSTING_URL='+url+'; SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=BLS_OEWS; SALARY_BASE_LOW=90000; SALARY_BASE_HIGH=130000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED');lines.push(line);original[id]=line;
  responses['https://boards-api.greenhouse.io/v1/boards/acme/jobs/'+(900+i)+'?pay_transparency=true']=JSON.stringify({id:900+i,title:'Director of Quality',location:{name:'Dayton, OH'},content:'A complete employer job description. '.repeat(25),pay_input_ranges:[{min_cents:18000000,max_cents:24000000,currency_type:'USD',interval:'year',title:'Base salary'}]});
 }
 lines.push(lines[0].replace('V2I-REVIEW1','V2I-DECLINED').replace('READY_TO_PURSUE','DECLINED_BY_TIM'),lines[0].replace('V2I-REVIEW1','V2I-APPLIED').replace('READY_TO_PURSUE','APPLIED'));
 fs.writeFileSync(master,lines.join('\n'));fs.writeFileSync(pages,JSON.stringify(responses));
 const env={...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_TEST_PUBLIC_PAGES:pages,ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')};
 const run=live=>{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),...(live?[]:['--dry'])],{env:{...env,...(live?{ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:writer,ENRICH_TEST_POSTS:posts}:{})},stdio:'pipe'});return JSON.parse(fs.readFileSync(report));};
 try{let out=run(false);assert.equal(out.salary_review.eligible,7);assert.equal(out.salary_review.reviewed,7);assert.equal(out.salary_review.target_reads,7);assert.equal(out.salary_review.posted_planned,7);assert.equal(out.sample[0].fields.SALARY_BASIS,'EMPLOYER_POSTED');assert.equal(out.sample[0].fields.SALARY_BASE_HIGH,240000);assert.equal(fs.existsSync(env.ENRICH_LEDGER),false,'dry review does not consume durable queue');
 original['V2I-REVIEW1']=original['V2I-REVIEW1'].replace('SALARY_CONF=LOW','SALARY_CONF=HIGH');original['V2I-REVIEW2']=original['V2I-REVIEW2'].replace('READY_TO_PURSUE','DECLINED_BY_TIM');original['V2I-REVIEW3']=original['V2I-REVIEW3'].replace(' | Acme | ',' | Different employer | ');fs.writeFileSync(writer,JSON.stringify(original));out=run(true);const sent=fs.readFileSync(posts,'utf8').trim().split('\n').flatMap(l=>JSON.parse(l).requests);assert.deepEqual(sent.map(q=>q.ruling.primaryId),['V2I-REVIEW4','V2I-REVIEW5','V2I-REVIEW6','V2I-REVIEW7']);assert.equal(out.salary_review.guard_dropped,2);assert.equal(out.guard_dropped,3);assert.equal(Object.keys(JSON.parse(fs.readFileSync(env.ENRICH_LEDGER)).salaryReview).length,7);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});

test('remote Meta tracking source reaches its direct posting and uses structured annual salary before estimating',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meta-salary-source-')),master=path.join(dir,'master.txt'),pages=path.join(dir,'pages.json'),reads=path.join(dir,'reads.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const url='https://www.metacareers.com/jobs/1065958456320572/',tracking='https://jsv3.recruitics.com/redirect?rx_jobId=a1KiE00000019qrUAA&rx_url='+encodeURIComponent(url+'?rx_a=0&rx_ts=2026'),j={'@type':'JobPosting',title:'Director, AI Manufacturing Enablement',hiringOrganization:{name:'Meta'},description:'Build a team and deploy artificial intelligence in manufacturing operations. '.repeat(12),jobLocationType:'TELECOMMUTE',applicantLocationRequirements:[{name:'United States of America'}],baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:245000,maxValue:309000}}};
 fs.writeFileSync(master,row(1,'V2I-META',j.title,'Remote, USA','SOURCE_URL='+tracking+'; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED').replace(' | Acme | ',' | Meta | '));fs.writeFileSync(pages,JSON.stringify({[url]:'<script type="application/ld+json">'+JSON.stringify(j)+'</script>'}));
 try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_PUBLIC_PAGES:pages,ENRICH_TEST_PUBLIC_READS:reads,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')},stdio:'pipe'});const out=JSON.parse(fs.readFileSync(report)),f=out.sample.find(x=>x.id==='V2I-META').fields;assert.equal(f.SALARY_BASIS,'EMPLOYER_POSTED');assert.equal(f.SALARY_BASE_LOW,245000);assert.equal(f.SALARY_BASE_HIGH,309000);assert.equal(f.SALARY_SOURCE,url);assert.equal(fs.readFileSync(reads,'utf8').trim(),url);assert.equal(out.estimates,0);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});


test('pay bot records pre-mutation refusal, observes backoff, and retries only with new request identities',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-not-accepted-')),master=path.join(dir,'master.txt'),rows=path.join(dir,'rows.json'),posts=path.join(dir,'posts.jsonl'),attempts=path.join(dir,'attempts.jsonl'),ledger=path.join(dir,'ledger.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const id='V2I-00000000000A',line=row(1,id,'Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19');fs.writeFileSync(master,line);fs.writeFileSync(rows,JSON.stringify({[id]:line}));
 const run=(mode,now)=>cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:ledger,ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:rows,ENRICH_TEST_POSTS:posts,ENRICH_TEST_ATTEMPTS:attempts,ENRICH_TEST_WRITER_MODE:mode,...(now?{ENRICH_TEST_NOW:String(now)}:{})},stdio:'pipe'});
 try{run('BUSY_NOT_ACCEPTED');let saved=JSON.parse(fs.readFileSync(ledger));assert.equal(Object.keys(saved.pendingWrites).length,0);assert.equal(Object.keys(saved.notAccepted).length,1);assert.equal(JSON.parse(fs.readFileSync(report)).writer_not_accepted,1);run('BUSY_NOT_ACCEPTED');assert.equal(fs.readFileSync(attempts,'utf8').trim().split('\n').length,1);run('OK',Date.now()+61000);const sent=fs.readFileSync(attempts,'utf8').trim().split('\n').map(JSON.parse);assert.equal(sent.length,2);assert.notEqual(sent[0].requestId,sent[1].requestId);assert.notEqual(sent[0].requests[0].ruling.requestId,sent[1].requests[0].ruling.requestId);assert.equal(JSON.parse(fs.readFileSync(report)).writer_ok,1);}finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}
});

test('pay public ledgers and refusal proofs exclude private response bodies while retaining private original checksum',()=>{
 for(const mode of ['PRIVATE_PLANNED_REFUSAL','PRIVATE_UNKNOWN_RESPONSE']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-response-privacy-')),master=path.join(dir,'master.txt'),rows=path.join(dir,'rows.json'),posts=path.join(dir,'posts.jsonl'),ledger=path.join(dir,'ledger.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null,secret='PRIVATE_LEDGER_BODY_SENTINEL recruiter-private@example.invalid';
 const id='V2I-00000000000A',line=row(1,id,'Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/111; DATE_ADDED=2026-10-19');fs.writeFileSync(master,line);fs.writeFileSync(rows,JSON.stringify({[id]:line}));
 try{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js')],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:ledger,ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_SUBMIT:'1',ENRICH_TEST_WRITER_ROWS:rows,ENRICH_TEST_POSTS:posts,ENRICH_TEST_WRITER_MODE:mode,ENRICH_TEST_PRIVATE_SENTINEL:secret},stdio:'pipe'});
 const publicText=fs.readFileSync(ledger,'utf8'),saved=JSON.parse(publicText),entry=Object.values(mode==='PRIVATE_PLANNED_REFUSAL'?saved.notAccepted:saved.pendingWrites)[0];assert.equal(publicText.includes(secret),false);assert.equal(entry.response,undefined);assert.equal(entry.responseProjectionSha256,require('../programmed-coordinator/store.cjs').hash(entry.responseProjection));const raw=JSON.parse(fs.readFileSync(path.join(dir,'private-writer-responses',entry.privateResponseRef)));assert.equal(JSON.stringify(raw).includes(secret),true);assert.equal(entry.acceptanceSha256,require('../programmed-coordinator/store.cjs').hash(raw));
 if(mode==='PRIVATE_PLANNED_REFUSAL'){const proof=fs.readFileSync(path.join(dir,entry.proof),'utf8');assert.equal(proof.includes(secret),false);assert.equal(require('../writer-outcome.cjs').released(dir,{requestId:Object.keys(saved.notAccepted)[0],...entry}),true);}else assert.equal(require('../writer-outcome.cjs').classify(entry.responseProjection).kind,'UNKNOWN');
 }finally{if(before)fs.writeFileSync(report,before);fs.rmSync(dir,{recursive:true,force:true});}
 }
});
test('saved pay-only posting evidence needs no salary fetch and does not pretend degree was reviewed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-posted-reuse-')),master=path.join(dir,'master.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 const Evidence=require('../source-trial/evidence-store'),Posted=require('../source-trial/posted-pay'),Pay=require('./pay-values'),at='2026-10-01T00:00:00Z',url='https://www.indeed.com/viewjob?jk=111111111111';
 const card={company:'Acme',title:'Director of Quality',location:'Dayton, OH',url,payFacts:Pay.fact({low:180000,high:220000},'STRUCTURED_ANNUAL_BASE'),salaryText:'Annual base salary USD $180,000-$220,000',source:'JOBSPY:indeed'};card.postedPay=Posted.capture(card,{observedAt:at});
 const ref=Evidence.capture(dir,card,{observedAt:at,proof:'state/source-trial-report.json',fullPosting:false});assert.ok(ref);
 fs.writeFileSync(path.join(dir,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries:{x:{sourceUrl:url,evidenceRefs:[ref]}}}));
 const run=payload=>{fs.writeFileSync(master,row(1,'V2I-POSTED-REUSE',card.title,card.location,'SOURCE_URL='+url+'; '+payload));cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_DISCOVERY_EVIDENCE_ROOT:dir,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')},stdio:'pipe'});return JSON.parse(fs.readFileSync(report));};
 try{
  for(const payload of ['DEGREE_REQ=REQUIRED','']){const out=run(payload),fields=out.sample.find(x=>x.id==='V2I-POSTED-REUSE').fields;assert.equal(fields.SALARY_BASIS,'EMPLOYER_POSTED');assert.equal(fields.SALARY_BASE_LOW,180000);assert.equal(fields.SALARY_ASOF,'2026-10-01');assert.equal(fields.DEGREE_REQ,undefined);assert.equal(fields.FEASIBILITY_ATTEMPT_ASOF,undefined);assert.equal(out.public_read,0);assert.equal(out.ats_read,0);assert.equal(out.estimates,0);}
  // A later full posting with no salary must not hide the original verified pay.
  const degreeAt=new Date(Date.now()-3600000).toISOString(),full=Evidence.capture(dir,{company:card.company,title:card.title,location:card.location,url,description:'Lead manufacturing quality and production operations. '.repeat(12)+'Bachelor degree required.'},{observedAt:degreeAt,proof:'state/source-trial-report.json',fullPosting:true});assert.ok(full);
  fs.writeFileSync(path.join(dir,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries:{x:{sourceUrl:url,evidenceRefs:[ref,full]}}}));
  const out=run(''),fields=out.sample.find(x=>x.id==='V2I-POSTED-REUSE').fields;
  assert.equal(fields.SALARY_BASE_LOW,180000);assert.equal(fields.SALARY_ASOF,'2026-10-01');assert.equal(fields.SALARY_SOURCE,url);
  assert.equal(fields.DEGREE_REQ,'REQUIRED');assert.equal(fields.DEGREE_ASOF,degreeAt.slice(0,10));assert.equal(fields.DEGREE_EVIDENCE_URL,url);
  assert.equal(out.public_read,0);assert.equal(out.ats_read,0);assert.equal(out.estimates,0);
  const cacheAt=Date.now()-1000,cacheUrl='https://careers.acme.com/job/quality',ledger={submitted:{},tried:{}};
  require('./recovery').saveEvidence(ledger,{PRIMARY_ID:'V2I-POSTED-REUSE',COMPANY:card.company,TITLE:card.title,LOCATION:card.location},cacheUrl,{text:'Lead site quality operations. '.repeat(20)+'Bachelor degree required.',pay:null,identityVerified:true,sourceIdentity:{company:card.company,title:card.title,location:card.location}},cacheAt);
  fs.writeFileSync(path.join(dir,'ledger.json'),JSON.stringify(ledger));
  const combined=run(''),cf=combined.sample.find(x=>x.id==='V2I-POSTED-REUSE').fields;
  assert.equal(cf.SALARY_BASE_LOW,180000);assert.equal(cf.SALARY_ASOF,'2026-10-01');assert.equal(cf.SALARY_SOURCE,url);
  assert.equal(cf.DEGREE_ASOF,new Date(cacheAt).toISOString().slice(0,10));assert.equal(cf.DEGREE_EVIDENCE_URL,cacheUrl);assert.equal(combined.public_read,0);assert.equal(combined.estimates,0);
 }finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
test('degree-triggered exact posting reads replace changed posted salary but preserve unchanged original observation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'enrich-pay-refresh-')),master=path.join(dir,'master.txt'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null,pages=path.join(dir,'pages.json');
 const Evidence=require('../source-trial/evidence-store'),Posted=require('../source-trial/posted-pay'),Pay=require('./pay-values'),at='2026-10-01T00:00:00Z',url='https://careers.acme.example/job/quality';
 const card={company:'Acme',title:'Director of Quality',location:'Dayton, OH',url,payFacts:Pay.fact({low:180000,high:220000},'STRUCTURED_ANNUAL_BASE'),salaryText:'Annual base salary USD $180,000-$220,000',source:'EMPLOYER_POSTING'};card.postedPay=Posted.capture(card,{observedAt:at});
 const ref=Evidence.capture(dir,card,{observedAt:at,proof:'state/source-trial-report.json',fullPosting:false});
 fs.writeFileSync(path.join(dir,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries:{x:{sourceUrl:url,evidenceRefs:[ref]}}}));fs.writeFileSync(master,row(1,'V2I-REFRESH-PAY',card.title,card.location,'SOURCE_URL='+url));
 try{for(const [lo,hi,currency] of [[190000,230000,'USD'],[180000,220000,'USD'],[190000,230000,'CAD']]){
 // These are independent source-response scenarios, not repeated reads inside cache freshness.
 fs.rmSync(path.join(dir,'emp.json'),{force:true});
 const j={'@type':'JobPosting',title:card.title,hiringOrganization:{name:card.company},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH'}},description:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required.',baseSalary:{currency,value:{unitText:'YEAR',minValue:lo,maxValue:hi}}};fs.writeFileSync(pages,JSON.stringify({[url]:'<script type="application/ld+json">'+JSON.stringify(j)+'</script>'}));
 cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--dry'],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_DISCOVERY_EVIDENCE_ROOT:dir,ENRICH_TEST_PUBLIC_PAGES:pages,ENRICH_TEST_FAST:'1',ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json')},stdio:'pipe'});
 const out=JSON.parse(fs.readFileSync(report)),f=out.sample.find(x=>x.id==='V2I-REFRESH-PAY').fields,changed=lo!==180000&&currency==='USD';assert.equal(f.SALARY_BASE_LOW,changed?190000:180000);assert.equal(f.SALARY_BASE_HIGH,changed?230000:220000);assert.equal(f.SALARY_ASOF,changed?new Date().toISOString().slice(0,10):at.slice(0,10));assert.equal(f.DEGREE_REQ,'REQUIRED');assert.equal(out.public_read,1);assert.equal(out.estimates,0);
 }}finally{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});

test('primary ATS, structured aggregator and public fallback reads are reusable across runs without re-fetching or re-dating',t=>{
 const page='https://job-boards.greenhouse.io/acme/jobs/111',api='https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true',guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/5012345678',publicUrl='https://careers.example.org/cache';
 const job={id:111,title:'Director of Quality',location:{name:'Dayton, OH'},content:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required. Annual base salary USD $180,000-$220,000.'};
 for(const [source,response] of [[page,{[api]:{body:job}}],['https://www.linkedin.com/jobs/view/5012345678',{[guest]:{body:exactPosting()}}],[publicUrl,{[publicUrl]:{body:exactPosting()}}]]){
  const line=row(1,'V2I-CACHE','Director of Quality','Dayton, OH','SOURCE_URL='+source),first=sourceRun(t,[line],response),entries=Object.values(first.cache.postingEvidence);assert.equal(entries.length,1,source);assert.equal(entries[0].payStatus,'PAY_FOUND');
  // A read yesterday remains yesterday's evidence, even though the next run is today.
  const observedAt=new Date(Date.now()-86400000).toISOString();entries[0].at=observedAt;
  const again=sourceRun(t,[line],{[api]:{status:500},[guest]:{status:500},[publicUrl]:{status:500}},{},first.cache);
  assert.equal(again.reads.length,0,source);assert.equal(again.report.sample[0].fields.SALARY_ASOF,observedAt.slice(0,10));assert.equal(again.report.sample[0].fields.DEGREE_ASOF,observedAt.slice(0,10));assert.equal(again.report.sample[0].fields.SALARY_BASE_LOW,180000);assert.equal(again.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
 }
});
test('full ATS no-pay reads survive across runs; unbound aggregator content and failures never become cache proof',t=>{
 const line=row(1,'V2I-NOPAY','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333'),first=sourceRun(t,[line],{}),entry=Object.values(first.cache.postingEvidence)[0];assert.equal(entry.payStatus,'NO_PAY_STATED');assert.equal(entry.pay,null);
 const again=sourceRun(t,[line],{}, {},first.cache);assert.equal(again.report.ats_read,0);assert.ok(!again.reads.some(u=>u.includes('/jobs/333?')));assert.equal(again.report.sample[0].fields.DEGREE_REQ,'PREFERRED');
 const unbound=sourceRun(t,[row(1,'V2I-UNBOUND','Director of Quality','Dayton, OH','SOURCE_URL=https://www.linkedin.com/jobs/view/4012345678')],{});assert.equal(Object.keys(unbound.cache.postingEvidence).length,0);
 const wrong=sourceRun(t,[line],{'https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true':{body:{id:333,title:'Wrong role',location:{name:'Dayton, OH'},content:'Lead manufacturing operations. '.repeat(30)}}});assert.equal(Object.keys(wrong.cache.postingEvidence).length,0);
});
test('active salary review retains complete exact postings with and without pay for later degree work',t=>{
 for(const id of ['111','333']){
  const source='https://job-boards.greenhouse.io/acme/jobs/'+id,line=row(1,'V2I-REVIEW-CACHE','Director of Quality','Dayton, OH',`SOURCE_URL=${source}; SALARY_BASIS=FORGE-ESTIMATE; SALARY_CONF=LOW; SALARY_SOURCE=BLS_OEWS; SALARY_BASE_LOW=100000; SALARY_BASE_HIGH=150000; DEGREE_REQ=NOT_STATED; DEGREE_TEXT=NOT_STATED`),first=sourceRun(t,[line],{});
  const entries=Object.values(first.cache.postingEvidence);assert.equal(entries.length,1);assert.equal(entries[0].payStatus,id==='111'?'PAY_FOUND':'NO_PAY_STATED');
  const later=row(1,'V2I-REVIEW-CACHE','Director of Quality','Dayton, OH',`SOURCE_URL=${source}; SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=170000; SALARY_BASE_HIGH=210000`),again=sourceRun(t,[later],{}, {},first.cache);assert.equal(again.reads.length,0);assert.equal(again.report.sample[0].fields.DEGREE_REQ,id==='111'?'REQUIRED':'PREFERRED');
 }
});
test('employer-board research saves full exact jobs and later target enrichment reuses them',t=>{
 const page='https://job-boards.greenhouse.io/acme/jobs/444',board='https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true',job={id:444,title:'Director of Quality',location:{name:'Cleveland, OH'},absolute_url:page,content:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required. Annual base salary USD $180,000-$220,000.'};
 const first=sourceRun(t,[row(1,'V2I-BOARD-TARGET','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333')],{[board]:{body:{jobs:[job]}}}),entry=Object.values(first.cache.postingEvidence).find(e=>e.url===page);assert.ok(entry);assert.equal(entry.sourceIdentity.location,'Cleveland, OH');
 const again=sourceRun(t,[row(1,'V2I-BOARD-NEXT','Director of Quality','Cleveland, OH','SOURCE_URL='+page)],{}, {},first.cache);assert.equal(again.reads.length,0);assert.equal(again.report.sample[0].fields.SALARY_BASE_LOW,180000);assert.equal(again.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
});
test('Workday board detail reads keep full exact source evidence instead of only salary',t=>{
 const source='https://acme.wd5.myworkdayjobs.com/Careers/job/Dayton/Director-Quality_R100',detail='https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Dayton/Director-Quality_R100',board='https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/jobs',page='https://acme.wd5.myworkdayjobs.com/Careers/job/Cleveland/Director-Quality_R200',boardDetail='https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Cleveland/Director-Quality_R200',description='Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required.';
 const data=(title,location,id,url,pay)=>({jobPostingInfo:{title,location,jobReqId:id,externalUrl:url,companyName:'Acme',jobDescription:description,...(pay?{baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}}:{})}});
 const first=sourceRun(t,[row(1,'V2I-WD-TARGET','Director of Quality','Dayton, OH','SOURCE_URL='+source)],{[detail]:{body:data('Director of Quality','Dayton, OH','R100',source,false)},[board]:{body:{jobPostings:[{title:'Director of Quality',locationsText:'Cleveland, OH',externalPath:'/job/Cleveland/Director-Quality_R200'}]}},[boardDetail]:{body:data('Director of Quality','Cleveland, OH','R200',page,true)}});
 const entry=Object.values(first.cache.postingEvidence).find(e=>e.url===page);assert.ok(entry);assert.equal(entry.pay.low,180000);assert.equal(entry.text,description);
 const again=sourceRun(t,[row(1,'V2I-WD-NEXT','Director of Quality','Cleveland, OH','SOURCE_URL='+page)],{}, {},first.cache);assert.equal(again.reads.length,0);assert.equal(again.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
});
test('unsupported ATS textual pay is unresolved on both the first read and cache reuse, never no-pay evidence',t=>{
 const api='https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true',line=row(1,'V2I-PAY-UNRESOLVED','Director of Quality','Dayton, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333');
 for(const pay of ['Base pay is USD $100-$120 per hour.','Annual base salary CAD $180,000-$220,000.']){
  const response={[api]:{body:{id:333,title:'Director of Quality',location:{name:'Dayton, OH'},content:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required. '+pay}}};
  const first=sourceRun(t,[line],response),again=sourceRun(t,[line],response,{},first.cache);
  for(const out of [first,again]){assert.equal(out.report.estimate_waiting_for_posting,1);assert.equal(out.report.estimates,0);assert.equal(Object.values(out.cache.postingEvidence)[0].payStatus,'PAY_UNRESOLVED');}
  assert.equal(again.reads.length,0);
 }
});
test('a pay parser change refreshes a retained custom posting instead of promoting rejected structured pay',t=>{
 const url='https://careers.example.org/parser-refresh',j={'@type':'JobPosting',title:'Director of Quality',hiringOrganization:{name:'Acme'},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH'}},description:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required. Annual base salary USD $180,000-$220,000.',baseSalary:{currency:'CAD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}},line=row(1,'V2I-MIGRATION','Director of Quality','Dayton, OH','SOURCE_URL='+url),response={[url]:{body:'<script type="application/ld+json">'+JSON.stringify(j)+'</script>'}};
 const first=sourceRun(t,[line],response),entry=Object.values(first.cache.postingEvidence)[0];entry.factsVersion='obsolete';
 const again=sourceRun(t,[line],response,{},first.cache);assert.deepEqual(again.reads,[url]);assert.equal(again.report.posted_pay,0);assert.equal(again.report.estimates,0);assert.equal(again.report.sample[0].fields.DEGREE_REQ,'REQUIRED');
 const third=sourceRun(t,[line],response,{},again.cache);assert.equal(third.reads.length,0);assert.equal(third.report.estimates,0);
});

test('Workday detail cache reuse preserves the salary observation date in employer anchors',t=>{
 const source='https://acme.wd5.myworkdayjobs.com/Careers/job/Dayton/Director-Quality_R100',detail='https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/Dayton/Director-Quality_R100',board='https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/jobs',page='https://acme.wd5.myworkdayjobs.com/Careers/job/Cleveland/Director-Quality_R200',description='Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required.',at=new Date(Date.now()-6*86400000).toISOString(),cache={};
 require('./posting-cache').create({cache}).save({COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Cleveland, OH'},page,{identityVerified:true,sourceIdentity:{company:'Acme',title:'Director of Quality',location:'Cleveland, OH'},text:description,pay:{low:180000,high:220000},basis:'EMPLOYER_POSTED'},{at});
 const out=sourceRun(t,[row(1,'V2I-WD-DATE','Director of Quality','Dayton, OH','SOURCE_URL='+source)],{[detail]:{body:{jobPostingInfo:{title:'Director of Quality',location:'Dayton, OH',jobReqId:'R100',externalUrl:source,companyName:'Acme',jobDescription:description}}},[board]:{body:{jobPostings:[{title:'Director of Quality',locationsText:'Cleveland, OH',externalPath:'/job/Cleveland/Director-Quality_R200'}]}}},{},cache);
 assert.equal(out.cache.employers.acme[0].seen,at);assert.ok(!out.reads.some(u=>u.includes('Director-Quality_R200')));
});

test('prepare-only persists a full policy estimate, skips receipts, reuses it, then the existing Writer consumes it',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-prepare-integration-')),master=path.join(dir,'master.txt'),ledger=path.join(dir,'ledger.json'),reads=path.join(dir,'reads'),posts=path.join(dir,'posts'),writer=path.join(dir,'writer.json'),report=path.join(ROOT,'state/enrich-ats-pay-report.json'),before=fs.existsSync(report)?fs.readFileSync(report):null;
 t.after(()=>{if(before)fs.writeFileSync(report,before);else fs.rmSync(report,{force:true});fs.rmSync(dir,{recursive:true,force:true});});
 const target=row(1,'V2I-PREPARE','Director of Quality','Toledo, OH','SOURCE_URL=https://job-boards.greenhouse.io/acme/jobs/333; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS; FEASIBILITY_ATTEMPT_ASOF=2026-11-09');
 const anchor=row(2,'V2I-ANCHOR','Director, Quality','Columbus, OH','SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; SALARY_MIDPOINT=180000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS');
 fs.writeFileSync(master,target+'\n'+anchor);fs.writeFileSync(writer,JSON.stringify({'V2I-PREPARE':target,'V2I-ANCHOR':anchor}));
 const postingRow={PRIMARY_ID:'V2I-PREPARE',COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Toledo, OH',p:{}};
 const cache={employers:{}};require('./posting-cache').create({cache}).save(postingRow,'https://job-boards.greenhouse.io/acme/jobs/333',{identityVerified:true,sourceIdentity:{company:postingRow.COMPANY,title:postingRow.TITLE,location:postingRow.LOCATION},text:'Lead manufacturing quality operations. '.repeat(20)+'BS preferred.'});fs.writeFileSync(path.join(dir,'emp.json'),JSON.stringify(cache));
 const original=JSON.stringify({submitted:{},tried:{},pendingWrites:{original:{ids:['V2I-OTHER'],requests:[],status:'POSTING_OR_UNCONFIRMED'}}});fs.writeFileSync(ledger,original);
 const env={...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_LEDGER:ledger,ENRICH_BLS_CACHE:path.join(dir,'bls.json'),ENRICH_EMPLOYER_CACHE:path.join(dir,'emp.json'),ENRICH_TEST_FAST:'1',ENRICH_TEST_FETCHES:reads,ENRICH_TEST_WRITER_ROWS:writer,ENRICH_TEST_POSTS:posts};
 fs.writeFileSync(reads,'');
 const run=args=>{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),...args],{env,stdio:'pipe'});return JSON.parse(fs.readFileSync(report));};
 let out=run(['--prepare-only']);assert.equal(out.salary_estimates_prepared,1);assert.equal(out.submitted,0);assert.equal(out.roles_researched,1);assert.equal(fs.readFileSync(ledger,'utf8'),original);assert.equal(fs.existsSync(posts),false);assert.doesNotMatch(fs.readFileSync(reads,'utf8'),/action=(receipt_index|request_result|writer_status)/);
 const artifacts=fs.readdirSync(dir).filter(f=>f.startsWith('enrich-ats-pay-prepared-'));assert.equal(artifacts.length,1);const record=JSON.parse(fs.readFileSync(path.join(dir,artifacts[0])));assert.equal(record.fields.SALARY_BASIS,'FORGE-ESTIMATE');assert.ok(record.fields.SALARY_NOTE);assert.ok(record.evidence.anchorInputsSha256);assert.ok(record.evidence.postingEvidence.text.length>=300);assert.equal(record.evidence.postingEvidence.identityVerified,true);assert.equal(record.row.p,undefined);assert.equal(record.row.line,undefined);
 out=run(['--prepare-only']);assert.equal(out.prepared_reused,1);assert.equal(out.roles_researched,0);assert.equal(out.salary_estimates_prepared,0);assert.equal(fs.readdirSync(dir).filter(f=>f.startsWith('enrich-ats-pay-prepared-')).length,1);
 const forged=structuredClone(record);forged.fields.SALARY_BASE_LOW=1;const Store=require('../programmed-coordinator/store.cjs');fs.unlinkSync(path.join(dir,artifacts[0]));Store.immutable(dir,'enrich-ats-pay-prepared-'+Store.hash(forged)+'.json',forged);
 fs.writeFileSync(path.join(dir,'emp.json'),JSON.stringify({employers:{}})); // source exists only in the durable artifact
 for(const changed of [target.replace('Director of Quality','Director of Other'),target+'; DO_NOT_REWORK=YES']){
  fs.writeFileSync(writer,JSON.stringify({'V2I-PREPARE':changed,'V2I-ANCHOR':anchor}));fs.writeFileSync(ledger,original);
  const guarded=run([]);assert.equal(guarded.salary_submitted,0);assert.equal(guarded.guard_dropped,1);assert.equal(fs.existsSync(posts),false);
 }
 fs.writeFileSync(writer,JSON.stringify({'V2I-PREPARE':target,'V2I-ANCHOR':anchor}));
 fs.writeFileSync(ledger,JSON.stringify({submitted:{},tried:{},pendingWrites:{original:{ids:['V2I-PREPARE'],requests:[],status:'POSTING_OR_UNCONFIRMED'}}}));
 const fenced=run([]);assert.equal(fenced.salary_submitted,0);assert.equal(fenced.prepared_sources_validated,0);assert.equal(fs.existsSync(posts),false);assert.ok(JSON.parse(fs.readFileSync(ledger)).pendingWrites.original);
 fs.writeFileSync(ledger,original);
 // Consume only the separately produced public-source artifact, not the salary preparation.
 for(const file of fs.readdirSync(dir).filter(f=>f.startsWith('enrich-ats-pay-prepared-')))fs.unlinkSync(path.join(dir,file));
 out=run([]);assert.equal(out.source_only_artifacts_validated,1);assert.equal(out.prepared_sources_validated,1);assert.equal(out.prepared_reused,0);assert.equal(out.prepared_revalidation_required,0);assert.equal(out.estimates,1);assert.equal(out.salary_submitted,1);assert.equal(out.salary_independently_verified,0);const sent=JSON.parse(fs.readFileSync(posts,'utf8').trim());assert.equal(sent.requests[0].ruling.primaryId,'V2I-PREPARE');assert.deepEqual(sent.requests[0].ruling.fields,record.fields);
});

test('private preparation cache retains newly learned postings instead of restarting from its seed',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-private-seed-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const master=path.join(dir,'master.txt'),seed=path.join(dir,'seed.json'),out=path.join(dir,'output'),sources=path.join(dir,'sources.json'),reads=path.join(dir,'reads');
 const url='https://careers.example.org/private-cache';fs.writeFileSync(master,row(1,'V2I-PRIVATE-CACHE','Director of Quality','Dayton, OH','SOURCE_URL='+url));fs.writeFileSync(seed,JSON.stringify({employers:{},postingEvidence:{}}));const seedBytes=fs.readFileSync(seed);fs.writeFileSync(sources,JSON.stringify({[url]:{body:exactPosting()}}));
 const env={...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_EMPLOYER_CACHE:seed,ENRICH_TEST_FAST:'1',ENRICH_TEST_FETCHES:reads,ENRICH_TEST_SOURCE_RESPONSES:sources};
 const run=extra=>{cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--prepare-only','--preparation-dir',out,...extra],{env,stdio:'pipe'});return JSON.parse(fs.readFileSync(path.join(out,'report.json')));};
 assert.equal(run([]).posted_pay,1);const cache=require('./employer-cache-store'),saved=cache.read(path.join(out,'employer.json'));assert.equal(Object.keys(saved.postingEvidence).length,1);
 // Force the second run to use saved posting evidence, not the prepared salary.
 for(const file of fs.readdirSync(out).filter(f=>f.startsWith('enrich-ats-pay-prepared-')))fs.unlinkSync(path.join(out,file));fs.writeFileSync(reads,'');
 const second=run(['--saved-evidence-only']);assert.equal(second.prepared_reused,0);assert.equal(second.network_requests,0);assert.equal(second.sample[0].fields.SALARY_BASE_LOW,180000);assert.deepEqual(cache.read(path.join(out,'employer.json')).postingEvidence,saved.postingEvidence);assert.deepEqual(fs.readFileSync(seed),seedBytes);assert.equal(fs.readFileSync(reads,'utf8'),'');
});

test('preparation fails closed for legacy LinkedIn text and historical lane checks without exact retained source',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-legacy-preparation-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const master=path.join(dir,'master.txt'),sources=path.join(dir,'sources.json'),out=path.join(dir,'output');
 const guest='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/5012345678';
 const text='Lead manufacturing quality and production operations. '.repeat(20)+'Bachelor degree required.';
 fs.writeFileSync(master,row(1,'V2I-LEGACY-PREP','Director of Quality','Dayton, OH','SOURCE_URL=https://www.linkedin.com/jobs/view/5012345678; FEASIBILITY_ATTEMPT_ASOF=2026-11-09')+'\n'+row(2,'V2I-ANCHOR','Director, Quality','Columbus, OH','SALARY_BASIS=EMPLOYER_POSTED; SALARY_BASE_LOW=160000; SALARY_BASE_HIGH=200000; DEGREE_REQ=REQUIRED; DEGREE_TEXT=BS'));
 fs.writeFileSync(sources,JSON.stringify({[guest]:{body:'<div class="show-more-less-html__markup">'+text+'</div>'}}));
 cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch.js'),path.join(__dirname,'run.js'),'--prepare-only','--preparation-dir',out],{env:{...process.env,ENRICH_FC_DIR:FC,ENRICH_MASTER_FILE:master,ENRICH_LEDGER:path.join(dir,'ledger.json'),ENRICH_TEST_FAST:'1',ENRICH_TEST_SOURCE_RESPONSES:sources},stdio:'pipe'});
 const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.equal(report.salary_estimates_prepared,0);assert.equal(report.preparation_source_gaps,1);assert.ok(report.pending.some(p=>p.status==='COMPLETE_EXACT_POSTING_EVIDENCE_REQUIRED'));assert.equal(fs.readdirSync(out).filter(f=>f.startsWith('enrich-ats-pay-prepared-')).length,0);
});

test('new exact cached salary is planned during source backoff with no repeated source reads',t=>{
 const id='V2I-RETAINED-WAKE',url='https://careers.example.org/evidence-wake';
 const r={PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',p:{SOURCE_URL:url}},ledger={submitted:{},tried:{}};
 const R=require('./recovery'),now=Date.now();R.remember(ledger,r,'SALARY,DEGREE','SOURCE_RESEARCH_REQUIRED',[{url,status:'HTTP_403'}],now-3600000);
 const parsed=require('./public-posting').parse(exactPosting(),r);R.saveEvidence(ledger,r,url,parsed,now-1000);
 const out=sourceRun(t,[row(1,id,r.TITLE,r.LOCATION,'SOURCE_URL='+url)],{[url]:{status:403}},{},null,ledger);
 assert.equal(out.report.recovery_evidence_wakeups,1);assert.equal(out.report.skipped_recent,0);
 assert.deepEqual(out.reads,[]);assert.equal(out.report.sample[0].fields.SALARY_BASE_LOW,180000);
 assert.equal(out.report.sample[0].fields.DEGREE_REQ,'REQUIRED');assert.equal(out.report.submitted,0);
});
test('blocked public hosts stop at three 403s and preserve fallback budget for exact employer sources',t=>{
 const lines=[],responses={},host='https://jobs.blocked.example',good='https://careers.example.org/unblocked';
 for(let i=0;i<5;i++){const url=host+'/jobs/'+i;responses[url]={status:403};lines.push(row(i+1,'V2I-PUBLIC-BLOCK'+i,'Director of Quality','Dayton, OH',`SOURCE_URL=${url}; ${i===4?"COMPANY_SOURCE_URL="+good+"; ":""}DATE_ADDED=2026-11-0${8-i}`));}
 responses[good]={body:exactPosting()};const out=sourceRun(t,lines,responses,{maxPublicFetches:20});
 assert.equal(out.reads.filter(u=>u.startsWith(host)).length,3);
 assert.ok(out.report.source_origin_skips>=2);assert.equal(out.report.source_origin_blocks[host],3);
 assert.ok(out.report.sample.some(x=>x.fields.SALARY_BASE_LOW===180000));
 assert.equal(out.report.source_retries,0);
});
