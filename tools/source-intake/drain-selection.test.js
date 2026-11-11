'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),A=require('./auto-run'),U=require('../pipeline-observability/upstream-flow');
const card=title=>({company:'Acme',title,location:'Austin, TX',url:'https://example.com/jobs/1'});
test('uncertain fit needs no second review and cannot override an active function exclusion',()=>{
 const r=card('General Manager'),reviewed=new Map([[U.key(r.url),{role:r}]]);a.equal(A.pick({new_roles:[r]},{max:10,sent:new Set()}).length,1);a.equal(A.pick({new_roles:[r]},{max:10,sent:new Set(),reviewed}).length,1);
 const off=card('Claims Operations Director');a.equal(A.pick({new_roles:[off]},{max:10,sent:new Set(),reviewed:new Map([[U.key(off.url),{role:off}]])}).length,0);
});
test('unneeded scope evidence cannot alter original identity and request fences survive new source URLs',()=>{
 const r=card('General Manager');const picked=A.pick({new_roles:[r]},{max:10,sent:new Set(),reviewed:new Map([[U.key(r.url),{role:{...r,location:'Dallas, TX'}}]])});a.equal(picked.length,1);a.equal(picked[0].record.LOCATION,'Austin, TX');
 const plant=card('Plant Manager'),identity=require('./auto-latch').identityKey({COMPANY:plant.company,TITLE:plant.title});a.equal(A.pick({new_roles:[plant]},{max:10,sent:new Set(),blockedIdentities:new Set([identity])}).length,0);
});
test('the Writer payload retains a compact audit reference and why discovery selected the role',()=>{
 const r={...card('Plant Manager'),selectionReason:'Title selected as MFG_PROD / DIRECTOR_PLUS; US manufacturing role',discoveryReview:{sourceSha256:'a'.repeat(64),scopeHits:['manufacturing']},initiatingUrl:'https://example.com/original/1'};
 const [picked]=A.pick({new_roles:[r]},{max:10,sent:new Set()});a.match(picked.record.SCOUT_NOTES,/discoverySHA=/);a.match(picked.record.SCOUT_NOTES,/MFG_PROD/);a.equal(picked.record.INITIATING_URL,r.initiatingUrl);a.ok(picked.record.SCOUT_NOTES.length<=400);
});
test('auto intake preserves source-bound salary and does not manufacture units',()=>{const P=require('../source-trial/posted-pay'),r={...card('Plant Manager'),payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'}};r.postedPay=P.capture(r,{observedAt:'2026-11-06T00:00:00Z'});const [p]=A.pick({new_roles:[r]},{max:10,sent:new Set()});a.equal(p.record.SALARY_BASE_LOW,180125);a.ok(!p.record.INITIAL_UNKNOWN_FIELDS.includes('PAY'));const [unknown]=A.pick({new_roles:[{...r,payFacts:null}]},{max:10,sent:new Set()});a.equal(unknown.record.SALARY_BASE_LOW,undefined);});
