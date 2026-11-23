'use strict';
const cp=require('node:child_process'),path=require('node:path');
const E=require('../helper-routing/enrichment.cjs'),H=require('../helper-routing/shared.cjs'),C=require('../helper-routing/reservations.cjs');
const {TASK,NAME}=require('./worker.cjs');
const P=require('../helper-routing/worker-partition.cjs');
function inspect({registry,owner,work,shared,claude,partition,sha}) {
  const task=registry?.tasks?.[TASK];
  if(registry?.schema!=='forge.ai-automation-tasks.v1'||!task)throw Error('REGISTRY_REQUIRED');
  const blockers=['LIVE_RELEASE_DISABLED'];let verified;
  if(!partition||task.workerPartition!==P.FILE||owner?.workerPartition!==P.FILE)blockers.push('AUTHORITATIVE_WORKER_PARTITION_UNAVAILABLE');
  else try{verified=P.validate(partition);}catch{blockers.push('AUTHORITATIVE_WORKER_PARTITION_INVALID');}
  if(task.route!=='utility'||task.procedure!=='lanes/CHATGPT_ENRICHMENT_RESEARCH.txt'||task.workAssignments!=='control/ENRICHMENT_HELPER_WORK.json')blockers.push('UNSUPPORTED_CURRENT_ROUTE');
  if(owner?.taskKey!==TASK||owner?.assignmentId!==work?.assignmentId)blockers.push('OWNER_CONFLICT');
  E.validateWork(work);H.validateWork(shared);C.validate(claude);
  const mine=E.assignedIds(work),sharedIds=H.reservedKeys(shared),claudeIds=C.enrichmentIds(claude);
  const overlaps=[...mine].filter(id=>sharedIds.has(id)||claudeIds.has(id));
  const independent=new Set([...sharedIds,...claudeIds,...E.researchIds(work)]);
  const partitionOverlaps=verified?[...verified.hermes,...verified.api].filter(id=>independent.has(id)):[];
  if(overlaps.length||partitionOverlaps.length)blockers.push('EXISTING_RESERVATION_OVERLAP');
  const hermesTasks=Object.entries(registry.tasks).filter(([k,v])=>/hermes/i.test(k+' '+(v.executionIdentity||''))).map(([k])=>k);
  return {schema:'forge.grant-allocation-preflight.v1',snapshotSha:sha,
    freshness:'PINNED_GIT_SNAPSHOT_NOT_LIVE_WRITER_STATE',worker:NAME,taskKey:TASK,
    enrichmentAssignmentLabel:owner.provider,assignmentId:work.assignmentId,
    requiredMechanism:{entry:'control/FORGE_SHARED_AUTOMATION_ENTRY.txt',registry:'control/AI_AUTOMATION_TASKS.json',
      ownership:'control/ENRICHMENT_RESEARCH_OWNER.json',membership:task.workAssignments,workerPartition:P.FILE,
      validator:'tools/helper-routing/enrichment.cjs validate <batch>',
      planner:'tools/helper-routing/enrichment-plan.cjs (fresh canonical input; publish membership through existing accounting before returns)',
      reservationExclusions:['control/SHARED_HELPER_WORK.json: shared.reservedKeys', 'control/CLAUDE_HELPER_WORK.json: reservations.enrichmentIds'],
      sharedAssignmentOwner:'existing programmed coordinator; no worker-side claims',
      writer:'existing locked returns-only wrapper; no direct master writes'},
    activeEnrichmentIds:mine.size,overlapCount:overlaps.length,overlapIds:overlaps,
    registeredHermesTaskKeys:hermesTasks,workerSplitVerified:!!verified,productionAuthorized:false,
    partition:verified?{sourceCommit:verified.sourceCommit,hermes:verified.hermes.size,api:verified.api.size,
      hermesIndependentlyReserved:partitionOverlaps.filter(id=>verified.hermes.has(id)).length,
      apiIndependentlyReserved:partitionOverlaps.filter(id=>verified.api.has(id)).length}:null,
    blockers,mutations:0};
}
function fromGit(root,ref='HEAD') {
  if(!/^[A-Za-z0-9_./-]+$/.test(ref)||ref.startsWith('-'))throw Error('INVALID_REF');
  const git=args=>cp.execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:20000000,stdio:['ignore','pipe','pipe']});
  const sha=git(['rev-parse','--verify',ref+'^{commit}']).trim();
  const read=file=>JSON.parse(git(['show',sha+':'+file]));
  let partition;
  try{partition=read(P.FILE);}catch(e){if(e instanceof SyntaxError)partition={};}
  return inspect({sha,partition,registry:read('control/AI_AUTOMATION_TASKS.json'),owner:read('control/ENRICHMENT_RESEARCH_OWNER.json'),
    work:read('control/ENRICHMENT_HELPER_WORK.json'),shared:read('control/SHARED_HELPER_WORK.json'),claude:read('control/CLAUDE_HELPER_WORK.json')});
}
if(require.main===module){try{
  const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--ref'))throw Error('INVALID_ARGUMENTS');
  const result=fromGit(path.resolve(__dirname,'../..'),args[1]||'HEAD');console.log(JSON.stringify(result,null,2));
  if(result.blockers.length)process.exitCode=2;
}catch{console.error('ALLOCATION_PREFLIGHT_FAILED');process.exitCode=1;}}
module.exports={inspect,fromGit};
