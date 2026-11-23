'use strict';
// Cross-provider lane run lock. One JSON file per lane on the run-locks branch.
// Every write is a compare-and-swap: a plain (non-force) push of a commit whose
// parent is the branch head we read, so two providers can never both win.
// A lock older than registry.runLock.staleAfterMinutes may be taken over.
// Usage: node tools/lane-run-lock.cjs acquire|release <TASK_KEY> <RUN_ID> <PROVIDER> [--root DIR] [--remote origin]
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const L=require('./automation-lanes.cjs');
const ID=/^[A-Za-z0-9_-]{6,160}$/;

function decide(held,{lane,runId,provider,now,staleMinutes}){
 if(!held)return{action:'ACQUIRE'};
 if(held.runId===runId)return{action:'ALREADY_HELD'};
 const at=Date.parse(held.acquiredAt),age=now-at;
 if(!Number.isFinite(at)||age>=staleMinutes*60000)return{action:'TAKEOVER',stale:held};
 return{action:'BUSY',heldBy:{runId:held.runId,provider:held.provider,acquiredAt:held.acquiredAt},retryAfter:new Date(at+staleMinutes*60000).toISOString(),lane};
}

function gitRunner(root,remote){
 const git=(args,opts={})=>cp.execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_AUTHOR_NAME:'forge-run-lock',GIT_AUTHOR_EMAIL:'run-lock@forge.invalid',GIT_COMMITTER_NAME:'forge-run-lock',GIT_COMMITTER_EMAIL:'run-lock@forge.invalid',...opts.env},input:opts.input});
 return{
  head(branch){try{git(['fetch','-q','--depth=1',remote,'+refs/heads/'+branch+':refs/forge-run-lock/'+branch]);return git(['rev-parse','refs/forge-run-lock/'+branch]).trim();}catch(e){if(/couldn't find remote ref|not found/i.test(String(e.stderr)))return null;throw e;}},
  read(commit,file){if(!commit)return null;try{return JSON.parse(git(['show',commit+':'+file]));}catch{return null;}},
  // Builds the next commit in a private index and pushes it without force.
  write(branch,parent,file,content,message){
   const index=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'run-lock-')),'index'),env={GIT_INDEX_FILE:index};
   try{
    if(parent)git(['read-tree',parent],{env});else git(['read-tree','--empty'],{env});
    if(content===null)git(['update-index','--force-remove',file],{env});
    else{const blob=git(['hash-object','-w','--stdin'],{input:JSON.stringify(content,null,1)+'\n'}).trim();git(['update-index','--add','--cacheinfo','100644,'+blob+','+file],{env});}
    const tree=git(['write-tree'],{env}).trim(),commit=git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',message]).trim();
    try{git(['push','-q',remote,commit+':refs/heads/'+branch]);return true;}catch{return false;}
   }finally{fs.rmSync(path.dirname(index),{recursive:true,force:true});}
  }};
}

function run(action,taskKey,runId,provider,{root=path.resolve(__dirname,'..'),remote='origin',now=Date.now(),store}={}){
 const registry=L.read(root),lane=L.resolve(registry,taskKey);
 if(!lane)return{result:'BLOCKED',reason:'UNKNOWN_TASK_KEY',taskKey};
 if(!ID.test(runId||''))return{result:'BLOCKED',reason:'RUN_ID_REQUIRED'};
 if(!L.authorized(registry,provider))return{result:'BLOCKED',reason:'PROVIDER_NOT_AUTHORIZED',provider};
 const cfg=registry.runLock||{},branch=cfg.branch||'run-locks',staleMinutes=cfg.staleAfterMinutes||90,file=lane.key+'.json';
 store=store||gitRunner(root,remote);
 for(let attempt=0;attempt<2;attempt++){
  const head=store.head(branch),held=store.read(head,file);
  if(action==='release'){
   if(!held||held.runId!==runId)return{result:'NOT_HELD',lane:lane.key};
   if(store.write(branch,head,file,null,'release '+lane.key+' '+runId))return{result:'RELEASED',lane:lane.key};
   continue;
  }
  const d=decide(held,{lane:lane.key,runId,provider,now,staleMinutes});
  if(d.action==='ALREADY_HELD')return{result:'ACQUIRED',lane:lane.key,already:true};
  if(d.action==='BUSY')return{result:'BUSY',...d};
  const lock={lane:lane.key,taskKey,runId,provider,acquiredAt:new Date(now).toISOString(),staleAfterMinutes:staleMinutes,...(d.stale?{tookOverStale:{runId:d.stale.runId,provider:d.stale.provider,acquiredAt:d.stale.acquiredAt}}:{})};
  if(store.write(branch,head,file,lock,'acquire '+lane.key+' '+runId))return{result:'ACQUIRED',lane:lane.key,...(d.stale?{tookOverStale:lock.tookOverStale}:{})};
 }
 return{result:'BUSY',reason:'LOST_RACE',lane:lane.key};
}

if(require.main===module){
 const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k);return i>=0?args.splice(i,2)[1]:undefined;};
 const root=opt('--root'),remote=opt('--remote'),[action,taskKey,runId,provider]=args;
 try{
  if(!['acquire','release'].includes(action))throw Error('USAGE: acquire|release <TASK_KEY> <RUN_ID> <PROVIDER>');
  const r=run(action,taskKey,runId,provider,{...(root?{root:path.resolve(root)}:{}),...(remote?{remote}:{})});
  console.log(JSON.stringify(r));process.exitCode=r.result==='ACQUIRED'||r.result==='RELEASED'||r.result==='NOT_HELD'?0:r.result==='BUSY'?2:1;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={decide,run,gitRunner};
