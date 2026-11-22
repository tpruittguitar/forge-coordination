'use strict';
// Exact-five review/compare extension of the existing allocator. Never claims.
const API=require('../helper-routing/api-grant.cjs');
const S=require('../programmed-coordinator/store.cjs');
const fail=c=>{throw Error(c);};
function preview(options){
 const {ids,snapshot,state}=options;
 if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5)fail('EXACTLY_FIVE_DISTINCT_IDS_REQUIRED');
 const proof=snapshot?.policyProof;
 if(proof?.repo!=='tpruittguitar/forge-policy'||proof.path!=='rules/TIM_PIPELINE_RULES_CANONICAL.txt'||proof.branch!=='main'||
  !/^[a-f0-9]{40}$/.test(proof.commit||'')||!/^[a-f0-9]{40}$/.test(proof.blob||'')||!/^[a-f0-9]{64}$/.test(proof.rawSha256||''))fail('CURRENT_POLICY_SOURCE_CHAIN_REQUIRED');
 for(const id of ids)if(snapshot.neverConsiderById?.[id]?.policySha256!==proof.rawSha256)fail('CLEARANCE_POLICY_VERSION_MISMATCH');
 const at=Date.parse(proof.readAt),now=options.now??Date.now();
 if(!Number.isFinite(at)||at>now||now-at>900000)fail('FRESH_POLICY_PROOF_REQUIRED');
 const prepared=API.plan(options);
 const active=prepared.work.items.filter(i=>i.taskKey===API.TASK&&require('../helper-routing/shared.cjs').active(i));
 if(active.length!==5||active.some(i=>!ids.includes(i.primaryId)))fail('EXACT_FIVE_WORKER_PARTITION_REQUIRED');
 // Compare substantive versions, not the observation clock of a fresh reread.
 const {readAt:policyReadAt,...policyVersion}=proof;
 const clearanceVersions=Object.fromEntries(ids.map(id=>{const {readAt,...v}=snapshot.neverConsiderById[id];return [id,v];}));
 const inputSha256=S.hash({ids,hermesIds:options.hermesIds,state,baseWorkSha256:prepared.baseWorkSha256,
  rows:snapshot.rows,needsById:snapshot.needsById,policyVersion,clearanceVersions,receiptIndex:snapshot.writerReceiptIndex,
  status:{build:snapshot.status.build,freeze:snapshot.status.freeze,level:snapshot.status.level,errors:snapshot.status.errors,unverified:snapshot.status.unverified}});
 return {schema:'forge.api-five-preflight.v1',ids:[...ids],inputSha256,baseWorkSha256:prepared.baseWorkSha256,
  policyProof:proof,rowBindings:ids.map(id=>({primaryId:id,rowSha256:S.hash(snapshot.rows.find(r=>r.PRIMARY_ID===id).line)})),
  assignmentWrites:0,writerSubmissions:0,productionAuthorized:false,prepared};
}
function compare(receipt,options){
 if(receipt?.schema!=='forge.api-five-preflight.v1')fail('FIVE_JOB_REVIEW_RECEIPT_REQUIRED');
 const fresh=preview(options);
 if(receipt.inputSha256!==fresh.inputSha256||S.hash(receipt.ids)!==S.hash(fresh.ids))fail('FIVE_JOB_INPUTS_CHANGED_REVIEW_AGAIN');
 return fresh; // Existing coordinator reserve owns the only mutation path.
}
module.exports={preview,compare};
