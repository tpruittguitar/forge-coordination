'use strict';
// Read-only master snapshot for steps 08 and 09. Accepts Writer master rows or the public structured
// snapshot rows (PRIMARY_ID, COMPANY, TITLE, LOCATION, BUCKET, DISPOSITION, SCOUT_ACTION key=value pairs).
const Identity=require('../../source-trial/job-identity');
function payload(row){
 if(row.p&&typeof row.p==='object')return row.p;
 const p={};
 for(const m of String(row.SCOUT_ACTION||'').matchAll(/(?:^|;\s*)([A-Z][A-Z0-9_]*)=([^;]*)/g))p[m[1]]=m[2].trim();
 return p;
}
const DECLINED=/^(DECLINED_BY_TIM|REJECTED_BY_EMPLOYER|NOT_GOOD_FIT|OFF_TARGET\w*)$/i;
const latched=v=>!!String(v||'').trim()&&!/^(false|no|0|none|unknown)$/i.test(String(v).trim());
function declinedRow(r){
 const p=r.p||{};
 return DECLINED.test(String(r.BUCKET||'').trim())||/DECLINED|REJECTED|NOT_GOOD_FIT/i.test(String(r.DISPOSITION||''))||['ANTI_RESURRECTION','DO_NOT_REWORK'].some(k=>latched(r[k])||latched(p[k]));
}
function load(rows,{archiveRows=[]}={}){
 const norm=(r,terminal)=>({PRIMARY_ID:r.PRIMARY_ID,COMPANY:r.COMPANY,TITLE:r.TITLE,LOCATION:r.LOCATION,REQ:r.REQ,BUCKET:r.BUCKET,DISPOSITION:r.DISPOSITION,p:payload(r),ARCHIVED_TERMINAL:terminal});
 const all=rows.map(r=>norm(r,false)).concat(archiveRows.map(r=>norm(r,true)));
 return {rows:all.length,archiveRows:archiveRows.length,idx:Identity.index(all)};
}
module.exports={load,payload,declinedRow};
