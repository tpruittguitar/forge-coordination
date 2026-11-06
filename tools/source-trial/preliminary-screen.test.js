'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),P=require('./preliminary-screen'),Resume=require('./resume-match');
const profile=Resume.load(),rules={status:'ACTIVE',raw:'current canonical fixture',rules:require('./never-consider-patterns.json').rules.map(r=>({RULE_ID:r.id,CATEGORY:r.category,MATCH:r.match,ACTION:'DO_NOT_ADD',active:true}))};
const ctx={profile,rules,documents:{resumes:[{id:profile.source.fileId,modifiedTime:profile.source.modifiedAt}]}};
const card={company:'Example Industries',title:'Director of Manufacturing',location:'Dallas, TX',url:'https://example.test/jobs/1'};
test('preliminary ATS carries current resume provenance and supported posting matches without a final score',()=>{
 const r=P.screen({...card,description:'Lead greenfield assembly, robotics commissioning, PPAP and manufacturing quality.'},ctx);
 a.equal(r.ats.resumeTextSha256,profile.source.textSha256);a.ok(r.ats.matches.some(m=>m.competencyId==='quality_systems'));a.equal(r.finalFit,false);a.equal(r.canonicalWrites,0);a.equal('score' in r.ats,false);
});
test('each current never-consider rule requires an explicit employer business statement',()=>{
 for(const [description,id] of [['We are a pharmaceutical manufacturer.','NC-001'],['We are a manufacturer of medical devices.','NC-002'],['We are a food manufacturer.','NC-003'],['We operate restaurants throughout Texas.','NC-004']]){
  const r=P.screen({...card,description},ctx);a.equal(r.decision,'EXCLUDE_NEVER_CONSIDER',description);a.equal(r.neverConsider.ruleId,id);a.equal(r.neverConsider.rulesSha256,P.hash(rules.raw));a.equal(r.neverConsider.quote,description);
 }
});
test('employer names, titles, customers, suppliers and agency clients cannot cause industry exclusion',()=>{
 for(const description of ['Pharmaceutical manufacturing experience required.','Our customers manufacture medical devices.','We are an automation supplier serving pharmaceutical manufacturers.','We are a food manufacturing equipment maker.','We are a manufacturer of machinery for the food manufacturing industry.','Our client is a food manufacturer.','We are seeking a director with pharmaceutical manufacturing experience.','We are a team of experts in food manufacturing.','We are proud to partner with a medical device manufacturer.','We are not a food manufacturer.','We are a pharmaceutical manufacturer. We are an equipment supplier.']){
  const r=P.screen({...card,company:'Pharma Foods Restaurant',description},ctx);a.equal(r.decision,'PROGRESS_TO_INTAKE',description);
 }
});
test('unavailable, inactive and changed rule definitions cannot exclude',()=>{
 const c={...card,description:'We are a food manufacturer.'};
 for(const r of [null,{...rules,status:'UNAVAILABLE'},{...rules,rules:rules.rules.map(x=>({...x,active:false}))},{...rules,rules:rules.rules.map(x=>({...x,MATCH:'Tim now excludes breweries only'}))}])a.equal(P.screen(c,{...ctx,rules:r}).decision,'PROGRESS_TO_INTAKE');
});
test('industry nouns cannot exclude makers of packaging, machines or device components',()=>{
 for(const description of ['We manufacture food packaging.','We manufacture food processing machines.','We manufacture medical device components.','We are a manufacturer of medical device components.','We are a manufacturer of machines for food processing.','We manufacture restaurant equipment.','We are a packaging manufacturer for restaurants.']){
  const r=P.screen({...card,description},ctx);a.equal(r.decision,'PROGRESS_TO_INTAKE',description);a.equal(r.neverConsider.status,'REVIEW_PROTECTED_SUPPLIER',description);
 }
 // The carveout does not change the canonical exclusion for an actual producer.
 for(const description of ['We are a food manufacturer.','We manufacture medical devices.','We operate restaurants throughout Texas.','We are a restaurant group.','We manufacture restaurant meals.'])a.equal(P.screen({...card,description},ctx).decision,'EXCLUDE_NEVER_CONSIDER',description);
});
test('a newer resume invalidates preliminary matching while an older approved resume cannot replace the user attachment',()=>{
 let r=P.screen(card,{...ctx,documents:{resumes:[{id:'old-approved',modifiedTime:'2026-09-17T00:00:00Z'}]}});a.equal(r.ats.resumeTextSha256,profile.source.textSha256);
 r=P.screen(card,{...ctx,documents:{resumes:[{id:'new-resume',modifiedTime:'2026-11-05T20:00:00Z'}]}});a.equal(r.ats.status,'RESUME_UPDATE_REQUIRED');a.equal(r.decision,'PROGRESS_TO_INTAKE');a.equal(r.ats.matches.length,0);
 r=P.screen(card,{...ctx,documents:{resumes:[{id:profile.source.fileId,modifiedTime:'2026-11-05T20:00:00Z'}]}});a.equal(r.ats.status,'RESUME_UPDATE_REQUIRED');
});
test('title-only or zero overlap never automatically rejects a candidate',()=>{
 const r=P.screen({...card,title:'General Manager'},ctx);a.equal(r.ats.contentBasis,'TITLE_ONLY');a.equal(r.ats.automaticRejection,false);a.equal(r.decision,'PROGRESS_TO_INTAKE');a.ok(r.unresolved.includes('EMPLOYER_BUSINESS_NOT_REVIEWED'));
});
test('context reads current policy and resume inventory once; a failed lookup becomes explicit uncertainty',async()=>{
 const actions=[];let c=await P.context({profile,reader:async action=>{actions.push(action);return{data:action==='rules'?{rules}:ctx.documents};}});a.deepEqual(actions.sort(),['documents','rules']);a.equal(P.screen({...card,description:'We are a food manufacturer.'},c).decision,'EXCLUDE_NEVER_CONSIDER');
 c=await P.context({profile,reader:async()=>{throw Error('offline');}});const r=P.screen(card,c);a.equal(r.neverConsider.status,'RULES_UNAVAILABLE');a.ok(r.unresolved.includes('CANONICAL_RULES_NOT_VERIFIED'));
});

test('early exclusions remain captured discoveries and current rule changes reopen only source screening',()=>{
 const U=require('../pipeline-observability/upstream-flow'),now=Date.parse('2026-11-05T21:00:00Z'),record=U.candidate({...card,description:'We are a food manufacturer.'},new Date(now-3600000).toISOString(),'fixture');
 const first=U.build({records:[record],rows:[],now,screenContext:ctx});a.equal(first.summary.counts.EXCLUDED,1);a.equal(first.summary.waiting,0);a.equal(first.summary.rates.discovery.count,1);a.equal(first.ledger.entries[record.key].preliminaryScreen.neverConsider.ruleId,'NC-003');
 const next=U.build({records:[],rows:[],prior:first.ledger,now,screenContext:{...ctx,rules:{...rules,rules:[]}}});a.equal(next.summary.waiting,1);a.equal(next.summary.rates.discovery.count,1);
 const protectedRow={PRIMARY_ID:'V2I-EXISTING',COMPANY:card.company,TITLE:card.title,LOCATION:card.location,BUCKET:'DECLINED_BY_TIM',p:{SOURCE_URL:card.url}};
 const present=U.build({records:[record],rows:[protectedRow],now,screenContext:ctx});a.equal(present.summary.counts.PRESENT,1);a.equal(present.summary.counts.EXCLUDED,0);
});
test('AUTO picks the next independent candidate after a current, grounded discovery exclusion',()=>{
 const {pick}=require('../source-intake/auto-run'),first={...card,description:'We are a food manufacturer.'},second={...card,company:'Factory Automation',url:'https://example.test/jobs/2',description:'We are an automation supplier serving food manufacturers.'};
 const chosen=pick({new_roles:[first,second]},{max:20,sent:new Set(),screenContext:ctx});a.equal(chosen.length,1);a.equal(chosen[0].r.company,second.company);
});
test('first email card capture receives preliminary ATS and rule evidence without disposing unknowns',()=>{
 const L=require('../email-recovery/ledger.cjs'),l=L.empty();L.seed(l,[{gmailId:'m',url:'https://www.linkedin.com/jobs/view/123/',advertisedUnseen:0}]);
 L.capture(l,{gmailId:'m',url:l.sources.m.url,at:'2026-11-05T21:00:00Z',jobs:[{jobId:'123',paragraphs:[card.title,card.company,card.location,'We are a food manufacturer.']}],next:false,endConfirmed:true},{screenContext:ctx});
 const j=l.jobs['linkedin:123'];a.equal(j.preliminaryScreen.neverConsider.ruleId,'NC-003');a.equal(j.preliminaryScreen.ats.resumeTextSha256,profile.source.textSha256);a.equal(j.status,'UNSCREENED','source screening is not a canonical disposition');
});
