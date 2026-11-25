'use strict';
// Engine 16: product and source. Source is script: the discovery channel and tool are already on the
// handoff. The employer's product / primary business is the AI part (high reasoning), which also feeds the
// employer-business Never-Consider rules that the title-only scope screen cannot judge.
const {filled}=require('../store.cjs');
const AI=require('../ai.cjs');
const select=j=>!filled(j,'DISCOVERY_CHANNEL')||!filled(j,'EMPLOYER_PRIMARY_BUSINESS');
async function work(job,ctx={}){
 const f={};
 if(!filled(job,'DISCOVERY_CHANNEL')){f.DISCOVERY_CHANNEL={value:job.channel,source:'HANDOFF'};f.DISCOVERY_TOOL={value:job.tool,source:'HANDOFF'};}
 if(filled(job,'EMPLOYER_PRIMARY_BUSINESS'))return {status:'PASS',reason:'SOURCE_SCRIPT',fields:f};
 const ai=ctx.ai||{available:false,reason:'AI_POOL_OFF'};
 if(!ai.available)return {status:'BLOCKED',reason:'PRODUCT_NEEDS_AI:'+(ctx.aiReason||ai.reason),fields:f};
 const r=ai.ask('From this posting, state the employer\'s primary business and main product in at most 80 characters, quoting the posting where possible. Return JSON {"business":"...","product":"...","quote":"..."}.\nCompany: '+job.company+'\nPosting:\n'+String(job.description).slice(0,12000),{model:'gpt-5.4-mini'});
 if(!r.ok)return {status:'BLOCKED',reason:'PRODUCT_NEEDS_AI:'+r.reason,fields:f};
 const a=AI.parseJson(r.text);
 f.EMPLOYER_PRIMARY_BUSINESS={value:String(a.business||'').slice(0,80),source:'AI_CREDIT:gpt-5.4-mini'};
 f.PRODUCT={value:String(a.product||'').slice(0,200),source:'AI_CREDIT:gpt-5.4-mini'};
 return {status:'PASS',reason:'PRODUCT_AND_SOURCE',fields:f};
}
module.exports={id:'16',select,work};
