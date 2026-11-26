'use strict';
/* Rediscovered deleted jobs (Tim 2026-11-25: "a rediscovered deleted job comes in as new").
 * Request IDs are content hashes (transaction-preflight.js stableId), so a job whose row Tim removed with delete_rows
 * (no tombstone) keeps a COMPLETE entry in the Writer replay index (forge-writer-state PIPELINE_RECEIPT_INDEX.json).
 * The executor then holds it as EXISTING_REQUEST_HOLD / ORIGINAL_REQUEST_RECONCILIATION_REQUIRED and the Writer refuses
 * it as REQUEST_ALREADY_RECORDED. A new generation (FORGE-SOURCE-<hash>-G2, then -G3 ...) is used ONLY when:
 *  - the role is ABSENT (not PRESENT, AMBIGUOUS or UNRESOLVED) from fresh authenticated master AND archive snapshots, and
 *  - every replay-index entry for the original IDs is COMPLETE (any PENDING / NEEDS_RESOLUTION / other state keeps
 *    today's fence and the original ID).
 * The generation is recomputed from those two reads every pass; no list of regenerated or deleted IDs is stored.
 * A generation already in the index and not COMPLETE is returned as-is, so the executor fences it exactly as today.
 * Pure: no network, no file writes. */
const Identity=require('../source-trial/job-identity');
const {requestId,MAX_REQUEST_GENERATION}=require('./production-executor');
const withGeneration=(record,g)=>{const {REQUEST_GENERATION,...base}=record;return g>1?{...base,REQUEST_GENERATION:g}:base};
// baseRecords: the record variants whose generation-1 IDs could already be fenced (normalized and raw employer name).
// Returns 1 (keep the original ID), 2..MAX (use that generation), or null (generations exhausted: do not submit).
function nextGeneration(baseRecords,{requests,presence}){
 if(presence!=='ABSENT'||!requests||typeof requests!=='object')return 1;
 const states=g=>[...new Set(baseRecords.map(r=>requestId(withGeneration(r,g))))].map(id=>requests[id]?.s).filter(s=>s!==undefined);
 const original=states(1);
 if(!original.length||original.some(s=>s!=='COMPLETE'))return 1;
 for(let g=2;g<=MAX_REQUEST_GENERATION;g++){
  const seen=states(g);
  if(!seen.length||seen.some(s=>s!=='COMPLETE'))return g;
 }
 return null;
}
// Builds pick()'s generation callback from the fresh canonical identity index and the replay index.
function forPick({identityIndex,requests}){
 return (record,role)=>{
  const presence=Identity.match(identityIndex,role).status;
  return nextGeneration([record,{...record,COMPANY:role.company}],{requests,presence});
 };
}
module.exports={nextGeneration,forPick,withGeneration};
