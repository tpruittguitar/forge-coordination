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

const unrelated=('Oversee customer support across all regions. Coordinate client appointments, resolve account inquiries, and report monthly service results. Set budgets and direct branch administrators, including daily scheduling and customer correspondence. ' ).repeat(2);
const gateCard={...card,title:'Director of Operational Excellence',description:unrelated};
test('early ATS gate excludes only a grounded zero, retains distinct positive hits and Never Consider precedence',()=>{
 const zero=P.screen(gateCard,ctx);a.equal(zero.decision,'EXCLUDE_ATS_ZERO');a.equal(P.excluded(zero),true);a.equal(zero.atsGate.hits,0);a.equal(zero.atsGate.sourceSha256,P.hash(unrelated.trim()));a.equal(zero.atsGate.resumeTextSha256,profile.source.textSha256);a.deepEqual(zero.atsGate.sourceIdentity,{company:card.company,title:gateCard.title,location:card.location});a.equal(zero.canonicalWrites,0);
 const positive=P.screen({...gateCard,description:unrelated+' PPAP, PPAP and ISO 9001.'},ctx);a.equal(positive.decision,'PROGRESS_TO_INTAKE');a.equal(positive.atsGate.hits,1);a.equal(positive.atsGate.status,'PASS');
 const nc=P.screen({...gateCard,description:'We are a food manufacturer. '+unrelated},ctx);a.equal(nc.decision,'EXCLUDE_NEVER_CONSIDER');a.equal(nc.atsGate.hits,0);
});
test('missing, short, selected, alert, title echo and access-page content is unknown, never a negative gate',()=>{
 for(const c of [{...gateCard,description:''},{...gateCard,description:'Customer support'},{...gateCard,description:'<p>  </p>'},{...gateCard,description:unrelated+' verify you are human'},{...gateCard,contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'},{...gateCard,discoveryReview:{contentBasis:'EXACT_ORIGINAL_ALERT_CARD',fullPosting:false}},{...gateCard,title:unrelated},{...gateCard,url:''}]){
  const s=P.screen(c,ctx);a.equal(s.atsGate.hits,null);a.equal(s.atsGate.status,'UNKNOWN');a.equal(s.decision,'PROGRESS_TO_INTAKE');
 }
});
test('missing, malformed, stale and unverified resume evidence cannot manufacture a zero gate',()=>{
 const bad=structuredClone(profile);bad.competencies[0].terms=[''];
 for(const extra of [{profile:null},{profile:{}},{profile:bad},{profile:{...profile,source:{...profile.source,modifiedAt:'invalid'}}},{documents:null},{documents:{}},{documents:{resumes:[]}},{documents:{resumes:[{id:'unrelated',modifiedTime:'2020-01-01T00:00:00Z'}]}},{documents:{resumes:[{id:'broken',modifiedTime:'invalid'}]}},{documents:{resumes:[{id:'newer',modifiedTime:'2030-01-01T00:00:00Z'}]}}]){
  const s=P.screen(gateCard,{...ctx,...extra});a.equal(s.atsGate.hits,null);a.equal(s.atsGate.status,'UNKNOWN');a.equal(s.decision,'PROGRESS_TO_INTAKE');
 }
});
test('AUTO applies gate before source fetch using either captured or locally stored posting; stale decisions are recomputed',()=>{
 const {pick}=require('../source-intake/auto-run'),options={max:2,sent:new Set(),screenContext:ctx};
 a.equal(pick({new_roles:[gateCard]},options).length,0);
 const titleOnly={...gateCard,description:'',discoveryReview:{decision:'EXCLUDE_ATS_ZERO',contentBasis:'EXACT_ORIGINAL_ALERT_CARD',fullPosting:false}};a.equal(pick({new_roles:[titleOnly]},options).length,1);
 let reads=0;a.equal(pick({new_roles:[titleOnly]},{...options,discoveryEvidence:{find(){reads++;return{doc:{text:unrelated,fullPosting:true}};}}}).length,0);a.equal(reads,1);
 a.equal(pick({new_roles:[{...gateCard,description:unrelated+' PPAP'}]},options).length,1);
});
test('ATS exclusion preserves discovery history and saved evidence, reopens on new resume, never overrides canonical/fenced work',t=>{
 const U=require('../pipeline-observability/upstream-flow'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'ats-gate-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const now=Date.parse('2026-11-07T04:00:00Z'),at=new Date(now-3600000).toISOString(),record=U.candidate({...gateCard,status:'NEW'},at,'state/board-discovery-report.json');
 let first=U.build({records:[record],rows:[],now,root,screenContext:ctx}),e=first.ledger.entries[record.key];a.equal(first.summary.waiting,0);a.equal(first.summary.counts.EXCLUDED,1);a.equal(first.summary.rates.discovery.count,1);a.equal(first.summary.reconciled,true);a.equal(e.evidenceRefs.length,1);a.equal(first.summary.screening.atsZeroExcluded,1);
 const again=U.build({records:[],rows:[],prior:first.ledger,now:now+60000,root,screenContext:ctx});a.equal(again.summary.counts.EXCLUDED,1);a.deepEqual(again.ledger.entries[record.key].sources,e.sources);a.equal(again.ledger.entries[record.key].firstSeen,e.firstSeen);a.deepEqual(again.ledger.entries[record.key].evidenceRefs,e.evidenceRefs);
 const changed=structuredClone(profile);changed.source.textSha256='a'.repeat(64);changed.competencies[0].terms.push('customer support');const reopened=U.build({records:[],rows:[],prior:again.ledger,now:now+120000,root,screenContext:{...ctx,profile:changed}});a.equal(reopened.summary.waiting,1);a.equal(reopened.summary.reconciled,true);
 const row={PRIMARY_ID:'V2I-EXISTING',COMPANY:gateCard.company,TITLE:gateCard.title,LOCATION:gateCard.location,BUCKET:'DECLINED_BY_TIM',p:{SOURCE_URL:gateCard.url}};
 const present=U.build({records:[record],rows:[],archive:[row],now,root,screenContext:ctx});a.equal(present.summary.counts.PRESENT,1);a.equal(row.BUCKET,'DECLINED_BY_TIM');
 const missing=U.build({records:[record],rows:[],prior:present.ledger,now:now+60000,root,screenContext:ctx});a.equal(missing.summary.counts.MISSING_PREVIOUSLY_PRESENT,1);
 for(const status of ['POST_IN_FLIGHT_UNKNOWN','SUBMITTED','HELD_WRITER_REVIEW','VERIFIED_EXISTING','EXISTING_PROTECTED']){const held=U.build({records:[{...record,status}],rows:[],now,root,screenContext:ctx});a.equal(held.summary.counts.EXCLUDED,0,status);}
 fs.writeFileSync(path.join(root,'state/EMAIL_RECOVERY_QUEUE.json'),JSON.stringify({jobs:{[record.key]:{key:record.key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'ORIGINAL'}]}}}));a.equal(U.build({records:[record],rows:[],now,root,screenContext:ctx}).summary.counts.EXCLUDED,0);
});
test('saved quotes and unmatched stored identities never become negative full-role evidence',t=>{
 const U=require('../pipeline-observability/upstream-flow'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'ats-binding-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const now=Date.parse('2026-11-07T04:00:00Z'),record=U.candidate(gateCard,new Date(now).toISOString(),'state/board-discovery-report.json');
 const first=U.build({records:[record],rows:[],now,root,screenContext:ctx});const e=first.ledger.entries[record.key];
 e.company='Different Company';const changed=U.build({records:[],rows:[],prior:first.ledger,now,root,screenContext:ctx});a.equal(changed.summary.counts.EXCLUDED,0);a.equal(changed.ledger.entries[record.key].preliminaryScreen.atsGate.hits,null);
 const prior={entries:{[record.key]:{key:record.key,company:gateCard.company,title:gateCard.title,location:gateCard.location,sourceUrl:gateCard.url,firstSeen:record.firstSeen,sources:['saved'],status:'WAITING',preliminaryScreen:{neverConsider:{quote:unrelated},ats:{matches:[]}}}},groups:{}};
 const quotes=U.build({records:[],rows:[],prior,now,screenContext:ctx});a.equal(quotes.summary.counts.EXCLUDED,0);a.equal(quotes.ledger.entries[record.key].preliminaryScreen.contentBasis,'PREVIOUSLY_CAPTURED_QUOTES');a.equal(quotes.ledger.entries[record.key].preliminaryScreen.atsGate.hits,null);
});

test('incomplete source report content stays unknown after evidence-store rollover',t=>{
 const U=require('../pipeline-observability/upstream-flow'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'ats-excerpt-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const now=Date.parse('2026-11-07T04:00:00Z');
 const r=U.candidate({...gateCard,source:'BOARD:greenhouse',contentBasis:'CAPTURED_CARD_EXCERPT'},new Date(now).toISOString(),'state/board-discovery-report.json');const first=U.build({records:[r],rows:[],now,root,screenContext:ctx});a.equal(first.summary.waiting,1);
 const after=U.build({records:[],rows:[],prior:first.ledger,now:now+60000,root,screenContext:ctx});a.equal(after.summary.waiting,1);a.equal(after.ledger.entries[r.key].preliminaryScreen.atsGate.hits,null);a.equal(after.ledger.entries[r.key].discoveredFacts.fullPosting,false);
});
