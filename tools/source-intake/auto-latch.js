'use strict';
/* AUTO intake latch (Claude 2026-10-26). Pure read of receipts/auto-intake/<run>.json state files; no Writer calls.
 * Shared by auto-run.js (decides whether a new run may start) and tools/needs-tim/build.js (puts the latch on the
 * "Needs you" board, so a latched run is visible without a red Actions run every trigger).
 *   blocking    : earlier runs that stop every later run until a person reconciles them (UNKNOWN POST, HOLD, etc.)
 *   quarantined : runs whose ONLY open case is one durably captured INSERT_IDENTITY_MISMATCH HOLD; later runs may proceed
 *                 with untouched candidates, but the HOLD is still unresolved.
 * A <run>.candidates.json without its state file stopped before any Writer POST and is ignored. */
const fs=require('node:fs'),path=require('node:path');
const DIR='receipts/auto-intake';
const {requestId}=require('./production-executor');
// Conservatively fence the employer/title family: a changed URL, country label, ZIP or site spelling cannot replay it.
const identityKey=r=>[String(r.COMPANY||'').replace(/\b(incorporated|corporation|corp|inc|llc|ltd|limited)\b/gi,''),r.TITLE].map(v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()).join('|');
// Explicit operator containment is not reconciliation: the original outcome stays UNKNOWN.
function isolatedUnknown(state){
 const q=state.quarantine,r=state.results?.[q?.requestId];
 if(!q||q.schema!=='forge.intake-quarantine.v1'||q.status!=='UNKNOWN_NO_REPLAY'||q.authorizedBy!=='Tim'||
    !Number.isFinite(Date.parse(q.at))||!q.record||q.candidatesHash!==state.candidatesHash||
    requestId(q.record)!==q.requestId||!(state.requestIds||[]).includes(q.requestId)||
    !r||r.ok===true||r.WRITE_ACCEPTED===true||!Array.isArray(q.proofs)||!q.proofs.length||
    !Array.isArray(q.carryForwardRequestIds)||q.carryForwardRequestIds.some(id=>!(state.requestIds||[]).includes(id)||Object.hasOwn(state.results||{},id))||
    new Set(q.carryForwardRequestIds).size!==q.carryForwardRequestIds.length||
    (state.requestIds||[]).some(id=>!Object.hasOwn(state.results||{},id)&&!q.carryForwardRequestIds.includes(id)))return null;
 return {requestId:q.requestId,reason:'UNKNOWN_NO_REPLAY; operator-contained, not resolved',record:q.record,identityKey:identityKey(q.record)};
}

function previous(root='.'){
 const dir=path.join(root,DIR);
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.endsWith('.candidates.json')).sort()
  .map(f=>({file:path.join(DIR,f).split(path.sep).join('/'),state:JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))}));
}
// The single exact shape that may be isolated (unchanged from auto-run.js before 2026-10-26).
function isolatedIdentityHold(state){
 const halt=state.halts?.at(-1),out=halt?.outcomes||[];
 const held=out.filter(x=>x.status==='HOLD');
 const exact=halt?.message==='HOLD: resumed case not verified (INSERT_IDENTITY_MISMATCH)'&&
  held.length===1&&held[0].reason===halt.message&&out.at(-1)===held[0]&&
  Object.hasOwn(state.results||{},held[0].requestId)&&
  state.results[held[0].requestId]?.WRITE_ACCEPTED===true&&
  state.results[held[0].requestId]?.receipt?.REQUEST_ID===held[0].requestId&&
  (state.results[held[0].requestId]?.receipt?.NEW_PRIMARY_IDS||[]).length===1&&
  out.slice(0,-1).every(x=>['SKIPPED','RESUMED_ACCOUNTED'].includes(x.status))&&
  out.every(x=>Object.hasOwn(state.results||{},x.requestId));
 return exact?{requestId:held[0].requestId,reason:halt.message}:null;
}
// The request the halted run was on when it stopped: the first request with no accounted outcome in the last halt.
function stoppedAt(state){
 // A crash can leave a newer durable intent after the last accepted-write halt.
 const inFlight=(state.requestIds||[]).find(id=>state.results?.[id]?.status==='POST_IN_FLIGHT_UNKNOWN');
 if(inFlight)return inFlight;
 const halt=state.halts?.at(-1),done=new Set((halt?.outcomes||[]).filter(x=>['SKIPPED','RESUMED_ACCOUNTED','NOOP_ACCOUNTED','IDENTITY_MISMATCH_SKIPPED'].includes(x.status)).map(x=>x.requestId));
 const open=(halt?.outcomes||[]).find(x=>!done.has(x.requestId));
 if(open)return open.requestId;
 return (state.requestIds||[]).find(r=>!done.has(r))||null;
}
function latch(prior){
 const blocking=[],quarantined=[];
 for(const p of prior){
  if(p.state.reconciliation||p.state.noCandidates||require("./unknown-recovery").resolved(p.state))continue;
  const continuation=p.state.continuation;
  if(continuation?.schema==='forge.intake-continuation.v1'&&continuation.candidatesHash===p.state.candidatesHash&&Array.isArray(continuation.pending)&&continuation.pending.length&&
     Array.isArray(p.state.outcomes)&&p.state.outcomes.length===p.state.requestIds?.length&&new Set(p.state.outcomes.map(x=>x.requestId)).size===p.state.requestIds.length&&
     p.state.outcomes.every(x=>p.state.requestIds.includes(x.requestId)&&['SKIPPED','NOOP_ACCOUNTED','RESUMED_ACCOUNTED','DEFERRED'].includes(x.status))&&
     p.state.outcomes.filter(x=>x.status==='DEFERRED').length===continuation.pending.length&&new Set(continuation.pending.map(x=>x.requestId)).size===continuation.pending.length&&
     continuation.pending.every(x=>requestId(x.record)===x.requestId&&Object.hasOwn(p.state.results||{},x.requestId)&&p.state.outcomes.some(o=>o.requestId===x.requestId&&o.status==='DEFERRED'))){
   for(const item of continuation.pending)quarantined.push({file:p.file,run:p.state.sourceRunId||'',...item,identityKey:identityKey(item.record),reason:item.reason||'PENDING_GOFER_RECONCILIATION'});
   continue;
  }
  const halt=p.state.halts?.at(-1)||null,iso=isolatedIdentityHold(p.state)||isolatedUnknown(p.state);
  if(iso){
   const extra=p.state.quarantine?.additionalUnknowns||[];
   if(!Array.isArray(extra)||new Set(extra.map(x=>x.requestId)).size!==extra.length||extra.some(x=>!x.record||requestId(x.record)!==x.requestId||x.requestId===iso.requestId||!p.state.requestIds.includes(x.requestId)||!p.state.results?.[x.requestId]||p.state.results[x.requestId].WRITE_ACCEPTED||p.state.results[x.requestId].writeId)){blocking.push({file:p.file,message:'Invalid additional request fences'});continue;}
   quarantined.push({file:p.file,run:p.state.sourceRunId||'',...iso});
   for(const x of extra)quarantined.push({file:p.file,run:p.state.sourceRunId||'',...x,identityKey:identityKey(x.record),reason:'UNKNOWN_NO_REPLAY; additional original contention'});
   continue;
  }
  blocking.push({file:p.file,run:p.state.sourceRunId||'',haltAt:halt?.at||null,message:halt?.message||'run stopped without a recorded halt',requestId:stoppedAt(p.state)});
 }
 return {blocking,quarantined};
}
module.exports={DIR,previous,latch,isolatedIdentityHold,isolatedUnknown,identityKey,stoppedAt};
