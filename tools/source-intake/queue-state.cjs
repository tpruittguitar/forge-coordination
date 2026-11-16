'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const supported=new Set(['state/INTAKE_DRAIN.json','state/RELEVANCE_SCREEN_GUARD.json']);
function sides(raw){
 const out=[[],[]];let mode='common',conflicts=0;
 for(const line of raw.split('\n')){
  if(/^<<<<<<< /.test(line)&&mode==='common'){mode='ours';conflicts++;}
  else if(/^\|{7} /.test(line)&&mode==='ours')mode='base';
  else if(line==='======='&&(mode==='ours'||mode==='base'))mode='theirs';
  else if(/^>>>>>>> /.test(line)&&mode==='theirs')mode='common';
  else if(mode==='common'){out[0].push(line);out[1].push(line);}
  else if(mode==='ours')out[0].push(line);
  else if(mode==='theirs')out[1].push(line);
 }
 if(!conflicts||mode!=='common')throw Error('INVALID_QUEUE_CONFLICT');
 return out.map(lines=>JSON.parse(lines.join('\n')));
}
function read(root,file,fallback){
 let raw;try{raw=fs.readFileSync(path.join(root,file),'utf8');}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return structuredClone(fallback);throw e;}
 try{return JSON.parse(raw);}catch(e){if(!supported.has(file)||!/^<<<<<<< /m.test(raw))throw e;}
 const [ours,theirs]=sides(raw),sha=crypto.createHash('sha256').update(raw).digest('hex');
 // Union text can corrupt JSON or drop Writer fences. Audit both sides, then
 // fail open for unrelated intake while holding disputed items for reconciliation.
 const audit=path.join(root,'receipts/auto-intake/state-conflicts',sha+'.json');
 fs.mkdirSync(path.dirname(audit),{recursive:true});
 try{fs.writeFileSync(audit,JSON.stringify({file,sha256:sha,raw})+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 if(file==='state/RELEVANCE_SCREEN_GUARD.json')return{mergeConflict:sha};
 if(!ours.items||!theirs.items)throw Error('INVALID_DRAIN_CONFLICT');
 const items={...ours.items,...theirs.items};
 for(const key of Object.keys(items)){
  const a=ours.items[key],b=theirs.items[key];
  if(JSON.stringify(a)===JSON.stringify(b))continue;
  const item={...a,...b,key,aliases:[...new Set([key,...a?.aliases||[],...b?.aliases||[]])],status:'INVENTORY_RECONCILIATION_REQUIRED',sourceConflict:'QUEUE_MERGE_CONFLICT'};
  if(a?.fence||b?.fence)item.fence={...a?.fence,...b?.fence,requestIds:[...new Set([...a?.fence?.requestIds||[],...b?.fence?.requestIds||[]])]};
  items[key]=item;
 }
 return{...ours,...theirs,items,mergeConflict:sha};
}
module.exports={read};
