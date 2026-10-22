'use strict';
/* Operator orchestration for the five-job canary. All Writer writes go through runCanary; this file only sequences
 * snapshots, persists every Writer response the moment it arrives, resumes after each deliberate halt and reconciles.
 *   node tools/source-intake/canary-cli.js snapshot before --state S.json --candidates C.json --source-run-id ID
 *   node tools/source-intake/canary-cli.js run --state S.json --candidates C.json     (repeat after each verified halt)
 *   node tools/source-intake/canary-cli.js snapshot after --state S.json --candidates C.json
 *   node tools/source-intake/canary-cli.js finalize --state S.json --candidates C.json
 * The Writer key comes only from FORGE_WRITER_KEY and is never written to the state file.
 * Every Writer response is fsync'd into the state file and read back from disk before the executor classifies it.
 * Stopping: set control/SOURCE_INTAKE_RELEASE.json enabled=false on main. That stops the NEXT case; a POST already in
 * flight completes or fails on its own, and its request must be reconciled (receipt index, then `run` again) before
 * anything else. Never re-submit a case by hand.
 */
const fs=require('node:fs'),crypto=require('node:crypto');
const {fetchAuthenticatedMaster,fetchAuthenticatedArchive}=require('./writer-reader');
const {runCanary,requestId}=require('./production-executor');
const {reconcileCanaryBatch}=require('./canary-accounting');
const ACCOUNTED=new Set(['NOOP_ACCOUNTED','RESUMED_ACCOUNTED']);
const hashOf=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function loadState(path){try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw Error('BLOCKED: canary state unreadable')}}
function saveState(path,state){const tmp=path+'.tmp',fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,JSON.stringify(state,null,1));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,path)}
// Durable recorder backed by the state file: every write is fsync'd and every read comes back from disk.
function fileRecorder(statePath,state){
 return {
  check:async()=>{const probe=crypto.randomUUID();state.recorderProbe={probe,at:new Date().toISOString()};saveState(statePath,state);return loadState(statePath)?.recorderProbe?.probe===probe},
  record:async(rid,result)=>{state.results[rid]=result;saveState(statePath,state)},
  read:async rid=>loadState(statePath)?.results?.[rid]
 };
}
function bound(state,candidates){
 if(!state)throw Error('BLOCKED: no canary state; take the before snapshot first');
 if(state.candidatesHash!==hashOf(candidates))throw Error('BLOCKED: candidates changed since the before snapshot');
 return state;
}
async function snapshot(phase,{statePath,candidates,sourceRunId,key,transport}){
 const state=loadState(statePath);
 if(phase==='before'){
  if(state)throw Error('BLOCKED: canary state already exists; a before snapshot is taken once');
  if(!/^[A-Z0-9_-]{8,120}$/.test(sourceRunId||''))throw Error('BLOCKED: source run identity');
 }else if(phase==='after'){
  bound(state,candidates);
  if(state.completedAt==null)throw Error('BLOCKED: after snapshot requires all five cases accounted');
 }else throw Error('BLOCKED: snapshot phase must be before or after');
 const [master,archive]=await Promise.all([fetchAuthenticatedMaster({key,transport}),fetchAuthenticatedArchive({key,transport})]);
 const snap={takenAt:new Date().toISOString(),master,archive};
 const next=phase==='before'?{version:1,sourceRunId,candidatesHash:hashOf(candidates),requestIds:candidates.map(c=>requestId(c.record)),
  snapshots:{before:snap},results:{},outcomes:[],halts:[],completedAt:null}:{...state,snapshots:{...state.snapshots,after:snap}};
 saveState(statePath,next);
 return {phase,masterRows:master.rows.length,archiveRows:archive.rows.length};
}
async function run({statePath,candidates,key,transport,switchTransport}){
 const state=bound(loadState(statePath),candidates);
 if(state.completedAt)return {status:'ALREADY_COMPLETE',outcomes:state.outcomes};
 try{
  const outcomes=await runCanary(candidates,{key,transport,switchTransport,sourceRunId:state.sourceRunId,priorResults:state.results,recorder:fileRecorder(statePath,state)});
  if(outcomes.length!==5||outcomes.some(x=>!ACCOUNTED.has(x.status)))throw Error('BLOCKED: canary returned without five accounted cases');
  state.outcomes=outcomes;state.completedAt=new Date().toISOString();saveState(statePath,state);
  return {status:'ALL_CASES_ACCOUNTED',outcomes};
 }catch(e){
  for(const o of e.outcomes||[])if(o.writerResult&&!state.results[o.requestId])state.results[o.requestId]=o.writerResult;
  state.halts.push({at:new Date().toISOString(),message:e.message,outcomes:(e.outcomes||[]).map(({writerResult,...rest})=>rest)});
  saveState(statePath,state);
  return {status:'HALTED',message:e.message,outcomes:e.outcomes||[]};
 }
}
function finalize({statePath,candidates}){
 const state=bound(loadState(statePath),candidates);
 const before=state.snapshots?.before,after=state.snapshots?.after;
 if(!state.completedAt||!after)throw Error('BLOCKED: finalize requires all five cases accounted and an after snapshot');
 if(Date.parse(after.takenAt)<Date.parse(state.completedAt))throw Error('BLOCKED: after snapshot predates canary completion');
 const cases=candidates.map((c,i)=>({expectedOutcome:c.expectedOutcome,record:c.record,protectedPrimaryId:c.protectedPrimaryId,accounting:state.outcomes[i]?.accounting}));
 const result=reconcileCanaryBatch({cases,before:before.master,after:after.master,archiveBefore:before.archive,archiveAfter:after.archive});
 state.reconciliation={...result,at:new Date().toISOString()};saveState(statePath,state);
 return result;
}
function args(argv){const out={_:[]};for(let i=0;i<argv.length;i++){if(argv[i].startsWith('--'))out[argv[i].slice(2)]=argv[++i];else out._.push(argv[i])}return out}
async function main(argv=process.argv.slice(2)){
 const a=args(argv),[cmd,phase]=a._;
 if(!a.state||!a.candidates)throw Error('usage: canary-cli <snapshot before|after|run|finalize> --state S.json --candidates C.json [--source-run-id ID]');
 const candidates=JSON.parse(fs.readFileSync(a.candidates,'utf8')),key=process.env.FORGE_WRITER_KEY;
 const common={statePath:a.state,candidates,key};
 const out=cmd==='snapshot'?await snapshot(phase,{...common,sourceRunId:a['source-run-id']}):cmd==='run'?await run(common):cmd==='finalize'?finalize(common):null;
 if(!out)throw Error('unknown command '+cmd);
 // Outcomes only; Writer responses stay in the state file.
 console.log(JSON.stringify(out,(k,v)=>k==='writerResult'?undefined:v,1));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={snapshot,run,finalize,hashOf,fileRecorder};
