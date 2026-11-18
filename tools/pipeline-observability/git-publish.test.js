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
