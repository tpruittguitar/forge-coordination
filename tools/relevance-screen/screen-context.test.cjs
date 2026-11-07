'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),C=require('./screen-context.cjs');
test('private context transport requires current run, exact private path and fresh checkedAt',t=>{
 const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'screen-context-'));t.after(()=>fs.rmSync(privateDir,{recursive:true,force:true}));const file=path.join(privateDir,'discovery-screen-context.json'),now=Date.now(),runId='RUN',context={checkedAt:new Date(now).toISOString(),documents:{resumes:[]}};
 const save=value=>fs.writeFileSync(file,JSON.stringify(value));save({runId,context});a.deepEqual(C.load({file,privateDir,runId,now}),context);a.equal(C.load({file,privateDir,runId:'OTHER',now}),null);a.equal(C.load({file,privateDir,runId,now:now+900001}),null);a.equal(C.load({file,privateDir,runId,now:now-1}),null);a.equal(C.load({file:path.join(privateDir,'other.json'),privateDir,runId,now}),null);save({runId,context:{}});a.equal(C.load({file,privateDir,runId,now}),null);fs.writeFileSync(file,'invalid');a.equal(C.load({file,privateDir,runId,now}),null);
});
