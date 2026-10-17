const test=require('node:test'),assert=require('node:assert');const {writeStateCore_}=require('./writeState.js');
const N='STATE';
function fakes(initial,opts={}){const files=Object.assign({},initial),log=[];let held=false,released=0;
 return {files,log,lock:{wait(){if(opts.lockTimeout)throw new Error('Lock timeout');held=true},release(){held=false;released++}},
  store:{read(n){return n in files?files[n]:null},write(n,t){if(opts.failWrite===n)throw new Error('Drive write failed');log.push(n);files[n]=opts.corruptOnWrite===n?'garbled':t}},
  get released(){return released}}}
const good=JSON.stringify({seen:{'JOB-A':1},rulings:{'JOB-A':{decision:'HOLD'}},incidents:{v:1,incidents:{}}});
test('lock timeout: throws, nothing written',()=>{const f=fakes({[N]:good},{lockTimeout:true});
 assert.throws(()=>writeStateCore_(f.store,f.lock,N,{seen:{'JOB-B':2}}));assert.equal(f.files[N],good);assert.deepEqual(f.log,[]);});
test('corrupt stored file: refuses, nothing written, lock released',()=>{const f=fakes({[N]:'{not json'});
 const r=writeStateCore_(f.store,f.lock,N,{seen:{'JOB-B':2}});assert.deepEqual(r,{ok:false,error:'STATE_UNREADABLE'});
 assert.equal(f.files[N],'{not json');assert.deepEqual(f.log,[]);assert.equal(f.released,1);});
test('stored JSON that is not an object (array/null): refuses',()=>{for(const bad of ['[]','null','5']){const f=fakes({[N]:bad});
 assert.equal(writeStateCore_(f.store,f.lock,N,{}).ok,false);assert.equal(f.files[N],bad);}});
test('missing file: treated as empty and created',()=>{const f=fakes({});const r=writeStateCore_(f.store,f.lock,N,{seen:{'JOB-B':2}});
 assert.equal(r.ok,true);assert.equal(JSON.parse(f.files[N]).seen['JOB-B'],2);});
test('happy path: .prev holds prior content, merge applied, rulings untouched',()=>{const f=fakes({[N]:good});
 const r=writeStateCore_(f.store,f.lock,N,{seen:{'JOB-B':2},rulings:{}});assert.equal(r.ok,true);assert.equal(f.files[N+'.prev'],good);
 const s=JSON.parse(f.files[N]);assert.equal(s.rulings['JOB-A'].decision,'HOLD');assert.deepEqual(Object.keys(s.seen).sort(),['JOB-A','JOB-B']);
 assert.deepEqual(f.log,[N+'.prev',N]);});
test('failed main write: error surfaces, .prev still holds the recoverable prior content, lock released',()=>{const f=fakes({[N]:good},{failWrite:N});
 assert.throws(()=>writeStateCore_(f.store,f.lock,N,{seen:{'JOB-B':2}}));assert.equal(f.files[N+'.prev'],good);assert.equal(f.released,1);});
test('readback mismatch: reports failure, .prev recoverable',()=>{const f=fakes({[N]:good},{corruptOnWrite:N});
 const r=writeStateCore_(f.store,f.lock,N,{});assert.deepEqual(r,{ok:false,error:'STATE_READBACK_MISMATCH'});assert.equal(f.files[N+'.prev'],good);});
