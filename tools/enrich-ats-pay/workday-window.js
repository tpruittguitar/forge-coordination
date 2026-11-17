'use strict';
/* Keeps enrich-ats-pay Workday reads out of the board-discovery window. The window is derived from the schedule that
 * board-discovery already declares in its workflow file (cron and timeout-minutes), so it follows any later schedule change
 * and no cron is edited here. GitHub often starts a scheduled run late, so the window runs from the scheduled start until
 * LATE_START_MS plus the job timeout have passed. ENRICH_BOARD_DISCOVERY_ACTIVE=1 forces the window on, 0 forces it off. */
const fs=require('node:fs'),path=require('node:path');
const WORKFLOW=path.join(__dirname,'../../.github/workflows/board-discovery.yml');
const LATE_START_MS=10*60000;
const DEFAULT_TIMEOUT_MINUTES=25;
const WORKDAY_HOST=/(^|[/.])myworkdayjobs\.com([/:?#]|$)/i;
function field(text,min,max){
 const out=new Set();
 for(const part of String(text).split(',')){
  const m=part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/);if(!m)return null;
  const step=m[2]?Number(m[2]):1;let lo=min,hi=max;
  if(m[1]!=='*'){const [a,b]=m[1].split('-').map(Number);lo=a;hi=b===undefined?(m[2]?max:a):b;}
  if(!(step>=1)||lo<min||hi>max||lo>hi)return null;
  for(let v=lo;v<=hi;v+=step)out.add(v);
 }
 return out.size?[...out].sort((a,b)=>a-b):null;
}
/* Supports minute and hour lists, ranges and steps with day, month and weekday all '*'. Anything else returns null. */
function parseSchedule(workflowText){
 const cron=String(workflowText||'').match(/^\s*-?\s*cron:\s*['"]([^'"]+)['"]/m)?.[1];if(!cron)return null;
 const f=cron.trim().split(/\s+/);if(f.length!==5||f[2]!=='*'||f[3]!=='*'||f[4]!=='*')return null;
 const minutes=field(f[0],0,59),hours=field(f[1],0,23);if(!minutes||!hours)return null;
 const timeout=Number(String(workflowText).match(/^\s*timeout-minutes:\s*(\d+)/m)?.[1]);
 return {minutes,hours,timeoutMinutes:timeout>0?timeout:DEFAULT_TIMEOUT_MINUTES};
}
function windowActive(schedule,now=Date.now()){
 if(!schedule)return false;
 const length=LATE_START_MS+schedule.timeoutMinutes*60000,day=Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate());
 for(const offset of [-1,0])for(const h of schedule.hours)for(const m of schedule.minutes){
  const start=day+offset*86400000+h*3600000+m*60000;
  if(now>=start&&now<start+length)return true;
 }
 return false;
}
let cached;
function active(now=Date.now(),{env=process.env,file=WORKFLOW}={}){
 if(env.ENRICH_BOARD_DISCOVERY_ACTIVE==='1')return true;
 if(env.ENRICH_BOARD_DISCOVERY_ACTIVE==='0')return false;
 if(cached===undefined||cached.file!==file){let text='';try{text=fs.readFileSync(file,'utf8')}catch{}cached={file,schedule:parseSchedule(text)};}
 return windowActive(cached.schedule,now);
}
const isWorkdayUrl=url=>WORKDAY_HOST.test(String(url||'').replace(/^https?:\/\//i,''));
const paused=(url,now,options)=>isWorkdayUrl(url)&&active(now,options);
module.exports={parseSchedule,windowActive,active,isWorkdayUrl,paused,LATE_START_MS,DEFAULT_TIMEOUT_MINUTES};
