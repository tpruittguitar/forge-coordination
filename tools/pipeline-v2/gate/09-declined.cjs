'use strict';
// Step 09: declined check. A same-job match to a row Tim declined, an employer rejection, or a row with an
// anti-resurrection / do-not-rework latch is dropped. Blocked identities from the intake fence also drop.
const Identity=require('../../source-trial/job-identity');
const {declinedRow}=require('./master.cjs');
module.exports=function declined(job,ctx){
 if(!ctx.master)throw Error('MASTER_SNAPSHOT_REQUIRED');
 const m=Identity.match(ctx.master.idx,{company:job.company,title:job.title,url:job.url,location:job.location});
 if(m.status==='PRESENT'){const d=m.rows.find(declinedRow);if(d)return {status:'DROP',reason:'DECLINED_BEFORE:'+(String(d.BUCKET||'LATCHED').toUpperCase()),detail:d.PRIMARY_ID};}
 const key=[job.company,job.title].map(v=>String(v||'').toLowerCase().replace(/\b(incorporated|corporation|corp|inc|llc|ltd|limited)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim()).join('|');
 if(ctx.blockedIdentities&&ctx.blockedIdentities.has(key))return {status:'DROP',reason:'BLOCKED_IDENTITY_FENCE'};
 return {status:'PASS',reason:'NOT_DECLINED'};
};
