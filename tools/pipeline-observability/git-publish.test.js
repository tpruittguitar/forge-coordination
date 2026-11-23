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
