'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const H=require('./run-health.cjs');
const now=Date.parse('2026-11-13T03:31:00Z'),snap=age=>({source:{readAt:new Date(now-age).toISOString()}});
test('long mail stage refreshes even without a verified write',async()=>{
 const old=snap(25*60000),fresh=snap(0);let reads=0;
 a.equal(await H.freshSnapshot({current:old,read:async()=>{reads++;return fresh;},now:()=>now}),fresh);a.equal(reads,1);
});
test('fresh snapshot is reused; verified changes force a read',async()=>{
 const current=snap(60000),fresh=snap(0);let reads=0;const read=async()=>{reads++;return fresh;};
 a.equal(await H.freshSnapshot({current,read,now:()=>now}),current);a.equal(reads,0);
 a.equal(await H.freshSnapshot({current,read,force:true,now:()=>now}),fresh);a.equal(reads,1);
});
test('boundary, invalid and future snapshots refresh; failed reads propagate',async()=>{
 for(const current of [snap(840000),{},snap(-120001)])a.equal(await H.freshSnapshot({current,read:async()=>42,now:()=>now}),42);
 await a.rejects(H.freshSnapshot({current:snap(900001),read:async()=>{throw Error('READ_FAILED');},now:()=>now}),/READ_FAILED/);
});
test('failure diagnostics persist safe reason and stage without exception content',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-health-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const args={privateDir:dir,runId:'FORGE-TEST-001',commit:'abc',stage:'routine-assignments'};
 const report=H.recordFailure({...args,error:Error('FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED')});a.equal(report.completed,false);a.equal(report.reason,'FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED');
 H.recordFailure({...args,error:Error('secret URL https://example.test?key=private')});
 const raw=fs.readFileSync(path.join(dir,'coordinator-failures/FORGE-TEST-001.json'),'utf8');a.ok(!raw.includes('private'));a.equal(JSON.parse(raw).stage,'routine-assignments');
 a.throws(()=>H.recordFailure({...args,runId:'../../unsafe',error:Error('FAIL')}),/PATH_REQUIRED/);
});
test('runner refreshes both assignment boundaries and records failures before rethrow',()=>{
 const run=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');
 a.equal((run.match(/freshSnapshot\(/g)||[]).length,2);
 a.ok(run.indexOf("stage='routine-assignments'")<run.indexOf("assignments.cjs').replenish"));
 a.match(run,/recordFailure\(\{privateDir,runId,commit,stage,error\}\)/);
 a.match(run,/throw error;\s*} finally/);
});
