'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),A=require('./auto-run'),U=require('../pipeline-observability/upstream-flow');
const card=title=>({company:'Acme',title,location:'Austin, TX',url:'https://example.com/jobs/1'});
test('independently validated content can resolve an unclear title, but cannot override an active function exclusion',()=>{
 const r=card('General Manager'),reviewed=new Map([[U.key(r.url),{role:r}]]);a.equal(A.pick({new_roles:[r]},{max:10,sent:new Set()}).length,0);a.equal(A.pick({new_roles:[r]},{max:10,sent:new Set(),reviewed}).length,1);
 const off=card('Claims Operations Director');a.equal(A.pick({new_roles:[off]},{max:10,sent:new Set(),reviewed:new Map([[U.key(off.url),{role:off}]])}).length,0);
});
test('scope evidence is identity bound and original request fences survive new source URLs',()=>{
 const r=card('General Manager');a.equal(A.pick({new_roles:[r]},{max:10,sent:new Set(),reviewed:new Map([[U.key(r.url),{role:{...r,location:'Dallas, TX'}}]])}).length,0);
 const plant=card('Plant Manager'),identity=require('./auto-latch').identityKey({COMPANY:plant.company,TITLE:plant.title});a.equal(A.pick({new_roles:[plant]},{max:10,sent:new Set(),blockedIdentities:new Set([identity])}).length,0);
});
test('the Writer payload retains a compact audit reference and why discovery selected the role',()=>{
 const r={...card('Plant Manager'),selectionReason:'Title selected as MFG_PROD / DIRECTOR_PLUS; US manufacturing role',discoveryReview:{sourceSha256:'a'.repeat(64),scopeHits:['manufacturing']},initiatingUrl:'https://example.com/original/1'};
 const [picked]=A.pick({new_roles:[r]},{max:10,sent:new Set()});a.match(picked.record.SCOUT_NOTES,/discoverySHA=/);a.match(picked.record.SCOUT_NOTES,/MFG_PROD/);a.equal(picked.record.INITIATING_URL,r.initiatingUrl);a.ok(picked.record.SCOUT_NOTES.length<=400);
});
