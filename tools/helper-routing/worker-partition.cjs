'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='control/ENRICHMENT_WORKER_PARTITION.json',SOURCE='a1e2b300e063764faac242364e009cd8a3b72987';
const TASK='FORGE_CHATGPT_ENRICHMENT_RESEARCH';
const LOCKED_HERMES_SIZE=369,LOCKED_API_SIZE=371;
const LOCKED_DIGEST='74dd4ea55221c00ec562ba4e3ce3400ca49d294a6561fca11cd5e8a0cad5d22e';
const LOCKED_HERMES_LAST='V2I-7D68816459DB',LOCKED_API_FIRST='V2I-7F045C7BC2A3';
// HERMES_SIZE / API_SIZE / DIGEST remain the frozen allowed set (PR #553), not the live list lengths.
const HERMES_SIZE=LOCKED_HERMES_SIZE,API_SIZE=LOCKED_API_SIZE,DIGEST=LOCKED_DIGEST;
function digestOf(ids){return crypto.createHash('sha256').update(ids.join('\n')+'\n').digest('hex');}
function validateIds(ids){
  return Array.isArray(ids)&&ids.every((v,i)=>typeof v==='string'&&/^V2I-[0-9A-F]{12}$/.test(v)&&(i===0||ids[i-1]<v))&&new Set(ids).size===ids.length;
}
function validate(x){
  const [h,a]=x?.workers||[],lock=x?.lock;
  if(x?.schema!=='forge.enrichment-worker-partition.v1'||x.sourceCommit!==SOURCE||
    x.sourcePath!=='state/PIPELINE_WAITING_QUEUES.json'||!Array.isArray(x.workers)||x.workers.length!==2||
    h?.provider!=='Hermes'||a?.provider!=='ChatGPT'||a.taskKey!==TASK||a.execution!=='API_GRANT'||
    !Array.isArray(h.primaryIds)||!Array.isArray(a.primaryIds)||
    !Array.isArray(lock?.hermes)||!Array.isArray(lock?.chatgpt)||
    lock.hermes.length!==LOCKED_HERMES_SIZE||lock.chatgpt.length!==LOCKED_API_SIZE)
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  const locked=[...lock.hermes,...lock.chatgpt];
  if(!validateIds(locked)||lock.hermes.at(-1)!==LOCKED_HERMES_LAST||lock.chatgpt[0]!==LOCKED_API_FIRST||digestOf(locked)!==LOCKED_DIGEST)
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  const ids=[...h.primaryIds,...a.primaryIds],lockH=new Set(lock.hermes),lockA=new Set(lock.chatgpt);
  if(!validateIds(ids)||h.primaryIds.some(id=>!lockH.has(id))||a.primaryIds.some(id=>!lockA.has(id)))
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  return {sourceCommit:SOURCE,hermes:new Set(h.primaryIds),api:new Set(a.primaryIds),lockedHermes:lockH,lockedApi:lockA};
}
function load(root){return validate(JSON.parse(fs.readFileSync(path.join(root,FILE),'utf8')));}
function prune(x,dropIds){
  const drop=new Set(dropIds);
  const next={...x,lock:x.lock,workers:x.workers.map(w=>({...w,primaryIds:w.primaryIds.filter(id=>!drop.has(id))}))};
  validate(next);
  return next;
}
function write(root,x){
  validate(x);
  fs.writeFileSync(path.join(root,FILE),JSON.stringify(x)+'\n');
}
function atsReserved(partition,{grant=false,independent=[]}={}){
  // ChatGPT's half is released (cs-0170c263). Skip those IDs only when independently reserved.
  // Hermes's half stays reserved. `grant` is kept for callers.
  return new Set([...partition.hermes,...independent]);
}
module.exports={FILE,SOURCE,TASK,HERMES_SIZE,API_SIZE,DIGEST,LOCKED_HERMES_SIZE,LOCKED_API_SIZE,LOCKED_DIGEST,LOCKED_HERMES_LAST,LOCKED_API_FIRST,validate,load,prune,write,atsReserved};
