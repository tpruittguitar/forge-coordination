const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('./activity'),{discoveryDue}=require('./discovery-watchdog');
test('only missed and idle discovery is dispatched, recent failures back off',()=>{const now=Date.parse('2026-10-31T03:00:00Z'),old={summary:{at:'2026-10-30T20:00:00Z'}};assert.equal(discoveryDue(old,[],now),true);assert.equal(discoveryDue({summary:{at:'2026-10-31T00:00:00Z'}},[],now),false);for(const status of ['queued','in_progress','completed'])assert.equal(discoveryDue(old,[{head_branch:'main',event:'workflow_dispatch',status,created_at:'2026-10-31T02:00:00Z'}],now),false);assert.equal(discoveryDue({},[],now),false);});
test('activity publication rejects invalid future index timestamps',async()=>{await assert.rejects(()=>build({now:Date.parse('2026-10-31T03:00:00Z'),load:async()=>({index:{updatedAt:'2026-11-30T20:00:00Z'}})}),/timestamp invalid/);});

test('incomplete receipt history remains partial and missing capture history never becomes zero discovery',async t=>{
 const fs=require('fs'),os=require('os'),path=require('path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rate-fallback-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'verify/recovery'),{recursive:true});fs.writeFileSync(path.join(root,'verify/recovery/latest.json'),'{}');const now=Date.parse('2026-11-05T22:00:00Z');
 const result=await build({root,now,load:async()=>({sha:'a'.repeat(40),index:{updatedAt:new Date(now).toISOString()}}),hydrate:async()=>({index:{},remaining:3,sources:[],error:null}),aggregate:()=>({rates36:{intake:{count:1,perHour:1/36},enrichment:{count:1,perHour:1/36},metadataGaps:0}})});
 assert.equal(result.rates36.intake.partial,true);assert.equal(result.rates36.enrichment.partial,true);assert.equal(result.rates36.discovery,null);assert.ok(result.rates36.discoveryError);
});
