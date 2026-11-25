'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {inspect}=require('./allocation-preflight.cjs'),{fixture}=require('./fixture.cjs'),{TASK}=require('./worker.cjs');
function input(){const f=fixture(2);return {sha:'a'.repeat(40),registry:{schema:'forge.ai-automation-tasks.v1',tasks:{[TASK]:{owner:'Claude',route:'utility',procedure:'lanes/CHATGPT_ENRICHMENT_RESEARCH.txt',workAssignments:'control/ENRICHMENT_HELPER_WORK.json'}}},owner:f.view.owner,work:f.view.work,
 shared:{schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,assignmentId:'SYNTHETIC',items:[],providers:{FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:false},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:false}}},
 claude:{schema:'forge.claude-helper-work.v1',enabled:false,intake:[],enrichment:[]}};}
test('reports existing authority and absent partition without mutation; a registry owner label no longer gates the lane',()=>{
 const data=input(),before=JSON.stringify(data),r=inspect(data);a.equal(JSON.stringify(data),before);a.equal(r.enrichmentAssignmentLabel,'ChatGPT');a.ok(!r.blockers.includes('OWNER_CONFLICT'));a.equal(r.workerSplitVerified,false);a.equal(r.activeEnrichmentIds,2);a.equal(r.mutations,0);
});
test('owner agreement alone never creates worker/Hermes reservations',()=>{
 const data=input();data.registry.tasks[TASK].owner='ChatGPT';const r=inspect(data);a.ok(!r.blockers.includes('OWNER_CONFLICT'));a.ok(r.blockers.includes('AUTHORITATIVE_WORKER_PARTITION_UNAVAILABLE'));a.equal(r.productionAuthorized,false);
});
test('existing shared or Claude reservation overlaps are explicit blockers',()=>{
 const data=input();data.claude.enabled=true;data.claude.enrichment=[{primaryId:'V2I-SYNTHETIC-0',task:'FORGE_CLAUDE_ENRICHMENT'}];
 const r=inspect(data);a.equal(r.overlapCount,1);a.ok(r.blockers.includes('EXISTING_RESERVATION_OVERLAP'));
});
test('authoritative controls prove the exact split, keep Hermes reserved, and skip the released ChatGPT half only when independently reserved',()=>{
 const fs=require('node:fs'),path=require('node:path'),P=require('../helper-routing/worker-partition.cjs');
 const root=path.resolve(__dirname,'../..'),json=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const data=input(),record=json(P.FILE),registry=json('control/AI_AUTOMATION_TASKS.json'),owner=json('control/ENRICHMENT_RESEARCH_OWNER.json');
 const split=P.load(root),hermes='V2I-7D723DF74DB5',api='V2I-7E2E8E0559E8',external=[...split.api][1];
 a.equal(registry.tasks[TASK].owner,undefined);a.equal(owner.provider,'ChatGPT');
 data.claude.enabled=true;data.claude.enrichment=[{primaryId:external,task:'FORGE_CLAUDE_ENRICHMENT'}];
 const r=inspect({...data,registry,owner:{...data.owner,workerPartition:owner.workerPartition},partition:record});
 a.equal(r.workerSplitVerified,true);a.equal(r.productionAuthorized,false);
 a.deepEqual(r.partition,{sourceCommit:P.SOURCE,hermes:P.HERMES_SIZE,api:P.API_SIZE,hermesIndependentlyReserved:0,apiIndependentlyReserved:1});
 a.ok(!r.blockers.includes('AUTHORITATIVE_WORKER_PARTITION_UNAVAILABLE'));
 a.ok(r.blockers.includes('EXISTING_RESERVATION_OVERLAP'));
 const ordinary=P.atsReserved(split),grant=P.atsReserved(split,{grant:true,independent:[external]});
 a.equal(ordinary.size,P.HERMES_SIZE);a.ok(ordinary.has(hermes)&&!ordinary.has(api));a.equal(grant.size,P.HERMES_SIZE+1);
 a.ok(grant.has(hermes)&&!grant.has(api)&&grant.has(external));
 record.workers[1].primaryIds[2]='V2I-7E2E8E0559E8';
 a.throws(()=>P.validate(record),/PARTITION_INVALID/);
});
