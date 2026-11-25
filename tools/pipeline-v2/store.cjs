'use strict';
// File store for pipeline v2: one JSON file per job, one queue file per engine, one status
// record per step. Plain files so every engine runs, retries and reports on its own.
const fs=require('node:fs'),path=require('node:path');
const STEPS=require('./steps.json').steps;
const step=id=>{const s=STEPS.find(x=>x.id===id);if(!s)throw Error('UNKNOWN_STEP '+id);return s;};
function readJson(f,d){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return d;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=f+'.tmp-'+process.pid;fs.writeFileSync(t,JSON.stringify(v,null,1)+'\n');fs.renameSync(t,f);}
function open(dir){
 const jobsDir=path.join(dir,'jobs');
 return {
  dir,
  getJob:id=>readJson(path.join(jobsDir,id+'.json'),null),
  putJob:j=>writeJson(path.join(jobsDir,j.id+'.json'),j),
  jobs:()=>fs.existsSync(jobsDir)?fs.readdirSync(jobsDir).filter(f=>f.endsWith('.json')).sort().map(f=>readJson(path.join(jobsDir,f),null)).filter(Boolean):[],
  queue:engine=>readJson(path.join(dir,'queues',engine+'.json'),{schema:'forge.pipeline-v2.queue.v1',engine,items:[]}),
  putQueue:(engine,q)=>writeJson(path.join(dir,'queues',engine+'.json'),q),
  status:id=>readJson(path.join(dir,'status',id+'-'+step(id).slug+'.json'),null),
  putStatus:rec=>writeJson(path.join(dir,'status',rec.step+'-'+step(rec.step).slug+'.json'),rec)
 };
}
// A field counts as filled only with a recorded source; engines skip filled fields.
const filled=(job,k)=>!!(job.fields&&job.fields[k]&&job.fields[k].source&&job.fields[k].value!==undefined&&job.fields[k].value!==null&&job.fields[k].value!=='');
function setField(job,k,value,source,at){job.fields=job.fields||{};job.fields[k]={value,source,at};}
module.exports={STEPS,step,open,readJson,writeJson,filled,setField};
