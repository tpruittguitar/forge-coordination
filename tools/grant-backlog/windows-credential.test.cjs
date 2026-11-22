'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startup,TARGET}=require('./windows-credential.cjs'),{save}=require('./checkpoint.cjs');
const SID='S-1-5-21-123-456-789-1001',KEY='sk-proj-SYNTHETIC_NOT_A_REAL_CREDENTIAL_12345';
test('Default project and exact Responses-only binding remain mandatory live gates',()=>{
 const {liveBlockers}=require('./worker.cjs');
 const project={name:'Default',responsesOnlyVerified:true,restrictedCredentialVerified:true,secureRuntimeBinding:TARGET,projectId:'proj_SYNTHETIC',grantOnly:true,noPaidFallback:true};
 a.ok(!liveBlockers({project}).includes('PROJECT_GRANT_ONLY_PROOF_REQUIRED'));
 for(const change of [p=>p.name='Other',p=>p.responsesOnlyVerified=false,p=>p.secureRuntimeBinding='Other',p=>p.noPaidFallback=false]){
  const p={...project};change(p);a.ok(liveBlockers({project:p}).includes('PROJECT_GRANT_ONLY_PROOF_REQUIRED'));
 }
 a.ok(liveBlockers({project}).includes('LIVE_RELEASE_DISABLED'));
});
function mock(){
 const record={target:TARGET,type:1,flags:0,persist:2,userName:'Default',attributeCount:0,blob:Buffer.from(KEY,'utf16le')};
 const context={host:'TIMMAY',sid:SID,impersonating:false};let reads=0;
 return {record,context,get reads(){return reads;},injection:{platform:'win32',native:{context:()=>context,read:()=>{reads++;return record;}}}};
}
test('startup reads exactly one credential and only returns scoped in-memory use',async()=>{
 const m=mock(),c=startup({expectedSid:SID},m.injection);a.equal(m.reads,1);a.ok(m.record.blob.every(x=>x===0));
 a.equal(JSON.stringify(c),'{}');a.deepEqual(Object.keys(c),['secureRuntime','close']);
 await c.secureRuntime(async key=>{a.equal(key,KEY);return new Response('ok');});
 await c.secureRuntime(async()=>new Response('ok'));a.equal(m.reads,1);
 c.close();await a.rejects(c.secureRuntime(async()=>new Response()),/CREDENTIAL_CLOSED/);
});
test('absent credential stops with no enumeration or fallback',()=>{
 const m=mock();m.injection.native.read=()=>{const e=Error(KEY);e.code='CREDENTIAL_ABSENT';throw e;};
 a.throws(()=>startup({expectedSid:SID},m.injection),/^Error: CREDENTIAL_ABSENT$/);
});
test('wrong platform, host, account or impersonation never reads a credential',()=>{
 for(const change of [m=>m.injection.platform='linux',m=>m.context.host='OTHER',m=>m.context.sid=SID+'0',m=>m.context.impersonating=true]){
  const m=mock();change(m);a.throws(()=>startup({expectedSid:SID},m.injection));a.equal(m.reads,0);
 }
 const m=mock();a.throws(()=>startup({expectedSid:''},m.injection),/EXPECTED_ACCOUNT/);a.equal(m.reads,0);
});
test('metadata trust failures erase the blob',()=>{
 for(const change of [r=>r.target='Other',r=>r.type=2,r=>r.userName='Other',r=>r.flags=4,r=>r.persist=1,r=>r.attributeCount=1]){
  const m=mock();change(m.record);a.throws(()=>startup({expectedSid:SID},m.injection),/CREDENTIAL_UNTRUSTED/);a.ok(m.record.blob.every(x=>x===0));
 }
});
test('rejects UTF8, BOM, NUL, newline, odd length, invalid prefix and oversized blob',()=>{
 for(const blob of [Buffer.from(KEY),Buffer.from('\ufeff'+KEY,'utf16le'),Buffer.from(KEY+'\0','utf16le'),Buffer.from(KEY+'\n','utf16le'),Buffer.alloc(49,65),Buffer.from('invalid-'+KEY,'utf16le'),Buffer.alloc(1026,65)]){
  const m=mock();m.record.blob=blob;a.throws(()=>startup({expectedSid:SID},m.injection),/CREDENTIAL_/);a.ok(blob.every(x=>x===0));
 }
});
test('changed account stops use and callback cannot return credential text',async()=>{
 const m=mock(),c=startup({expectedSid:SID},m.injection);await a.rejects(c.secureRuntime(async key=>key),/^Error: CREDENTIAL_USE_FAILED$/);
 m.context.sid='wrong';let called=false;await a.rejects(c.secureRuntime(async()=>{called=true;return new Response();}),/CREDENTIAL_USE_FAILED/);a.equal(called,false);c.close();
});
test('errors and startup never log secrets, including hostile native/callback errors',async t=>{
 const logs=[];for(const name of ['log','error','warn','info','debug'])t.mock.method(console,name,(...args)=>logs.push(args));
 const m=mock(),c=startup({expectedSid:SID},m.injection);await a.rejects(c.secureRuntime(async key=>{throw Error(key);}),/^Error: CREDENTIAL_USE_FAILED$/);c.close();
 const bad=mock();bad.injection.native.read=()=>{throw Error(KEY);};a.throws(()=>startup({expectedSid:SID},bad.injection),/^Error: CREDENTIAL_READ_FAILED$/);a.deepEqual(logs,[]);
});
test('Windows checkpoint uses flushed staging file and native replacement only',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-win-save-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let calls=0;
 const file=path.join(dir,'checkpoint.json');
 const native={read:()=>a.fail('secret access in dry run'),replaceCheckpoint:(from,to)=>{calls++;a.deepEqual(JSON.parse(fs.readFileSync(from)),{n:1});a.equal(to,file);fs.renameSync(from,to);}};
 save(file,{n:1},{platform:'win32',native});a.equal(calls,1);
 native.replaceCheckpoint=()=>{throw Error('native fail');};a.throws(()=>save(file,{n:2},{platform:'win32',native}),/^Error: CHECKPOINT_DURABILITY_FAILURE$/);
 a.deepEqual(JSON.parse(fs.readFileSync(file)),{n:1});a.ok(fs.readdirSync(dir).some(x=>x.includes('.tmp-')));
});
test('native source binds documented single-target API and frees native buffers',()=>{
 const code=fs.readFileSync(path.join(__dirname,'native/wincred.cc'),'utf8');
 a.ok(code.includes('CredReadW(Target,CRED_TYPE_GENERIC,0,&c.p)'));a.ok(code.includes('CredFree(p)'));a.ok(code.includes('SecureZeroMemory'));
 a.ok(!/CredEnumerate|CredWrite|printf|std::cout|GetEnvironmentVariable|CreateProcess/.test(code));
});
