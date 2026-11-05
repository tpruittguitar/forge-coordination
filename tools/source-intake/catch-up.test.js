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
