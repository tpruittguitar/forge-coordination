'use strict';
const path=require('node:path'), S=require('./store.cjs');
// Refresh before the unchanged 15-minute assignment gates, not instead of them.
// Leave one minute for local planning/indexing before the downstream check.
async function freshSnapshot({current,read,force=false,now=()=>Date.now()}) {
 const at=Date.parse(current?.source?.readAt), age=now()-at;
 if(force||!Number.isFinite(at)||age>=840000||age< -120000)return read();
 return current;
}
function recordFailure({privateDir,runId,commit,stage,error,at=new Date().toISOString()}) {
 if(!path.isAbsolute(privateDir)||!/^FORGE-[A-Za-z0-9_-]+$/.test(runId))throw Error('PRIVATE_FAILURE_DIAGNOSTIC_PATH_REQUIRED');
 // Never persist arbitrary exception text, URLs, bodies, credentials or stacks.
 const message=String(error?.message||'');
 const report={schema:'forge.coordinator-failure.v1',runId,at,instructionCommit:commit,stage,
   reason:/^[A-Z][A-Z0-9_]{3,100}$/.test(message)?message:'UNCLASSIFIED_COORDINATOR_FAILURE',
   errorMessageSha256:S.hash(message),completed:false};
 S.save(privateDir,'coordinator-failures/'+runId+'.json',report);
 return report;
}
module.exports={freshSnapshot,recordFailure};
