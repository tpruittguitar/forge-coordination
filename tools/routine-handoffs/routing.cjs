'use strict';
const S=require('../programmed-coordinator/store.cjs');
const Partition=require('../helper-routing/worker-partition.cjs');
const LEGACY_ENRICHMENT='FORGE_GROK_ENRICHMENT';
const FILE='state/HELPER_ROUTING_CURRENT.json';
function enrichment(root,task){
 const owner=S.read(root,'control/ENRICHMENT_RESEARCH_OWNER.json');
 const work=S.read(root,task.workAssignments);
 if(owner.schema!=='forge.research-owner.v1'||owner.provider!=='ChatGPT'||owner.taskKey!==Partition.TASK||
    owner.assignmentId!==work.assignmentId||task.workerPartition!==Partition.FILE||owner.workerPartition!==task.workerPartition||
    task.executionMode!=='WRITE_THROUGH_SUPPORTED_WRITER'||work.schema!=='forge.enrichment-helper-work.v1'||
    !work.assignmentId||typeof work.enabled!=='boolean')throw Error('ENRICHMENT_ROUTING_MISMATCH');
 const partition=S.read(root,task.workerPartition);
 Partition.validate(partition);
 const enabled=work.enabled&&!task.executionHold;
 return {procedure:task.procedure,assignmentId:work.assignmentId,enabled,
  routingActive:enabled&&work.routingActive===true,cutoverAt:owner.at||null,partitionSha256:S.hash(partition)};
}
function snapshot(root,commit,at=new Date().toISOString()){
 if(!/^[a-f0-9]{40}$/.test(commit)||!Number.isFinite(Date.parse(at)))throw Error('RESOLVED_ROUTING_REVISION_REQUIRED');
 const registry=S.read(root,'control/AI_AUTOMATION_TASKS.json'),tasks={};
 const enrichmentTask=registry.tasks[Partition.TASK];
 if(enrichmentTask&&!enrichmentTask.retired)tasks[Partition.TASK]=enrichment(root,enrichmentTask);
 // The old assignment ID is provenance, not a second live enrichment route.
 for(const [key,t]of Object.entries(registry.tasks))if(key!==Partition.TASK&&!(key===LEGACY_ENRICHMENT&&(t.retired||enrichmentTask))&&t.executionMode==='EVIDENCE_ONLY'&&t.workAssignments){let w;if(t.workAssignments==='state/INTAKE_DRAIN.json'){const inventory=S.read(root,t.workAssignments,null),ready=inventory?.schema==='forge.intake-drain.v1'&&!!inventory.items;w={assignmentId:'INTAKE-DRAIN-V1',enabled:ready,routingActive:ready,routing:{inventoryPublished:ready,partitionSha256:S.hash(ready?Object.values(inventory.items).filter(i=>i.taskKey===key&&i.status!=='ACCOUNTED_UPSTREAM').map(i=>({key:i.key,sourceVersion:i.sourceVersion})):[])}};}else w=S.read(root,t.workAssignments);tasks[key]={procedure:t.procedure,assignmentId:w.assignmentId,enabled:w.enabled,routingActive:w.routingActive===true,cutoverAt:w.routing?.cutoverAt||null,partitionSha256:S.hash({assignmentId:w.assignmentId,enabled:w.enabled,routingActive:w.routingActive,routing:w.routing||null})};}
 return{schema:'forge.helper-routing-current.v1',instructionCommit:commit,at,tasks,ackIsCoverage:false,requireFreshMain:true};
}
function assertCurrent(report,current,now=Date.now()){
 if(!Number.isFinite(Date.parse(current.at))||now-Date.parse(current.at)>15*60000||Date.parse(current.at)>now+120000)throw Error('FRESH_ROUTING_SNAPSHOT_REQUIRED');
 const task=current.tasks[report.taskKey];if(!task||report.assignmentId!==task.assignmentId||report.routingActive!==task.routingActive||report.partitionSha256!==task.partitionSha256)throw Error('STALE_ROUTING_ACK_NOT_COVERAGE');
 return{valid:true,coverageComplete:false,active:task.enabled&&task.routingActive};
}
function refresh(root,commit){
 const current=snapshot(root,commit);
 S.save(root,FILE,current);
 return current;
}
module.exports={snapshot,refresh,assertCurrent};
