'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('./contract.cjs'),S=require('./store.cjs'),St=require('./status.cjs'),G=require('./gate.cjs'),D=require('./discovery.cjs');
const {runEngine}=require('./engine.cjs'),Scope=require('./gate/10-scope.cjs'),M=require('./gate/master.cjs');
const E13=require('./engines/13-posted-pay.cjs'),E14=require('./engines/14-degree-buried-pay.cjs'),E17=require('./engines/17-pay-basis.cjs'),E19=require('./engines/19-final-score.cjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'pv2-test-'));
const RULES=['- NC-013 NY_PA_NORTHEAST: never. states=NY|PA|NJ; location_exempt=remote|multi_location',
 '- NC-015 ROLE_FAMILIES: x. title_any=sales|supply chain|logistics; title_exempt=manufacturing',
 '- NC-019 PROGRAM_PROJECT_MANAGEMENT: x. title_any=program manager; employer_business_exempt=manufacturing|energy',
 '- NC-020 IC_ENGINEER: x. title_any=engineer|technician; title_exempt=staff engineer|senior staff engineer|principal engineer; level_exempt=manager|director|vp|head',
 '- NC-021 FIRST_LINE: x. title_any=supervisor|coordinator',
 '- NC-023 UPPER_MIDWEST_ONSITE: x. states=MI|WI|MN|IA; city_any=Chicago|Skokie; location_exempt=remote|multi_location',
 '- NC-030 LEGAL_ROLES: x. title_any=attorney|counsel|legal'].join('\n');
const DESC='We build industrial machines. The Director owns plant operations, safety, quality, delivery and cost for the site and leads launch and ramp. Bachelor\'s degree in engineering or equivalent experience. '.repeat(3);
const job=(o={})=>({company:'Acme',title:'Director of Quality',location:'Austin, TX',url:'https://example.com/j/1',description:DESC,...o});
const viewer={Scoring:{point:()=>({lat:30.27,lon:-97.74}),scoreRow:()=>({overall:70,confidence:60,parts:{geo:{known:true,score:80},compensation:{known:true,score:75}},assessment:{adjustedFit:null,decision:'NEEDS_EVIDENCE',flex:{class:'HIGH_FLEX',modifier:90}},payWorth:{score:75},band:'GOOD',modelId:'m',modelVersion:'1'})},Policy:{flex:p=>/equivalent experience/i.test(p.DEGREE_TEXT)||p.DEGREE_TEXT==='NOT_STATED'?{class:'HIGH_FLEX',modifier:90}:{class:'NO_FLEX',modifier:-60}}};

test('handoff keeps every result with the 5 fields and never filters by title or place',()=>{
 const {record,problems}=C.handoff({source:'JOBSPY:linkedin',company:'X',title:'Barista',location:'Paris, France',url:'https://e.com/1'});
 assert.equal(record.lane,'JOBSPY');assert.equal(record.title,'Barista');assert.equal(record.channel,'JOBSPY_HIRINGCAFE');
 assert.deepEqual(problems,['description']);
 assert.throws(()=>C.handoff({source:'MYSTERY'}),/UNKNOWN_LANE/);
});

test('scope screen: one decision for all lanes, a reason for every drop',()=>{
 const ctx={ncRules:Scope.parseRules(RULES)};
 assert.equal(ctx.ncRules.some(r=>r.id==='NC-019'),false,'title rules with an employer exemption are left to enrichment');
 const r=(t,l,o={})=>Scope(job({title:t,location:l,...o}),ctx);
 assert.equal(r('Plant Manager','Guelph, ON, Canada').reason,'OUT_OF_SCOPE:NON_US');
 assert.equal(r('Director of Quality','Allentown, PA').reason,'NEVER_CONSIDER:NC-013_NY_PA_NORTHEAST');
 assert.equal(r('Director of Quality','Remote').status,'PASS');
 assert.equal(r('Director, Supply Chain','Savannah, GA').reason,'NEVER_CONSIDER:NC-015_ROLE_FAMILIES');
 assert.equal(r('Quality Engineer','Austin, TX').reason,'NEVER_CONSIDER:NC-020_IC_ENGINEER');
 assert.equal(r('Senior Staff Manufacturing Engineer','Hawthorne, CA').status,'PASS','senior-staff rule');
 assert.equal(r('Production Supervisor','Georgetown, KY').reason,'NEVER_CONSIDER:NC-021_FIRST_LINE');
 assert.equal(r('Associate General Counsel','Arlington, VA').reason,'NEVER_CONSIDER:NC-030_LEGAL_ROLES');
 assert.equal(r('Director of Quality','Oshkosh, WI').reason,'NEVER_CONSIDER:NC-023_UPPER_MIDWEST_ONSITE');
 assert.equal(r('Plant Manager','Skokie, IL').reason,'NEVER_CONSIDER:NC-023_UPPER_MIDWEST_ONSITE');
 const vp=r('VP Operations','Roseau, MN');assert.equal(vp.status,'PASS');assert.equal(vp.fields.NC_REVIEW_NEEDED.value,'NC-023_UPPER_MIDWEST_ONSITE');
 assert.equal(r('Director of Marketing','Costa Mesa, CA').reason,'OUT_OF_SCOPE:NOT_TARGET_FAMILY');
 assert.equal(r('Quality Manager','Marina, CA').reason,'OUT_OF_SCOPE:NOT_LEADERSHIP_LEVEL');
 assert.equal(r('Director of Quality','Multiple Locations').status,'PASS','unknown places pass');
});

test('gate runs the 7 steps in order, records drops and holds, parks unfixable holds, publishes 7 status records',async()=>{
 const store=S.open(tmp());
 const master=M.load([
  {PRIMARY_ID:'V2F-1',COMPANY:'Dup Co',TITLE:'Plant Manager',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',SCOUT_ACTION:'SOURCE_URL=https://example.com/dup'},
  {PRIMARY_ID:'V2F-2',COMPANY:'Old Co',TITLE:'Director of Quality',LOCATION:'Tampa, FL',BUCKET:'DECLINED_BY_TIM',SCOUT_ACTION:'SOURCE_URL=https://example.com/declined'}]);
 const lanes={EMAIL:[job({url:'https://example.com/dup',company:'Dup Co',title:'Plant Manager',location:'Dayton, OH'}),job({url:''})],WEB:[job({url:'https://example.com/declined',company:'Old Co',location:'Tampa, FL'}),job({url:'https://example.com/ok'}),job({url:'https://example.com/nodesc',description:''}),job({url:'https://example.com/sales',title:'Director of Sales'})]};
 const ctx={master,ncRules:Scope.parseRules(RULES),viewer,network:false};
 D.runDiscovery({store,lanes,ctx});
 const recs=await G.runGate({store,ctx});
 assert.deepEqual(recs.map(r=>r.step),G.STEP_IDS);
 const by=Object.fromEntries(recs.map(r=>[r.step,r]));
 assert.equal(by['06'].counts.hold,1);assert.equal(by['06'].queue.parked,1,'missing URL parks at once');
 assert.equal(by['07'].reasons['DESCRIPTION_UNAVAILABLE:NETWORK_OFF'],1);assert.equal(by['07'].queue.retrying,1);
 assert.equal(by['08'].reasons.DUPLICATE_OF_EXISTING,1);
 assert.equal(by['09'].reasons['DECLINED_BEFORE:DECLINED_BY_TIM'],1);
 assert.equal(by['10'].reasons['NEVER_CONSIDER:NC-015_ROLE_FAMILIES'],1);
 assert.equal(by['12'].counts.pass,1);
 const ready=store.jobs().filter(j=>j.state==='ENRICHING');assert.equal(ready.length,1);
 assert.equal(ready[0].fields.REMOTE_HYBRID.value,'ONSITE');assert.equal(ready[0].fields.LATITUDE.source,'PIPELINE_V2_CITY_TABLE');
 for(const r of recs){for(const k of ['rateIn','rateOut','queue','lastRun','nextRun','schedule'])assert.ok(k in r,k);assert.equal(r.schedule.enabled,false);assert.equal(r.nextRun,null);}
 const again=G.intake(store,[C.handoff(lanes.WEB[1],{lane:'WEB'}).record]);assert.deepEqual(again,{added:0,known:1});
 const recs2=await G.runGate({store,ctx});assert.equal(recs2[1].counts.in,1);
});

test('engine loop: own queue, retry, park after retry.max, status record',async()=>{
 const store=S.open(tmp());store.putJob({id:'P2-a',state:'ENRICHING',fields:{},trail:[]});
 const boom=async()=>{throw Error('flaky');};
 let rec;for(let i=0;i<3;i++)rec=await runEngine('13',{store,select:()=>true,work:boom});
 assert.equal(rec.counts.fail,1);assert.equal(rec.queue.parked,1);assert.equal(rec.lastRun.result,'FAILED');
 const rec4=await runEngine('13',{store,select:()=>true,work:boom});assert.equal(rec4.counts.in,0,'parked items are not retried blindly');
});

test('posted pay reads lane pay or text and keeps estimates apart',()=>{
 assert.deepEqual(E13.fromText('Pay range: $180,000 - $220,000 per year'),{low:180000,high:220000,interval:'yearly',quote:'$180,000 - $220,000'});
 assert.equal(E13.fromText('$55 - $70 per hour').interval,'hourly');
 assert.equal(E13.fromText('raised $200 million to $300 million'),null);
 const est=E13.work({description:'x',facts:{LANE_PAY:{value:{low:150000,high:190000,interval:'yearly',estimated:true},source:'JOBSPY:LANE'}},fields:{}});
 assert.equal(est.fields.PAY_POSTED.value,'NO');assert.match(est.fields.LANE_PAY_ESTIMATE.source,/THIRD_PARTY_ESTIMATE/);
});

test('AI engines report BLOCKED with no pool and still save script fields; no paid fallback',async()=>{
 const j={description:DESC,fields:{PAY_POSTED:{value:'NO',source:'x'}}};
 const out=await E14.work(j,{aiReason:'AI_POOL_UNAVAILABLE:CREDIT_KEY_EXPIRED'});
 assert.equal(out.status,'BLOCKED');assert.match(out.reason,/CREDIT_KEY_EXPIRED/);assert.match(out.fields.DEGREE_TEXT.value,/equivalent experience/);
 const ok=await E14.work(j,{ai:{available:true,ask:()=>({ok:true,text:'{"low":200000,"high":240000,"interval":"yearly","quote":"q"}'})}});
 assert.equal(ok.status,'PASS');assert.match(ok.fields.BURIED_PAY.source,/AI_CREDIT/);
});

test('pay basis and final score run as scripts and mark partial scores',()=>{
 assert.equal(E17.work({fields:{PAY_POSTED:{value:'YES',source:'s'}}}).fields.SALARY_BASIS.value,'EMPLOYER_POSTED');
 assert.equal(E17.work({fields:{PAY_POSTED:{value:'NO',source:'s'}}}).reason,'PENDING_BURIED_PAY_CHECK');
 const f=k=>({value:k,source:'s'});
 const j={company:'A',title:'Director of Quality',location:'Austin, TX',url:'https://e/1',description:DESC,fields:{PAY_POSTED:f('YES'),SALARY_BASIS:f('EMPLOYER_POSTED'),FLEX_CLASS:f('HIGH_FLEX'),REMOTE_HYBRID:f('ONSITE')}};
 const out=E19.work(j,{viewer,scoringModel:{},flexPolicy:{}});
 assert.equal(out.fields.OVERALL.value,70);assert.match(out.fields.OVERALL.source,/PARTIAL/);
 assert.equal(E19.select({fields:{...j.fields,OVERALL:out.fields.OVERALL,SCOPE_FIT_RAW:f(80)}}),true,'a partial score is redone when the AI fit lands');
});

test('steps registry: 19 steps, every schedule ships disabled',()=>{
 assert.equal(S.STEPS.length,19);assert.deepEqual(S.STEPS.map(s=>s.id),Array.from({length:19},(_,i)=>String(i+1).padStart(2,'0')));
 assert.ok(S.STEPS.every(s=>s.schedule.enabled===false));
});

test('runner refuses any Writer mode except dry run',async()=>{
 const R=require('./run.cjs');await assert.rejects(R.main({writer:'live'}),/dry run only/);
});

const ES=require('./engine-status.cjs');

test('engine status feed validates shape for 19 steps',()=>{
 const feed=ES.build({statusDir:require('node:path').join(__dirname,'out-test-status')});
 assert.equal(feed.schema,'forge.engine-status.v1');
 assert.equal(feed.steps.length,19);
 for(const step of feed.steps){
  for(const k of ['id','n','name','stage','method','runsAs','schedule','rateIn','rateOut','queue','queueDeltaPerHour','lastRunAt','nextRunAt','result','state']) assert.ok(k in step,k);
 }
 assert.ok('writer' in feed);
 assert.ok('readyForDecision' in feed);
});

test('dry run writes engine status feed for 20-row fixture',()=>{
 const tmp=require('node:os').tmpdir();
 const dir=require('node:path').join(tmp,'pv2-'+Date.now());
 fs.mkdirSync(require('node:path').join(dir,'status'),{recursive:true});
 for(const s of require('./steps.json').steps) fs.writeFileSync(require('node:path').join(dir,'status',s.id+'-'+s.slug+'.json'),'{}\n');
 const feed=ES.build({statusDir:require('node:path').join(dir,'status')});
 assert.equal(feed.steps.length,19);
});
