'use strict';
// Engine 14: degree requirement text and buried pay. Script first: the degree clauses are cut from the
// posting text (or NOT_STATED when a full posting names no degree). Buried pay (pay written in a form the
// posted-pay script cannot read) is the AI part, on the cheap model, only for jobs with no posted pay.
const {filled}=require('../store.cjs');
const AI=require('../ai.cjs');
const DEG=/\b(bachelor\w*|master\w*|mba|m\.?b\.?a\.?|ph\.?d|doctorate|degree|b\.?s\.?(?:ee|me|ce|e)?|b\.?a\.?|b\.?eng|bsc|msc|equivalent (?:work )?experience|in lieu of)\b/i;
function degreeText(text){
 const lines=String(text||'').split(/\n|(?<=[.;])\s+/).map(s=>s.trim()).filter(s=>s&&DEG.test(s)&&!/\b(?:degrees? (?:fahrenheit|celsius)|360[- ]degree)\b/i.test(s));
 return lines.join(' ').slice(0,1500);
}
const select=j=>!filled(j,'DEGREE_TEXT')||(j.fields.PAY_POSTED&&j.fields.PAY_POSTED.value==='NO'&&!filled(j,'BURIED_PAY'));
async function work(job,ctx={}){
 if(!filled(job,'PAY_POSTED'))return {status:'WAIT',reason:'WAITING_ON_13_POSTED_PAY'};
 const f={};
 if(!filled(job,'DEGREE_TEXT')){const t=degreeText(job.description);f.DEGREE_TEXT={value:t||'NOT_STATED',source:t?'POSTING_TEXT_SCRIPT':'FULL_POSTING_NO_DEGREE_SCRIPT'};}
 if(job.fields.PAY_POSTED.value!=='NO'||filled(job,'BURIED_PAY'))return {status:'PASS',reason:'DEGREE_SCRIPT',fields:f};
 const ai=ctx.ai||{available:false,reason:'AI_POOL_OFF'};
 if(!ai.available)return {status:'BLOCKED',reason:'BURIED_PAY_NEEDS_AI:'+(ctx.aiReason||ai.reason),fields:f};
 const r=ai.ask('Read this job posting. If it states base pay anywhere (any wording), return JSON {"low":number,"high":number,"interval":"yearly|hourly","quote":"exact text"}; if it states none, return {"none":true}. Posting:\n'+String(job.description).slice(0,12000),{model:'gpt-5.4-nano'});
 if(!r.ok)return {status:'BLOCKED',reason:'BURIED_PAY_NEEDS_AI:'+r.reason,fields:f};
 const a=AI.parseJson(r.text);
 f.BURIED_PAY={value:a.none?'NONE':JSON.stringify({low:a.low,high:a.high,interval:a.interval}),source:'AI_CREDIT:gpt-5.4-nano'+(a.quote?':'+String(a.quote).slice(0,200):'')};
 return {status:'PASS',reason:a.none?'BURIED_PAY_NONE':'BURIED_PAY_FOUND',fields:f};
}
module.exports={id:'14',select,work,degreeText};
