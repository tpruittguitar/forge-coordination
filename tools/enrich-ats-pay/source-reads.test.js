'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),S=require('./source-reads');
const url='https://careers.example.org/job/123';
const http=status=>Object.assign(Error('HTTP '+status),{status});
test('endpoint identity removes fragments/default port but preserves distinct paths and query values',()=>{
 a.equal(S.endpoint('https://CAREERS.example.org:443/job/123#salary'),url);
 a.notEqual(S.endpoint(url+'?language=en'),S.endpoint(url+'?language=fr'));
 a.notEqual(S.endpoint(url),S.endpoint(url+'/'));
 for(const p of ['linkedin','indeed','ziprecruiter']){a.equal(S.provider('https://www.'+p+'.com/jobs/1'),p);a.equal(S.provider('https://'+p+'.com.evil.org/jobs'),null);}
});
test('failed endpoints and concurrent aliases cannot restart a read; distinct fallback can succeed',async()=>{
 const reads=[],s=S.create({read:async u=>{reads.push(u);if(u===url)throw http(404);return 'posting';},wait:async()=>{}});
 await a.rejects(s.read(url),{status:404});await a.rejects(s.read(url+'#details'),{code:'SOURCE_ALREADY_ATTEMPTED'});
 a.equal(await s.read(url+'?alternate=1'),'posting');a.deepEqual(reads,[url,url+'?alternate=1']);
 const first=s.read(url+'/other');await a.rejects(s.read(url+'/other#same'),{code:'SOURCE_ALREADY_ATTEMPTED'});await first;
});
test('one transient retry is explicit and cannot be extended through fallback',async()=>{
 for(const error of [http(408),http(500),http(502),http(503),http(504),Object.assign(Error('socket'),{code:'ECONNRESET'}),new TypeError('fetch failed'),Object.assign(Error('timeout'),{name:'TimeoutError'})]){
  let calls=0;const waits=[],s=S.create({read:async()=>{calls++;throw error;},wait:async ms=>waits.push(ms)});
  await a.rejects(s.read(url,{gapMs:20}),e=>e===error);a.equal(calls,2);a.deepEqual(waits,[20,1000]);
  await a.rejects(s.read(url),{code:'SOURCE_ALREADY_ATTEMPTED'});a.equal(calls,2);
 }
});
test('transient recovery returns the second result; permanent failures and budget expiry never retry',async()=>{
 let calls=0;const s=S.create({read:async()=>{if(++calls===1)throw http(503);return 'recovered';},wait:async()=>{}});
 a.equal(await s.read(url),'recovered');a.equal(calls,2);
 for(const error of [http(400),http(401),http(403),http(404),http(429),new SyntaxError('invalid JSON'),Object.assign(Error('budget'),{code:'RUN_BUDGET'})]){
  let n=0;const r=S.create({read:async()=>{n++;throw error;},wait:async()=>{}});await a.rejects(r.read(url),e=>e===error);a.equal(n,1);
 }
});
test('provider gate, physical request budget and Retry-After apply before a transient retry',async()=>{
 let calls=0,blocked=2;const r=S.create({read:async()=>{calls++;throw http(503);},wait:async()=>{},canRead:()=>blocked<3,onFailure:()=>blocked++});
 await a.rejects(r.read(url),{status:503});a.equal(calls,1);a.equal(blocked,3);
 const error=Object.assign(http(503),{retryAfterMs:60000}),waits=[];
 const budget=S.create({read:async()=>{throw error;},wait:async ms=>waits.push(ms),canRead:(_,reserve)=>reserve<30000});
 await a.rejects(budget.read(url),e=>e===error);a.deepEqual(waits,[0]);
 let n=0;const delayed=S.create({read:async()=>{if(++n===1)throw error;return 'ok';},wait:async ms=>waits.push(ms)});
 a.equal(await delayed.read(url),'ok');a.deepEqual(waits,[0,0,60000]);
});
test('successful malformed source bytes are read only once and later rows get a fresh attempt budget',async()=>{
 let calls=0;const options={read:async()=>{calls++;return 'not JSON';},wait:async()=>{}};
 const first=S.create(options);a.throws(()=>JSON.parse('not JSON'));a.equal(await first.read(url),'not JSON');await a.rejects(first.read(url),{code:'SOURCE_ALREADY_ATTEMPTED'});
 a.equal(await S.create(options).read(url),'not JSON');a.equal(calls,2);
});
test('public origin circuit bounds 403s per run without blocking other origins or retrying permanent errors',()=>{
 const c=S.originCircuit(),u='https://blocked.example/job/1';
 for(let i=0;i<2;i++){c.failure(u,{status:403});a.equal(c.allowed(u),true);}
 c.failure(u,{status:403});a.equal(c.allowed('https://blocked.example/job/2'),false);
 a.equal(c.allowed('https://employer.example/job/2'),true);
 a.deepEqual(c.blocked(),{'https://blocked.example':3});
 a.equal(S.originCircuit().allowed(u),true);c.success(u);a.equal(c.allowed(u),true);
 for(let i=0;i<10;i++)c.failure(u,{status:404});a.equal(c.allowed(u),true);
});
