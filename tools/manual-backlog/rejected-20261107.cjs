'use strict';
// One incident, two exact requests. Offline evidence construction only; no I/O or replay.
const D=require('./decisions.cjs');
const CASES={
 '8ac4b5c1c08625d72b77b79b0f40eaeb567ba17b97b7e69f7ab23dbffe4ca08c':'2026-11-07T00:54:34.520Z',
 '04e55b35b00dccff5ac9e8cbd00de9d3925b2ee3e9ba69e36ad6195e1a7e07e1':'2026-11-07T00:59:36.998Z'
};
const SOURCE_SHA256='82517557c54fc40c2ab85c756a180e4b832eb259f872e5ee07977116f3534bd8';
function build(request,source){
 const normalized=D.normalize(request),id=D.hash(normalized);
 if(!CASES[id]||request.receiptId!==id||normalized.scope!==undefined)throw Error('EXACT_REJECTED_INCIDENT_REQUEST_REQUIRED');
 if(D.hash(source)!==SOURCE_SHA256)throw Error('PINNED_DEPLOYED_IMPLEMENTATION_REQUIRED');
 const rejectedKeys=normalized.items.map(i=>i.key).filter(k=>!/^(linkedin:\d+|url:[a-f0-9]{24})$/.test(k));
 if(!rejectedKeys.length)throw Error('VALIDATOR_REJECTION_PROOF_REQUIRED');
 return {schema:'forge.manual-backlog-receipt.v1',receiptId:id,requestId:normalized.requestId,status:'COMPLETE',decision:normalized.decision,snapshotRevision:normalized.snapshotRevision,observedAt:'2026-11-07T01:24:17Z',canonicalWrites:0,queueWrites:0,
  items:normalized.items.map(i=>({...i,decision:normalized.decision,status:'NOT_ACCEPTED',reason:'VALIDATOR_REJECTED_BEFORE_QUEUE'})),
  evidence:{schema:'forge.manual-backlog-negative-evidence.v1',kind:'STATIC_PRE_QUEUE_REJECTION',request:normalized,clientAttemptAt:CASES[id],
   implementation:{repository:'tpruittguitar/foreman-cockpit',commit:'fcc611db72617299ba6fc450a1db358a6b020519',path:'functions/api/backlog-decisions.js',gitBlobSha:'1673c6b8152d324319c7a2ea32228c60a8823fff',sha256:SOURCE_SHA256},
   rejectedKeys,validatorError:'UNIQUE_DISCOVERY_KEYS_REQUIRED',explanation:'The pinned deployed handler rejects the entire request in normalize before computing its receipt key or calling kv.put. Earlier auth, capability, or transport failures could also prevent acceptance; this is not an assertion of a captured HTTP response.',
   corroboration:{observedAt:'2026-11-07T01:07:00Z',timePrecision:'approximate minute',queueRead:{method:'GET',path:'/api/backlog-decisions?action=queue',httpStatus:200,requests:0,cursor:null},committedManualReceipts:0},
   effects:'No candidate dismissal or canonical mutation. This receipt closes only the failed original submission; it does not resubmit, upgrade scope, or authorize a replacement request.'}};
}
module.exports={build,CASES,SOURCE_SHA256};
