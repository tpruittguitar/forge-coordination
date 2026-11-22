'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {inspect}=require('./allocation-preflight.cjs'),{fixture}=require('./fixture.cjs'),{TASK}=require('./worker.cjs');
function input(){const f=fixture(2);return {sha:'a'.repeat(40),registry:{schema:'forge.ai-automation-tasks.v1',tasks:{[TASK]:{owner:'Claude',route:'utility',procedure:'lanes/CHATGPT_ENRICHMENT_RESEARCH.txt',workAssignments:'control/ENRICHMENT_HELPER_WORK.json'}}},owner:f.view.owner,work:f.view.work,
 shared:{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,assignmentId:'SYNTHETIC',items:[],providers:{FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:false},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:false}}},
 claude:{schema:'forge.claude-helper-work.v1',enabled:false,intake:[],enrichment:[]}};}
test('reports required existing authority, conflict and absent partition without mutation',()=>{
 const data=input(),before=JSON.stringify(data),r=inspect(data);a.equal(JSON.stringify(data),before);a.equal(r.registryOwner,'Claude');a.equal(r.enrichmentOwner,'ChatGPT');a.ok(r.blockers.includes('OWNER_CONFLICT'));a.equal(r.workerSplitVerified,false);a.equal(r.activeEnrichmentIds,2);a.equal(r.mutations,0);
});
test('owner agreement alone never creates worker/Hermes reservations',()=>{
 const data=input();data.registry.tasks[TASK].owner='ChatGPT';const r=inspect(data);a.ok(!r.blockers.includes('OWNER_CONFLICT'));a.ok(r.blockers.includes('AUTHORITATIVE_WORKER_PARTITION_UNAVAILABLE'));a.equal(r.productionAuthorized,false);
});
test('existing shared or Claude reservation overlaps are explicit blockers',()=>{
 const data=input();data.claude.enabled=true;data.claude.enrichment=[{primaryId:'V2I-SYNTHETIC-0',task:'FORGE_CLAUDE_ENRICHMENT'}];
 const r=inspect(data);a.equal(r.overlapCount,1);a.ok(r.blockers.includes('EXISTING_RESERVATION_OVERLAP'));
});
