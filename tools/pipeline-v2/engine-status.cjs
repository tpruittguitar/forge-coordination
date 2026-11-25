'use strict';
const fs=require('node:fs');
const path=require('node:path');
const S=require('./store.cjs');
const SCHEMA='forge.engine-status.v1';
const OUT=path.join(__dirname,'out','engine-status.json');
const STEPS=S.STEPS;
const readJson=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}};
const iso=v=>typeof v==='string'&&v&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const latest=arr=>arr.reduce((a,b)=>!a||Date.parse(b.at||'')>Date.parse(a.at||'')?b:a,null);
function statusFrom(rec){
 if(!rec)return {result:null,state:'idle',lastRunAt:null,nextRunAt:null,queue:null,queueDeltaPerHour:null,rateIn:null,rateOut:null};
 const last=rec.lastRun||{};
 return {
  result:typeof last.result==='string'?last.result:null,
  state:typeof last.result==='string'&&last.result==='PASS'?'ok':typeof last.result==='string'&&['SKIP','WAIT'].includes(last.result)?'degraded':typeof last.result==='string'&&['DROP','FAIL','BLOCKED'].includes(last.result)?'failed':'idle',
  lastRunAt:iso(last.finishedAt||last.startedAt),
  nextRunAt:null,
  queue:num(rec.queue&&rec.queue.waiting||0),
  queueDeltaPerHour:null,
  rateIn:num(rec.rateIn&&rec.rateIn.perHour),
  rateOut:num(rec.rateOut&&rec.rateOut.perHour)
 };
}
function writerFrom(statuses){
 const writer=statuses.filter(s=>s&&s.engine==='writer');
 const q=writer.map(s=>s.queue).find(v=>Number.isFinite(v));
 const last=latest(writer.map(s=>({at:s.lastRunAt||null})).filter(x=>x.at));
 return {queue:num(q),ratePerHour:null,lastWriteAt:last?last.at:null};
}
function build({stepsPath=path.join(__dirname,'steps.json'),statusDir=path.join(__dirname,'status')}={}){
 const steps=JSON.parse(fs.readFileSync(stepsPath,'utf8')).steps;
 const records=steps.map(s=>({step:s,status:readJson(path.join(statusDir,s.id+'-'+s.slug+'.json'))}));
 const built=records.map(({step:s,status:rec})=>({id:s.id,n:s.id,name:s.name,stage:s.stage.toUpperCase(),method:s.method,runsAs:s.engine||null,schedule:s.schedule||null,rateIn:null,rateOut:null,queue:null,queueDeltaPerHour:null,lastRunAt:null,nextRunAt:null,result:null,state:'idle',...statusFrom(rec)}));
 const envelope={schema:SCHEMA,at:new Date().toISOString(),steps:built,writer:writerFrom(built),readyForDecision:{count:null,applied:null,declined:null}};
 return envelope;
}
function write(feed=build(),out=OUT){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(feed,null,1)+'\n');return feed;}
if(require.main===module)write();
module.exports={SCHEMA,OUT,build,write};
