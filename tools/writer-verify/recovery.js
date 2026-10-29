'use strict';
// Recovery evidence only. All Writer calls are authenticated GETs; never submit, correct or replay a write.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {read,fetchAuthenticatedArchive}=require('../source-intake/writer-reader');
const {validate}=require('./verify');
const BAD=new Set(['FALSE_COMPLETE','NOT_PERSISTED','NEEDS_RESOLUTION']),PENDING=new Set(['PENDING','PENDING_DELIVERY','VERIFYING']);
const PID=/^V2[A-Z]-[A-Za-z0-9_-]+$/,HASH=/^[a-f0-9]+:\d+$/;
const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
// Verbatim Writer cyrb53 row hash; also retain SHA-256 in the independent readback proof.
function textHash(s){s=String(s);let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(16)+':'+s.length;}
function indexValid(j){return j&&j.version===1&&j.requests&&typeof j.requests==='object'&&!Array.isArray(j.requests)&&Array.isArray(j.pending);}
async function loadIndex({transport=fetch,token=process.env.GITHUB_TOKEN}={}){
 const headers={Accept:'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'forge-receipt-recovery',...(token?{Authorization:'Bearer '+token}:{})};
 async function get(url){const r=await transport(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Receipt index source HTTP '+r.status);const t=await r.text();if(t.length>16*1024*1024)throw Error('Receipt index source too large');return JSON.parse(t);}
 const base='https://api.github.com/repos/tpruittguitar/forge-writer-state',meta=await get(base+'/contents/PIPELINE_RECEIPT_INDEX.json?ref=main');
 if(!/^[a-f0-9]{40}$/.test(meta.sha||''))throw Error('Receipt index revision missing');
 const blob=meta.content?meta:await get(base+'/git/blobs/'+meta.sha),raw=Buffer.from(blob.content||'','base64');
 if(raw.length>8*1024*1024||crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex')!==meta.sha)throw Error('Receipt index blob integrity failed');
 const index=JSON.parse(raw.toString('utf8'));if(!indexValid(index))throw Error('Unsupported receipt index');return {index,sha:meta.sha};
}
function graph(index){
 const conflicts=new Set(Object.values(index.requests).filter(e=>e&&e.s!=='COMPLETE'&&e.w).map(e=>e.w)),g=new Map();
 for(const [rid,e]of Object.entries(index.requests)){if(e?.s!=='COMPLETE'||!e.w||conflicts.has(e.w)||(!Number.isFinite(Date.parse(e.at))||Date.parse(e.at)>Date.parse(index.updatedAt)))continue;
  for(const i of e.items||[]){if(!PID.test(i.pid||'')||i.op!=='REPLACE'||!HASH.test(i.b||'')||!HASH.test(i.a||''))continue;const edges=g.get(i.pid)||[];edges.push({requestId:rid,writeId:e.w,at:e.at,from:i.b,to:i.a});g.set(i.pid,edges);}}
 return g;
}
function chain(edges,from,to,after,excludedWrite){
 const q=[{hash:from,at:Date.parse(after),path:[]}],seen=new Map();let examined=0;
 while(q.length&&examined++<2000){const cur=q.shift();if(cur.hash===to&&cur.path.length)return cur.path;if(cur.path.length>=32)continue;
  for(const e of edges||[]){const at=Date.parse(e.at);if(e.from!==cur.hash||at<cur.at||e.writeId===excludedWrite)continue;const old=seen.get(e.to);if(old!==undefined&&old<=at)continue;seen.set(e.to,at);q.push({hash:e.to,at,path:[...cur.path,e]});}}
 return null;
}
function candidates(root,index){
 const cases=new Map();for(const [rid,e]of Object.entries(index.requests))if(BAD.has(e?.s)||PENDING.has(e?.s))cases.set(rid,{requestId:rid,entry:e,bindings:[]});
 const dir=path.join(root,'verify/requests');if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
  let d;try{d=JSON.parse(fs.readFileSync(path.join(dir,file)));}catch{continue;}if(validate(d))continue;
  let old;try{old=JSON.parse(fs.readFileSync(path.join(root,'verify/results',file)));}catch{}
  for(const r of d.requests){if(old?.results?.some(x=>x.requestId===r.requestId&&x.verdict==='VERIFIED'&&canonical(x.primaryIds||[])===canonical(r.primaryIds||[])))continue;
   const c=cases.get(r.requestId)||{requestId:r.requestId,entry:index.requests[r.requestId]||null,bindings:[]};c.bindings.push({file:'verify/requests/'+file,primaryIds:r.primaryIds||[]});cases.set(r.requestId,c);}}
 return [...cases.values()].sort((a,b)=>a.requestId.localeCompare(b.requestId));
}
function rowReader(opts){
 const cache=new Map();let archive;
 return async function rows(rid,ids){
  const missing=ids.filter(id=>!cache.has(id));for(let n=0;n<missing.length;n+=25){const group=missing.slice(n,n+25),r=(await read('row_readback',{...opts,requestId:rid,primaryIds:group})).data;
   if(r.master?.endMarkerPresent!==true||!Array.isArray(r.rows)||!Number.isFinite(Date.parse(r.readAt||'')))throw Error('Incomplete live master readback');
   for(const id of group){const matches=r.rows.filter(x=>x.primaryId===id);if(matches.length!==1)throw Error('Readback ID binding failed');const x=matches[0];if(x.found&&(x.matches!==1||String(x.line||'').split(' | ')[1]!==id))cache.set(id,{error:'DUPLICATE_OR_MISMATCHED_ROW'});
    else if(x.found){const sha=digest(x.line);if(x.lineSha256&&sha!==x.lineSha256)throw Error('Row readback hash mismatch');cache.set(id,{primaryId:id,hash:textHash(x.line),sha256:sha,readAt:r.readAt,location:'MASTER'});}
    else cache.set(id,{primaryId:id,missing:true,readAt:r.readAt});}}
  if(ids.some(id=>cache.get(id)?.missing)){if(!archive)archive=await fetchAuthenticatedArchive(opts);for(const id of ids.filter(id=>cache.get(id)?.missing)){const found=archive.rows.filter(r=>r.PRIMARY_ID===id);if(found.length===1)cache.set(id,{primaryId:id,hash:textHash(found[0].RAW_ROW),sha256:digest(found[0].RAW_ROW),readAt:archive.writerReadAt,location:'TERMINAL_ARCHIVE'});else if(found.length>1)cache.set(id,{error:'DUPLICATE_ARCHIVE_ROW'});}}
  return ids.map(id=>cache.get(id));
 };
}
async function inspect(c,index,g,rows,opts){
 const out={requestId:c.requestId,sourceEntry:c.entry,sourceBindings:c.bindings,status:'ESCALATED',owner:'ChatGPT Gofer'};
 const e=c.entry;if(!e)return {...out,reason:'NO_CANONICAL_REQUEST_BINDING',nextAction:'Find original acceptance and child request IDs; never infer an envelope or resend it.'};
 if(e.s==='COMPLETE'){
  const ids=[...new Set(c.bindings.flatMap(x=>x.primaryIds))];if(!ids.length||ids.length>200||!Array.isArray(e.items)||ids.some(id=>!e.items.some(i=>i.pid===id)))return {...out,reason:'COMPLETE_RECEIPT_WITHOUT_EXACT_IDS',nextAction:'Recover exact accepted row IDs before claiming row verification.'};
  const current=(await read('receipt_index',{...opts,requestId:c.requestId})).data;
  if(current.source!=='GITHUB'||current.request?.s!=='COMPLETE'||canonical(current.request)!==canonical(e))throw Error('Receipt changed during recovery');
  const detail=(await read('request_result',{...opts,requestId:c.requestId})).data;
  if(!detail.found||detail.requestId!==c.requestId||detail.status!=='COMPLETE'||!detail.durable||detail.entry?.w!==e.w)throw Error('Durable receipt binding missing');
  const found=await rows(c.requestId,ids),ok=found.every(r=>!r.error&&!r.missing);
  return {...out,status:ok?'VERIFIED_RECEIPT_AND_ROWS':'ESCALATED',reason:ok?'DURABLE_COMPLETE_AND_EXACT_IDS':'CURRENT_AND_ARCHIVE_ROWS_NOT_PROVEN',rows:found.map((r,i)=>({...r,primaryId:ids[i]})),nextAction:ok?'No write required.':'Reconcile saved acceptance with exact current/archive rows; never replay.'};
 }
 const pending=index.pending.find(p=>p.writeId===e.w&&p.requestIds.includes(c.requestId));
 const items=e.items||pending?.items;if(pending&&!e.items)out.pendingBinding={writeId:pending.writeId,requestIds:pending.requestIds,items:pending.items,writtenAt:pending.writtenAt};
 if(!Array.isArray(items)||!items.length||items.length>200||new Set(items.map(x=>x.pid)).size!==items.length||items.some(i=>!PID.test(i.pid||'')||!HASH.test(i.a||'')||!['INSERT','REPLACE'].includes(i.op)))return {...out,reason:'SAVED_AFTER_IMAGE_BINDING_MISSING',nextAction:'Recover original receipt/event after-image; row existence or a similar title cannot prove this write.'};
 if(!Number.isFinite(Date.parse(e.at||'')))return {...out,reason:'INVALID_RECEIPT_TIME',nextAction:'Repair evidence timestamp through Writer-owned reconciliation.'};
 const rb=await rows(c.requestId,items.map(i=>i.pid));
 out.rows=items.map((i,n)=>{const r=rb[n];if(r.error||r.missing)return {primaryId:i.pid,status:r.error||'ROW_MISSING'};
  const proof={primaryId:i.pid,expectedAfter:i.a,observedHash:r.hash,sha256:r.sha256,readAt:r.readAt,location:r.location};
  if(Date.parse(r.readAt)<=Date.parse(e.at))return {...proof,status:'READ_NOT_AFTER_RECEIPT'};
  if(r.hash===i.a)return {...proof,status:'EXACT_AFTER_IMAGE'};
  const linked=chain(g.get(i.pid),i.a,r.hash,e.at,e.w);if(linked)return {...proof,status:'LATER_VERIFIED_HASH_CHAIN',chain:linked};
  return {...proof,status:r.hash===i.b?'ORIGINAL_BEFORE_IMAGE_STILL_PRESENT':'CURRENT_ROW_DIFFERS'};});
 const proven=out.rows.every(r=>['EXACT_AFTER_IMAGE','LATER_VERIFIED_HASH_CHAIN'].includes(r.status));
 return {...out,status:proven?'PROVEN_PERSISTED':'ESCALATED',reason:proven?'EXACT_SAVED_WRITE_EVIDENCE':'INSUFFICIENT_ROW_EVIDENCE',nextAction:proven?'Recovery proved persistence; original failure record and replay fences remain unchanged.':'Gofer: inspect the original event/acceptance and row history. Do not resubmit or assume a later different row proves this write.'};
}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,1)+'\n');fs.renameSync(tmp,file);}
function savedResolution(root,c,now,index){
 const name=digest([c.requestId,c.entry,'PROVEN_PERSISTED','EXACT_SAVED_WRITE_EVIDENCE'])+'.json';let p;
 try{p=JSON.parse(fs.readFileSync(path.join(root,'verify/recovery/resolutions',name)));}catch{return null;}
 const items=c.entry?.items||p.pendingBinding?.items,time=Date.parse(p.checkedAt||'');
 if(p.status!=='PROVEN_PERSISTED'||canonical(p.sourceEntry)!==canonical(c.entry)||p.writerSubmissions!==0||p.masterMutations!==0||p.source?.repo!=='tpruittguitar/forge-writer-state'||!/^[a-f0-9]{40}$/.test(p.source.sha||'')||!Number.isFinite(time)||time>now+120000||!Array.isArray(items)||!items.length||!Array.isArray(p.rows)||p.rows.length!==items.length)return null;
 const pending=index.pending.find(x=>x.writeId===c.entry.w&&x.requestIds.includes(c.requestId));if(pending&&p.pendingBinding&&canonical(p.pendingBinding.items)!==canonical(pending.items))return null;
 if(p.rows.some(r=>!r||typeof r!=='object')||new Set(p.rows.map(r=>r.primaryId)).size!==items.length||!items.every(i=>{const r=p.rows.find(r=>r.primaryId===i.pid);if(!r||r.expectedAfter!==i.a||!/^[a-f0-9]{64}$/.test(r.sha256||'')||!(Date.parse(r.readAt)>Date.parse(c.entry.at)))return false;
  if(r.status==='EXACT_AFTER_IMAGE')return r.observedHash===i.a;
  if(r.status!=='LATER_VERIFIED_HASH_CHAIN'||!Array.isArray(r.chain)||!r.chain.length||r.chain.length>32)return false;
  let hash=i.a,last=Date.parse(c.entry.at);const ok=r.chain.every(l=>{const peer=index.requests[l.requestId],t=Date.parse(l.at);if(!peer||peer.s!=='COMPLETE'||peer.w!==l.writeId||peer.at!==l.at||l.from!==hash||!Number.isFinite(t)||t<last||t>Date.parse(r.readAt)||Object.values(index.requests).some(e=>e.w===l.writeId&&e.s!=='COMPLETE'))return false;if(peer.items&&!peer.items.some(j=>j.pid===i.pid&&j.op==='REPLACE'&&j.b===l.from&&j.a===l.to))return false;hash=l.to;last=t;return true;});return ok&&hash===r.observedHash;
 }))return null;
 return {...p,historicalResolution:true,sourceBindings:c.bindings,proofRecordedAt:p.checkedAt};
}
async function recover({root='.',index,sha,now=new Date(),opts={},maxCases=100,readRows}={}){
 const started=Date.now(),observed=()=>new Date(now.getTime()+Date.now()-started).toISOString();
 if(!indexValid(index)||!/^[a-f0-9]{40}$/.test(sha||'')||!Number.isFinite(now.getTime())||!Number.isFinite(Date.parse(index.updatedAt))||Date.parse(index.updatedAt)>now.getTime()+120000)throw Error('Invalid recovery source/time');
 const all=candidates(root,index),priorFile=path.join(root,'verify/recovery/latest.json');let prior;try{prior=JSON.parse(fs.readFileSync(priorFile));}catch{}
 const checked=new Map(Object.entries(prior?.lastChecked||{}));for(const c of prior?.cases||[])checked.set(c.requestId,Date.parse(c.checkedAt)||0);all.sort((a,b)=>(checked.get(a.requestId)||0)-(checked.get(b.requestId)||0)||a.requestId.localeCompare(b.requestId));
 const g=graph(index),rows=readRows||rowReader(opts),report={schema:'forge.receipt-recovery.v1',at:now.toISOString(),source:{repo:'tpruittguitar/forge-writer-state',path:'PIPELINE_RECEIPT_INDEX.json',sha,indexUpdatedAt:index.updatedAt},writerSubmissions:0,masterMutations:0,canonicalReceiptMutations:0,cases:[],deferred:Math.max(0,all.length-maxCases)};
 report.lastChecked=Object.fromEntries(all.map(c=>[c.requestId,checked.get(c.requestId)||0]));
 for(const c of all.slice(0,maxCases)){let result=savedResolution(root,c,now.getTime(),index);try{if(!result)result=await inspect(c,index,g,rows,opts);}catch{result={requestId:c.requestId,sourceEntry:c.entry,sourceBindings:c.bindings,status:'CHECK_FAILED',reason:'AUTHENTICATED_READ_FAILED',owner:'ChatGPT Gofer',nextAction:'Retry evidence reads on the next run; do not resubmit.'};}
  result.checkedAt=observed();const type=result.status==='PROVEN_PERSISTED'||result.status==='VERIFIED_RECEIPT_AND_ROWS'?'resolutions':'escalations',name=digest([result.requestId,result.sourceEntry,result.status,result.reason])+'.json';
  result.evidenceFile='verify/recovery/'+type+'/'+name;const evidencePath=path.join(root,result.evidenceFile);if(!fs.existsSync(evidencePath))atomic(evidencePath,{...result,source:report.source,writerSubmissions:0,masterMutations:0});
  report.lastChecked[c.requestId]=now.getTime();report.cases.push(result);atomic(priorFile,{...report,inProgress:true});
 }
 report.at=observed();report.summary={checked:report.cases.length,resolved:report.cases.filter(c=>['PROVEN_PERSISTED','VERIFIED_RECEIPT_AND_ROWS'].includes(c.status)).length,escalated:report.cases.filter(c=>c.status==='ESCALATED').length,checkFailed:report.cases.filter(c=>c.status==='CHECK_FAILED').length,deferred:report.deferred};
 atomic(priorFile,report);return report;
}
async function main(){if(!process.env.FORGE_WRITER_KEY)throw Error('Writer read credential unavailable');const {index,sha}=await loadIndex();const report=await recover({index,sha});console.log(JSON.stringify({at:report.at,summary:report.summary,writerSubmissions:0,masterMutations:0}));}
if(require.main===module)main().catch(()=>{console.error('Receipt recovery failed; retain previous evidence and investigate source access. No writes were submitted.');process.exitCode=1;});
module.exports={textHash,canonical,digest,loadIndex,graph,chain,candidates,rowReader,inspect,recover};
