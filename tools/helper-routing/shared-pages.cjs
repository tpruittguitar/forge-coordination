'use strict';
// Derived accounting only: exact source bytes + immutable pages, never a claim/lease.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),H=require('./shared.cjs'),S=require('../programmed-coordinator/store.cjs');
const BASE='control/shared-helper-pages',tasks=Object.keys(H.TASKS);
const indexPath=task=>{if(!H.TASKS[task])throw Error('UNKNOWN_SHARED_HELPER_TASK');return `${BASE}/${task}/current.json`;};
const pagePath=(task,hash)=>`${BASE}/${task}/${hash}.json`;
const raw=value=>JSON.stringify(value,null,2)+'\n';
const blob=bytes=>crypto.createHash('sha1').update(Buffer.from(`blob ${Buffer.byteLength(bytes)}\0`)).update(bytes).digest('hex');
function binding(bytes){const w=H.validateWork(JSON.parse(bytes));return{file:H.FILE,sha256:S.hash(bytes),gitBlobSha:blob(bytes),bytes:Buffer.byteLength(bytes),assignmentId:w.assignmentId,sourceAt:w.at||null};}
function classify(file){for(const task of tasks){if(file===indexPath(task))return 'CURRENT';if(new RegExp('^'+BASE+'/'+task+'/[a-f0-9]{64}\\.json$').test(file))return 'IMMUTABLE';}return null;}
function build(bytes,{now=Date.now()}={}){
 if(!Number.isFinite(now))throw Error('INVALID_SHARED_PROJECTION_TIME');
 const work=H.validateWork(JSON.parse(bytes)),source=binding(bytes),files={},indexes={};
 // Time alone can change priority/eligibility. Require a new projection at the first retry boundary.
 const retries=work.items.filter(i=>i.status==='ASSIGNED'&&work.providers[i.taskKey]?.available).map(i=>Date.parse(i.retryAfter)).filter(t=>t>now);
 const validUntil=retries.length?new Date(Math.min(...retries)).toISOString():null;
 for(const taskKey of tasks){
  let after=null,pageNumber=0;const pages=[];let first;
  do{
   const next=H.next(work,taskKey,after,now);first||=next;
   if(!next.items.length)break;
   const page={...next,schema:'forge.shared-helper-page.v1',source,evaluatedAt:new Date(now).toISOString(),validUntil,pageNumber:++pageNumber};
   const content=raw(page),sha256=S.hash(content),file=pagePath(taskKey,sha256);
   files[file]=page;pages.push({file,sha256,gitBlobSha:blob(content),bytes:Buffer.byteLength(content),items:page.items.length});after=next.nextAfter;
  }while(after);
  const index={schema:'forge.shared-helper-index.v1',source,provider:H.TASKS[taskKey],taskKey,evaluatedAt:new Date(now).toISOString(),validUntil,enabled:work.enabled,routingActive:work.routingActive,available:work.providers[taskKey].available,mode:'EVIDENCE_ONLY',canonicalCompletion:false,claimOrLease:false,backlogCounts:first.backlogCounts,laneOrder:first.laneOrder,total:pages.reduce((n,p)=>n+p.items,0),maxArtifactItems:H.MAX_ARTIFACT_ITEMS,runItemCap:null,pages};
  indexes[indexPath(taskKey)]=index;
 }
 return{source,files,indexes};
}
function generate(root,{now=Date.now(),checkLock}={}){
 if(typeof checkLock!=='function')throw Error('SHARED_COORDINATOR_LOCK_REQUIRED');checkLock();
 const bytes=fs.readFileSync(path.join(root,H.FILE));
 // Reuse a still-current projection: repeated coordinator checks do not append
 // timestamp-only pages or inflate the immutable history.
 try{if(validateStored(root,{now,required:true}).valid){const indexes=tasks.map(indexPath);return{source:binding(bytes),indexes,pages:indexes.reduce((n,f)=>n+S.read(root,f).pages.length,0)};}}catch{}
 const result=build(bytes,{now});
 for(const [file,value]of Object.entries(result.files)){checkLock();S.immutable(root,file,value);}
 checkLock();if(!fs.readFileSync(path.join(root,H.FILE)).equals(bytes))throw Error('STALE_SHARED_PROJECTION_SOURCE');
 // Indexes are published last, after every referenced immutable page exists.
 for(const [file,value]of Object.entries(result.indexes)){checkLock();S.save(root,file,value);}
 return{source:result.source,indexes:Object.keys(result.indexes),pages:Object.keys(result.files).length};
}
// Readers resolve fresh operational main ONCE, get work metadata and all files at
// that commit, then verify. A snapshot does not fence overlapping same-provider runs.
function validateIndex(index,{taskKey,workBlobSha,now=Date.now()}={}){
 if(!H.TASKS[taskKey]||index?.schema!=='forge.shared-helper-index.v1'||index.taskKey!==taskKey||index.provider!==H.TASKS[taskKey]||index.source?.file!==H.FILE||!/^[a-f0-9]{40}$/.test(workBlobSha||'')||index.source.gitBlobSha!==workBlobSha||!/^[a-f0-9]{64}$/.test(index.source.sha256||'')||!Number.isFinite(Date.parse(index.evaluatedAt))||Date.parse(index.evaluatedAt)>now||index.validUntil!==null&&(!Number.isFinite(Date.parse(index.validUntil))||now>=Date.parse(index.validUntil))||!Array.isArray(index.pages))throw Error('STALE_OR_INVALID_SHARED_INDEX');
 for(const p of index.pages)if(p.file!==pagePath(taskKey,p.sha256)||classify(p.file)!=='IMMUTABLE'||!/^[a-f0-9]{40}$/.test(p.gitBlobSha||'')||!Number.isInteger(p.items)||p.items<1||p.items>H.MAX_ARTIFACT_ITEMS)throw Error('INVALID_SHARED_PAGE_REFERENCE');
 if(index.total!==index.pages.reduce((n,p)=>n+p.items,0)||index.pages.length&&(!index.enabled||!index.routingActive||!index.available))throw Error('INVALID_SHARED_INDEX_GATES');
 return index;
}
function validatePage(index,bytes,pageNumber,options){
 validateIndex(index,options);const ref=index.pages[pageNumber-1];if(!ref||S.hash(bytes)!==ref.sha256||blob(bytes)!==ref.gitBlobSha||Buffer.byteLength(bytes)!==ref.bytes)throw Error('MISSING_OR_TAMPERED_SHARED_PAGE');
 const page=JSON.parse(bytes);if(page.schema!=='forge.shared-helper-page.v1'||raw(page.source)!==raw(index.source)||page.taskKey!==index.taskKey||page.provider!==index.provider||page.pageNumber!==pageNumber||page.evaluatedAt!==index.evaluatedAt||page.validUntil!==index.validUntil||page.items.length!==ref.items)throw Error('INVALID_SHARED_PAGE_BINDING');return page;
}
// Historical pages need not remain referenced by current.json, but every newly
// published immutable file must still be a correctly named, provider-only page.
function validateImmutableFile(root,file){
 const content=fs.readFileSync(path.join(root,file)),page=JSON.parse(content);
 if(classify(file)!=='IMMUTABLE'||file!==pagePath(page.taskKey,S.hash(content))||page.schema!=='forge.shared-helper-page.v1'||H.TASKS[page.taskKey]!==page.provider||page.source?.file!==H.FILE||!/^[a-f0-9]{64}$/.test(page.source.sha256||'')||!/^[a-f0-9]{40}$/.test(page.source.gitBlobSha||'')||page.assignmentId!==page.source.assignmentId||page.sourceAt!==page.source.sourceAt||!Number.isInteger(page.pageNumber)||page.pageNumber<1||!Array.isArray(page.items)||!page.items.length||page.items.length>H.MAX_ARTIFACT_ITEMS||page.items.some(item=>item.taskKey!==page.taskKey||item.provider!==page.provider||item.status!=='ASSIGNED'))throw Error('INVALID_IMMUTABLE_SHARED_PAGE');
 return page;
}
function validateStored(root,{now=Date.now(),required=false,allowExpired=false}={}){
 const present=tasks.filter(t=>fs.existsSync(path.join(root,indexPath(t))));
 if(!required&&!present.length)return{present:false};
 if(present.length!==tasks.length)throw Error('MISSING_SHARED_PROJECTION_INDEX');
 const bytes=fs.readFileSync(path.join(root,H.FILE));
 for(const taskKey of tasks){const index=S.read(root,indexPath(taskKey));const checkedAt=allowExpired?Date.parse(index.evaluatedAt):now;validateIndex(index,{taskKey,workBlobSha:blob(bytes),now:checkedAt});
  const expected=build(bytes,{now:Date.parse(index.evaluatedAt)});if(raw(index)!==raw(expected.indexes[indexPath(taskKey)]))throw Error('INVALID_SHARED_PROJECTION_CONTENT');
  for(let n=0;n<index.pages.length;n++){const ref=index.pages[n],content=fs.readFileSync(path.join(root,ref.file));validatePage(index,content,n+1,{taskKey,workBlobSha:blob(bytes),now:checkedAt});if(content.toString()!==raw(expected.files[ref.file]))throw Error('INVALID_SHARED_PROJECTION_CONTENT');}
 }
 return{present:true,valid:true};
}
module.exports={BASE,indexPath,classify,blob,binding,build,generate,validateIndex,validatePage,validateStored,validateImmutableFile};
