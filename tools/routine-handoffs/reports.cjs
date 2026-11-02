'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs');
const schemas={
 'forge.claude-helper-batch.v1':b=>'receipts/CLAUDE_HELPERS/'+b.taskKey+'/'+b.runId+'.json',
 'forge.intake-helper-batch.v1':b=>'receipts/GROK_HELPERS/'+b.taskKey+'/'+b.runId+'.json',
 'forge.enrichment-helper-batch.v1':b=>'receipts/GROK_HELPERS/'+b.taskKey+'/'+b.runId+'.json',
 'forge.relevance-helper-batch.v1':b=>'receipts/CLAUDE_RELEVANCE/'+b.runId+'.json',
 'forge.outcome-helper-batch.v1':b=>'helper-outcomes/'+b.runId+'.json'
};
const canonical=x=>JSON.stringify(Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
// Parse complete JSON objects, respecting quoted braces/escapes. A notification
// excerpt or unfinished fence never becomes a completed batch.
function batches(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>2_000_000)throw Error('REPORT_FORMAT_LIMIT');
 // Some supported captures encode a complete report as a JSON string. Decode
 // only valid complete strings; never repair a truncated transport or payload.
 for(let n=0;n<3;n++){try{const value=JSON.parse(text);if(typeof value!=='string')break;text=value;}catch{break;}}
 const found=[];let start=-1,depth=0,quoted=false,escape=false;
 for(let n=0;n<text.length;n++){
  const c=text[n];if(start<0){if(c==='{'){start=n;depth=1;quoted=false;escape=false;}continue;}
  if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
  if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){
   const raw=text.slice(start,n+1);start=-1;
   try{const value=JSON.parse(raw);if(schemas[value.schema])found.push({value,raw});}catch{}
  }
 }
 return found;
}
function empty(){return{schema:'forge.helper-transport.v1',artifacts:{},reports:{},cursors:{},exceptions:{},privateOutcomeBatches:[]};}
function ingest({root,privateDir,state,text,source,commit,validate=C.validateEnvelope,routing=C.routingProof}){
 if(source.complete!==true)throw Error('FULL_REPORT_REQUIRED');
 const sourceHash=S.hash(text),id=S.hash({provider:source.provider,taskKey:source.taskKey,id:source.id}),prior=state.reports[id];
 S.immutable(privateDir,'helper-reports/'+sourceHash+'.txt.json',{text});
 if(prior?.sha256===sourceHash&&!state.exceptions[id])return{duplicate:true,imported:0};
 if(prior&&prior.sha256!==sourceHash){state.exceptions[id]={owner:'CODE',reason:'IMMUTABLE_REPORT_CHANGED',sourceHash};return{quarantined:true,imported:0};}
 // Persist the full report privately before acknowledging transport. It can be
 // reparsed later even if one malformed batch needs correction.
 S.immutable(privateDir,'helper-reports/'+sourceHash+'.txt.json',{text});
 const parsed=batches(text),results=[];
 // Native Claude reports often link the immutable receipt already delivered to
 // this repository. Read only allowlisted receipt paths and revalidate the full
 // envelope/routing below; prose never becomes fabricated structured evidence.
 const references=[...new Set(text.match(/receipts\/(?:CLAUDE_RELEVANCE\/|(?:CLAUDE_HELPERS|GROK_HELPERS)\/FORGE_[A-Z0-9_]+\/)[A-Za-z0-9_-]+\.json/g)||[])];
 for(const relative of references){const filename=path.join(root,relative);if(!fs.existsSync(filename))continue;for(const b of batches(fs.readFileSync(filename,'utf8')))if(!parsed.some(p=>canonical(p.value)===canonical(b.value)))parsed.push(b);}
 for(const {value:b,raw} of parsed){
  try{
   if(!/^[A-Za-z0-9_-]{3,160}$/.test(b.runId||'')||!/^[A-Z][A-Z0-9_]{3,80}$/.test(b.taskKey||'')||!source.provider||source.provider!==b.provider||source.taskKey!==b.taskKey||S.read(root,'control/AI_AUTOMATION_TASKS.json').tasks[b.taskKey]?.owner!==b.provider)throw Error('REPORT_TASK_OR_PROVIDER_MISMATCH');
   const privateBatch=b.schema==='forge.outcome-helper-batch.v1',relative=schemas[b.schema](b),targetRoot=privateBatch?privateDir:root,dest=path.join(targetRoot,relative);
   if(fs.existsSync(dest)){
    if(canonical(JSON.parse(fs.readFileSync(dest,'utf8')))!==canonical(b))throw Error('IMMUTABLE_BATCH_COLLISION');
    results.push({status:'DUPLICATE',batchHash:S.hash(canonical(b)),private:privateBatch});continue;
   }
   validate(root,b);routing(root,b,commit);
   fs.mkdirSync(path.dirname(dest),{recursive:true});const fd=fs.openSync(dest,'wx',0o600);
   try{fs.writeFileSync(fd,raw+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   if(privateBatch&&!state.privateOutcomeBatches.includes(relative))state.privateOutcomeBatches.push(relative);
   results.push({status:'IMPORTED',batchHash:S.hash(canonical(b)),path:privateBatch?null:relative,private:privateBatch});
  }catch(e){results.push({status:'QUARANTINED',reason:e.message,batchHash:S.hash(raw)});}
 }
 state.reports[id]={sha256:sourceHash,taskKey:source.taskKey,provider:source.provider,results,fullReportSaved:true,checkedAgainst:commit};
 if(!parsed.length||results.some(r=>r.status==='QUARANTINED'))state.exceptions[id]={owner:'CODE',reason:!parsed.length?'NO_COMPLETE_BATCH_IN_REPORT':'REPORT_CORRECTION_REQUIRED',sourceHash};
 else delete state.exceptions[id];
 return{imported:results.filter(r=>r.status==='IMPORTED').length,quarantined:results.filter(r=>r.status==='QUARANTINED').length};
}
async function collectFeed({feed,root,privateDir,state,commit,save=()=>{},ingestReport=ingest}){
 const cursorKey=S.hash({provider:feed.provider,taskKey:feed.taskKey,id:feed.id}),seen=new Set();let cursor=state.cursors[cursorKey]??null,imported=0;
 for(;;){
  const page=await feed.list({cursor});
  if(!page||!Array.isArray(page.reports)||typeof page.exhausted!=='boolean')throw Error('INVALID_REPORT_PAGE');
  for(const report of page.reports){
   const full=await feed.read(report);
   const result=ingestReport({root,privateDir,state,text:full.text,source:{provider:feed.provider,taskKey:feed.taskKey,id:report.id,complete:full.complete},commit});imported+=result.imported;
   await save(); // Cursor never moves ahead of durable full reports.
  }
  if(page.incomplete)throw Error('NATIVE_REPORT_LIST_INCOMPLETE');
  if(page.exhausted){state.cursors[cursorKey]=page.resumeCursor??cursor;await save();return{imported,exhausted:true};}
  if(!page.nextCursor||page.nextCursor===cursor||seen.has(page.nextCursor))throw Error('REPORT_CURSOR_CYCLE');
  seen.add(page.nextCursor);cursor=page.nextCursor;state.cursors[cursorKey]=cursor;await save();
 }
}
function scanInboxes({root,privateDir,state,commit,inboxes=[],python=process.env.FORGE_PYTHON||'python',validate}){
 let imported=0;
 for(const inbox of inboxes){
  if(!path.isAbsolute(inbox.directory))throw Error('ABSOLUTE_INBOX_REQUIRED');
  if(!fs.existsSync(inbox.directory))continue;
  const pattern=new RegExp(inbox.pattern||'^(?:GROK-|CLAUDE-|forge-helper-|claude-helper-batches).*\\.(?:json|jsonl|txt|md|zip)$','i');
  for(const entry of fs.readdirSync(inbox.directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(!entry.isFile()||!pattern.test(entry.name))continue;
   const filename=path.join(inbox.directory,entry.name),stat=fs.statSync(filename);
   if(stat.size>64_000_000){state.exceptions[S.hash(filename)]={owner:'CODE',reason:'ARTIFACT_FORMAT_LIMIT'};continue;}
   const sha=S.hash(fs.readFileSync(filename)),artifactId=S.hash(filename);
   if(state.artifacts[artifactId]?.sha256===sha&&state.artifacts[artifactId].status==='COLLECTED'&&state.artifacts[artifactId].checkedAgainst===commit)continue;
   try{
    const reports=/\.zip$/i.test(entry.name)?JSON.parse(cp.execFileSync(python,[path.join(__dirname,'artifact-reader.py'),filename],{encoding:'utf8',maxBuffer:70e6,windowsHide:true})): [{name:entry.name,text:fs.readFileSync(filename,'utf8')}];
    let batchCount=0;
    for(const report of reports){
     S.immutable(privateDir,'helper-reports/'+S.hash(report.text)+'.txt.json',{text:report.text});
     const parsed=batches(report.text);
     // Identity is derived only from a complete envelope and cross-checked
     // against the current registry. No prose-derived routing is accepted.
     const tasks=new Set(parsed.map(x=>x.value.taskKey));
     if(!tasks.size)continue;
     batchCount+=parsed.length;
     for(const taskKey of tasks){const subset=parsed.filter(x=>x.value.taskKey===taskKey),provider=subset[0].value.provider;
      const result=ingest({root,privateDir,state,text:subset.map(x=>x.raw).join('\n'),source:{id:sha+':'+report.name+':'+taskKey,provider,taskKey,complete:true},commit,validate});imported+=result.imported;
     }
    }
    if(!batchCount)throw Error('NO_COMPLETE_BATCH_IN_ARTIFACT');
    state.artifacts[artifactId]={sha256:sha,status:'COLLECTED',checkedAgainst:commit};delete state.exceptions[artifactId];
   }catch(e){state.artifacts[artifactId]={sha256:sha,status:'PENDING_CORRECTION'};state.exceptions[artifactId]={owner:'CODE',reason:/^[A-Z][A-Z0-9_]{3,100}$/.test(e.message||'')?e.message:'REPORT_ARTIFACT_READ_FAILED',errorSha256:S.hash(e.message)};}
  }
 }
 return{imported};
}
module.exports={empty,batches,ingest,collectFeed,scanInboxes,canonical};
