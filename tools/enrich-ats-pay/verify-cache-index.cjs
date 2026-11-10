'use strict';
// Fail publication before commit if Git attributes/staging changed cache bytes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const Store=require('./employer-cache-store');
const CACHE='state/enrich-ats-pay-employer.json';
function verify(cwd=path.resolve(__dirname,'../..')){
 function staged(relative,maxBytes){
  const entry=cp.execFileSync('git',['ls-files','--stage','-z','--',relative],{cwd,encoding:'utf8',maxBuffer:4096});
  const match=/^(100644|100755) ([a-f0-9]{40,64}) 0\t([^\0]+)\0$/.exec(entry);
  if(!match||match[3]!==relative)throw Error('Missing, unmerged or non-file staged cache entry: '+relative);
  const size=Number(cp.execFileSync('git',['cat-file','-s',match[2]],{cwd,encoding:'utf8'}).trim());
  if(!Number.isSafeInteger(size)||size<1||size>maxBytes)throw Error('Staged cache entry exceeds publication bound: '+relative);
  return cp.execFileSync('git',['cat-file','blob',match[2]],{cwd,maxBuffer:maxBytes});
 }
 const bytes=staged(CACHE,100*1024*1024),manifest=JSON.parse(bytes.toString('utf8'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-index-verify-')),file=path.join(dir,'employer.json');
 try{
  fs.writeFileSync(file,bytes);
  if(manifest?.schema===Store.SCHEMA){
   if(!Array.isArray(manifest.parts))throw Error('Invalid staged employer cache manifest');
   fs.mkdirSync(Store.partsDir(file));
   for(const part of manifest.parts){
    if(!/^[a-f0-9]{64}\.json\.gz$/.test(part?.file||''))throw Error('Invalid staged employer cache part reference');
    fs.writeFileSync(path.join(Store.partsDir(file),part.file),staged('state/enrich-ats-pay-employer.parts/'+part.file,Store.MAX_FILE_BYTES));
   }
  }
  const restored=Store.read(file);
  return {parts:manifest?.schema===Store.SCHEMA?manifest.parts.length:0,observations:Object.keys(restored.postingEvidence||{}).length};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module){try{console.log(JSON.stringify({verifiedStagedEmployerCache:true,...verify()}));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={verify};
