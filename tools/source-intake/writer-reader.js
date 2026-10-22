'use strict';
/* Authorized read-only transport; never submit and never log the Writer key. */
const ENDPOINT='https://script.google.com/macros/s/AKfycbwShspSkto70NeFWjgTuyIf-W3EDgUmKmoWevE-jZq95pm6SAulrJYHX1HmiPg8tx3i/exec';
async function read(action,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch,clock=()=>Date.now()}={}){
 if(!key)throw Error('BLOCKED: credential required');
 if(!['ping','master','writer_status'].includes(action))throw Error('BLOCKED: unsupported Writer action');
 const started=clock(),url=new URL(ENDPOINT);url.searchParams.set('action',action);url.searchParams.set('key',key);
 let resp;try{resp=await transport(url.toString(),{method:'GET',redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-store'}})}catch{throw Error('BLOCKED: Writer read transport failed')}
 if(!resp.ok)throw Error('BLOCKED: Writer HTTP '+resp.status);
 let data;try{data=await resp.json()}catch{throw Error('BLOCKED: Writer JSON invalid')}
 if(!data||data.ok!==true)throw Error('BLOCKED: Writer read not authorized');
 const ended=clock();if(ended<started||ended-started>30000)throw Error('BLOCKED: Writer read time invalid');
 return {data,startedAt:new Date(started).toISOString(),completedAt:new Date(ended).toISOString()};
}
function parseMaster(text){
 if(typeof text!=='string'||!text.trim())throw Error('BLOCKED: no master text');
 const rows=text.split(/\r?\n/).filter(l=>/^\d+\s*\|\s*V2[A-Z]-/.test(l)).map(l=>{
 const c=l.trim().split(/\s+\|\s+/);if(c.length<10)throw Error('BLOCKED: short master row');
 return {PRIMARY_ID:c[1],COMPANY:c[2],TITLE:c[3],BUCKET:c[4],DISPOSITION:c[5],REQ_ID:c[7],LOCATION:c[8]};
 });
 if(!rows.length||!/\bEND\b/.test(text))throw Error('BLOCKED: master completeness marker missing');
 if(new Set(rows.map(x=>x.PRIMARY_ID)).size!==rows.length)throw Error('BLOCKED: duplicated master identities');
 return rows;
}
async function fetchAuthenticatedMaster(options={}){
 const [ping,status,master]=await Promise.all(['ping','writer_status','master'].map(a=>read(a,options)));
 if(status.data.frozen===true)throw Error('BLOCKED: Writer frozen');
 return {source:'WRITER',authenticated:true,rows:parseMaster(master.data.text),writerModifiedTime:master.data.modifiedTime||null,writerReadAt:master.completedAt,writerBuild:ping.data.build||null};
}
module.exports={read,parseMaster,fetchAuthenticatedMaster};
