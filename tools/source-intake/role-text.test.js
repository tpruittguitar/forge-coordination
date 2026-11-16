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
