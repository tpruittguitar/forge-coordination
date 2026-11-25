'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const DEFAULT_MESSAGE='ACTIVITY-BOT: publish compact verified receipt activity';
function run(root,args,env){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:env?{...process.env,...env}:undefined});}
// Exact inputs of `publish-report.js flow intake-queue`, derived from the literal repo paths in the
// transitive require tree of process-flow.js, intake-drain/queue.cjs and publish-report.js, plus the
// code and workflow that run them. A commit touching any of these between build and push forces a
// rebuild from fresh main; every other commit (evidence, verify, other reference/state files,
// status displays, usage readings) is unrelated to the flow and is safely reparented over.
const FLOW_INPUTS=['tools','.github/workflows/pipeline-observability.yml','policy/current','lanes/FORGE_API_GRANT_ENRICHMENT.txt','README.md',
 'control/AI_AUTOMATION_TASKS.json','control/CHATGPT_OWNER_CUTOVER.json','control/CLAUDE_HELPER_WORK.json','control/CLAUDE_RELEVANCE_WORK.json','control/ENRICHMENT_HELPER_WORK.json','control/ENRICHMENT_RESEARCH_OWNER.json','control/ENRICHMENT_WORKER_PARTITION.json','control/GROK_INTAKE_HELPER_WORK.json','control/RELEVANCE_SCREEN.json','control/RESUME_MATCH_PROFILE.json','control/RESUME_MATCH_VARIANTS.json','control/SHARED_HELPER_WORK.json','control/claude-relevance','control/grok-intake','control/shared-helper-pages',
 'receipts/manual-backlog','receipts/INTAKE_DRAIN','receipts/auto-intake','receipts/live-backlog','receipts/CHATGPT_HELPERS',
 'reference/COMPANY_SITE_CONTEXT.json','reference/EXCLUSION_BUSINESS_EVIDENCE.json','reference/EXCLUSION_ROLE_EVIDENCE.json','reference/EXCLUSION_TITLE_RULES.json',
 'state/CLAUDE_HELPER_CONSUMPTION.json','state/CODE_INTAKE_CONSUMPTION.json','state/DISCOVERY_SCREEN_REPORT.json','state/EMAIL_RECOVERY_QUEUE.json','state/ENRICHMENT_FLOW.json','state/ENRICHMENT_OUTCOMES.json','state/HELPER_HANDOFFS.json','state/INTAKE_DRAIN.json','state/intake-drain-archive','state/PIPELINE_WAITING_QUEUES.json','state/PROCESS_COMPLETIONS.json','state/PROGRAMMED_COORDINATOR.json','state/RELEVANCE_INTAKE_PLAN.json','state/RELEVANCE_SCREEN_GUARD.json','state/REPORTING_HEALTH.json','state/UPSTREAM_COLLECT_CURSOR.json','state/UPSTREAM_FLOW.json','state/UPSTREAM_LEDGER.json','state/upstream-ledger-archive','state/board-discovery-report.json','state/discovery-evidence','state/enrich-ats-pay-recovery.json','state/enrich-ats-pay.json','state/source-trial-report.json','state/targeted-posting-lookup.json','state/waiting-queues'];
// Top-level receipts read by name pattern (upstream-flow.js email files; transactions/writer-outcome/handoff receipts).
const FLOW_INPUT_PATTERNS=[/^receipts\/EMAIL_(?:CANDIDATE_LEDGER|EVAL|PENDING)[^/]*\.json$/,/^receipts\/[^/]+_(?:CHECKPOINT|VERIFIED|NOT_ACCEPTED|HANDOFFS)\.json$/];
const isFlowInput=p=>FLOW_INPUTS.some(x=>p===x||p.startsWith(x+'/'))||FLOW_INPUT_PATTERNS.some(r=>r.test(p));
const Store=require('../upstream-ledger/store.cjs');
const {LEDGER_PATH,LEDGER_ARCHIVE,DRAIN_PATH,DRAIN_ARCHIVE}=Store;
const INVENTORIES=[[LEDGER_PATH,LEDGER_ARCHIVE],[DRAIN_PATH,DRAIN_ARCHIVE]];
const COMPLETE_FLOW=[LEDGER_PATH,LEDGER_ARCHIVE,'state/UPSTREAM_FLOW.json','state/ENRICHMENT_FLOW.json','state/PIPELINE_WAITING_QUEUES.json','state/waiting-queues',DRAIN_PATH,DRAIN_ARCHIVE,'state/UPSTREAM_COLLECT_CURSOR.json'];
function reparentFinishedFlow(root,{base,finished,paths,message,retries=4,sleep}){
 for(let attempt=1;attempt<=retries;attempt++){
  run(root,['fetch','--no-tags','origin','refs/heads/main']);
  const latest=run(root,['rev-parse','FETCH_HEAD']).trim();
  if(latest===base||latest===finished)throw Error('Flow reparent requires a strictly newer canonical main');
  run(root,['merge-base','--is-ancestor',base,latest]);
  const commits=run(root,['rev-list','--first-parent','--reverse','--max-count=65',base+'..'+latest]).trim().split(/\s+/);
  if(commits.length>64||run(root,['rev-parse',commits[0]+'^']).trim()!==base)throw Error('Flow input history is not a bounded linear continuation');
  const names=(from,to)=>run(root,['diff','--name-only','--no-renames','-z',from,to]).split('\0').filter(Boolean);
  for(const c of commits){
   const changed=names(c+'^',c);
   if(!changed.length||changed.some(isFlowInput))throw Error('Flow inputs changed: rebuild from fresh main');
  }
  // Verify exact input parity across the whole span, in addition to the per-commit check.
  if(names(base,latest).some(isFlowInput))throw Error('Flow inputs changed: rebuild from fresh main');
  const delta=names(base,finished);
  if(!delta.length||delta.some(f=>!paths.some(p=>f===p||f.startsWith(p+'/'))))throw Error('Finished flow contains an out-of-scope publication');
  run(root,['diff','--quiet',base,latest,'--',...delta]);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-flow-reparent-')),env={GIT_INDEX_FILE:path.join(dir,'index')};
  try{
   run(root,['read-tree',latest],env);
   for(const file of delta){
    const entries=run(root,['ls-tree','-z',finished,'--',file]);
    if(!entries){run(root,['update-index','--force-remove','--',file],env);continue;}
    const match=/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entries);
    if(!match||match[3]!==file)throw Error('Finished flow path is not an exact regular Git blob');
    run(root,['update-index','--add','--cacheinfo',match[1],match[2],file],env);
   }
   const tree=run(root,['write-tree'],env).trim();
   const commit=run(root,['commit-tree',tree,'-p',latest,'-m',message]).trim();
   try{run(root,['push','origin',commit+':refs/heads/main']);return {changed:true,pushed:true,attempts:attempt,reparented:true,commit};}
   catch(e){
    if(!/\[rejected\].*(?:fetch first|non-fast-forward)/i.test(String(e.stderr||'')))throw e;
    if(attempt===retries)throw Error('Flow reparent failed after '+retries+' attempts',{cause:e});
    if(sleep)sleep(attempt*2000);
   }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
 throw Error('Flow reparent failed after '+retries+' attempts');
}
function present(root,paths){return paths.filter(p=>fs.existsSync(path.join(root,p)));}
function snapshot(root,paths,dest){
 for(const p of present(root,paths)){fs.mkdirSync(path.dirname(path.join(dest,p)),{recursive:true});fs.cpSync(path.join(root,p),path.join(dest,p),{recursive:true});}
}
function restore(root,paths,src){
 for(const p of paths){const from=path.join(src,p),to=path.join(root,p);fs.rmSync(to,{recursive:true,force:true});if(fs.existsSync(from)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true});}}
}
function commitListed(root,paths,message){
 const files=present(root,paths),missing=paths.filter(p=>!files.includes(p));
 if(files.length)run(root,['add','--',...files]);
 for(const pathspec of missing)if(run(root,['ls-files','--',pathspec]))run(root,['add','-A','--',pathspec]);
 let changed=false;try{run(root,['diff','--cached','--quiet']);}catch{run(root,['commit','-m',message]);changed=true;}
 return changed;
}
function publish(root,paths,message=DEFAULT_MESSAGE,{retries=4,sleep,push=true,ref='HEAD:main',allowFlowStatusReparent=false}={}){
 // Queue outputs (and their in-run cursor) belong to the exact input ledger revision.
 // Never rebase/replay these files: a fresh worksheet tombstone could be overwritten.
 let relativePaths=paths.map(p=>path.relative(root,path.resolve(root,p)).split(path.sep).join('/'));
 if(relativePaths.some(p=>p==='..'||p.startsWith('../')||path.isAbsolute(p)))throw Error('Publish paths must stay inside the repository');
 const inventoryPaths=([file,dir])=>relativePaths.some(p=>p===file||p===dir||p.startsWith(dir+'/'));
 const inventories=INVENTORIES.filter(inventoryPaths);
 const sourceBound=inventories.length>0||relativePaths.some(p=>p==='state/UPSTREAM_FLOW.json'||p==='state/UPSTREAM_COLLECT_CURSOR.json'||p==='state/PIPELINE_WAITING_QUEUES.json'||p==='state/waiting-queues'||p.startsWith('state/waiting-queues/'));
 if(allowFlowStatusReparent&&(!sourceBound||ref!=='HEAD:main'||!COMPLETE_FLOW.every(p=>relativePaths.includes(p))))throw Error('Status-only reparent requires the complete flow and canonical main');
 if(sourceBound){
  for(const [file] of inventories)(file===LEDGER_PATH?Store.readLedger:Store.readDrain)(root,null);
  relativePaths=[...new Set([...relativePaths,...inventories.flat()])];
  const base=allowFlowStatusReparent?run(root,['rev-parse','HEAD']).trim():null;
  const changed=commitListed(root,relativePaths,message);
  if(!push)return {changed,pushed:false};
  try{run(root,['push','origin',ref]);return {changed,pushed:true,attempts:1};}
  catch(e){
   if(!allowFlowStatusReparent||!changed||!/\[rejected\].*(?:fetch first|non-fast-forward)/i.test(String(e.stderr||'')))throw e;
   const finished=run(root,['rev-parse','HEAD']).trim();
   if(run(root,['rev-parse',finished+'^']).trim()!==base)throw Error('Finished flow is not a direct child of build input');
   return reparentFinishedFlow(root,{base,finished,paths:relativePaths,message,retries,sleep});
  }
 }
 const backup=fs.mkdtempSync(path.join(os.tmpdir(),'git-publish-'));
 try{
  snapshot(root,paths,backup);
  let changed=commitListed(root,paths,message);
  if(!push)return {changed,pushed:false};
  let last;
  for(let attempt=1;attempt<=retries;attempt++){
   try{run(root,['push','origin',ref]);return {changed,pushed:true,attempts:attempt};}
   catch(e){
    last=e;
    if(attempt===retries)break;
    if(sleep)sleep(attempt*2000);
    try{run(root,['fetch','origin','main']);}catch{continue;}
    try{run(root,['-c','core.editor=true','rebase','origin/main']);}
    catch{
     try{run(root,['rebase','--abort']);}catch{}
     run(root,['reset','--hard','origin/main']);
     restore(root,paths,backup);
     changed=commitListed(root,paths,message)||changed;
    }
   }
  }
  throw last||Error('git push failed');
 }finally{fs.rmSync(backup,{recursive:true,force:true});}
}
if(require.main===module){
 const argv=process.argv.slice(2),paths=[];let message=DEFAULT_MESSAGE,allowFlowStatusReparent=false;
 for(let i=0;i<argv.length;i++){if(argv[i]==='--message'){message=argv[++i];continue;}if(argv[i]==='--no-push'){process.env.GIT_PUBLISH_NO_PUSH='1';continue;}if(argv[i]==='--allow-status-only-reparent'){allowFlowStatusReparent=true;continue;}paths.push(argv[i]);}
 try{const result=publish(process.cwd(),paths,message,{push:process.env.GIT_PUBLISH_NO_PUSH!=='1',allowFlowStatusReparent});if(result.changed)console.log(result.pushed?'Published':'Committed');process.exitCode=0;}
 catch(e){console.error(e.stderr||e.message);process.exitCode=1;}
}
module.exports={publish,present,DEFAULT_MESSAGE,FLOW_INPUTS,isFlowInput};
