'use strict';
const S=require('../programmed-coordinator/store.cjs');
function snapshot(root,commit,at=new Date().toISOString()){
 if(!/^[a-f0-9]{40}$/.test(commit)||!Number.isFinite(Date.parse(at)))throw Error('RESOLVED_ROUTING_REVISION_REQUIRED');
 const registry=S.read(root,'control/AI_AUTOMATION_TASKS.json'),tasks={};
 for(const [key,t]of Object.entries(registry.tasks))if(t.executionMode==='EVIDENCE_ONLY'&&t.workAssignments){const w=S.read(root,t.workAssignments);tasks[key]={provider:t.owner,procedure:t.procedure,assignmentId:w.assignmentId,enabled:w.enabled,routingActive:w.routingActive===true,cutoverAt:w.routing?.cutoverAt||null,partitionSha256:S.hash({assignmentId:w.assignmentId,enabled:w.enabled,routingActive:w.routingActive,routing:w.routing||null})};}
 return{schema:'forge.helper-routing-current.v1',instructionCommit:commit,at,tasks,ackIsCoverage:false,requireFreshMain:true};
}
function assertCurrent(report,current,now=Date.now()){
 if(!Number.isFinite(Date.parse(current.at))||now-Date.parse(current.at)>15*60000||Date.parse(current.at)>now+120000)throw Error('FRESH_ROUTING_SNAPSHOT_REQUIRED');
 const task=current.tasks[report.taskKey];if(!task||report.provider!==task.provider||report.assignmentId!==task.assignmentId||report.routingActive!==task.routingActive||report.partitionSha256!==task.partitionSha256)throw Error('STALE_ROUTING_ACK_NOT_COVERAGE');
 return{valid:true,coverageComplete:false,active:task.enabled&&task.routingActive};
}
module.exports={snapshot,assertCurrent};
