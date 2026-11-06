'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),Q=require('./queue.cjs'),G=require('./geography.cjs');
function prepare(root,{keys,runId,now=Date.now(),work=Q.sync(root,{now})}={}){
 if(!Array.isArray(keys)||!keys.length||keys.some(k=>typeof k!=='string')||new Set(keys).size!==keys.length)throw Error('EXPLICIT_UNIQUE_ASSIGNED_KEYS_REQUIRED');
 if(!/^FORGE-DRAIN-[A-Za-z0-9_-]+$/.test(runId||''))throw Error('EXPLICIT_RUN_ATTRIBUTION_REQUIRED');
 const reviews=[],skipped=[];
 for(const key of keys){const item=work.items[key];try{
  if(!item||item.status!=='ACTION_REQUIRED'||item.review)throw Error('CURRENT_UNREVIEWED_ACTION_REQUIRED');
  if(item.owner!=='ChatGPT'||item.taskKey==='CODE'||!Object.values(Q.TASKS).includes(item.taskKey))throw Error('EXISTING_OWNER_HANDOFF_REQUIRED');
  const exclusionEvidence={kind:'TASK_GEOGRAPHY',ruleId:G.ID,key,sourceVersion:item.sourceVersion,company:item.card.company,url:item.card.url,quote:item.card.location};
  const b=G.binding(root,exclusionEvidence,item.card);
  const r={schema:'forge.intake-drain-review.v1',key,sourceVersion:item.sourceVersion,provider:'ChatGPT',taskKey:item.taskKey,runId,observedAt:new Date(now).toISOString(),outcome:'EXCLUSION_CANDIDATE',originalCard:{...item.card},exclusionEvidence,reason:'User-authorized nine-state backlog cleanup; exact current location requires independent source validation.',nextAction:'Existing verifier must confirm one nonremote US worksite; existing observer must protect all canonical identities before exclusion.',attempts:[{action:'MATCH_AUTHORIZED_GEOGRAPHY_SNAPSHOT',source:G.FILE,bindingSha256:S.hash(b),result:'Exact authorized card/version matched; no source fetch or closure claimed.'}],writerSubmitted:false};
  Q.validate(r,item,now);reviews.push(r);
 }catch(e){skipped.push({key,reason:e.message});}}
 return{schema:'forge.geography-review-plan.v1',at:new Date(now).toISOString(),runId,requested:keys.length,prepared:reviews.length,skipped,reviews,canonicalWrites:0,published:0,independentlyVerified:0,excluded:0};
}
if(require.main===module){try{const [file]=process.argv.slice(2);if(!file)throw Error('Use geography-reviews.cjs <assigned-keys-and-run-id.json>');console.log(JSON.stringify(prepare(path.resolve(__dirname,'../..'),JSON.parse(fs.readFileSync(file,'utf8'))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={prepare};
