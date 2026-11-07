'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadCanonical}=require('./run'),Reader=require('../source-intake/writer-reader'),T=require('./lib');
const now=Date.parse('2026-11-07T12:00:00Z');
const line='1 | V2I-ONE | Acme | Plant Manager | NEW | ACTIVE | - | REQ-ONE | Austin, TX | SOURCE_URL=https://jobs.example.com/1; SOURCE_CUSTOM_EVIDENCE=must survive';
const text='V2_CURRENT_POPULATION_MASTER\n'+line+'\nEND V2_CURRENT_POPULATION_MASTER';
const W={parseRows(raw){return raw.split('\n').filter(l=>/^\d+ \| /.test(l)).map(l=>{const c=l.split(' | ');return{PRIMARY_ID:c[1],COMPANY:c[2],TITLE:c[3],BUCKET:c[4],DISPOSITION:c[5],REQ:c[7],LOCATION:c[8],p:Object.fromEntries(c[9].split('; ').map(v=>{const at=v.indexOf('=');return[v.slice(0,at),v.slice(at+1)];}))};});}};
function fixture(overrides={}){const calls=[],data={ping:{ok:true,build:'test'},writer_status:{ok:true,freeze:null,level:'OK',errors:[]},master:{ok:true,text,count:1,bytes:text.length,fetchedAt:new Date(now).toISOString()},archive:{ok:true,text:'',mode:'NOT_MIGRATED'},...overrides};return{calls,options:{key:'fixture-only',clock:()=>now,masterFile:null,archiveFile:null,W,transport:async(url,options)=>{const action=new URL(url).searchParams.get('action');calls.push(action);a.equal(options.method,'GET');a.equal(options.headers['Cache-Control'],'no-store');a.ok(data[action],action);return{ok:true,json:async()=>data[action]};}}};}
test('one authenticated master and one archive read serve any number of local discovery matches',async()=>{
 for(const count of [1,2000]){const f=fixture(),loaded=await loadCanonical(f.options);a.equal(loaded.rows[0].p.SOURCE_CUSTOM_EVIDENCE,'must survive');a.equal(loaded.master.authenticated,true);
  for(let n=0;n<count;n++)a.equal(T.novelty(loaded.idx,'Acme','Plant Manager','https://jobs.example.com/1','Austin, TX'),'EXISTING');
  a.deepEqual(f.calls,['ping','writer_status','master','archive']);
 }
});
test('raw master text is opt-in and default snapshot shape remains unchanged',async()=>{
 const f=fixture(),normal=await Reader.fetchAuthenticatedMaster(f.options),full=await Reader.fetchAuthenticatedMaster({...f.options,includeText:true});a.equal(Object.hasOwn(normal,'text'),false);a.equal(full.text,text);a.deepEqual({...full,text:undefined},{...normal,text:undefined});
});
test('stale, incomplete or untrusted canonical master cannot fall back to KV',async()=>{
 for(const master of [{ok:true,text,count:1,fetchedAt:'2020-01-01T00:00:00Z'},{ok:true,text:line,count:1,fetchedAt:new Date(now).toISOString()},{ok:true,text,count:2,fetchedAt:new Date(now).toISOString()}]){const f=fixture({master});await a.rejects(()=>loadCanonical(f.options),/BLOCKED/);a.deepEqual(f.calls,['ping','writer_status','master']);}
 const f=fixture({writer_status:{ok:true,freeze:'FROZEN',level:'OK',errors:[]}});await a.rejects(()=>loadCanonical(f.options),/status not healthy/);
});
test('archive failure stays explicitly unavailable and fixture mode never accesses Writer',async t=>{
 const f=fixture({archive:{ok:true,degraded:true,text:''}}),result=await loadCanonical(f.options);a.equal(result.archive.read,false);a.match(result.archive.error,/degraded/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'canonical-fixture-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const masterFile=path.join(dir,'master.txt'),archiveFile=path.join(dir,'archive.txt');fs.writeFileSync(masterFile,line);fs.writeFileSync(archiveFile,'V2_TERMINAL_ARCHIVE\n');const local=await loadCanonical({W,masterFile,archiveFile,transport:async()=>{throw Error('unexpected network');}});a.equal(local.rows.length,1);a.equal(local.master.source,'LOCAL_FIXTURE');a.equal(local.master.authenticated,false);
});
