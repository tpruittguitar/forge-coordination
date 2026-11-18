'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const DEFAULT_MESSAGE='ACTIVITY-BOT: publish compact verified receipt activity';
function run(root,args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
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
 if(missing.length)try{run(root,['add','-A','--',...missing]);}catch{}
 let changed=false;try{run(root,['diff','--cached','--quiet']);}catch{run(root,['commit','-m',message]);changed=true;}
 return changed;
}
function publish(root,paths,message=DEFAULT_MESSAGE,{retries=4,sleep,push=true,ref='HEAD:main'}={}){
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
 const argv=process.argv.slice(2),paths=[];let message=DEFAULT_MESSAGE;
 for(let i=0;i<argv.length;i++){if(argv[i]==='--message'){message=argv[++i];continue;}if(argv[i]==='--no-push'){process.env.GIT_PUBLISH_NO_PUSH='1';continue;}paths.push(argv[i]);}
 try{const result=publish(process.cwd(),paths,message,{push:process.env.GIT_PUBLISH_NO_PUSH!=='1'});if(result.changed)console.log(result.pushed?'Published':'Committed');process.exitCode=0;}
 catch(e){console.error(e.stderr||e.message);process.exitCode=1;}
}
module.exports={publish,present,DEFAULT_MESSAGE};
