'use strict';
// Operator-reconciled runs retain their unattempted tail even after source reports roll over.
// These are discovery inputs only: current filters, live evidence and Writer gates still apply.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {requestId}=require('./production-executor');
const {knownRequestIds}=require('./known-requests');
function carryForwardRoles(prior,{root='.'}={}){
 const sent=knownRequestIds(prior),seen=new Set(),roles=[];
 for(const p of prior){
  const ids=p.state.reconciliation?.carryForwardRequestIds;
  if(ids===undefined)continue;
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('BLOCKED: invalid carry-forward identities');
  const candidates=JSON.parse(fs.readFileSync(path.join(root,p.file.replace(/\.json$/,'.candidates.json')),'utf8'));
  const hash=crypto.createHash('sha256').update(JSON.stringify(candidates)).digest('hex');
  if(hash!==p.state.candidatesHash)throw Error('BLOCKED: carry-forward candidate hash mismatch');
  const byId=new Map(candidates.map(c=>[requestId(c.record),c]));
  for(const id of ids){
   if(!p.state.requestIds.includes(id)||Object.hasOwn(p.state.results||{},id)||!byId.has(id))throw Error('BLOCKED: carry-forward is not an untouched original candidate');
   if(sent.has(id)||seen.has(id))continue;
   seen.add(id);const c=byId.get(id),r=c.record;
   roles.push({company:r.COMPANY,title:r.TITLE,location:r.LOCATION,url:r.SOURCE_URL,level:c.level,family:c.family,source:c.source||'RECOVERY_CARRY_FORWARD',status:'NEW',recoveredFrom:p.state.sourceRunId});
  }
 }
 return roles;
}
module.exports={carryForwardRoles};
