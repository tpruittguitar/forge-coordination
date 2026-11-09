'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('./store.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-store-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file='state/PROGRAMMED_COORDINATOR_REPORT.json';S.save(root,file,{old:true});return{root,file,dest:path.join(root,file)};}
function pending(f){return fs.readdirSync(path.dirname(f.dest)).filter(n=>n.startsWith(path.basename(f.dest)+'.tmp-'));}
function error(code){return Object.assign(new Error('simulated '+code),{code});}
for(const code of ['EPERM','EACCES','EBUSY'])test('atomic report replacement retries transient '+code+' without rewriting staged bytes',t=>{
 const f=fixture(t),rename=fs.renameSync,waits=[],staging=new Set();let attempts=0;
 t.mock.method(Atomics,'wait',(_a,_i,_v,ms)=>{waits.push(ms);return 'timed-out';});
 t.mock.method(fs,'renameSync',(tmp,dest)=>{
  staging.add(tmp);a.equal(dest,f.dest);a.deepEqual(JSON.parse(fs.readFileSync(tmp)),{updated:true});
  a.deepEqual(JSON.parse(fs.readFileSync(dest)),{old:true});if(++attempts<4)throw error(code);return rename(tmp,dest);
 });
 S.save(f.root,f.file,{updated:true});a.equal(attempts,4);a.equal(staging.size,1);a.deepEqual(waits,[25,50,100]);a.deepEqual(S.read(f.root,f.file),{updated:true});a.deepEqual(pending(f),[]);
});
test('retry exhaustion leaves original and complete staging evidence; another save cannot clobber it',t=>{
 const f=fixture(t),waits=[];t.mock.method(Atomics,'wait',(_a,_i,_v,ms)=>{waits.push(ms);return 'timed-out';});
 let attempts=0;t.mock.method(fs,'renameSync',()=>{attempts++;throw error('EPERM');});
 let failed;a.throws(()=>S.save(f.root,f.file,{first:true}),e=>{failed=e.pendingPath;return e.code==='EPERM';});
 a.equal(attempts,8);a.equal(waits.reduce((n,x)=>n+x,0),1575);a.deepEqual(S.read(f.root,f.file),{old:true});a.deepEqual(JSON.parse(fs.readFileSync(failed)),{first:true});
 t.mock.restoreAll();S.save(f.root,f.file,{second:true});a.deepEqual(S.read(f.root,f.file),{second:true});a.deepEqual(JSON.parse(fs.readFileSync(failed)),{first:true});a.equal(pending(f).length,1);
});
for(const code of ['ENOENT','ENOSPC','EXDEV'])test('non-sharing error '+code+' fails immediately and retains both files',t=>{
 const f=fixture(t);let attempts=0;t.mock.method(fs,'renameSync',()=>{attempts++;throw error(code);});t.mock.method(Atomics,'wait',()=>a.fail('must not retry'));
 a.throws(()=>S.save(f.root,f.file,{new:true}),e=>e.code===code&&JSON.parse(fs.readFileSync(e.pendingPath)).new);
 a.equal(attempts,1);a.deepEqual(S.read(f.root,f.file),{old:true});a.equal(pending(f).length,1);
});
test('flush failure never attempts to replace the existing destination',t=>{
 const f=fixture(t);t.mock.method(fs,'fsyncSync',()=>{throw error('ENOSPC');});t.mock.method(fs,'renameSync',()=>a.fail('unflushed bytes must not replace destination'));
 a.throws(()=>S.save(f.root,f.file,{new:true}),{code:'ENOSPC'});a.deepEqual(S.read(f.root,f.file),{old:true});a.equal(pending(f).length,1);
});
test('legacy fixed staging evidence is neither overwritten nor auto-replayed',t=>{
 const f=fixture(t),legacy=f.dest+'.tmp';fs.writeFileSync(legacy,'retained old failed save');S.save(f.root,f.file,{new:true});a.equal(fs.readFileSync(legacy,'utf8'),'retained old failed save');a.deepEqual(S.read(f.root,f.file),{new:true});
});

test('Windows replacement survives an actual temporary deny-delete reader', {skip:process.platform!=='win32'}, async t=>{
 const f=fixture(t),cp=require('node:child_process'),release=path.join(f.root,'release-reader');
 // Read/write sharing without FileShare.Delete reproduces the Windows rename
 // failure while the report itself remains readable and is not read-only.
 const child=cp.spawn('pwsh.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop'; $f=[IO.File]::Open($env:FORGE_TEST_LOCK_PATH,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite); try { [Console]::WriteLine('READY'); $timer=[Diagnostics.Stopwatch]::StartNew(); while (-not [IO.File]::Exists($env:FORGE_TEST_RELEASE_PATH)) { if ($timer.ElapsedMilliseconds -gt 10000) { throw 'Release signal timeout' }; Start-Sleep -Milliseconds 10 } } finally { $f.Dispose() }"],{env:{...process.env,FORGE_TEST_LOCK_PATH:f.dest,FORGE_TEST_RELEASE_PATH:release},stdio:['ignore','pipe','pipe']});
 t.after(()=>{if(child.exitCode===null)child.kill();});
 const exited=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('lock helper exit '+code)));});
 // Mark rejection handled while the synchronous save is busy retrying.
 exited.catch(()=>{});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('lock helper not ready')),10000);let out='';child.stdout.on('data',chunk=>{out+=chunk;if(out.includes('READY')){clearTimeout(timer);resolve();}});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);if(!out.includes('READY'))reject(new Error('lock helper exited before readiness'));});});
 const rename=fs.renameSync;let retries=0;t.mock.method(fs,'renameSync',(...args)=>{try{return rename(...args);}catch(e){if(++retries===1)fs.writeFileSync(release,'release');throw e;}});
 S.save(f.root,f.file,{afterReader:true});await exited;a.ok(retries>0,'test exercised a real rename failure');a.deepEqual(S.read(f.root,f.file),{afterReader:true});a.deepEqual(pending(f),[]);
});
