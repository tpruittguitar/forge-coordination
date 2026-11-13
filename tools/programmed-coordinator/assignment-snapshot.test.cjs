'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {refresh}=require('./assignment-snapshot.cjs');
const now=Date.parse('2026-11-13T03:31:10.143Z'),snap=at=>({source:{readAt:new Date(at).toISOString()},rows:[],archiveRows:[]});
test('read-only mail aging beyond 15 minutes refreshes before assignments',async()=>{
 const old=snap(Date.parse('2026-11-13T03:06:52.525Z')),fresh=snap(now);let reads=0;
 a.equal(await refresh(old,async()=>{reads++;return fresh;},{clock:()=>now}),fresh);a.equal(reads,1);
});
test('fresh unchanged snapshot reused without redundant read',async()=>{
 const fresh=snap(now-10000);a.equal(await refresh(fresh,()=>{throw Error('unexpected read');},{clock:()=>now}),fresh);
});
test('verified mail effects force fresh snapshot even if prior read is recent',async()=>{
 const fresh=snap(now);let reads=0;a.equal(await refresh(snap(now-1000),async()=>{reads++;return fresh;},{force:true,clock:()=>now}),fresh);a.equal(reads,1);
});
for(const [label,input]of [['missing',{}],['malformed',{source:{readAt:'bad'}}],['future',snap(now+1000)],['budget-boundary',snap(now-14*60000)]])test(label+' forces refresh',async()=>{
 const fresh=snap(now);a.equal(await refresh(input,async()=>fresh,{clock:()=>now}),fresh);
});
test('unreadable or stale refresh fails closed rather than passing old data',async()=>{
 const old=snap(now-20*60000);await a.rejects(refresh(old,async()=>{throw Error('transport');},{clock:()=>now}),/transport/);await a.rejects(refresh(old,async()=>old,{clock:()=>now}),/FRESH_CANONICAL/);await a.rejects(refresh(old,async()=>({}),{clock:()=>now}),/FRESH_CANONICAL/);
});
test('original assignment freshness guard remains active with exact failing run timestamps',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'assignment-age-'));try{a.throws(()=>require('../routine-handoffs/assignments.cjs').replenish({root,state:{},snapshot:snap(Date.parse('2026-11-13T03:06:52.525Z')),runId:'READ_ONLY',apply:false,now}),/FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('coordinator refreshes after mail and before assignment replenishment',()=>{
 const text=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8'),mail=text.indexOf("mail-pipeline.cjs').run"),refreshAt=text.indexOf("assignment-snapshot.cjs').refresh"),assignment=text.indexOf("assignments.cjs').replenish");a.ok(mail<refreshAt&&refreshAt<assignment);a.match(text.slice(refreshAt,assignment),/force:!!mail.masterVerifiedThisRun/);
});
