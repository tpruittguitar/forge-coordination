'use strict';
// Status record each step publishes after every run: rate in, rate out, queue, last run, result, next run.
const {step}=require('./store.cjs');
const SCHEMA='forge.pipeline-v2.status.v1';
const OUT=['PASS','SKIP'];
function blank(){return {in:0,pass:0,skip:0,drop:0,hold:0,wait:0,blocked:0,fail:0,parked:0};}
function result(c){
 if(c.in===0&&c.wait===0&&c.blocked===0)return 'IDLE';
 if(c.fail>0&&c.pass+c.skip===0)return 'FAILED';
 if(c.blocked>0||c.fail>0||c.parked>0)return 'DEGRADED';
 if(c.in>0&&c.pass===0&&c.skip>0&&c.drop+c.hold===0)return 'NOT_NEEDED';
 return 'OK';
}
function build(id,{counts,reasons={},queue={waiting:0,retrying:0,parked:0},startedAt,finishedAt,previous=null,dryRun=true,notes=[]}){
 const s=step(id),hist=(previous&&Array.isArray(previous.history)?previous.history:[]).concat([{at:finishedAt,in:counts.in,out:counts.pass+counts.skip}]).slice(-48);
 const since=Date.parse(finishedAt)-3600000,recent=hist.filter(h=>Date.parse(h.at)>=since);
 const sum=k=>recent.reduce((a,h)=>a+(h[k]||0),0);
 return {
  schema:SCHEMA,step:s.id,name:s.name,stage:s.stage,method:s.method,engine:s.engine,dryRun,
  schedule:{cron:s.schedule.cron,enabled:s.schedule.enabled===true},
  rateIn:{lastRun:counts.in,perHour:sum('in')},
  rateOut:{lastRun:counts.pass+counts.skip,perHour:sum('out')},
  queue,
  lastRun:{startedAt,finishedAt,result:result(counts)},
  nextRun:s.schedule.enabled===true?'per cron '+s.schedule.cron:null,
  nextRunNote:s.schedule.enabled===true?'':'schedule disabled; enabling needs Tim\'s yes through President',
  counts,reasons,notes,history:hist
 };
}
module.exports={SCHEMA,OUT,blank,result,build};
