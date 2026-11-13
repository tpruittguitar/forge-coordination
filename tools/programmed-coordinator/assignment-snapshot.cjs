'use strict';
// Mail processing can outlive the canonical snapshot even without any writes.
// Refresh before handing it to assignment planning; never relax its 15m gate.
const BUDGET=14*60*1000;
function reusable(snapshot,now){const at=Date.parse(snapshot?.source?.readAt);return Number.isFinite(at)&&at<=now&&now-at<BUDGET;}
async function refresh(snapshot,read,{force=false,clock=Date.now}={}){
 if(!force&&reusable(snapshot,clock()))return snapshot;
 const fresh=await read();
 if(!reusable(fresh,clock()))throw Error('FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED');
 return fresh;
}
module.exports={refresh};
