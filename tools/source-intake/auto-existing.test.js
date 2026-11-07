'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {partitionExisting}=require('./auto-run'),{requestId}=require('./production-executor'),{identityKey}=require('./auto-latch');
const role={company:'Factory',title:'Director Manufacturing',location:'Austin, TX',url:'https://jobs.example.com/roles/101'};
const row={PRIMARY_ID:'V2I-1',COMPANY:role.company,TITLE:role.title,LOCATION:role.location,p:{SOURCE_URL:role.url}};
const snapshot=rows=>({source:'WRITER',authenticated:true,writerReadAt:new Date().toISOString(),rows});
const input=(rows=[row],archived=[])=>({master:snapshot(rows),archive:snapshot(archived)});
test('unique master or archive presence is partitioned before source fetch or Writer submission',()=>{
 for(const options of [input(),input([],[row])]){const out=partitionExisting([role],options);assert.equal(out.remaining.length,0);assert.equal(out.existing[0].primaryId,row.PRIMARY_ID);assert.equal(out.existing[0].writerSubmissions,0);assert.equal(out.existing[0].writeCompletionClaimed,false);assert.match(out.existing[0].rowSha256[0],/^[a-f0-9]{64}$/);}
});
test('ambiguous or contradictory identity is never silently closed',()=>{
 const duplicate={...row,PRIMARY_ID:'V2I-2'};
 assert.equal(partitionExisting([role],input([row,duplicate])).existing.length,0);
 assert.equal(partitionExisting([{...role,reqId:'DIFFERENT'}],input([{...row,REQ_ID:'KNOWN'}])).existing.length,0);
 const otherCity={...role,location:'Dallas, TX',url:'https://jobs.example.com/roles/102'};
 assert.equal(partitionExisting([otherCity],input()).existing.length,0);
});
test('request and identity fences cannot be satisfied by discovery presence',()=>{
 const record={COMPANY:role.company,TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url};
 for(const fence of [{sent:new Set([requestId(record)])},{blockedIdentities:new Set([identityKey(record)])}]){
  const out=partitionExisting([role],{...input(),...fence});assert.equal(out.existing.length,0);assert.equal(out.remaining.length,1);
 }
});
test('snapshot authority and freshness fail closed, and repeated checks remain zero-write',()=>{
 assert.throws(()=>partitionExisting([role],{...input(),master:{...snapshot([row]),authenticated:false}}),/authenticated/);
 assert.throws(()=>partitionExisting([role],{...input(),archive:{...snapshot([]),writerReadAt:'2020-01-01T00:00:00Z'}}),/authenticated/);
 for(let i=0;i<2;i++)assert.equal(partitionExisting([role],input()).existing[0].writerSubmissions,0);
});
test('ambiguous and incomplete canonical matches never enter source fetch or intake candidates',()=>{
 const {pick}=require('./auto-run');for(const rows of [[row,{...row,PRIMARY_ID:'V2I-2'}],[{...row,LOCATION:'UNKNOWN',p:{}}]]){
  const out=partitionExisting([{...role,url:'https://jobs.example.com/roles/other'}],input(rows));assert.equal(out.existing.length,0);assert.equal(out.remaining.length,0);assert.equal(out.held.length,1);assert.equal(out.held[0].writerSubmissions,0);assert.equal(pick({new_roles:out.remaining},{max:10,sent:new Set()}).length,0);
 }
});
test('normalized cross-source Writer fences block closure and resubmission',()=>{
 const {pick}=require('./auto-run'),out=partitionExisting([{...role,company:'Factory Group',title:'Sr. Director Manufacturing'}],{...input([{...row,COMPANY:'Factory',TITLE:'Senior Director Manufacturing'}]),writerFences:[{key:'url:other',requestIds:['UNCERTAIN'],record:{COMPANY:'Factory Inc.',TITLE:'Senior Director Manufacturing',SOURCE_URL:'https://other.example/job'}}]});
 assert.equal(out.existing.length,0);assert.equal(out.remaining.length,0);assert.equal(out.held[0].status,'ORIGINAL_WRITER_FENCE');assert.equal(pick({new_roles:out.remaining},{max:10,sent:new Set()}).length,0);
});
test('an unrelated same-title worksite is not excluded by a quarantined full record or cross-workflow fence',()=>{
 const {pick}=require('./auto-run'),old={COMPANY:'Factory',TITLE:'Director Manufacturing',LOCATION:'La Porte, IN',SOURCE_URL:'https://jobs.example.com/roles/old'},newRole={...role,location:'Morristown, TN'};
 for(const options of [{blockedRecords:[old]},{writerFences:[{requestIds:['ORIGINAL'],record:old}]}]){const out=partitionExisting([newRole],{...input([]),...options});assert.equal(out.held.length,0);assert.equal(out.remaining.length,1);assert.equal(pick({new_roles:out.remaining},{max:10,sent:new Set(),blockedRecords:[old]}).length,1);}
 const same={...newRole,location:'La Porte, Indiana'};assert.equal(pick({new_roles:[same]},{max:10,sent:new Set(),blockedRecords:[old]}).length,0);
 const unknown={...old,LOCATION:'UNKNOWN'};assert.equal(pick({new_roles:[newRole]},{max:10,sent:new Set(),blockedRecords:[unknown]}).length,0);
});
test('pick emits whitelisted scope and identity evidence without changing stable request IDs',()=>{
 const {pick}=require('./auto-run'),I=require('../source-trial/job-identity');
 const candidate={...role,p:{REMOTE_HYBRID:'HYBRID',OPERATING_SCOPE:'MULTI_SITE',OPERATING_SCOPE_EVIDENCE:'Lead across plants',INITIATING_URL:'https://alerts.example.com/123',COMPANY_SOURCE_URL:'https://ats.example.com/123',OPERATING_SCOPE_SOURCE_URL:'https://ats.example.com/123',REQ_ID:'EMPLOYER-123'},workArrangement:'REMOTE',UNSUPPORTED:'must not leak',BUCKET:'APPLIED',description:'source description'};
 const [{record}]=pick({new_roles:[candidate]},{max:1,sent:new Set()});
 assert.equal(record.INITIATING_URL,'https://alerts.example.com/123');assert.equal(record.OPERATING_SCOPE_SOURCE_URL,'https://ats.example.com/123');assert.equal(record.REMOTE_HYBRID,'HYBRID');assert.equal(record.OPERATING_SCOPE,'MULTI_SITE');assert.equal(record.OPERATING_SCOPE_EVIDENCE,'Lead across plants');assert.equal(record.COMPANY_SOURCE_URL,'https://ats.example.com/123');assert.equal(record.REQUISITION_ID,undefined);assert.equal(record.REQ_ID,undefined);assert.equal(record.UNSUPPORTED,undefined);assert.equal(record.BUCKET,undefined);assert.equal(record.p,undefined);
 assert.equal(requestId(record),requestId({COMPANY:role.company,TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url}));assert.equal(I.fields(record).scopeUncertain,true);
 const [{record:aliases}]=pick({new_roles:[{...role,workMode:'REMOTE',operatingScope:'REGIONAL',scopeEvidence:'Across facilities'}]},{max:1,sent:new Set()});assert.equal(aliases.REMOTE_HYBRID,'REMOTE');assert.equal(aliases.OPERATING_SCOPE,'REGIONAL');assert.equal(aliases.OPERATING_SCOPE_EVIDENCE,'Across facilities');
});
