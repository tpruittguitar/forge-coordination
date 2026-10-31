'use strict';
// Read-only reporting sidecar. Never changes canonical receipts or turns missing receipts into success.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='state/WRITER_ACTIVITY_DETAILS.json',BASE='https://api.github.com/repos/tpruittguitar/forge-writer-state';
function matches(a,b){return a?.s==='COMPLETE'&&b?.s==='COMPLETE'&&a.w===b.w&&a.at===b.at&&a.snapshotHash===b.snapshotHash;}
async function hydrate(index,{root,now=Date.now(),transport=fetch,token=process.env.GITHUB_TOKEN,maxReads=8}={}){
 const file=path.join(root,FILE);let cache={schema:'forge.activity-details.v1',entries:{}};
 if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.schema===cache.schema&&old.entries)cache=old;}
 const clone=JSON.parse(JSON.stringify(index)),cut=now-36*3600000,needed=()=>Object.entries(clone.requests).filter(([id,e])=>e.s==='COMPLETE'&&e.w&&Date.parse(e.at)>=cut&&Date.parse(e.at)<=now&&!Array.isArray(e.items));
 for(const [id,v] of Object.entries(cache.entries)){const e=clone.requests[id];if(!e||Date.parse(e.at)<cut||!matches(e,v.entry)||!Array.isArray(v.entry.items)||!/^[a-f0-9]{40}$/.test(v.sha||'')){delete cache.entries[id];continue;}if(!e.items)e.items=v.entry.items;}
 const headers={Accept:'application/vnd.github+json','User-Agent':'forge-activity-history',...(token?{Authorization:'Bearer '+token}:{})};
 async function get(url){const r=await transport(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('History HTTP '+r.status);return r.json();}
 const tried=new Set(),sources=new Set();let error=null;
 for(let n=0;n<maxReads&&needed().length;n++){
  const targets=needed().sort((a,b)=>Date.parse(b[1].at)-Date.parse(a[1].at)),target=targets.find(([id])=>!tried.has(id));if(!target)break;tried.add(target[0]);
  try{
   const until=new Date(Math.min(now,Date.parse(target[1].at)+5*60000)).toISOString();
   const commits=await get(BASE+'/commits?path=PIPELINE_RECEIPT_INDEX.json&per_page=1&until='+encodeURIComponent(until));if(!commits.length)continue;
   const meta=await get(BASE+'/contents/PIPELINE_RECEIPT_INDEX.json?ref='+commits[0].sha),blob=meta.content?meta:await get(BASE+'/git/blobs/'+meta.sha),raw=Buffer.from(blob.content||'','base64');
   if(raw.length>8*1024*1024||crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex')!==meta.sha)throw Error('History blob integrity failed');
   const old=JSON.parse(raw);sources.add(meta.sha);
   for(const [id,e]of Object.entries(clone.requests)){const v=old.requests?.[id];if(!e.items&&Date.parse(e.at)>=cut&&matches(e,v)&&Array.isArray(v.items)){e.items=v.items;cache.entries[id]={entry:v,sha:meta.sha};}}
  }catch(e){error=e.message;break;}
 }
 // Capture current detail before Writer's 100-entry compaction drops it.
 for(const [id,e]of Object.entries(index.requests))if(e.s==='COMPLETE'&&Date.parse(e.at)>=cut&&Date.parse(e.at)<=now&&Array.isArray(e.items))cache.entries[id]={entry:e,sha:index.sourceSha};
 cache.at=new Date(now).toISOString();const text=JSON.stringify(cache);if(text.length>2*1024*1024)throw Error('Activity detail cache budget exceeded');fs.writeFileSync(file,text+'\n');
 return {index:clone,remaining:needed().length,sources:[...sources],error};
}
module.exports={hydrate,matches};
