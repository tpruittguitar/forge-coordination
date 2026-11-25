'use strict';
// AI transport for engines 14, 15 and 16: the OpenAI API only, through the existing credit key file path
// read at runtime. No logging of the key. No paid or other fallback. Missing key or a 401 means BLOCKED.
const fs=require('node:fs'),https=require('node:https');
const KEY_PATH=process.env.PIPELINE_V2_OPENAI_KEY_FILE||process.env.OPENAI_API_KEY_FILE||'/home/box/.openai_api_key';
function readKey(){try{return fs.readFileSync(KEY_PATH,'utf8').trim();}catch{return '';}}
function postJson(path,payload,key){return new Promise((resolve,reject)=>{const req=https.request({hostname:'api.openai.com',path,method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;});res.on('end',()=>resolve({statusCode:res.statusCode||0,body}));});req.on('error',reject);req.write(JSON.stringify(payload));req.end();});}
function creditPool({card,enabled=process.env.PIPELINE_V2_AI==='credit'}={}){
 if(!enabled)return {available:false,reason:'AI_POOL_OFF'};
 return {available:true,ask:async(prompt,{model='gpt-5.4-mini'}={})=>{const key=readKey();if(!key)return {ok:false,reason:'AI_POOL_UNAVAILABLE:NO_KEY'};try{const r=await postJson('/v1/responses',{model,input:prompt},key);if(r.statusCode===401)return {ok:false,reason:'AI_POOL_UNAVAILABLE:401'};if(r.statusCode<200||r.statusCode>=300)return {ok:false,reason:'AI_POOL_REFUSED:HTTP_'+r.statusCode};const j=JSON.parse(r.body);const text=String(j.output_text||'');return {ok:true,text};}catch(e){return {ok:false,reason:'AI_POOL_REFUSED:'+String(e&&e.message||e).slice(0,80)};}}};
}
function parseJson(text){const m=String(text||'').match(/\{[\s\S]*\}/);if(!m)throw Error('AI_ANSWER_NOT_JSON');return JSON.parse(m[0]);}
module.exports={creditPool,parseJson,readKey,KEY_PATH};
