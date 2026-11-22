'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../writer-post-recheck.cjs'),Ser=require('./pilot-serialization.cjs'),PostLock=require('../writer-post-lock.cjs');
const REPO=path.resolve(__dirname,'../..'),ATS='tools/enrich-ats-pay/run.js';
const memStore=()=>{let file=null,n=0;return {peek:()=>file,
 async read(){return file?{sha:file.sha,data:JSON.parse(JSON.stringify(file.data))}:null},
 async create(d){if(file)return false;file={sha:'s'+(++n),data:d};return true},
 async replace(sha,d){if(!file||file.sha!==sha)return false;file={sha:'s'+(++n),data:d};return true},
 async remove(sha){if(!file||file.sha!==sha)return false;file=null;return true}}};
const clock=(t=Date.UTC(2026,10,22))=>({now:()=>t,advance:ms=>{t+=ms},sleep:async ms=>{t+=ms}});
const pilot=(id,extra={})=>({taskKey:R.PILOT_TASK,primaryId:id,status:'ASSIGNED',pilotGrantId:'G1',...extra});
const currentAts=fs.readFileSync(path.join(REPO,ATS),'utf8');
const cap=({store=memStore(),shas=[],files={}}={})=>({store,async activeAtsShas(){return typeof shas==='function'?shas():shas},async readFile(file,sha){return files[sha]??currentAts}});

test('the committed ATS runner carries the pilot recheck',()=>{a.equal(Ser.carries(currentAts),true);a.equal(Ser.carries('// old runner'),false);});

test('pilot fence ids: active claims and aliases fence, settled and excluded grants do not',()=>{
 const ids=R.pilotFenceIds({items:[pilot('V2A-one',{aliases:['V2A-old']}),pilot('V2A-done',{status:'RELEASED'}),pilot('V2A-other',{pilotGrantId:'G2'}),{taskKey:'FORGE_CLAUDE_SHARED_HELPER',primaryId:'V2A-claude',status:'ASSIGNED'}]},{excludePilotGrant:'G2'});
 a.deepEqual([...ids].sort(),['V2A-old','V2A-one']);
});

test('a malformed pilot fence throws but ids read before it stay fenced',()=>{
 const into=new Set();
 a.throws(()=>R.pilotFenceIds({items:[pilot('V2A-first'),pilot('bad id')]},{into}),/INVALID_PILOT_FENCE_ID/);
 a.equal(into.has('V2A-first'),true);
});

test('fresh recheck reads main: missing file is no reservations, a read failure propagates',async()=>{
 a.equal((await R.createRecheck({readFile:async()=>null}).fresh()).size,0);
 const fresh=await R.createRecheck({readFile:async f=>{a.equal(f,R.FILE);return JSON.stringify({items:[pilot('V2A-one')]})}}).fresh();
 a.deepEqual([...fresh],['V2A-one']);
 await a.rejects(R.createRecheck({readFile:async()=>{throw Error('WRITER_RECHECK_READ_FAILED: HTTP 502')}}).fresh(),/HTTP 502/);
});

test('github reader asks for the raw file on main and fails closed on other statuses',async()=>{
 const seen=[];const read=R.githubReader({token:'t',repo:'o/r',fetcher:async(url,o)=>{seen.push([url,o.headers.Accept]);return url.includes('missing')?{status:404}:url.includes('boom')?{status:500}:{status:200,text:async()=>'{}'}}});
 a.equal(await read(),'{}');a.match(seen[0][0],/\/repos\/o\/r\/contents\/control\/SHARED_HELPER_WORK\.json\?ref=main$/);a.equal(seen[0][1],'application/vnd.github.raw+json');
 a.equal(await read('missing.json'),null);await a.rejects(read('boom.json'),/WRITER_RECHECK_READ_FAILED/);
 a.throws(()=>R.githubReader({repo:'o/r'}),/WRITER_RECHECK_GITHUB_REQUIRED/);
});

test('no capability, an old checkout or a forged session is never serialization proof',async()=>{
 await a.rejects(Ser.establish({root:REPO,capability:null,hold:true}),/CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN/);
 const old=fs.mkdtempSync(path.join(os.tmpdir(),'pilot-ser-'));fs.mkdirSync(path.join(old,'tools/enrich-ats-pay'),{recursive:true});fs.writeFileSync(path.join(old,ATS),'// runner without recheck');
 await a.rejects(Ser.establish({root:old,capability:cap(),hold:true}),/CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN/);
 a.throws(()=>Ser.check(),/CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN/);
 a.throws(()=>Ser.check({protocol:Ser.PROTOCOL,held:true}),/CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN/);
});

test('an ATS run still on a commit without the recheck blocks the pilot, before or after the lock',async()=>{
 const sha='a'.repeat(40);
 await a.rejects(Ser.establish({root:REPO,capability:cap({shas:[sha],files:{[sha]:'// old runner'}}),hold:false}),/ATS_RUN_WITHOUT_PILOT_RECHECK_ACTIVE/);
 // A run that appears between the listing and the acquire is caught under the lock, and the lock is released.
 let calls=0;const store=memStore();
 await a.rejects(Ser.establish({root:REPO,capability:cap({store,shas:()=>++calls===1?[]:[sha],files:{[sha]:'// old runner'}}),hold:true,owner:'p',lockOptions:clock()}),/ATS_RUN_WITHOUT_PILOT_RECHECK_ACTIVE/);
 a.equal(store.peek(),null);
});

test('reserve holds the shared lock, proves it at publication and releases it',async()=>{
 const store=memStore(),s=await Ser.establish({root:REPO,capability:cap({store}),hold:true,owner:'direct-pilot-G1',lockOptions:clock()});
 Ser.check(s,{lock:true});a.equal(store.peek().data.owner,'direct-pilot-G1');
 await Ser.confirmHeld(s);await Ser.end(s);a.equal(store.peek(),null);
 const run=await Ser.establish({root:REPO,capability:cap(),hold:false});Ser.check(run);a.throws(()=>Ser.check(run,{lock:true}),/UNPROVEN/);
});

test('a busy lock refuses reserve; a lock taken over as stale is caught before publication',async()=>{
 const store=memStore(),c=clock();await PostLock.createLock({store,owner:'enrich-ats-pay',...c}).acquire();
 await a.rejects(Ser.establish({root:REPO,capability:cap({store}),hold:true,owner:'p',lockOptions:{...c,waitMs:10000,pollMs:5000}}),/WRITER_POST_LOCK_BUSY/);
 const s2=memStore(),c2=clock(),s=await Ser.establish({root:REPO,capability:cap({store:s2}),hold:true,owner:'p',lockOptions:{...c2,staleMs:60000}});
 c2.advance(61000);a.equal((await PostLock.createLock({store:s2,owner:'enrich-ats-pay',staleMs:60000,...c2}).acquire()).ok,true);
 await a.rejects(Ser.confirmHeld(s),/WRITER_POST_LOCK_LOST/);
});

test('interleaving: an ATS POST after the pilot releases sees the reservation and drops the row',async()=>{
 const store=memStore(),c=clock();let main=JSON.stringify({items:[]});
 const recheck=R.createRecheck({readFile:async()=>main});
 const s=await Ser.establish({root:REPO,capability:cap({store}),hold:true,owner:'direct-pilot-G1',lockOptions:c});
 // ATS run started earlier and planned this row; its POST must wait for the lock.
 const ats=PostLock.createLock({store,owner:'enrich-ats-pay',waitMs:60000,pollMs:5000,now:c.now,sleep:async ms=>{c.advance(ms);if(main.includes('V2A-one')&&store.peek()?.data.owner==='direct-pilot-G1')await Ser.end(s);}});
 main=JSON.stringify({items:[pilot('V2A-one')]});await Ser.confirmHeld(s);
 const hold=await ats.acquire();a.equal(hold.ok,true);
 const fence=await recheck.fresh(),batch=['V2A-one','V2A-two'].filter(id=>!fence.has(id));
 a.deepEqual(batch,['V2A-two']);await hold.release();
});
