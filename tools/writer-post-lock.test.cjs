'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLock,fromEnv}=require('./writer-post-lock.cjs');
const memStore=()=>{let file=null,n=0;return {peek:()=>file,
 async read(){return file?{sha:file.sha,data:JSON.parse(JSON.stringify(file.data))}:null},
 async create(d){if(file)return false;file={sha:'s'+(++n),data:d};return true},
 async replace(sha,d){if(!file||file.sha!==sha)return false;file={sha:'s'+(++n),data:d};return true},
 async remove(sha){if(!file||file.sha!==sha)return false;file=null;return true}}};
const clock=(t=Date.UTC(2026,10,17))=>({now:()=>t,advance:ms=>{t+=ms},sleep:async ms=>{t+=ms}});
test('a second poster cannot take a fresh lock and gets LOCK_BUSY after its wait',async()=>{
 const store=memStore(),c=clock();
 const a=createLock({store,owner:'intake',...c}),b=createLock({store,owner:'enrich',waitMs:20000,pollMs:5000,...c});
 const held=await a.acquire();assert.equal(held.ok,true);
 const denied=await b.acquire();assert.equal(denied.ok,false);assert.equal(denied.reason,'LOCK_BUSY');
 assert.equal(store.peek().data.owner,'intake');
});
test('a waiting poster gets the lock once the owner releases',async()=>{
 const store=memStore(),c=clock(),a=createLock({store,owner:'intake',...c});
 const held=await a.acquire();let polls=0;
 const b=createLock({store,owner:'enrich',waitMs:60000,pollMs:5000,now:c.now,sleep:async ms=>{c.advance(ms);if(++polls===2)await held.release()}});
 const got=await b.acquire();assert.equal(got.ok,true);assert.ok(polls>=2);
});
test('only the owner releases; a stale lock is taken over and the old owner cannot release the new lock',async()=>{
 const store=memStore(),c=clock(),a=createLock({store,owner:'intake',staleMs:60000,...c}),b=createLock({store,owner:'enrich',staleMs:60000,...c});
 const first=await a.acquire();c.advance(61000);
 const second=await b.acquire();assert.equal(second.ok,true);assert.equal(second.tookStale.owner,'intake');
 assert.equal(await first.release(),false);assert.equal(store.peek().data.owner,'enrich');
 assert.equal(await second.release(),true);assert.equal(store.peek(),null);
});
test('a store error fails closed with no lock claimed',async()=>{
 const bad={read:async()=>{throw Error('HTTP 500')}};
 const got=await createLock({store:bad,owner:'x'}).acquire();assert.equal(got.ok,false);assert.equal(got.reason,'LOCK_STORE_ERROR');
});
test('without a token and repository, or when switched off, no lock is used',()=>{
 assert.equal(fromEnv({}),null);assert.equal(fromEnv({GITHUB_TOKEN:'t'}),null);
 assert.equal(fromEnv({GITHUB_TOKEN:'t',GITHUB_REPOSITORY:'o/r',FORGE_WRITER_POST_LOCK:'off'}),null);
 assert.ok(fromEnv({GITHUB_TOKEN:'t',GITHUB_REPOSITORY:'o/r'}));
});
