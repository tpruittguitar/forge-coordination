const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),os=require('os'),p=require('path'),S=require('../programmed-coordinator/store.cjs'),M=require('./modern-receipts');
test('JSON-in-txt research receipts prove execution through immutable reviews, without claiming canonical resolution',()=>{const root=fs.mkdtempSync(p.join(os.tmpdir(),'modern-receipt-'));try{const run='FORGE-GOFER-CHATGPT-20261105T074326Z',v={schema:'forge.ai-exception-review.v1',reviewedBy:'CHATGPT',taskKey:'FORGE_APPLICATION_WRITER_GOFER',reviewedAt:'2026-11-05T07:43:30Z'},file='receipts/AI_EXCEPTION_REVIEWS/'+'a'.repeat(64)+'-'+S.hash(v)+'.json';S.save(root,file,v);const t={provider:'ChatGPT',runId:run,taskKey:v.taskKey,instructionSha:'b'.repeat(40),at:'2026-11-05T07:44:00Z',submitted:0,verified:0,noReplay:true,persistentReviews:[{path:file,canonicalWrites:0}]};a.equal(M.execution(root,'AI_REASON_RUN_RECEIPT_'+run+'_TERMINAL.txt',t).id,'forge-application-writer-gofer');t.persistentReviews[0].canonicalWrites=1;a.equal(M.execution(root,'AI_REASON_RUN_RECEIPT_'+run+'_TERMINAL.txt',t),null);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('tracker source capture needs independent code consumption corroboration',()=>{const t={provider:'ChatGPT',runId:'FORGE-OUTCOME-CHATGPT-20261105T072426Z',taskKey:'FORGE_APPLICATION_OUTCOME_TRACKER',instructionSha:'a'.repeat(40),at:'2026-11-05T07:25:00Z',masterSubmitted:0,masterVerified:0,noReplay:true,gmail:{enumerated:20,newFullCaptures:5,reused:15,pendingCapture:0}},f='AI_REASON_RUN_RECEIPT_'+t.runId+'_TERMINAL.txt';a.equal(M.execution('.',f,t,null),null);a.equal(M.execution('.',f,t,{at:'2026-11-05T07:30:00Z',runId:'CODE',routineHandoffs:{mail:{read:20}}}).id,'forge-application-outcome-tracker');});

test('instruction SHA aliases are validated and instructionSha takes precedence',()=>{
 const t={provider:'ChatGPT',runId:'FORGE-OUTCOME-CHATGPT-test',taskKey:'FORGE_APPLICATION_OUTCOME_TRACKER',at:'2026-11-05T07:25:00Z',masterSubmitted:0,masterVerified:0,noReplay:true,gmail:{enumerated:1,newFullCaptures:1,reused:0,pendingCapture:0}},f='AI_REASON_RUN_RECEIPT_'+t.runId+'_TERMINAL.txt',c={at:t.at,runId:'CODE',routineHandoffs:{mail:{read:1}}};
 for(const field of ['instructionSha','instructionCommit']){
  for(const sha of ['a'.repeat(40),'B'.repeat(40)])a.equal(M.execution('.',f,{...t,[field]:sha},c).id,'forge-application-outcome-tracker');
  for(const bad of ['a'.repeat(39),'z'.repeat(40),'a'.repeat(41),''])a.equal(M.execution('.',f,{...t,[field]:bad},c),null);
 }
 a.equal(M.execution('.',f,{...t,instructionSha:'bad',instructionCommit:'a'.repeat(40)},c),null);
 a.ok(M.execution('.',f,{...t,instructionSha:'a'.repeat(40),instructionCommit:'bad'},c));
});
test('real POSTVAL source checks prove execution without claiming canonical writes',()=>{
 const file='AI_REASON_RUN_RECEIPT_FORGE-POSTVAL-CHATGPT-20261116T021250Z_TERMINAL.txt',t=JSON.parse(fs.readFileSync(p.join(__dirname,'../../receipts',file)));
 a.deepEqual(M.execution('.',file,t),{id:'forge-posting-validation',status:'SOURCE_CHECKS_SAVED_CANONICAL_CONSUMPTION_PENDING',files:[file]});
 for(const patch of [{noReplay:false},{writerSubmitted:true},{WRITTEN:1},{VERIFIED:1},{SUBMITTED:1},{items:[]},{ROWS_EVALUATED:999},{items:[{...t.items[0],evidenceSha256:'bad'}]},{items:[{...t.items[0],observedAt:'2099-01-01'}]}])a.equal(M.execution('.',file,{...t,...patch}),null);
});
