'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Scope=require('./scope.cjs'),S=require('../programmed-coordinator/store.cjs');
test('explicit intake scope is run-bound, private and fails closed instead of broadening',t=>{
 const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'intake-scope-'));t.after(()=>fs.rmSync(privateDir,{recursive:true,force:true}));
 const runId='FORGE-CODE-TEST',file=Scope.save({privateDir,runId,keys:['one','one','two']}),options={privateDir,runId,file};
 a.deepEqual([...Scope.load(options)],['one','two']);a.equal(Scope.load({file:null}),null);
 for(const change of [{runId:'OTHER'},{file:path.join(privateDir,'other.json')},{privateDir:null}])a.throws(()=>Scope.load({...options,...change}),/SCOPE/);
 Scope.save({privateDir,runId,keys:[]});a.equal(Scope.load(options).size,0);
 S.save(privateDir,'intake-return-scope.json',{runId,keys:['one']});a.throws(()=>Scope.load(options),/SCOPE/);
 fs.unlinkSync(file);a.throws(()=>Scope.load(options),/SCOPE/);
});
