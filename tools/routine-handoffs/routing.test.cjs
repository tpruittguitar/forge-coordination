'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./routing.cjs'),path=require('node:path');
test('fresh routing is resolved from actual current assignment; old inactive ACK never changes ownership or proves coverage',()=>{const s=R.snapshot(path.resolve(__dirname,'../..'),'a'.repeat(40)),taskKey='FORGE_GROK_APPLICATION_OUTCOME_HELPER',t=s.tasks[taskKey];a.equal(t.routingActive,true);const ack={taskKey,provider:t.provider,assignmentId:t.assignmentId,routingActive:t.routingActive,partitionSha256:t.partitionSha256};a.equal(R.assertCurrent(ack,s).coverageComplete,false);a.throws(()=>R.assertCurrent({...ack,routingActive:false},s),/STALE_ROUTING_ACK/);a.throws(()=>R.assertCurrent(ack,{...s,at:'2020-01-01T00:00:00Z'}),/FRESH_ROUTING/);});

test('generated intake routing remains explicitly inactive until its inventory is published',t=>{const fs=require('node:fs'),os=require('node:os'),S=require('../programmed-coordinator/store.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'drain-routing-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const key='FORGE_INTAKE_SCOPE_REVIEW';S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[key]:{owner:'ChatGPT',procedure:'lanes/CHATGPT_INTAKE_DRAIN.txt',executionMode:'EVIDENCE_ONLY',workAssignments:'state/INTAKE_DRAIN.json'}}});let task=R.snapshot(root,'a'.repeat(40)).tasks[key];a.equal(task.enabled,false);a.equal(task.routingActive,false);S.save(root,'state/INTAKE_DRAIN.json',{schema:'forge.intake-drain.v1',items:{one:{key:'one',sourceVersion:'version',taskKey:key,status:'ACTION_REQUIRED'}}});task=R.snapshot(root,'a'.repeat(40)).tasks[key];a.equal(task.enabled,true);a.equal(task.routingActive,true);});

test('published enrichment routing uses the current owner, assignment and worker partition',()=>{
 const root=path.resolve(__dirname,'../..'),S=require('../programmed-coordinator/store.cjs'),P=require('../helper-routing/worker-partition.cjs');
 const s=R.snapshot(root,'a'.repeat(40));
 const task=s.tasks[P.TASK],work=S.read(root,'control/ENRICHMENT_HELPER_WORK.json'),partition=S.read(root,P.FILE);
 a.equal(task.procedure,'lanes/CHATGPT_ENRICHMENT_RESEARCH.txt');
 a.equal(task.assignmentId,work.assignmentId);
 a.equal(task.partitionSha256,S.hash(partition));
 a.equal(task.enabled,true);
 a.equal(task.routingActive,true);
 a.equal(Object.hasOwn(s.tasks,'FORGE_GROK_ENRICHMENT'),false);
 a.deepEqual(R.assertCurrent({taskKey:P.TASK,...task},s,Date.parse(s.at)),{valid:true,coverageComplete:false,active:true});
 a.throws(()=>R.assertCurrent({taskKey:'FORGE_GROK_ENRICHMENT',...task},s,Date.parse(s.at)),/STALE_ROUTING_ACK/);
});

test('enrichment refresh binds active partition membership and rejects conflicting authority',t=>{
 const fs=require('node:fs'),os=require('node:os'),S=require('../programmed-coordinator/store.cjs'),P=require('../helper-routing/worker-partition.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'enrichment-routing-')),repo=path.resolve(__dirname,'../..'),commit='b'.repeat(40);
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const registry='control/AI_AUTOMATION_TASKS.json',ownerFile='control/ENRICHMENT_RESEARCH_OWNER.json';
 const task=S.read(repo,registry).tasks[P.TASK],owner=S.read(repo,ownerFile),partition=S.read(repo,P.FILE);
 S.save(root,registry,{tasks:{[P.TASK]:task}});
 S.save(root,ownerFile,owner);
 S.save(root,task.workAssignments,{schema:'forge.enrichment-helper-work.v1',assignmentId:owner.assignmentId,enabled:true,routingActive:true});
 S.save(root,P.FILE,partition);
 const first=R.refresh(root,commit).tasks[P.TASK];
 const pruned=P.prune(partition,[partition.workers[1].primaryIds[0]]);
 S.save(root,P.FILE,pruned);
 const current=R.refresh(root,commit);
 a.notEqual(current.tasks[P.TASK].partitionSha256,first.partitionSha256);
 a.throws(()=>R.assertCurrent({taskKey:P.TASK,...first},current),/STALE_ROUTING_ACK/);
 S.save(root,ownerFile,{...owner,assignmentId:'wrong-assignment'});
 a.throws(()=>R.refresh(root,commit),/ENRICHMENT_ROUTING_MISMATCH/);
 S.save(root,ownerFile,owner);
 pruned.workers[1].taskKey='FORGE_GROK_ENRICHMENT';
 S.save(root,P.FILE,pruned);
 a.throws(()=>R.refresh(root,commit),/AUTHORITATIVE_WORKER_PARTITION_INVALID/);
 a.deepEqual(S.read(root,'state/HELPER_ROUTING_CURRENT.json'),current);
});
