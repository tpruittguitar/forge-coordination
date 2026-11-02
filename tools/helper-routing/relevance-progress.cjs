'use strict';
const fs=require('node:fs'),path=require('node:path');
function completed(root,w,validate){
  const keys=new Set(),dir=path.join(root,'receipts/CLAUDE_RELEVANCE');
  if(!fs.existsSync(dir))return keys;
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
    const b=JSON.parse(fs.readFileSync(path.join(dir,name)));
    if(b.assignmentId!==w.assignmentId)continue;
    validate(b,w);for(const i of b.items)if(i.recommendation!=='SOURCE_BLOCKED')keys.add(i.key);
  }
  return keys;
}
function handoffs(w){
  for(const [key,h] of Object.entries(w.coordinatorHandoffs||{})){
    if(!w.keys.includes(key)||h.owner!=='ChatGPT'||!h.reason||!h.proof||!Number.isFinite(Date.parse(h.at)))throw Error('Invalid coordinator handoff');
  }
  return w.coordinatorHandoffs||{};
}
function next(root,w,validate,start=1){
  if(!Number.isInteger(start)||start<1||start>w.pages.length)throw Error('Unknown page; do not restart');
  const done=completed(root,w,validate),owned=handoffs(w);
  for(let n=start;n<=w.pages.length;n++){
    const p=JSON.parse(fs.readFileSync(path.join(root,w.pages[n-1].path)));
    const items=p.items.filter(i=>!done.has(i.key)&&!owned[i.key]);
    if(items.length)return {...p,items,page:n,pagePath:w.pages[n-1].path,publishedKeys:p.items.filter(i=>done.has(i.key)).map(i=>i.key),coordinatorOwnedKeys:p.items.filter(i=>owned[i.key]).map(i=>i.key),pageComplete:false};
  }
  return {assignmentId:w.assignmentId,items:[],helperResearchExhausted:true,assignmentComplete:false,reason:'All helper keys have published evidence or explicit coordinator ownership; canonical completion is not inferred'};
}
function checkpoint(root,w,validate,b){
  validate(b,w);const done=completed(root,w,validate),owned=handoffs(w);
  for(const i of b.items){
    if(owned[i.key])throw Error('Coordinator-owned key; do not duplicate research');
    if(done.has(i.key))throw Error('Already published key; reuse immutable evidence');
    if(!['INTAKE_READY','RETAIN_RANKED','FUNCTION_MISMATCH_PROPOSAL','NC_PROPOSAL','EXISTING_MATCH_CANDIDATE'].includes(i.recommendation))throw Error('Blocked access alone is not a completed relevance result');
  }
  if(!/^CLAUDE-RELEVANCE-[A-Za-z0-9_-]+$/.test(b.runId))throw Error('Unsafe run ID');
  const rel='receipts/CLAUDE_RELEVANCE/'+b.runId+'.json',dest=path.join(root,rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(b,null,2)+'\n',{flag:'wx'});
  return {saved:rel,items:b.items.length,submitted:0,verified:0,publishRequired:true};
}
module.exports={completed,handoffs,next,checkpoint};
