'use strict';
// A recovered pre-existing write has no acceptance response in the interrupted run.
// Keep its independently verified identity out of later discovery selections without
// inventing a Writer response or treating the untouched tail as attempted.
function knownRequestIds(prior){
 const ids=new Set(prior.flatMap(p=>Object.keys(p.state.results||{}).filter(id=>!(p.resolvedRequestIds||[]).includes(id)||p.state.requestResolutions?.[id]?.status!=='CONFIRMED_NO_MASTER_WRITE'||p.state.requestResolutions[id].retryEligible!==true)));
 for(const {state:s} of prior){
  // A locally rejected title never gets a Writer response. Do not select it again
  // on the next AUTO pass. A changed title yields a different request identity.
  for(const o of s.outcomes||[])if(o.status==='SKIPPED'&&o.reason==='OUT_OF_SCOPE:NOT_LEADERSHIP_LEVEL'&&(s.requestIds||[]).includes(o.requestId))ids.add(o.requestId);
  const r=s.reconciliation;
  if(r?.status!=='RECONCILED_INTERRUPTED_RUN_WITH_CARRY_FORWARD')continue;
  for(const p of r.preExistingCompleteRequests||[]){
   if(p.receiptState!=='COMPLETE'||p.exactRowVerified!==true||!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(p.primaryId||'')||
      !(s.requestIds||[]).includes(p.requestId)||!(r.proofs||[]).includes(p.proof))
    throw Error('BLOCKED: invalid recovered existing-request evidence');
   ids.add(p.requestId);
  }
 }
 return ids;
}
module.exports={knownRequestIds};
