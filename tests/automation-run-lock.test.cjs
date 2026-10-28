'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const cli=path.resolve(__dirname,'../tools/automation-run-lock.cjs');
test('independent runs exclude each other and only the owner may release',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-schedule-')),file=path.join(dir,'lock');
 const run=(a,t)=>spawnSync(process.execPath,[cli,a,file,t],{encoding:'utf8'});
 try{
  assert.equal(run('acquire','RUN-ONE-123').status,0);
  assert.equal(run('acquire','RUN-TWO-123').status,2);
  assert.equal(run('release','RUN-TWO-123').status,1);
  assert.ok(fs.existsSync(file));
  // Old metadata must not permit a second run to steal a lock.
  fs.writeFileSync(file,JSON.stringify({token:'RUN-ONE-123',at:'2000-01-01T00:00:00Z'}));
  assert.equal(run('acquire','RUN-TWO-123').status,2);
  assert.equal(run('check','RUN-ONE-123').status,0);
  assert.equal(run('release','RUN-ONE-123').status,0);
  assert.equal(run('acquire','RUN-TWO-123').status,0);
  assert.equal(run('release','RUN-TWO-123').status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
