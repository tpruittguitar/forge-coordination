'use strict';
// Operational snapshot diagnostic, never a PR code gate or a write/replay path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='control/GROK_INTAKE_HELPER_WORK.json';
function inspect(root,now=Date.now()){
 const evidenceFiles=[],hash=crypto.createHash('sha256'),findings=[];
 const out={schema:'forge.intake-assignment-health.v1',at:new Date(now).toISOString(),status:'NOT_CONFIGURED',checkedItems:0,issueCount:0,counts:{},findings,evidenceFiles};
 function load(file){evidenceFiles.push(file);const raw=fs.readFileSync(path.join(root,file),'utf8');hash.update(file+'\0'+raw+'\0');return JSON.parse(raw);}
 function issue(code,key){out.issueCount++;out.counts[code]=(out.counts[code]||0)+1;if(findings.length<20)findings.push({code,...(key?{key}:{})});}
 if(!fs.existsSync(path.join(root,FILE)))return out;
 try{
  const work=load(FILE);
  if(work.schema!=='forge.intake-helper-work.v1'||work.owner!=='Grok'||work.taskKey!=='FORGE_GROK_INTAKE_HELPER'||!Array.isArray(work.keys)||!Array.isArray(work.pages)||typeof work.enabled!=='boolean'||typeof work.routingActive!=='boolean')throw Error('INVALID_ASSIGNMENT');
  if(!work.enabled||!work.routingActive){out.status='INACTIVE';out.inputSha256=hash.digest('hex');return out;}
  if(new Set(work.keys).size!==work.keys.length)issue('DUPLICATE_ASSIGNMENT_KEYS');
  const claude=load('control/CLAUDE_RELEVANCE_WORK.json'),consumed=load('state/CLAUDE_HELPER_CONSUMPTION.json'),queue=load('state/EMAIL_RECOVERY_QUEUE.json');
  if(!Array.isArray(claude.keys)||!Array.isArray(consumed.items)||!queue.jobs||typeof queue.jobs!=='object')throw Error('INVALID_ASSIGNMENT_DEPENDENCIES');
  const reserved=new Set(claude.enabled?claude.keys:[]),items=new Map(consumed.items.map(i=>[i.key,i]));
  for(const page of work.pages){
   if(typeof page.path!=='string'||!/^control\/grok-intake\/[A-Za-z0-9_.-]+\.json$/.test(page.path)||page.path.includes('..'))throw Error('INVALID_ASSIGNMENT_PAGE');
   const content=load(page.path);if(!Array.isArray(content.items))throw Error('INVALID_ASSIGNMENT_PAGE');
   for(const item of content.items){
    if(typeof item.key!=='string'||item.aliases!=null&&!Array.isArray(item.aliases))throw Error('INVALID_ASSIGNMENT_ITEM');
    out.checkedItems++;const names=[item.key,...item.aliases||[]];
    if(names.some(k=>reserved.has(k)))issue('CLAUDE_KEY_OR_ALIAS_COLLISION',item.key);
    const saved=items.get(item.key);
    if(!saved)issue('MISSING_SOURCE_ITEM',item.key);
    else if(saved.requestId||/VERIFIED|HELD_WRITER|SUBMIT|POST_IN_FLIGHT|EXCLUDED|CLOSED/.test(saved.status))issue('TERMINAL_OR_PENDING_REQUEST',item.key);
    if(queue.jobs[item.key]?.submissions?.length)issue('QUEUED_SUBMISSION',item.key);
   }
  }
  out.status=out.issueCount?'ACTION_REQUIRED':'HEALTHY';
 }catch(e){issue('UNREADABLE_OR_INVALID_ASSIGNMENT');out.status='UNKNOWN';}
 out.inputSha256=hash.digest('hex');return out;
}
if(require.main===module){const out=inspect(process.argv[2]||'.');console.log(JSON.stringify(out,null,2));if(['ACTION_REQUIRED','UNKNOWN'].includes(out.status))process.exitCode=1;}
module.exports={inspect,FILE};
