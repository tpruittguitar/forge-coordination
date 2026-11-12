'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const Store=require('./employer-cache-store'),Index=require('./verify-cache-index.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-index-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=(...args)=>cp.execFileSync('git',args,{cwd:dir,stdio:['pipe','pipe','pipe']});
 git('init','-q');git('config','core.autocrlf','true');git('config','core.safecrlf','false');
 fs.mkdirSync(path.join(dir,'state'));fs.writeFileSync(path.join(dir,'.gitattributes'),'state/** text eol=lf\n');
 const text='Full public posting evidence. '.repeat(30);
 const cache={employers:{},postingEvidence:{one:{url:'https://example.org/posting',at:'2026-11-09T01:00:00Z',text,identityVerified:true}}};
 const file=path.join(dir,'state/enrich-ats-pay-employer.json');Store.write(file,cache);
 const manifest=JSON.parse(fs.readFileSync(file)),old=path.join(Store.partsDir(file),manifest.parts[0].file),compressed=fs.readFileSync(old);
 // A valid gzip comment guarantees a CRLF byte pair across zlib versions.
 compressed[3]|=16;const exact=Buffer.concat([compressed.subarray(0,10),Buffer.from('fixture\r\n\0'),compressed.subarray(10)]);
 const name=crypto.createHash('sha256').update(exact).digest('hex')+'.json.gz',part=path.join(Store.partsDir(file),name);
 fs.writeFileSync(part,exact);fs.unlinkSync(old);manifest.parts[0].file=name;fs.writeFileSync(file,JSON.stringify(manifest));
 assert.deepEqual(Store.read(file),cache);
 return {dir,git,cache,file,manifest,part,exact,stage:()=>git('add','.gitattributes','state')};
}
test('broad text rule corrupts compressed staged bytes even with valid working files',t=>{
 const f=fixture(t);f.stage();assert.deepEqual(Store.read(f.file),f.cache);
 assert.throws(()=>Index.verify(f.dir),/checksum mismatch/);
});
test('binary override preserves exact staged bytes under autocrlf and permits full readback',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.dir,'.gitattributes'),fs.readFileSync(path.join(__dirname,'../../.gitattributes')));f.stage();
 assert.deepEqual(Index.verify(f.dir),{parts:1,observations:1});
 assert.deepEqual(f.git('show',':state/enrich-ats-pay-employer.parts/'+f.manifest.parts[0].file),f.exact);
 const checkout=path.join(f.dir,'roundtrip');fs.mkdirSync(checkout);f.git('checkout-index','--all','--prefix='+checkout+path.sep);
 assert.deepEqual(Store.read(path.join(checkout,'state/enrich-ats-pay-employer.json')),f.cache);
});
test('un-staged disk repair cannot hide corrupt Git index; renormalized repair succeeds',t=>{
 // Avoid Git's racy-stat fallback: make the original part older than the index.
 // A plain add can otherwise appear to repair bytes only because Git rereads it.
 const f=fixture(t),old=new Date(Date.now()-10000);fs.utimesSync(f.part,old,old);f.stage();fs.writeFileSync(path.join(f.dir,'.gitattributes'),'state/** text eol=lf\nstate/enrich-ats-pay-employer.parts/*.json.gz binary\n');
 assert.throws(()=>Index.verify(f.dir),/checksum mismatch/);f.stage();
 assert.throws(()=>Index.verify(f.dir),/checksum mismatch/);
 f.git('add','--renormalize','state');
 assert.deepEqual(Index.verify(f.dir),{parts:1,observations:1});
 assert.deepEqual(f.git('show',':state/enrich-ats-pay-employer.parts/'+f.manifest.parts[0].file),f.exact);
});
test('missing staged parts and traversal references fail before publication',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.dir,'.gitattributes'),'state/enrich-ats-pay-employer.parts/*.json.gz binary\n');f.stage();
 f.git('rm','--cached','state/enrich-ats-pay-employer.parts/'+f.manifest.parts[0].file);assert.throws(()=>Index.verify(f.dir),/Missing, unmerged or non-file/);
 f.manifest.parts[0].file='../outside.json.gz';fs.writeFileSync(f.file,JSON.stringify(f.manifest));f.git('add','state/enrich-ats-pay-employer.json');assert.throws(()=>Index.verify(f.dir),/Invalid staged employer cache part reference/);
});
test('every pay publication retry verifies staged cache after staging and before commit',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/enrich-ats-pay.yml'),'utf8');
 assert.match(workflow,/for i in 1 2 3 4 5 6; do[\s\S]*git add state\/enrich-ats-pay[\s\S]*node tools\/enrich-ats-pay\/verify-cache-index\.cjs[\s\S]*git commit/);
 assert.match(workflow,/run: bash tools\/enrich-ats-pay\/test-isolated\.sh/);
});
