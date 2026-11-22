'use strict';
/* Cross-host Writer serialization for direct-pilot reservations (protocol below).
 * The pilot on TIMMAY publishes its job reservations to main while holding the shared Writer POST lock
 * (writer-post-lock.cjs). enrich-ats-pay holds the same lock around every Writer POST and, after taking it,
 * rereads the published reservations from main through this module and drops reserved rows. So every ATS POST
 * either finished before the reservation was written or sees it. A failed fresh read sends nothing. */
const PROTOCOL='forge.writer-post-lock.pilot-reserve.v1',MARKER='PILOT_FENCE_RECHECK_V1';
const PILOT_TASK='FORGE_OPENAI_DIRECT_PILOT',SETTLED=['CONSUMED','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE'],FILE='control/SHARED_HELPER_WORK.json';
// One definition of an active pilot fence, shared with transactions.fenceIndex. IDs are added to `into` as
// they are read, so IDs found before a malformed item stay fenced (fenceIndex's fail-closed ordering).
function pilotFenceIds(work,{excludePilotGrant,into}={}){
 const ids=into||new Set();
 for(const i of work?.items||[])if(i.taskKey===PILOT_TASK&&!SETTLED.includes(i.status)&&(!excludePilotGrant||i.pilotGrantId!==excludePilotGrant)){
  if(!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.primaryId||''))throw Error('INVALID_PILOT_FENCE_ID');
  ids.add(i.primaryId);for(const alias of i.aliases||[])ids.add(alias);
 }
 return ids;
}
function githubReader({token,repo,fetcher=globalThis.fetch,ref='main'}){
 if(!token||!/^[\w.-]+\/[\w.-]+$/.test(repo||''))throw Error('WRITER_RECHECK_GITHUB_REQUIRED');
 const headers={Accept:'application/vnd.github.raw+json',Authorization:'Bearer '+token,'User-Agent':'forge-writer-post-recheck'};
 return async function readFile(file=FILE,at=ref){
  const r=await fetcher('https://api.github.com/repos/'+repo+'/contents/'+file+'?ref='+encodeURIComponent(at),{headers,signal:AbortSignal.timeout(20000)});
  if(r.status===404)return null;
  if(r.status!==200)throw Error('WRITER_RECHECK_READ_FAILED: HTTP '+r.status);
  return r.text();
 };
}
// Fresh published fence for the next POST. Missing work file = no pilot reservations; anything else unreadable throws.
function createRecheck({readFile}){
 return {async fresh(){const text=await readFile(FILE);return text===null?new Set():pilotFenceIds(JSON.parse(text));}};
}
function fromEnv(env=process.env,options={}){
 const token=env.GITHUB_TOKEN||env.GH_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||env.FORGE_WRITER_POST_LOCK==='off')return null;
 return createRecheck({readFile:githubReader({token,repo,...options})});
}
module.exports={PROTOCOL,MARKER,PILOT_TASK,FILE,pilotFenceIds,githubReader,createRecheck,fromEnv};
