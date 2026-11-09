'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),Store=require('./employer-cache-store');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-cache-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'employer.json');}
const evidence=()=>({identity:'exact identity',url:'https://example.com/jobs/1',at:'2026-11-08T01:00:00Z',text:'Full posting. '.repeat(100),pay:null,payAmbiguous:true,payStatus:'PAY_UNRESOLVED',sourceIdentity:{company:'Acme',title:'Manager',location:'Dayton, OH'},factsVersion:'original-parser',futureField:{nested:[1,null,'é']}});
const cache=()=>({employers:{Acme:[{seen:'2026-10-01'}]},sourceSearch:{a:{retryAt:'2026-11-09'}},futureRoot:['unchanged'],postingEvidence:{one:evidence(),two:{...evidence(),at:'2026-11-08T02:00:00Z'}}});
test('legacy and empty caches read without migration or mutation',t=>{const file=fixture(t);assert.deepEqual(Store.read(file),{employers:{}});const bytes=JSON.stringify(cache(),null,1);fs.writeFileSync(file,bytes);assert.deepEqual(Store.read(file),cache());assert.equal(fs.readFileSync(file,'utf8'),bytes);});
test('lossless round trip interns identical bodies, retaining every timestamp and unknown field',t=>{
 const file=fixture(t),original=cache(),before=JSON.stringify(original),stats=Store.write(file,original);
 assert.equal(stats.observations,2);assert.equal(stats.bodies,1);assert.deepEqual(Store.read(file),original);assert.equal(JSON.stringify(original),before);
 const got=Store.read(file);got.postingEvidence.one.futureField.nested[0]=99;assert.equal(got.postingEvidence.two.futureField.nested[0],1,'observations must not share mutable body objects');
});
test('changed pay, no-pay, identity, raw text or parser evidence stays distinct',t=>{
 const file=fixture(t),original=cache();for(const [key,change]of Object.entries({pay:{pay:{low:100000,high:200000}},noPay:{payAmbiguous:false,payStatus:'NO_PAY_STATED'},identity:{identity:'another'},text:{text:'different '+evidence().text},parser:{factsVersion:'new'}}))original.postingEvidence[key]={...evidence(),...change};
 assert.equal(Store.write(file,original).bodies,6);assert.deepEqual(Store.read(file),original);
});
test('absence of posting evidence or observation timestamp is preserved',t=>{const file=fixture(t);Store.write(file,{employers:{}});assert.deepEqual(Store.read(file),{employers:{}});const original=cache();delete original.postingEvidence.one.at;Store.write(file,original);assert.deepEqual(Store.read(file),original);});
test('malformed evidence fails rather than silently discarding fields',t=>{const file=fixture(t);for(const postingEvidence of [null,[],1,'invalid',{bad:null}])assert.throws(()=>Store.write(file,{employers:{},postingEvidence}));assert.equal(fs.existsSync(file),false);});
test('multi-part snapshots are bounded and survive Unicode splits and incompressible content',t=>{
 const file=fixture(t),original=cache();original.postingEvidence.large={...evidence(),text:'é'.repeat(Store.PART_BYTES)+crypto.randomBytes(Store.PART_BYTES).toString('base64')};
 const result=Store.write(file,original);assert.ok(result.parts>2);assert.deepEqual(Store.read(file),original);
 for(const name of fs.readdirSync(Store.partsDir(file)))assert.ok(fs.statSync(path.join(Store.partsDir(file),name)).size<=Store.MAX_FILE_BYTES);
});
test('parts are immutable, unchanged writes reuse them, superseded snapshots remain readable',t=>{
 const file=fixture(t),original=cache();Store.write(file,original);const prior=fs.readFileSync(file),names=fs.readdirSync(Store.partsDir(file));Store.write(file,original);assert.deepEqual(fs.readdirSync(Store.partsDir(file)),names);assert.deepEqual(fs.readFileSync(file),prior);
 const changed=cache();changed.postingEvidence.three={...evidence(),at:'2026-11-09'};Store.write(file,changed);for(const name of names)assert.ok(fs.existsSync(path.join(Store.partsDir(file),name)));
 fs.writeFileSync(file,prior);assert.deepEqual(Store.read(file),original);
});
test('missing, corrupt, path traversal and mixed snapshot parts fail closed',t=>{
 for(const fault of ['missing','corrupt','traversal','length','snapshot']){
  const file=fixture(t);Store.write(file,cache());const m=JSON.parse(fs.readFileSync(file)),part=path.join(Store.partsDir(file),m.parts[0].file);
  if(fault==='missing')fs.renameSync(part,part+'.saved');if(fault==='corrupt')fs.appendFileSync(part,'bad');if(fault==='traversal')m.parts[0].file='../outside';if(fault==='length')m.parts[0].bytes++;if(fault==='snapshot')m.sha256='0'.repeat(64);
  fs.writeFileSync(file,JSON.stringify(m));assert.throws(()=>Store.read(file));
 }
});
test('failed part publication leaves the prior root and complete snapshot usable',t=>{
 const file=fixture(t),original=cache();Store.write(file,original);const prior=fs.readFileSync(file),changed=cache();changed.postingEvidence.three={...evidence(),text:'Changed body'};
 const write=fs.writeFileSync;fs.writeFileSync=(target,...args)=>{if(String(target).includes('.json.gz.')){write(target,Buffer.from(args[0]).subarray(0,5));throw Error('simulated disk full');}return write(target,...args);};
 try{assert.throws(()=>Store.write(file,changed),/disk full/);}finally{fs.writeFileSync=write;}
 assert.deepEqual(fs.readFileSync(file),prior);assert.deepEqual(Store.read(file),original);
 Store.write(file,changed);assert.deepEqual(Store.read(file),changed,'an identical retry recovers from a partial temporary write');
});
test('workflow artifacts and publication retries retain the complete employer cache bundle',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/enrich-ats-pay.yml'),'utf8');
 assert.match(workflow,/state\/enrich-ats-pay-employer\.parts\/\*\*/);assert.match(workflow,/cp -a state\/enrich-ats-pay-employer\.parts \/tmp\/out\//);
 assert.match(workflow,/git add state\/enrich-ats-pay-employer\.parts/);assert.match(workflow,/cp -a \/tmp\/out\/\. state\//);
});
