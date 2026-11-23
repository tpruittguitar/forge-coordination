'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='control/ENRICHMENT_WORKER_PARTITION.json',SOURCE='a1e2b300e063764faac242364e009cd8a3b72987';
const TASK='FORGE_CHATGPT_ENRICHMENT_RESEARCH',SIZE=1582;
const DIGEST='9015b370ced0fbd997b0eafa992cefcc1db927cb0117ed6a4bf18fa5fb34c082';
function validate(x){
  const [h,a]=x?.workers||[];
  if(x?.schema!=='forge.enrichment-worker-partition.v1'||x.sourceCommit!==SOURCE||
    x.sourcePath!=='state/PIPELINE_WAITING_QUEUES.json'||x.workers.length!==2||h?.provider!=='Hermes'||
    a?.provider!=='ChatGPT'||a.taskKey!==TASK||a.execution!=='API_GRANT'||
    ![h,a].every(w=>Array.isArray(w.primaryIds)&&w.primaryIds.length===SIZE))
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  const ids=[...h.primaryIds,...a.primaryIds];
  if(!ids.every((v,i)=>typeof v==='string'&&/^V2I-[0-9A-F]{12}$/.test(v)&&(i===0||ids[i-1]<v))||
    h.primaryIds.at(-1)!=='V2I-7E12B5B75B52'||a.primaryIds[0]!=='V2I-7E2E8E0559E8'||
    crypto.createHash('sha256').update(ids.join('\n')+'\n').digest('hex')!==DIGEST)
    throw Error('AUTHORITATIVE_WORKER_PARTITION_INVALID');
  return {sourceCommit:SOURCE,hermes:new Set(h.primaryIds),api:new Set(a.primaryIds)};
}
function load(root){return validate(JSON.parse(fs.readFileSync(path.join(root,FILE),'utf8')));}
function atsReserved(partition,{grant=false,independent=[]}={}){
  return new Set([...partition.hermes,...(grant?[]:partition.api),...independent]);
}
module.exports={FILE,SOURCE,TASK,validate,load,atsReserved};
