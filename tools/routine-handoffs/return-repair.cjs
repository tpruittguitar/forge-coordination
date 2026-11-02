'use strict';
const S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs'),path=require('node:path'),fs=require('node:fs');
// Salvage individually valid source items from an otherwise invalid batch.
// Never manufacture a missing URL/identity or promote blocked research.
function repair(root,commit,{apply=false,routing=C.routingProof}={}){
 const work=S.read(root,'control/GROK_INTAKE_HELPER_WORK.json',null);if(!work)return[];
 const results=[];
 for(const file of S.files(path.join(root,'receipts/GROK_HELPERS/FORGE_GROK_INTAKE_HELPER'))){
  const b=JSON.parse(fs.readFileSync(file,'utf8'));if(b.transportRepair||!Array.isArray(b.items)||b.assignmentId!==work.assignmentId)continue;
  try{C.validateEnvelope(root,b);continue;}catch{}
  const original=path.relative(root,file).replace(/\\/g,'/'),copy=structuredClone(b),valid=[],unresolved=[];
  try{
   if(new Set(b.items.map(i=>i.key)).size!==b.items.length)throw Error('DUPLICATE_SOURCE_ITEMS');
   for(const i of b.items){try{C.validateEnvelope(root,{...b,items:[i]});valid.push(i);}catch{unresolved.push(i.key);}}
   if(!valid.length)continue;
   copy.items=valid;copy.runId='GROK-INTAKE-'+S.hash(b).slice(0,24)+'-VALIDATED-SUBSET';copy.originalBatch=original;copy.transportRepair={by:'CODE',originalSha256:S.hash(b),unresolvedKeys:unresolved,kind:'VALIDATED_UNCHANGED_ITEMS',sourceFactsChanged:false};
   C.validateEnvelope(root,copy);routing(root,copy,commit);
   const relative='receipts/GROK_HELPERS/FORGE_GROK_INTAKE_HELPER/'+copy.runId+'.json';if(apply)S.immutable(root,relative,copy);
   results.push({original,correction:relative,items:copy.items.length,unresolvedKeys:unresolved});
  }catch(e){results.push({original,status:'REQUIRES_SOURCE_CORRECTION',reason:e.message});}
 }
 return results;
}
module.exports={repair};
