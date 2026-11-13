'use strict';
// Read-only projection of cached fences. Never releases an active submission,
// fabricates a refusal, or authorizes replay of the original request.
const S=require('../programmed-coordinator/store.cjs'),O=require('../writer-outcome.cjs');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function reader(root){
 const cache=new Map();
 function proof(id){
  if(cache.has(id))return cache.get(id);
  let keys=null;
  try{
   if(!/^FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+$/.test(id))throw Error('INVALID_ID');
   const base='receipts/'+id,p=S.read(root,base+'_NOT_ACCEPTED.json'),c=S.read(root,base+'_CHECKPOINT.json'),a=S.read(root,base+'_ACCEPTANCE.json');
   const outcome=O.classify(p.responseProjection,{requestId:id});
   if(p.schema!=='forge.intake-not-accepted.v1'||[p,c,a].some(x=>x.requestId!==id)||p.reason!=='INTAKE_REQUEST_BOUND_BEFORE_MUTATION'||p.originalRequestMustNotBeReplayed!==true||p.canonicalWrites!==0||!sha(p.payloadSha256)||p.payloadSha256!==c.payloadSha256||!sha(p.responseSha256)||p.responseSha256!==a.responseSha256||!Number.isSafeInteger(c.records)||c.records<1||p.records!==c.records||!Array.isArray(c.keys)||c.keys.length!==c.records||new Set(c.keys).size!==c.records||!Array.isArray(c.queueKeys)||c.queueKeys.length!==c.records||!Number.isFinite(Date.parse(p.at))||!/^[a-f0-9]{40}$/.test(p.indexSha||'')||!/^[a-f0-9]{7,40}$/.test(p.writerCommit||'')||!O.validProjection(p.responseProjection,p.responseProjectionSha256,{requestId:id})||outcome.kind!=='NOT_ACCEPTED'||outcome.retryable!==true||!['WRITER_BUSY','WRITE_FENCE'].includes(outcome.code))throw Error('UNBOUND_REFUSAL');
   keys=new Set([...c.keys,...c.queueKeys].filter(k=>typeof k==='string'&&k));
  }catch{} // Missing, malformed, legacy or differently bound evidence retains the fence.
  cache.set(id,keys);return keys;
 }
 function refused(id,key){const keys=proof(id);return !!keys&&keys.has(key);}
 function filter(fence,key){
  if(!fence||!Array.isArray(fence.requestIds)||!fence.requestIds.length||fence.requestIds.some(id=>typeof id!=='string'||!id)||Object.keys(fence).some(k=>!['requestIds','proof','record'].includes(k)))return fence;
  const requestIds=fence.requestIds.filter(id=>!refused(id,key,fence.record));
  if(requestIds.length===fence.requestIds.length)return fence;
  return requestIds.length?{...fence,requestIds}:undefined;
 }
 return{refused,filter};
}
module.exports={reader};
