'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path'),C=require('./catch-up');
const role={company:'Acme',title:'Director Manufacturing',location:'Dayton, OH',url:'https://example.org/jobs/1'};
test('catch-up retains candidates through report rollover, deduplicates, and leaves attempted requests fenced',()=>{
 const s=C.ingest({schema:'forge.intake-catch-up.v1',roles:{}},[{new_roles:[role,role]}],1000);
 C.ingest(s,[{new_roles:[]}],2000);a.equal(C.due(s,2000).length,1);
 const r=C.report(s,{sent:new Set([C.id(role)]),quarantined:[{requestId:C.id(role)}]},2000);a.equal(r.unattempted,0);a.equal(r.attempted,1);a.equal(r.unresolvedRequests,1);a.equal(r.canonicalCompletionsClaimed,0);
});
test('unchanged source is not retried on every batch; due time or changed evidence reopens it',()=>{
 const s=C.ingest({roles:{}},[{new_roles:[role]}],1000);C.defer(s,role,2000);
 C.ingest(s,[{new_roles:[{...role,discoveredAt:'new-observation'}]}],3000);a.equal(C.due(s,3000).length,0);a.equal(C.due(s,3602000).length,1);
 C.ingest(s,[{new_roles:[{...role,sourceSha256:'changed-source'}]}],4000);a.equal(C.due(s,4000).length,1);
});
test('catch-up inventory and retry checkpoints survive process restart',()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'catch-up-'));try{const s=C.ingest(C.load(root),[{new_roles:[role]}],1000);C.defer(s,role,2000);C.save(root,s);a.equal(C.due(C.load(root),3000).length,0);a.equal(C.report(C.load(root),{},3000).waitingSourceRetry,1);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('captured source releases only source-access waits and preserves attempts without completion',()=>{
 const s=C.ingest({roles:{}},[{new_roles:[role]}],1000);C.defer(s,role,2000);C.defer(s,role,3000);const item=s.roles[C.id(role)];
 a.equal(C.releaseSourceHolds(s,r=>r===role,4000),1);a.equal(C.due(s,4000).length,1);a.equal(item.status,'PENDING_INTAKE');a.equal(item.attempts,2);a.equal(item.lastAttempt,new Date(3000).toISOString());a.equal(item.retryAfter,undefined);a.equal(item.reason,undefined);a.equal(item.sourceHoldHistory[0].reason,'SOURCE_EVIDENCE_UNAVAILABLE');a.equal(item.sourceHoldHistory[0].attempts,2);a.equal(C.report(s,{},4000).canonicalCompletionsClaimed,0);
 a.equal(C.releaseSourceHolds(s,()=>true,5000),0);a.equal(item.sourceHoldHistory.length,1);
 a.equal(C.report(s,{sent:new Set([C.id(role)])},5000).attempted,1,'release does not undo prior request fence');
});
test('missing captured evidence and non-source holds are not released',()=>{
 for(const change of [{},{reason:'IDENTITY_CONFLICT'},{status:'POST_IN_FLIGHT_UNKNOWN'},{status:'PROTECTED'}]){
  const s=C.ingest({roles:{}},[{new_roles:[role]}],1000);C.defer(s,role,2000);Object.assign(s.roles[C.id(role)],change);const before=JSON.stringify(s);a.equal(C.releaseSourceHolds(s,()=>!!Object.keys(change).length,3000),0);a.equal(JSON.stringify(s),before);
 }
});
