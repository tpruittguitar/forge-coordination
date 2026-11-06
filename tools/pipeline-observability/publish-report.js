'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const FILE='state/REPORTING_HEALTH.json';
const sections=[
 {id:'activity',script:'tools/pipeline-observability/activity.js',paths:['state/WRITER_ACTIVITY.json','state/WRITER_ACTIVITY_DETAILS.json']},
 {id:'flow',script:'tools/pipeline-observability/process-flow.js',paths:['receipts/manual-backlog','state/PROCESS_COMPLETIONS.json','state/ENRICHMENT_OUTCOMES.json','state/RELEVANCE_SCREEN_GUARD.json','state/ENRICHMENT_FLOW.json','state/UPSTREAM_LEDGER.json','state/UPSTREAM_FLOW.json','state/PIPELINE_WAITING_QUEUES.json','state/waiting-queues','state/discovery-evidence','state/DISCOVERY_SCREEN_REPORT.json']},
 {id:'intake-queue',script:'tools/intake-drain/queue.cjs',args:['sync'],paths:['state/INTAKE_DRAIN.json']}
];
async function publish({root=process.cwd(),run=(s)=>{const r=cp.spawnSync(process.execPath,[s.script,...s.args||[]],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4e6});return{ok:r.status===0,error:r.error?.message||r.stderr||'Report generation failed'};},sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),components=sections}={}){
 const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
 const health={schema:'forge.reporting-health.v1',at:new Date(now()).toISOString(),components:{...prior.components}};
 for(const section of components){
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'forge-report-')),exists=new Set();
  for(const f of section.paths)if(fs.existsSync(path.join(root,f))){exists.add(f);fs.mkdirSync(path.dirname(path.join(backup,f)),{recursive:true});fs.cpSync(path.join(root,f),path.join(backup,f),{recursive:true});}
  let result,attempts=0;
  try{for(;attempts<3;){attempts++;try{result=await run(section);}catch(e){result={ok:false,error:e.message};}if(result.ok)break;
   // Restore the entire component, including files created before a later read failed.
   for(const f of section.paths){fs.rmSync(path.join(root,f),{recursive:true,force:true});if(exists.has(f)){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.cpSync(path.join(backup,f),path.join(root,f),{recursive:true});}}
   if(!/Writer HTTP (404|408|429|5\d\d)|transport|timed? ?out/i.test(result.error||'')||attempts===3)break;
   await sleep(attempts===1?3000:8000);
  }}finally{fs.rmSync(backup,{recursive:true,force:true});}
  const at=new Date(now()).toISOString(),old=prior.components?.[section.id]||{};
  health.components[section.id]=result.ok?{status:'CURRENT',at,lastSuccessAt:at,attempts,...(old.status==='STALE'?{recoveredAt:at}:{})}:{status:'STALE',at,lastSuccessAt:old.lastSuccessAt||null,failureSince:old.status==='STALE'?old.failureSince:at,error:String(result.error).slice(-500),attempts,owner:'CODE',nextAction:'Automatic reporting retry; retain last successful metrics'};
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(health,null,2)+'\n');return health;
}
if(require.main===module)publish().then(h=>console.log(JSON.stringify(h))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={publish,sections,FILE};
