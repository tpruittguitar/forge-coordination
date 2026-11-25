'use strict';
// Step 08: duplicate check against the canonical master (and terminal archive when supplied) with the
// shared job-identity matcher. Declined/rejected matches are left to step 09, which owns that reason.
const Identity=require('../../source-trial/job-identity');
const {declinedRow}=require('./master.cjs');
module.exports=function duplicate(job,ctx){
 if(!ctx.master)throw Error('MASTER_SNAPSHOT_REQUIRED');
 const m=Identity.match(ctx.master.idx,{company:job.company,title:job.title,url:job.url,location:job.location});
 if(m.status==='ABSENT')return {status:'PASS',reason:'NEW'};
 if(m.status==='PRESENT'){
  if(m.rows.some(declinedRow))return {status:'PASS',reason:'MATCH_IS_DECLINED_SEE_09'};
  return {status:'DROP',reason:'DUPLICATE_OF_EXISTING',detail:m.rows.map(r=>r.PRIMARY_ID+' '+(r.BUCKET||'')).join(', ')};
 }
 return {status:'HOLD',park:true,reason:'IDENTITY_AMBIGUOUS',detail:m.status+' '+(m.basis||[]).join(',')};
};
