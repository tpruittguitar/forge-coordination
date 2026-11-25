'use strict';
// Engine 15: experience fit (AI, highest reasoning available on the credit runner). Paced to intake output:
// it reads only jobs that passed the gate. Writes SCOPE_FIT_RAW (0-100) with its basis; the formula that
// turns it into the score stays in Tim's published scoring model (engine 19).
const {filled}=require('../store.cjs');
const AI=require('../ai.cjs');
const select=j=>!filled(j,'SCOPE_FIT_RAW');
async function work(job,ctx={}){
 const ai=ctx.ai||{available:false,reason:'AI_POOL_OFF'};
 if(!ai.available)return {status:'BLOCKED',reason:'NEEDS_AI:'+(ctx.aiReason||ai.reason)};
 const r=ai.ask('You judge how well Tim Pruitt\'s experience (senior manufacturing, quality and operations leadership; plant launch and ramp; automotive to industrial, robotics, defense, space and energy) fits this role\'s actual scope. Return JSON {"fit":0-100,"basis":"one sentence"}.\nTitle: '+job.title+'\nCompany: '+job.company+'\nPosting:\n'+String(job.description).slice(0,12000),{model:'gpt-5.4-mini'});
 if(!r.ok)return {status:'BLOCKED',reason:'NEEDS_AI:'+r.reason};
 const a=AI.parseJson(r.text),fit=Math.max(0,Math.min(100,Math.round(Number(a.fit))));
 if(!Number.isFinite(fit))throw Error('AI_FIT_NOT_NUMBER');
 return {status:'PASS',reason:'FIT_SCORED',fields:{SCOPE_FIT_RAW:{value:fit,source:'AI_CREDIT:gpt-5.4-mini'},EXPERIENCE_FIT_BASIS:{value:String(a.basis||'').slice(0,300),source:'AI_CREDIT:gpt-5.4-mini'}}};
}
module.exports={id:'15',select,work};
