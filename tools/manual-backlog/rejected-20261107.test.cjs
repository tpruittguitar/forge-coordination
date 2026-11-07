'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const R=require('./rejected-20261107.cjs'),D=require('./decisions.cjs');
const source=fs.readFileSync(path.join(__dirname,'fixtures/endpoint-fcc611db.txt'),'utf8');
const receipts=Object.keys(R.CASES).map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../../receipts/manual-backlog',id+'.json'))));
test('two negative receipts bind exact original hashes and immutable deployed source',()=>{
 assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0').update(source).digest('hex'),'1673c6b8152d324319c7a2ea32228c60a8823fff');
 assert.deepEqual(receipts.map(r=>r.items.length).sort((a,b)=>a-b),[1,91]);
 for(const r of receipts){assert.deepEqual(R.build({...r.evidence.request,receiptId:r.receiptId},source),r);assert.equal(D.hash(r.evidence.request),r.receiptId);assert.equal(r.scope,undefined);assert.equal(r.evidence.request.scope,undefined);assert.equal(r.status,'COMPLETE');assert.equal(r.canonicalWrites,0);assert.equal(r.queueWrites,0);assert.ok(r.items.every(i=>i.status==='NOT_ACCEPTED'&&i.reason==='VALIDATOR_REJECTED_BEFORE_QUEUE'));}
});
test('historical handler rejects both complete requests before any KV read/write, with no production network',async()=>{
 let gets=0,puts=0,fetches=0;const context={Response,URL,TextEncoder,AbortSignal,crypto:crypto.webcrypto,fetch:async url=>{fetches++;return new Response(JSON.stringify(String(url).includes('action=ping')?{ok:true}:{at:new Date().toISOString(),manualDecisions:{version:1}}),{status:200});}};
 vm.createContext(context);vm.runInContext(source.replace('export async function onRequest','async function onRequest')+'\nthis.handler=onRequest;',context);
 const env={PIPELINE_SNAPSHOT_KV:{get:async()=>{gets++;return null;},put:async()=>{puts++;}}};
 for(const r of receipts){const request=new Request('https://example.invalid/api/backlog-decisions',{method:'POST',headers:{'x-writer-key':'test-only'},body:JSON.stringify({...r.evidence.request,action:'submit'})});const response=await context.handler({request,env});assert.equal(response.status,400);assert.equal((await response.json()).error,'UNIQUE_DISCOVERY_KEYS_REQUIRED');}
 assert.equal(gets,0);assert.equal(puts,0);assert.equal(fetches,4);
});
test('no negative receipt can be constructed for tampering, replacements, scoped upgrades or valid-key requests',()=>{
 const q={...receipts[0].evidence.request,receiptId:receipts[0].receiptId};
 for(const r of [{...q,requestId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'},{...q,scope:'DISCOVERY_CARD_DISMISSAL'},{...q,decision:'DELETE'},{...q,items:[{key:'linkedin:123'}]},{...q,receiptId:'f'.repeat(64)}])assert.throws(()=>R.build(r,source),/EXACT_REJECTED_INCIDENT_REQUEST_REQUIRED/);
 assert.throws(()=>R.build(q,source+' '),/PINNED_DEPLOYED_IMPLEMENTATION_REQUIRED/);
});
test('negative receipts resolve originals without making them pending observer work',async()=>{
 const requests=receipts.map(r=>({...r.evidence.request,receiptId:r.receiptId}));
 const pending=await D.load(path.resolve(__dirname,'../..'),{key:'test-only',fetchImpl:async()=>new Response(JSON.stringify({ok:true,requests,cursor:null}),{headers:{'content-type':'application/json'}})});
 assert.deepEqual(pending,[]);
});
