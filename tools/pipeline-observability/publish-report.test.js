const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),os=require('os'),p=require('path'),{publish,runCli,fatalError,SPAWN_TIMEOUT_MS,isPushReject,isRetryable}=require('./publish-report');
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
test('activity stays published when a later flow run fails',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-cheap-'));try{
  const components=[{id:'activity',paths:['state/activity.json']},{id:'flow',paths:['state/flow.json']}];
  await publish({root,components,only:['activity'],now:()=>1000,run:s=>{if(s.id!=='activity')throw Error('flow should not run');fs.mkdirSync(p.join(root,'state'),{recursive:true});fs.writeFileSync(p.join(root,'state/activity.json'),'cheap');return{ok:true};}});
  await publish({root,components,only:['flow'],sleep:async()=>{},now:()=>2000,run:()=>{fs.writeFileSync(p.join(root,'state/flow.json'),'partial');return{ok:false,error:'timed out'};}});
  a.equal(fs.readFileSync(p.join(root,'state/activity.json'),'utf8'),'cheap');
  a.equal(fs.existsSync(p.join(root,'state/flow.json')),false);
  const health=JSON.parse(fs.readFileSync(p.join(root,'state/REPORTING_HEALTH.json')));
  a.equal(health.components.activity.status,'CURRENT');a.equal(health.components.flow.status,'STALE');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('unknown publish section is rejected and an omitted only list still runs every section',async()=>{
 const ran=[];await publish({root:fs.mkdtempSync(p.join(os.tmpdir(),'report-all-')),components:[{id:'activity',paths:[]},{id:'flow',paths:[]}],run:s=>{ran.push(s.id);return{ok:true};}});
 a.deepEqual(ran,['activity','flow']);
 await a.rejects(()=>publish({components:[{id:'activity',paths:[]}],only:['nope'],run:()=>({ok:true})}),/Unknown publish section/);
});
test('workflow publishes cheap activity before fetching full discovery history, without changing checkout depth or triggers',()=>{
 const y=fs.readFileSync(p.join(__dirname,'../../.github/workflows/pipeline-observability.yml'),'utf8');
 const cheap=y.indexOf('Publish cheap Writer activity'),flow=y.indexOf('Publish flow with incremental cursor'),retain=y.indexOf('Retain reporting evidence');
 a.ok(cheap>=0&&flow>cheap&&retain>flow);
 const activity=y.slice(cheap,flow),pub=y.slice(flow,retain);
 a.ok(activity.includes('publish-report.js activity'));
 a.ok(!/continue-on-error|--unshallow/.test(activity));
 a.ok(pub.includes('if: ${{ !cancelled() }}'));
 a.ok(pub.includes("UPSTREAM_FLOW_COMMIT_CURSOR: '1'"));
 a.ok(y.includes("cron: '7,17,27,37,47,57 * * * *'"));
 a.ok(y.includes('workflow_dispatch: {}'));
 a.match(y,/fetch-depth:\s*1/);
 a.doesNotMatch(y,/fetch-depth:\s*0|--shallow-since/);
 a.match(pub,/for attempt in 1 2 3 4; do[\s\S]*if \[\[ \$\(git rev-parse --is-shallow-repository\) == true \]\]; then\s+git fetch --no-tags --unshallow --filter=blob:none origin main\s+else\s+git fetch --no-tags origin main\s+fi\s+git reset --hard FETCH_HEAD\s+if node tools\/pipeline-observability\/publish-report\.js flow intake-queue/);
});
test('a flow spawn timeout fails the step with a non-zero exit and is not retried',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-timeout-'));const prev=process.exitCode,log=console.log;let n=0;
 try{
  process.exitCode=0;console.log=()=>{};
  const h=await runCli({root,components:[{id:'flow',paths:[]}],sleep:async()=>{},now:()=>1000,run:()=>{n++;return{ok:false,error:'spawnSync node ETIMEDOUT',spawnError:{code:'ETIMEDOUT'}};}});
  a.equal(n,1);a.equal(h.components.flow.status,'STALE');a.match(h.components.flow.error,/ETIMEDOUT/);a.ok(fatalError(h));a.equal(process.exitCode,1);
 }finally{console.log=log;process.exitCode=prev;fs.rmSync(root,{recursive:true,force:true});}
});
test('a leftover stale flow does not fail an activity-only run, but a timeout in this run still exits non-zero',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-leftover-'));const prev=process.exitCode,log=console.log;
 const components=[{id:'activity',paths:['state/activity.json']},{id:'flow',paths:['state/flow.json']}];
 try{
  fs.mkdirSync(p.join(root,'state'));
  fs.writeFileSync(p.join(root,'state/REPORTING_HEALTH.json'),JSON.stringify({schema:'forge.reporting-health.v1',at:'2026-11-18T04:28:17.118Z',components:{activity:{status:'CURRENT',at:'2026-11-18T04:21:58.170Z',lastSuccessAt:'2026-11-18T04:21:58.170Z',attempts:1},flow:{status:'STALE',at:'2026-11-18T04:28:17.118Z',lastSuccessAt:'2026-11-18T04:03:25.353Z',failureSince:'2026-11-18T04:28:17.118Z',error:'spawnSync node ETIMEDOUT',attempts:3,owner:'CODE',nextAction:'Automatic reporting retry; retain last successful metrics'}}}));
  process.exitCode=0;console.log=()=>{};
  const ok=await runCli({root,components,only:['activity'],sleep:async()=>{},now:()=>1000,run:s=>{if(s.id!=='activity')throw Error('flow should not run');fs.writeFileSync(p.join(root,'state/activity.json'),'cheap');return{ok:true};}});
  a.equal(ok.components.activity.status,'CURRENT');a.equal(ok.components.flow.status,'STALE');a.match(ok.components.flow.error,/ETIMEDOUT/);a.equal(process.exitCode,0);
  process.exitCode=0;
  const bad=await runCli({root,components,only:['flow'],sleep:async()=>{},now:()=>2000,run:()=>({ok:false,error:'spawnSync node ETIMEDOUT',spawnError:{code:'ETIMEDOUT'}})});
  a.equal(bad.components.flow.status,'STALE');a.match(bad.components.flow.error,/ETIMEDOUT/);a.ok(fatalError(bad,['flow']));a.equal(fatalError(bad,['activity']),undefined);a.equal(process.exitCode,1);
 }finally{console.log=log;process.exitCode=prev;fs.rmSync(root,{recursive:true,force:true});}
});
test('flow spawn timeout is 15 minutes and stays inside the 20-minute job limit',()=>{
 a.equal(SPAWN_TIMEOUT_MS,15*60*1000);
 const y=fs.readFileSync(p.join(__dirname,'../../.github/workflows/pipeline-observability.yml'),'utf8');
 const m=y.match(/timeout-minutes:\s*(\d+)/);
 a.ok(m);a.equal(Number(m[1]),20);a.ok(SPAWN_TIMEOUT_MS<Number(m[1])*60*1000);
});
test('a rejected fetch-first push is retried and can recover, unlike a spawn timeout',async()=>{
 a.ok(isPushReject(' ! [rejected] HEAD -> main (fetch first)\nerror: failed to push some refs'));
 a.equal(isRetryable({ok:false,error:' ! [rejected] HEAD -> main (fetch first)'}),true);
 a.equal(isRetryable({ok:false,error:'spawnSync node ETIMEDOUT',spawnError:{code:'ETIMEDOUT'}}),false);
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-fetch-'));try{
  let n=0;
  const h=await publish({root,components:[{id:'flow',paths:[]}],sleep:async()=>{},run:()=>++n===1?{ok:false,error:' ! [rejected]          HEAD -> main (fetch first)\nerror: failed to push some refs'}:{ok:true}});
  a.equal(n,2);a.equal(h.components.flow.status,'CURRENT');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('a flow section that stays STALE from a rejected push exits non-zero and does not look like a green publish',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-stale-flow-'));const prev=process.exitCode,log=console.log;let n=0;
 try{
  process.exitCode=0;console.log=()=>{};
  const h=await runCli({root,components:[{id:'flow',paths:[]},{id:'intake-queue',paths:[]}],only:['flow','intake-queue'],sleep:async()=>{},now:()=>1000,run:s=>{if(s.id==='intake-queue')return{ok:true};n++;return{ok:false,error:' ! [rejected] HEAD -> main (fetch first)'};}});
  a.equal(n,3);a.equal(h.components.flow.status,'STALE');a.equal(h.components['intake-queue'].status,'CURRENT');
  a.ok(fatalError(h,['flow','intake-queue']));a.equal(fatalError(h,['activity']),undefined);a.equal(process.exitCode,1);
 }finally{console.log=log;process.exitCode=prev;fs.rmSync(root,{recursive:true,force:true});}
});
test('cursor push contention makes retained-old flow a CLI failure and never publishes it',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-cursor-race-')),previous=process.exitCode,log=console.log;
 const ledger='state/UPSTREAM_LEDGER.json',prior='{"status":"EXCLUDED","worksheetDeletion":{"receiptId":"verified"}}';
 try{
  fs.mkdirSync(p.join(root,'state'));fs.writeFileSync(p.join(root,ledger),prior);process.exitCode=0;console.log=()=>{};
  const output=await runCli({root,only:['flow'],components:[{id:'flow',paths:[ledger]}],sleep:async()=>{},run:()=>{
   fs.writeFileSync(p.join(root,ledger),'{"status":"WAITING"}');return{ok:false,error:'Updates were rejected (non-fast-forward)'};
  }});
  a.equal(output.components.flow.status,'STALE');a.equal(process.exitCode,1);a.equal(fs.readFileSync(p.join(root,ledger),'utf8'),prior);
 }finally{console.log=log;process.exitCode=previous;fs.rmSync(root,{recursive:true,force:true});}
});
test('a STALE intake-queue keeps last metrics and does not block a CURRENT flow publish',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-intake-stale-'));const prev=process.exitCode,log=console.log;
 const components=[{id:'flow',paths:['state/flow.json']},{id:'intake-queue',paths:['state/intake.json']}];
 try{
  fs.mkdirSync(p.join(root,'state'));process.exitCode=0;console.log=()=>{};
  const first=await runCli({root,components,only:['flow','intake-queue'],now:()=>1000,run:s=>{
   if(s.id==='flow'){fs.writeFileSync(p.join(root,'state/flow.json'),'flow-v1');return{ok:true};}
   fs.writeFileSync(p.join(root,'state/intake.json'),'intake-v1');return{ok:true};
  }});
  a.equal(first.components.flow.status,'CURRENT');a.equal(first.components['intake-queue'].status,'CURRENT');a.equal(process.exitCode,0);
  const lastIntake=first.components['intake-queue'].lastSuccessAt;
  process.exitCode=0;
  const second=await runCli({root,components,only:['flow','intake-queue'],sleep:async()=>{},now:()=>2000,run:s=>{
   if(s.id==='flow'){fs.writeFileSync(p.join(root,'state/flow.json'),'flow-v2');return{ok:true};}
   fs.writeFileSync(p.join(root,'state/intake.json'),'intake-partial');return{ok:false,error:'state/INTAKE_DRAIN.json: live inventory exceeds the storage limit'};
  }});
  a.equal(second.components.flow.status,'CURRENT');
  a.equal(second.components['intake-queue'].status,'STALE');
  a.equal(second.components['intake-queue'].lastSuccessAt,lastIntake);
  a.match(second.components['intake-queue'].error,/storage limit/);
  a.equal(second.components['intake-queue'].nextAction,'Automatic reporting retry; retain last successful metrics');
  a.equal(fs.readFileSync(p.join(root,'state/flow.json'),'utf8'),'flow-v2');
  a.equal(fs.readFileSync(p.join(root,'state/intake.json'),'utf8'),'intake-v1');
  a.equal(fatalError(second,['flow','intake-queue']),undefined);
  a.equal(process.exitCode,0);
 }finally{console.log=log;process.exitCode=prev;fs.rmSync(root,{recursive:true,force:true});}
});
test('a STALE flow still exits non-zero when intake-queue is also STALE',async()=>{
 const root=fs.mkdtempSync(p.join(os.tmpdir(),'report-both-stale-'));const prev=process.exitCode,log=console.log;
 try{
  process.exitCode=0;console.log=()=>{};
  const h=await runCli({root,components:[{id:'flow',paths:[]},{id:'intake-queue',paths:[]}],only:['flow','intake-queue'],sleep:async()=>{},now:()=>1000,run:s=>({ok:false,error:s.id==='flow'?'flow failed':'state/INTAKE_DRAIN.json: live inventory exceeds the storage limit'})});
  a.equal(h.components.flow.status,'STALE');a.equal(h.components['intake-queue'].status,'STALE');
  a.ok(fatalError(h,['flow','intake-queue']));a.equal(process.exitCode,1);
 }finally{console.log=log;process.exitCode=prev;fs.rmSync(root,{recursive:true,force:true});}
});
