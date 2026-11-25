'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='control/ENRICHMENT_WORKER_PARTITION.json',SOURCE='a1e2b300e063764faac242364e009cd8a3b72987';
const TASK='FORGE_CHATGPT_ENRICHMENT_RESEARCH',HERMES_SIZE=369,API_SIZE=371;
const DIGEST='74dd4ea55221c00ec562ba4e3ce3400ca49d294a6561fca11cd5e8a0cad5d22e';
function validate(x){
  const [h,a]=x?.workers||[];
  if(x?.schema!=='forge.enrichment-worker-partition.v1'||x.sourceCommit!==SOURCE||
    x.sourcePath!=='state/PIPELINE_WAITING_QUEUES.json'||x.workers.length!==2||h?.provider!=='Hermes'||
    a?.provider!=='ChatGPT'||a.taskKey!==TASK||a.execution!=='API_GRANT'||
    !Array.isArray(h.primaryIds)||!Array.isArray(a.primaryIds)||h.primaryIds.length!==HERMES_SIZE||a.primaryIds.length!==API_SIZE)
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  const ids=[...h.primaryIds,...a.primaryIds];
  if(!ids.every((v,i)=>typeof v==='string'&&/^V2I-[0-9A-F]{12}$/.test(v)&&(i===0||ids[i-1]<v))||
    h.primaryIds.at(-1)!=='V2I-7D68816459DB'||a.primaryIds[0]!=='V2I-7F045C7BC2A3'||
    crypto.createHash('sha256').update(ids.join('\n')+'\n').digest('hex')!==DIGEST)
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  return {sourceCommit:SOURCE,hermes:new Set(h.primaryIds),api:new Set(a.primaryIds)};
}
function load(root){return validate(JSON.parse(fs.readFileSync(path.join(root,FILE),'utf8')));}
function atsReserved(partition,{grant=false,independent=[]}={}){
  // ChatGPT's half is released (cs-0170c263). Skip those IDs only when independently reserved.
  // Hermes's half stays reserved. `grant` is kept for callers.
  return new Set([...partition.hermes,...independent]);
}
module.exports={FILE,SOURCE,TASK,HERMES_SIZE,API_SIZE,validate,load,atsReserved};
