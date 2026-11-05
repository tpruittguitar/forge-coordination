const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),os=require('os'),p=require('path'),{publish}=require('./publish-report');
test('failed flow preserves old metrics, publishes independent output, retries reads and clears health on recovery',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-test-'));try{
 fs.mkdirSync(p.join(root,'state'));fs.writeFileSync(p.join(root,'state/flow.json'),'old');
 const components=[{id:'flow',paths:['state/flow.json']},{id:'activity',paths:['state/activity.json']}];let attempts=0;
 const h=await publish({root,components,sleep:async()=>{},now:()=>1000,run:s=>{if(s.id==='flow'){attempts++;fs.writeFileSync(p.join(root,'state/flow.json'),'partial');return{ok:false,error:'BLOCKED: Writer HTTP 404'};}fs.writeFileSync(p.join(root,'state/activity.json'),'new');return{ok:true};}});
 a.equal(attempts,3);a.equal(fs.readFileSync(p.join(root,'state/flow.json'),'utf8'),'old');a.equal(h.components.flow.status,'STALE');a.equal(h.components.activity.status,'CURRENT');a.equal(fs.readFileSync(p.join(root,'state/activity.json'),'utf8'),'new');
 const recovered=await publish({root,components,now:()=>2000,run:()=>({ok:true})});a.equal(recovered.components.flow.status,'CURRENT');a.equal(recovered.components.flow.recoveredAt,new Date(2000).toISOString());a.equal(recovered.components.flow.error,undefined);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('a transient 404 recovers without a stale notice and never retries a write client',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-retry-'));try{let n=0;const h=await publish({root,components:[{id:'flow',paths:[]}],sleep:async()=>{},run:()=>++n===1?{ok:false,error:'BLOCKED: Writer HTTP 404'}:{ok:true}});a.equal(n,2);a.equal(h.components.flow.status,'CURRENT');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
