'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {publish}=require('./git-publish');
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
function repo(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'git-publish-')),root=path.join(base,'work'),bare=path.join(base,'origin.git');
 fs.mkdirSync(root);git(root,'init','-b','main');git(root,'config','user.name','test');git(root,'config','user.email','test@example.test');
 fs.writeFileSync(path.join(root,'README'),'init\n');git(root,'add','README');git(root,'commit','-m','init');
 git(base,'clone','-q','--bare',root,bare);git(root,'remote','add','origin',bare);
 return {base,root,bare};
}
test('publish commits listed paths and skips a clean tree',()=>{
 const {base,root}=repo();
 try{
  fs.mkdirSync(path.join(root,'state'));fs.writeFileSync(path.join(root,'state/WRITER_ACTIVITY.json'),'{"ok":1}\n');
  const first=publish(root,['state/WRITER_ACTIVITY.json'],'cheap',{push:false});
  assert.equal(first.changed,true);assert.match(git(root,'log','-1','--pretty=%s'),/cheap/);
  const again=publish(root,['state/WRITER_ACTIVITY.json'],'cheap',{push:false});
  assert.equal(again.changed,false);
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('publish pushes to origin and retries after a rejected first push',()=>{
 const {base,root,bare}=repo();
 try{
  fs.mkdirSync(path.join(root,'state'));fs.writeFileSync(path.join(root,'state/WRITER_ACTIVITY.json'),'{"ok":1}\n');
  const dest=path.join(base,'race');git(base,'clone','-q',bare,dest);git(dest,'config','user.name','test');git(dest,'config','user.email','test@example.test');
  fs.writeFileSync(path.join(dest,'other.txt'),'race\n');git(dest,'add','other.txt');git(dest,'commit','-m','race');git(dest,'push','-q','origin','HEAD:main');
  const result=publish(root,['state/WRITER_ACTIVITY.json'],'cheap',{retries:3,sleep:()=>{},push:true});
  assert.equal(result.pushed,true);assert.equal(result.attempts,2);
  const msgs=git(bare,'log','--pretty=%s').trim().split(/\n/);
  assert.ok(msgs.includes('cheap'));assert.ok(msgs.includes('race'));
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('when rebase conflicts, publish resets to origin/main, replays the files, and pushes',()=>{
 const {base,root,bare}=repo();
 try{
  fs.mkdirSync(path.join(root,'state'));fs.writeFileSync(path.join(root,'state/WRITER_ACTIVITY.json'),'{"ok":1}\n');
  const dest=path.join(base,'race');git(base,'clone','-q',bare,dest);git(dest,'config','user.name','test');git(dest,'config','user.email','test@example.test');
  fs.mkdirSync(path.join(dest,'state'));fs.writeFileSync(path.join(dest,'state/WRITER_ACTIVITY.json'),'{"race":1}\n');git(dest,'add','state/WRITER_ACTIVITY.json');git(dest,'commit','-m','race');git(dest,'push','-q','origin','HEAD:main');
  const result=publish(root,['state/WRITER_ACTIVITY.json'],'cheap',{retries:3,sleep:()=>{},push:true});
  assert.equal(result.pushed,true);assert.ok(result.attempts>=2);
  const tip=git(bare,'show','HEAD:state/WRITER_ACTIVITY.json');
  assert.match(tip,/"ok":1/);
  const msgs=git(bare,'log','--pretty=%s').trim().split(/\n/);
  assert.ok(msgs.includes('cheap'));assert.ok(msgs.includes('race'));
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('intake publication and its cursor cannot rebase across or overwrite a worksheet deletion',()=>{
 const {base,root,bare}=repo();
 const ledger='state/UPSTREAM_LEDGER.json',cursor='state/UPSTREAM_COLLECT_CURSOR.json',queue='state/waiting-queues/intake-0001.json';
 const write=(dir,name,value)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value)+'\n');};
 const dest=path.join(base,'worksheet');
 try{
  write(root,ledger,{status:'WAITING'});write(root,queue,{items:['posting']});
  git(root,'add','state');git(root,'commit','-m','initial queue');git(root,'push','-q','origin','HEAD:main');
  git(base,'clone','-q',bare,dest);git(dest,'config','user.name','test');git(dest,'config','user.email','test@example.test');
  const deleted={status:'EXCLUDED',worksheetDeletion:{receiptId:'confirmed-receipt'}};
  write(dest,ledger,deleted);write(dest,queue,{items:[]});
  git(dest,'add','state');git(dest,'commit','-m','worksheet deletion');git(dest,'push','-q','origin','HEAD:main');
  const fresh=git(bare,'rev-parse','HEAD');
  assert.throws(()=>publish(root,[path.join(base,cursor)],'outside checkout'),/inside the repository/);
  write(root,cursor,{offset:1});
  assert.throws(()=>publish(root,[path.join(root,cursor)],'stale cursor',{retries:4}),/rejected/);
  assert.notEqual(git(root,'rev-parse','HEAD^'),fresh,'cursor must not advance HEAD over a stale calculation');
  write(root,ledger,{status:'WAITING',checked:true});write(root,queue,{items:['posting']});
  assert.throws(()=>publish(root,[ledger,'state/waiting-queues'],'stale intake',{retries:4}),/rejected/);
  assert.equal(git(bare,'rev-parse','HEAD'),fresh);
  assert.deepEqual(JSON.parse(git(bare,'show','HEAD:'+ledger)),deleted);
  git(root,'fetch','origin','main');git(root,'reset','--hard','FETCH_HEAD');
  const preserved=JSON.parse(fs.readFileSync(path.join(root,ledger),'utf8'));
  assert.deepEqual(preserved,deleted);
  write(root,ledger,{...preserved,checked:true});write(root,queue,{items:[]});
  assert.equal(publish(root,[ledger,'state/waiting-queues'],'fresh calculation',{retries:4}).attempts,1);
  assert.deepEqual(JSON.parse(git(bare,'show','HEAD:'+queue)),{items:[]});
  assert.deepEqual(JSON.parse(git(bare,'show','HEAD:'+ledger)).worksheetDeletion,deleted.worksheetDeletion);
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('only a completed flow can retarget once across non-input commits; real input writes stay fenced',()=>{
 const flow=['state/UPSTREAM_LEDGER.json','state/UPSTREAM_FLOW.json','state/ENRICHMENT_FLOW.json','state/PIPELINE_WAITING_QUEUES.json','state/waiting-queues','state/upstream-ledger-archive','state/INTAKE_DRAIN.json','state/intake-drain-archive','state/UPSTREAM_COLLECT_CURSOR.json'];
 const ledger=flow[0],usage='usage/AI_USAGE_READINGS.jsonl',display='control/OFFICE_STATUS.json';
 // [extra file committed on main during the build, whether it is a real flow input]
 for(const [forbidden,fenced] of [[null,false],['state/AUTOMATION_EXECUTION_EVIDENCE.json',false],['reference/EMPLOYER_PAY_SOURCES.json',false],['verify/recovery/latest.json',false],['receipts/live-backlog/new.json',true],['state/UPSTREAM_COLLECT_CURSOR.json',true]]){
  const {base,root,bare}=repo(),race=path.join(base,'race');
  const put=(dir,file,body)=>{const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);};
  try{
   put(root,ledger,JSON.stringify('old ledger'));put(root,'state/waiting-queues/intake-0001.json','old page');git(root,'add','state');git(root,'commit','-m','flow base');git(root,'push','-q','origin','HEAD:main');
   git(base,'clone','-q',bare,race);git(race,'config','user.name','test');git(race,'config','user.email','test@example.test');
   put(race,usage,'fresh usage');put(race,display,'fresh display');if(forbidden)put(race,forbidden,'new source');
   git(race,'add','-A');git(race,'commit','-m','new main');git(race,'push','-q','origin','HEAD:main');
   const newer=git(bare,'rev-parse','HEAD').trim();
   assert.throws(()=>publish(root,[flow.at(-1)],'cursor',{allowFlowStatusReparent:true}),/complete flow/);
   put(root,ledger,JSON.stringify('fresh ledger'));fs.rmSync(path.join(root,'state/waiting-queues/intake-0001.json'));put(root,'state/waiting-queues/intake-0002.json','new page');
   if(fenced){
    assert.throws(()=>publish(root,flow,'finished',{allowFlowStatusReparent:true}),/Flow inputs changed/);
    assert.equal(git(bare,'rev-parse','HEAD').trim(),newer);
   }else{
    const result=publish(root,flow,'finished',{allowFlowStatusReparent:true});
    assert.equal(result.reparented,true);assert.equal(result.attempts,1);
    assert.equal(git(bare,'rev-parse','HEAD^').trim(),newer);
    assert.equal(git(bare,'show','HEAD:'+usage),'fresh usage');
    assert.equal(git(bare,'show','HEAD:'+display),'fresh display');
    if(forbidden)assert.equal(git(bare,'show','HEAD:'+forbidden),'new source');
    assert.equal(JSON.parse(git(bare,'show','HEAD:'+ledger)),'fresh ledger');
    assert.equal(git(bare,'show','HEAD:state/waiting-queues/intake-0002.json'),'new page');
    assert.throws(()=>git(bare,'cat-file','-e','HEAD:state/waiting-queues/intake-0001.json'));
   }
  }finally{fs.rmSync(base,{recursive:true,force:true});}
 }
});

test('CLI parses --allow-status-only-reparent, keeps it out of paths, and leaves the default off',()=>{
 const {base,root}=repo();
 const script=path.join(__dirname,'git-publish.js');
 const cli=(args)=>{try{return {status:0,stdout:execFileSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}),stderr:''};}catch(e){return {status:e.status,stdout:e.stdout||'',stderr:String(e.stderr||'')}};};
 try{
  fs.writeFileSync(path.join(root,'--allow-status-only-reparent'),'not a flag\n');
  const off=cli(['--no-push']);
  assert.equal(off.status,0,off.stderr);
  assert.equal(git(root,'status','--porcelain').trim(),'?? --allow-status-only-reparent');
  const on=cli(['--allow-status-only-reparent','--no-push']);
  assert.notEqual(on.status,0);
  assert.match(on.stderr,/complete flow/);
  assert.equal(git(root,'status','--porcelain').trim(),'?? --allow-status-only-reparent');
  const mixed=cli(['--no-push','--allow-status-only-reparent','--allow-status-only-reparent']);
  assert.notEqual(mixed.status,0);
  assert.match(mixed.stderr,/complete flow/);
  assert.equal(git(root,'status','--porcelain').trim(),'?? --allow-status-only-reparent');
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('publication stages each inventory, its manifest and shards as one group',()=>{
 const {base,root}=repo(),Store=require('../upstream-ledger/store.cjs');
 try{
  const item={key:'one',firstSeen:'2026-11-03',detail:{history:['old']}};
  Store.writeLedger(root,{entries:{one:{...item,status:'EXCLUDED'}}});
  Store.writeDrain(root,{items:{one:{...item,status:'ACCOUNTED_UPSTREAM'}}});
  publish(root,[Store.LEDGER_PATH,Store.DRAIN_ARCHIVE+'/manifest.json'],'split inventory',{push:false});
  const paths=git(root,'diff-tree','--no-commit-id','--name-only','-r','HEAD').trim().split('\n');
  assert.deepEqual(paths.sort(),[
   Store.LEDGER_PATH,Store.DRAIN_PATH,
   ...[Store.LEDGER_ARCHIVE,Store.DRAIN_ARCHIVE].flatMap(dir=>[dir+'/manifest.json',dir+'/2026-11-03.json'])
  ].sort());

  fs.appendFileSync(path.join(root,Store.DRAIN_ARCHIVE,'2026-11-03.json'),' ');
  assert.throws(()=>publish(root,[Store.DRAIN_ARCHIVE],'broken snapshot',{push:false}),/sha256 mismatch/);
  assert.equal(git(root,'log','-1','--pretty=%s').trim(),'split inventory');

  Store.writeDrain(root,{items:{one:{...item,status:'ACTION_REQUIRED'}}});
  fs.rmdirSync(path.join(root,Store.DRAIN_ARCHIVE));
  publish(root,[Store.DRAIN_PATH],'reopen inventory',{push:false});
  assert.throws(()=>git(root,'cat-file','-e','HEAD:'+Store.DRAIN_ARCHIVE+'/manifest.json'));
  assert.equal(JSON.parse(git(root,'show','HEAD:'+Store.DRAIN_PATH)).items.one.detail.history[0],'old');
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});

// Forces the reparent push (<sha>:refs/heads/main) to lose a real race RACE_MAX times: before each such push,
// a shim moves origin main with a non-input commit, so git returns a genuine "[rejected] (fetch first)".
function raceFlow(raceMax,opts){
 const flow=['state/UPSTREAM_LEDGER.json','state/UPSTREAM_FLOW.json','state/ENRICHMENT_FLOW.json','state/PIPELINE_WAITING_QUEUES.json','state/waiting-queues','state/upstream-ledger-archive','state/INTAKE_DRAIN.json','state/intake-drain-archive','state/UPSTREAM_COLLECT_CURSOR.json'];
 const ledger=flow[0],usage='usage/AI_USAGE_READINGS.jsonl';
 const {base,root,bare}=repo(),race=path.join(base,'race'),bin=path.join(base,'bin'),count=path.join(base,'count');
 const put=(dir,file,body)=>{const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);};
 const realGit=execFileSync('sh',['-c','command -v git'],{encoding:'utf8'}).trim();
 fs.mkdirSync(bin);
 fs.writeFileSync(path.join(bin,'git'),`#!/bin/sh
if [ "$1" = push ]; then case "$3" in *:refs/heads/main)
 n=$(cat "$RACE_COUNT" 2>/dev/null || echo 0)
 if [ "$n" -lt "$RACE_MAX" ]; then echo $((n+1)) > "$RACE_COUNT"
  ( cd "$RACE_DIR" && "$REAL_GIT" fetch -q origin && "$REAL_GIT" reset -q --hard origin/main && echo "race $n" > usage/race.txt && "$REAL_GIT" add -A && "$REAL_GIT" -c user.name=t -c user.email=t@t commit -qm "race $n" && "$REAL_GIT" push -q origin HEAD:main ) >/dev/null 2>&1
 fi;; esac; fi
exec "$REAL_GIT" "$@"
`,{mode:0o755});
 const saved={PATH:process.env.PATH};
 try{
  put(root,ledger,JSON.stringify('old ledger'));put(root,'state/waiting-queues/intake-0001.json','old page');git(root,'add','state');git(root,'commit','-m','flow base');git(root,'push','-q','origin','HEAD:main');
  git(base,'clone','-q',bare,race);git(race,'config','user.name','test');git(race,'config','user.email','test@example.test');
  put(race,usage,'fresh usage');git(race,'add','-A');git(race,'commit','-m','new main');git(race,'push','-q','origin','HEAD:main');
  put(root,ledger,JSON.stringify('fresh ledger'));fs.rmSync(path.join(root,'state/waiting-queues/intake-0001.json'));put(root,'state/waiting-queues/intake-0002.json','new page');
  Object.assign(process.env,{PATH:bin+path.delimiter+saved.PATH,REAL_GIT:realGit,RACE_DIR:race,RACE_COUNT:count,RACE_MAX:String(raceMax)});
  let result,error;
  try{result=publish(root,flow,'finished',{allowFlowStatusReparent:true,retries:4,sleep:()=>{},...opts});}catch(e){error=e;}
  process.env.PATH=saved.PATH;
  return {result,error,bare,ledger,usage,races:Number(fs.readFileSync(count,'utf8').trim()),cleanup:()=>fs.rmSync(base,{recursive:true,force:true})};
 }catch(e){fs.rmSync(base,{recursive:true,force:true});throw e;}
 finally{process.env.PATH=saved.PATH;for(const k of ['REAL_GIT','RACE_DIR','RACE_COUNT','RACE_MAX'])delete process.env[k];}
}
test('flow reparent refetches and retries after the reparent push loses a race',()=>{
 const r=raceFlow(2);
 try{
  assert.equal(r.error,undefined);
  assert.equal(r.races,2);assert.equal(r.result.reparented,true);assert.equal(r.result.attempts,3);
  assert.equal(git(r.bare,'log','-1','--pretty=%s','HEAD^').trim(),'race 1');
  assert.equal(git(r.bare,'show','HEAD:'+r.usage),'fresh usage');
  assert.equal(git(r.bare,'show','HEAD:usage/race.txt'),'race 1\n');
  assert.equal(JSON.parse(git(r.bare,'show','HEAD:'+r.ledger)),'fresh ledger');
  assert.equal(git(r.bare,'show','HEAD:state/waiting-queues/intake-0002.json'),'new page');
 }finally{r.cleanup();}
});
test('flow reparent gives up after 4 rejected attempts and leaves origin at the racing commit',()=>{
 const r=raceFlow(99);
 try{
  assert.match(String(r.error&&r.error.message),/after 4 attempts/);
  assert.equal(r.races,4);
  assert.equal(git(r.bare,'log','-1','--pretty=%s').trim(),'race 3');
  assert.equal(JSON.parse(git(r.bare,'show','HEAD:'+r.ledger)),'old ledger');
 }finally{r.cleanup();}
});
