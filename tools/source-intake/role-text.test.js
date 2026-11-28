'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const A=require('./auto-run');
const card={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://careers.example.com/plant',source:'SAVED_DISCOVERY'};
const base={max:10,sent:new Set()};
const store=text=>({forIntake:()=>({doc:{text,fullPosting:true,contentBasis:'CAPTURED_ROLE_CONTENT'}})});
test('pick carries saved posting text into ROLE_TEXT, capped at 4000 characters',()=>{
 const text='Lead plant launch and process engineering. ';
 const [p]=A.pick({new_roles:[card]},{...base,discoveryEvidence:store(text)});
 a.equal(p.record.ROLE_TEXT,text);
 const [q]=A.pick({new_roles:[card]},{...base,discoveryEvidence:store(text.repeat(300))});
 a.equal(q.record.ROLE_TEXT.length,4000);
});
test('pick sets no ROLE_TEXT when no posting text was saved, and fetches nothing',()=>{
 const [p]=A.pick({new_roles:[card]},{...base});
 a.ok(p);a.equal(p.record.ROLE_TEXT,undefined);
});
test('prepareCandidate carries captured card text into ROLE_TEXT and names it in SCOUT_NOTES',async()=>{
 const text='Own manufacturing operations. '.repeat(10).trim(),capturedCard={...card,source:'HIRINGCAFE',description:text};
 const captured={card:capturedCard,observedAt:'2026-11-15T00:00:00Z',proof:{path:'state/source-trial-report.json'}};
 const c=await A.prepareCandidate(card,{COMPANY:'Acme',TITLE:card.title,LOCATION:card.location,SOURCE_URL:card.url,SCOUT_NOTES:'n'},{capturedInputs:{find:()=>captured},discoveryEvidence:{find:()=>null},rulesHash:'abc',fetchEvidence:async()=>{throw Error('no fetch');}});
 a.equal(c.record.ROLE_TEXT,text);a.match(c.record.SCOUT_NOTES,/ROLE_TEXT carried/);
});
test('an aggregator snippet stays out of ROLE_TEXT unless full employer text is saved',async()=>{
 const source={...card,url:'https://www.glassdoor.com/job-listing/test'};
 const text='Own plant launch and process engineering. '.repeat(15);
 const partial={doc:{text:'Plant Manager snippet.',fullPosting:false,contentBasis:'INCOMPLETE_ROLE_CONTENT'}};
 const employer={ref:{path:'state/discovery-evidence/demo.json'},doc:{url:card.url,text,fullPosting:true}};
 const discoveryEvidence={forIntake:()=>partial,employerText:()=>employer,find:()=>null};
 const [noText]=A.pick({new_roles:[source]},{...base,discoveryEvidence:{forIntake:()=>partial}});
 a.equal(noText.record.ROLE_TEXT,undefined);
 const [saved]=A.pick({new_roles:[source]},{...base,discoveryEvidence});
 a.equal(saved.record.ROLE_TEXT,text);
 const out=await A.prepareCandidate(source,saved.record,{discoveryEvidence,fetchEvidence:async()=>{throw Error('should reuse saved posting');}});
 a.equal(out.evidenceUrl,card.url);
 a.equal(out.record.ROLE_TEXT,text);
});
test('auto intake uses the employer posting listed in recovery instead of an aggregator fetch',async()=>{
 const source={...card,url:'https://www.glassdoor.com/job-listing/test',next:'Try '+card.url+'.'};
 const [picked]=A.pick({new_roles:[source]},{...base}),text='Direct site launch and manufacturing engineering. '.repeat(15);
 const out=await A.prepareCandidate(source,picked.record,{discoveryEvidence:{find:()=>null},
  fetchEvidence:async()=>{throw Error('should not load the aggregator');},
  readEmployer:async(job,url)=>{a.equal(job,source);a.equal(url,card.url);return {text};}});
 a.equal(out.evidenceUrl,card.url);a.equal(out.record.ROLE_TEXT,text);
});
