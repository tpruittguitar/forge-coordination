'use strict';
// Read-only readiness proof inspection. Never enables a provider or manufactures its return.
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),H=require('./shared.cjs'),C=require('../programmed-coordinator/collect.cjs'),Reports=require('../routine-handoffs/reports.cjs');
function transportProofs(privateDir,batch,file){
 if(!privateDir)return[];
 const proofs=[],same=raw=>Reports.canonical(JSON.parse(raw))===Reports.canonical(batch);
 if(batch.returnTransport==='GITHUB_PR')for(const source of S.files(path.join(privateDir,'helper-delivery'))){try{
  const p=JSON.parse(fs.readFileSync(source,'utf8'));
  if(typeof p.raw!=='string'||path.basename(source)!==S.hash(p.raw)+'.json'||p.path!==file||!Number.isSafeInteger(p.pullRequest)||p.pullRequest<1||!/^[a-f0-9]{40}$/.test(p.commit||'')||!same(p.raw))continue;
  proofs.push({transport:'GITHUB_PR',pullRequest:p.pullRequest,sourceCommit:p.commit,sourceSha256:S.hash(p.raw)});
 }catch{/* Incomplete or changed capture is not transport proof. */}}
 if(batch.returnTransport==='DRIVE'){
  const D=require('../routine-handoffs/direct-handoffs.cjs'),consumed=S.read(privateDir,'direct-handoffs/consumed.json',{packets:{},files:{}});
  for(const source of S.files(path.join(privateDir,'direct-handoffs/incoming'))){try{
   const raw=fs.readFileSync(source),p=JSON.parse(raw),m=p.metadata,sha=S.hash(p.text);
   if(p.schema!=='forge.direct-handoff-packet.v1'||!m||typeof p.text!=='string'||consumed.packets?.[S.hash(raw)]!==sha||consumed.files?.[m.id]!==sha||m.title!=='forge-helper-'+batch.runId+'.json'||!m.parent_ids?.includes(D.folder)||m.mime_type!=='text/plain'||Buffer.byteLength(p.text)!==Number(m.size)||!Number.isFinite(Date.parse(m.modified_time))||typeof m.url!=='string'||!m.url.startsWith('https://drive.google.com/file/d/'+m.id+'/')||!same(p.text))continue;
   proofs.push({transport:'DRIVE',sourceId:m.id,sourceSha256:sha});
  }catch{/* Unconsumed or changed capture is not transport proof. */}}
 }
 return proofs;
}
function verified({root,privateDir,taskKey,commit,routing=C.routingProof}){
 if(!H.TASKS[taskKey]||!/^[a-f0-9]{40}$/.test(commit||''))throw Error('CURRENT_READINESS_ROUTE_REQUIRED');
 const state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{batches:{}}),proofs=[];
 const prefix='receipts/'+H.TASKS[taskKey].toUpperCase()+'_HELPERS/'+taskKey+'/';
 for(const [file,meta]of Object.entries(state.batches)){
  if(!meta.readinessOnly||meta.status!=='VALIDATED'||meta.taskKey!==taskKey||meta.provider!==H.TASKS[taskKey]||!file.startsWith(prefix)||!/^[-A-Za-z0-9_]+\.json$/.test(file.slice(prefix.length)))continue;
  try{
   const raw=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),batch=JSON.parse(raw);
   if(S.hash(raw)!==meta.sha256||batch.mode!=='READINESS_ONLY'||batch.provider!==meta.provider||batch.taskKey!==taskKey||batch.returnTransport!==meta.returnTransport)continue;
   const validation=C.validateEnvelope(root,batch);if(!validation.readinessOnly)continue;
   routing(root,batch,commit);proofs.push({path:file,sha256:meta.sha256,provider:batch.provider,taskKey,runId:batch.runId,instructionCommit:batch.instructionCommit,declaredReturnTransport:batch.returnTransport,observedTransport:transportProofs(privateDir,batch,file),checkedAgainst:commit});
  }catch{/* A changed/missing/stale artifact is not proof of readiness. */}
 }
 return{taskKey,provider:H.TASKS[taskKey],artifactValidated:proofs.length>0,returnTransportVerified:proofs.some(p=>p.observedTransport.length>0),proofs,activationChanged:false,canonicalWrites:0,researchCompleted:false};
}
if(require.main===module){try{const [taskKey,rootArg,privateArg]=process.argv.slice(2),root=path.resolve(rootArg||path.join(__dirname,'../..')),privateDir=privateArg||process.env.FORGE_PRIVATE_WORK_DIR,commit=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();console.log(JSON.stringify(verified({root,privateDir,taskKey,commit})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verified};
