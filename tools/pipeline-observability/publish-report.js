'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const Store=require('../upstream-ledger/store.cjs');
const FILE='state/REPORTING_HEALTH.json';
const sections=[
 {id:'activity',script:'tools/pipeline-observability/activity.js',paths:['state/WRITER_ACTIVITY.json','state/WRITER_ACTIVITY_DETAILS.json']},
 {id:'flow',script:'tools/pipeline-observability/process-flow.js',paths:['state/UPSTREAM_COLLECT_CURSOR.json','receipts/manual-backlog','state/PROCESS_COMPLETIONS.json','state/ENRICHMENT_OUTCOMES.json','state/RELEVANCE_SCREEN_GUARD.json','state/ENRICHMENT_FLOW.json',Store.LEDGER_PATH,Store.LEDGER_ARCHIVE,'state/UPSTREAM_FLOW.json','state/PIPELINE_WAITING_QUEUES.json','state/waiting-queues','state/discovery-evidence','state/DISCOVERY_SCREEN_REPORT.json']},
 {id:'intake-queue',script:'tools/intake-drain/queue.cjs',args:['sync'],paths:[Store.DRAIN_PATH,Store.DRAIN_ARCHIVE]}
];
const CHEAP_PATHS=['state/WRITER_ACTIVITY.json','state/WRITER_ACTIVITY_DETAILS.json','state/REPORTING_HEALTH.json'],SPAWN_TIMEOUT_MS=15*60*1000;
function runSection(s,root){const r=cp.spawnSync(process.execPath,[s.script,...s.args||[]],{cwd:root,encoding:'utf8',timeout:SPAWN_TIMEOUT_MS,maxBuffer:4e6}),spawnError=r.error||null,signal=r.signal||null,error=spawnError?.message||(signal?'killed by '+signal:null)||r.stderr||'Report generation failed';return{ok:r.status===0&&!spawnError&&!signal,error,spawnError,signal,status:r.status};}
function isSpawnFailure(result){const err=result&&result.error||'';return !!(result&&(result.spawnError||result.signal||/\bETIMEDOUT\b/.test(err)||/^spawnSync\b/.test(err)||/^killed by /.test(err)));}
function ranIds(opts={}){return opts.only||(opts.components||sections).map(s=>s.id);}
function isPushReject(err){return /fetch first|non-fast-forward|failed to push some refs|Updates were rejected/i.test(String(err||''));}
function isRetryable(result){const err=result&&result.error||'';if(isSpawnFailure(result))return false;return isPushReject(err)||/Writer HTTP (404|408|429|5\d\d)|transport|timed? ?out/i.test(err);}
function fatalError(health,ran){const allow=ran&&ran.length?new Set(Array.isArray(ran)?ran.map(s=>typeof s==='string'?s:s.id):[]):null;return Object.entries(health?.components||{}).find(([id,c])=>c&&c.status==='STALE'&&id!=='intake-queue'&&(!allow||allow.has(id)))?.[1];}
async function publish({root=process.cwd(),run=(s)=>runSection(s,root),sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),components=sections,only}={}){
 if(only){const want=new Set(only),selected=components.filter(s=>want.has(s.id));if(selected.length!==want.size)throw Error('Unknown publish section');components=selected;}

 const file=path.join(root,FILE),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
 const health={schema:'forge.reporting-health.v1',at:new Date(now()).toISOString(),components:{...prior.components}};
 for(const section of components){
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'forge-report-')),exists=new Set();
  for(const f of section.paths)if(fs.existsSync(path.join(root,f))){exists.add(f);fs.mkdirSync(path.dirname(path.join(backup,f)),{recursive:true});fs.cpSync(path.join(root,f),path.join(backup,f),{recursive:true});}
  let result,attempts=0;
  try{for(;attempts<3;){attempts++;try{result=await run(section);}catch(e){result={ok:false,error:e.message};}if(result.ok)break;
   // Restore the entire component, including files created before a later read failed.
   for(const f of section.paths){fs.rmSync(path.join(root,f),{recursive:true,force:true});if(exists.has(f)){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.cpSync(path.join(backup,f),path.join(root,f),{recursive:true});}}
   if(!isRetryable(result)||attempts===3)break;
   await sleep(attempts===1?3000:8000);
  }}finally{fs.rmSync(backup,{recursive:true,force:true});}
  const at=new Date(now()).toISOString(),old=prior.components?.[section.id]||{};
  health.components[section.id]=result.ok?{status:'CURRENT',at,lastSuccessAt:at,attempts,...(old.status==='STALE'?{recoveredAt:at}:{})}:{status:'STALE',at,lastSuccessAt:old.lastSuccessAt||null,failureSince:old.status==='STALE'?old.failureSince:at,error:String(result.error).slice(-500),attempts,owner:'CODE',nextAction:'Automatic reporting retry; retain last successful metrics'};
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(health,null,2)+'\n');return health;
}
async function runCli(opts={}){try{const h=await publish(opts);console.log(JSON.stringify(h));if(fatalError(h,ranIds(opts)))process.exitCode=1;return h;}catch(e){console.error(e.message);process.exitCode=1;}}
if(require.main===module){const only=process.argv.slice(2).filter(a=>!a.startsWith('-'));runCli({only:only.length?only:undefined});}
module.exports={publish,sections,FILE,CHEAP_PATHS,isSpawnFailure,isPushReject,isRetryable,fatalError,runCli,SPAWN_TIMEOUT_MS,runSection};

