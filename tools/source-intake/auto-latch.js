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
 const halt=state.halts?.at(-1),done=new Set((halt?.outcomes||[]).filter(x=>['SKIPPED','RESUMED_ACCOUNTED','NOOP_ACCOUNTED','IDENTITY_MISMATCH_SKIPPED'].includes(x.status)).map(x=>x.requestId));
 const open=(halt?.outcomes||[]).find(x=>!done.has(x.requestId));
 if(open)return open.requestId;
 return (state.requestIds||[]).find(r=>!done.has(r))||null;
}
function latch(prior){
 const blocking=[],quarantined=[];
 for(const p of prior){
  if(p.state.reconciliation||p.state.noCandidates)continue;
  const halt=p.state.halts?.at(-1)||null,iso=isolatedIdentityHold(p.state);
  if(iso){quarantined.push({file:p.file,run:p.state.sourceRunId||'',...iso});continue}
  blocking.push({file:p.file,run:p.state.sourceRunId||'',haltAt:halt?.at||null,message:halt?.message||'run stopped without a recorded halt',requestId:stoppedAt(p.state)});
 }
 return {blocking,quarantined};
}
module.exports={DIR,previous,latch,isolatedIdentityHold,stoppedAt};
