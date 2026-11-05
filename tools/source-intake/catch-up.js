'use strict';
// Persistent discovery inventory. This authorizes no writes: normal live gates,
// source verification, helper reservations and original-request fences still apply.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {requestId}=require('./production-executor'),{normalizeCompany}=require('./record-normalize');
const FILE='receipts/auto-intake/catch-up/state.json';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const id=r=>requestId({COMPANY:normalizeCompany(r.company).company,TITLE:r.title,LOCATION:r.location,SOURCE_URL:r.url});
function load(root='.') {const file=path.join(root,FILE);if(!fs.existsSync(file))return{schema:'forge.intake-catch-up.v1',roles:{}};const s=JSON.parse(fs.readFileSync(file));if(s.schema!=='forge.intake-catch-up.v1'||!s.roles)throw Error('INVALID_CATCH_UP_INVENTORY');return s;}
function ingest(state,reports,now=Date.now()) {
 const observed=new Set();
 for(const report of reports)for(const role of report.new_roles||[]){if(!role.company||!role.title||!role.location||!role.url)continue;const key=id(role);if(observed.has(key))continue;observed.add(key);const version=hash({company:normalizeCompany(role.company).company,title:role.title,location:role.location,url:role.url,sourceSha256:role.sourceSha256||null,description:role.description||null}),old=state.roles[key];
  if(!old||old.sourceHash!==version)state.roles[key]={role,sourceHash:version,firstSeen:old?.firstSeen||new Date(now).toISOString(),observedAt:new Date(now).toISOString()};
 }
 return state;
}
function due(state,now=Date.now()){return Object.values(state.roles).filter(x=>!x.retryAfter||Date.parse(x.retryAfter)<=now).map(x=>x.role);}
function defer(state,role,now=Date.now()){const x=state.roles[id(role)];if(!x)return;x.status='WAITING_SOURCE_RETRY';x.reason='SOURCE_EVIDENCE_UNAVAILABLE';x.lastAttempt=new Date(now).toISOString();x.retryAfter=new Date(now+3600000).toISOString();x.owner='CODE';}
function report(state,{sent=new Set(),quarantined=[],blocking=[]}={},now=Date.now()){
 const pending=new Set(quarantined.map(x=>x.requestId));let unattempted=0,waitingRetry=0,attempted=0;
 for(const [key,x]of Object.entries(state.roles)){if(sent.has(key)||sent.has(requestId({COMPANY:x.role.company,TITLE:x.role.title,LOCATION:x.role.location,SOURCE_URL:x.role.url}))){attempted++;continue;}if(x.retryAfter&&Date.parse(x.retryAfter)>now)waitingRetry++;else unattempted++;}
 return{scope:'Saved discovery candidates; admission still requires current screening and live evidence',at:new Date(now).toISOString(),unattempted,waitingSourceRetry:waitingRetry,attempted,unresolvedRequests:pending.size,blockingRuns:blocking.length,canonicalCompletionsClaimed:0};
}
function save(root,state){const file=path.join(root,FILE);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp',fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,JSON.stringify(state,null,1)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
module.exports={FILE,id,load,ingest,due,defer,report,save};
