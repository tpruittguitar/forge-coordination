'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {hash}=require('./input-fingerprint');
const old=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('input fingerprint preserves previous JSON byte order and digest',()=>{
 for(const value of [{anchors:[],context:null,benchmarks:{},payProfile:null,employerEvidence:{},bls:null},
  {2:'two',1:'one',z:'quotes" slash\\ newline\n 😀 lone\ud800',a:[null,true,false,-0,1.25,NaN,undefined,,{x:undefined,y:'é'}]},
  {employerEvidence:{postingEvidence:{a:{text:'same body',at:'first'},b:{text:'same body',at:'second'}}}}])assert.equal(hash(value),old(value));
});
test('expanded cache beyond Node single-string limit hashes without truncation',()=>{
 const text='x'.repeat(1024*1024),value={postingEvidence:Array.from({length:520},(_,i)=>({text,at:i}))};
 assert.throws(()=>JSON.stringify(value),/Invalid string length/);
 const digest=hash(value);assert.match(digest,/^[a-f0-9]{64}$/);
 value.postingEvidence[519].at=999;assert.notEqual(hash(value),digest);
});
