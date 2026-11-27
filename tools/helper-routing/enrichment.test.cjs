'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('./enrichment.cjs');
const SHA='a'.repeat(40);
function work(items){
  return {schema:'forge.enrichment-helper-work.v1',enabled:true,assignmentId:'GROK-ENRICH-20261101-V1',provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',items};
}
function item(id,owner){
  const taskKey=owner==='Hermes'?'FORGE_HERMES_ENRICHMENT_RESEARCH':'FORGE_CHATGPT_ENRICHMENT_RESEARCH';
  return {primaryId:id,owner,taskKey,status:'ASSIGNED'};
}
function batch({provider='Hermes',taskKey='FORGE_HERMES_ENRICHMENT_RESEARCH',runId='FORGE-HERMES-TEST-1',ids=['V2I-AAA']}){
  return {schema:'forge.enrichment-helper-batch.v1',provider,taskKey,assignmentId:'GROK-ENRICH-20261101-V1',runId,instructionCommit:SHA,items:ids.map(primaryId=>({primaryId,writerSubmitted:false,recommendation:'EVIDENCE_CAPTURED',sourceEvidence:{url:'https://example.com',proposedRawFields:{}}}))};
}

test('validateWork accepts mixed ChatGPT and Hermes owners',()=>{
  const w=work([item('V2I-CHAT1','ChatGPT'),item('V2I-HERM1','Hermes')]);
  a.equal(E.validateWork(w).items.length,2);
});

test('validateWork still rejects an unknown owner pair',()=>{
  const w=work([item('V2I-CHAT1','ChatGPT')]);
  w.assignmentId='OTHER-ASSIGNMENT';
  w.items[0].owner='Sniffer';
  a.throws(()=>E.validateWork(w),/Invalid or overlapping helper research assignment/);
});

test('validateBatch accepts a Hermes envelope for Hermes-owned items',()=>{
  const w=work([item('V2I-CHAT1','ChatGPT'),item('V2I-HERM1','Hermes')]);
  const got=E.validateBatch(batch({ids:['V2I-HERM1']}),w);
  a.equal(got.valid,true);
  a.equal(got.items,1);
  a.equal(got.productionAuthorized,false);
});

test('validateBatch rejects a Hermes envelope that includes a ChatGPT-owned id',()=>{
  const w=work([item('V2I-CHAT1','ChatGPT'),item('V2I-HERM1','Hermes')]);
  a.throws(()=>E.validateBatch(batch({ids:['V2I-CHAT1']}),w),/ENRICHMENT_ITEM_OUTSIDE_ASSIGNMENT/);
});

test('validateBatch still accepts a ChatGPT envelope and rejects a Hermes runId on it',()=>{
  const w=work([item('V2I-CHAT1','ChatGPT'),item('V2I-HERM1','Hermes')]);
  const ok=E.validateBatch(batch({provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',runId:'FORGE-CHATGPT-TEST-1',ids:['V2I-CHAT1']}),w);
  a.equal(ok.valid,true);
  a.throws(()=>E.validateBatch(batch({provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',runId:'FORGE-HERMES-TEST-1',ids:['V2I-CHAT1']}),w),/Invalid enrichment evidence-only envelope/);
});

test('next() skips Hermes-owned items for the ChatGPT work-file owner',()=>{
  const w=work([item('V2I-HERM1','Hermes'),item('V2I-CHAT1','ChatGPT'),item('V2I-CHAT2','ChatGPT')]);
  const n=E.next(w);
  a.equal(n.provider,'ChatGPT');
  a.deepEqual(n.items.map(i=>i.primaryId),['V2I-CHAT1','V2I-CHAT2']);
});

test('live helper work file still validates after the Hermes reassignment',()=>{
  const file=path.resolve(__dirname,'../../control/ENRICHMENT_HELPER_WORK.json');
  const w=JSON.parse(fs.readFileSync(file,'utf8'));
  E.validateWork(w);
  a.equal(w.provider,'ChatGPT');
  a.ok(w.items.some(i=>i.owner==='Hermes'&&i.taskKey==='FORGE_HERMES_ENRICHMENT_RESEARCH'));
  a.ok(w.items.some(i=>i.owner==='ChatGPT'&&i.taskKey==='FORGE_CHATGPT_ENRICHMENT_RESEARCH'));
});
