'use strict';
/* Authorized read-only transport; never submit and never log the Writer key. */
const ENDPOINT='https://script.google.com/macros/s/AKfycbwShspSkto70NeFWjgTuyIf-W3EDgUmKmoWevE-jZq95pm6SAulrJYHX1HmiPg8tx3i/exec';
async function read(action,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch,clock=()=>Date.now()}={}){
 if(!key)throw Error('BLOCKED: credential required');
 if(!['ping','master','writer_status','archive'].includes(action))throw Error('BLOCKED: unsupported Writer action');
 const started=clock(),url=new URL(ENDPOINT);url.searchParams.set('action',action);url.searchParams.set('key',key);
 let resp;try{resp=await transport(url.toString(),{method:'GET',redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-store'}})}catch{throw Error('BLOCKED: Writer read transport failed')}
 if(!resp.ok)throw Error('BLOCKED: Writer HTTP '+resp.status);
 let data;try{data=await resp.json()}catch{throw Error('BLOCKED: Writer JSON invalid')}
 if(!data||data.ok!==true)throw Error('BLOCKED: Writer read not authorized');
 const ended=clock();if(ended<started||ended-started>30000)throw Error('BLOCKED: Writer read time invalid');
 return {data,startedAt:new Date(started).toISOString(),completedAt:new Date(ended).toISOString()};
}
function parseArchive(text){
 if(typeof text!=='string')throw Error('BLOCKED: archive text unavailable');
 const lines=[],at=new Map();
 for(const line of text.split(/\r?\n/)){
  if(/^\d+ \| V2[A-Z]-/.test(line)){
   const cells=line.split(' | '),id=cells[1]+'#'+cells[0];
   if(cells.length<10)throw Error('BLOCKED: malformed terminal archive row');
   if(at.has(id))lines[at.get(id)]=null;
   at.set(id,lines.length);
   lines.push({PRIMARY_ID:cells[1],COMPANY:cells[2],TITLE:cells[3],BUCKET:cells[4],DISPOSITION:cells[5],REQ_ID:cells[7],LOCATION:cells[8]});
  }else{
   const m=line.match(/^RESTORED\|([^|]+)\|(\d+)\|/);
   if(m){const id=m[1]+'#'+m[2];if(at.has(id)){lines[at.get(id)]=null;at.delete(id)}}
  }
 }
 return lines.filter(Boolean);
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
async function fetchAuthenticatedArchive(options={}){
 const r=await read('archive',options);
 if(r.data.degraded===true)throw Error('BLOCKED: Writer archive degraded');
 if(r.data.archiveId&&!r.data.text)throw Error('BLOCKED: Writer archive empty despite archiveId');
 if(!r.data.archiveId&&r.data.mode&&r.data.mode!=='NOT_MIGRATED')throw Error('BLOCKED: missing Writer archive ID');
 return {source:'WRITER',authenticated:true,rows:parseArchive(r.data.text),writerReadAt:r.completedAt,archiveId:r.data.archiveId||null};
}
async function auditLiveWriter(preview,options={}){
 const {auditAuthenticated}=require('./admission');
 return auditAuthenticated(preview,{fetchMaster:()=>fetchAuthenticatedMaster(options),fetchArchive:()=>fetchAuthenticatedArchive(options)});
}
module.exports={read,parseMaster,parseArchive,fetchAuthenticatedMaster,fetchAuthenticatedArchive,auditLiveWriter};
