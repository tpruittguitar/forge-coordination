'use strict';
const C=require('../programmed-coordinator/collect.cjs');
const repository='tpruittguitar/forge-coordination',publicReceipt=/^receipts\/(?:CLAUDE_RELEVANCE\/[A-Za-z0-9_-]+|(?:CLAUDE_HELPERS|GROK_HELPERS|CHATGPT_HELPERS)\/FORGE_[A-Z0-9_]+\/[A-Za-z0-9_-]+)\.json$/;
function diagnostic(error){
 const message=String(error?.message||''),legacy={
  'Invalid enrichment evidence-only envelope':'INVALID_ENRICHMENT_ENVELOPE',
  'Invalid relevance evidence envelope':'INVALID_RELEVANCE_ENVELOPE',
  'Unassigned, duplicated or submitting relevance item':'INVALID_RELEVANCE_ITEM',
  'Invalid helper batch envelope':'INVALID_CLAUDE_ENVELOPE',
  'Item outside assigned work':'ITEM_OUTSIDE_ASSIGNMENT',
  'Duplicate helper item':'DUPLICATE_HELPER_ITEM',
  'Invalid intake evidence envelope':'INVALID_INTAKE_ENVELOPE',
  'Unassigned, duplicate or invalid evidence item':'INVALID_INTAKE_ITEM'
 };
 return{reason:error instanceof SyntaxError?'HELPER_JSON_INVALID':/^[A-Z][A-Z0-9_]{3,100}$/.test(message)?message:legacy[message]||'HELPER_PR_VALIDATION_REQUIRED',errorSha256:require('../programmed-coordinator/store.cjs').hash(message)};
}
async function harvest({root,privateDir,commit,pr,api,validate=C.validateEnvelope,routing=C.routingProof}){
 if(!privateDir||pr.base?.ref!=='main'||pr.head?.repo?.full_name!==repository)return{captured:0};
 const files=await api.pages(`/repos/${repository}/pulls/${pr.number}/files`),record=/^control\/changes\/[A-Za-z0-9_.-]+\.txt$/;
 if(!files.length||files.some(f=>f.status!=='added'||!(publicReceipt.test(f.filename)||record.test(f.filename))))return{captured:0};
 const artifacts=[],pendingArtifacts=[];
 for(const f of files.filter(f=>publicReceipt.test(f.filename))){try{const raw=await api.content(f.filename,pr.head.sha);if(Buffer.byteLength(raw)>2_000_000)throw Error('HELPER_DELIVERY_FORMAT_LIMIT');const batch=JSON.parse(raw);if(batch.schema==='forge.outcome-helper-batch.v1'||f.filename.includes('FORGE_GROK_APPLICATION_OUTCOME_HELPER'))throw Error('PRIVATE_OUTCOME_DELIVERY_REQUIRED');if(!f.filename.endsWith('/'+batch.runId+'.json'))throw Error('SOURCE_RUN_PATH_MISMATCH');validate(root,batch);routing(root,batch,commit);artifacts.push({path:f.filename,raw,batch});}catch(e){pendingArtifacts.push({path:f.filename,...diagnostic(e)});}}
 if(await api.head(pr.head.ref)!==pr.head.sha)throw Error('HELPER_PR_HEAD_CHANGED');
 const S=require('../programmed-coordinator/store.cjs');let captured=0;
 for(const item of artifacts){try{const sha=S.hash(item.raw);S.immutable(privateDir,'helper-delivery/'+sha+'.json',{pullRequest:pr.number,commit:pr.head.sha,path:item.path,raw:item.raw});S.immutable(privateDir,'helper-inbox/forge-helper-'+sha+'.json',item.batch);captured++;}catch(e){pendingArtifacts.push({path:item.path,...diagnostic(e)});}}
 return{captured,sourceCommit:pr.head.sha,pendingArtifacts};
}
const shaPattern=/^[a-f0-9]{40}$/;
function branchIdentity(branch){
 const match=/^(claude|grok)-shared-helper-batch-[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.exec(branch?.name||'');
 if(!match||branch.repo&&branch.repo.full_name!==repository)return null;
 const owner=match[1].toUpperCase();
 return{provider:owner==='CLAUDE'?'Claude':'Grok',taskKey:'FORGE_'+owner+'_SHARED_HELPER',directory:'receipts/'+owner+'_HELPERS/FORGE_'+owner+'_SHARED_HELPER/',sourceKey:'branch:'+repository+':'+branch.name};
}
function completeCompare(comparison,base,head){
 // GitHub returns at most 300 changed files, without a total file count.
 // A response at that boundary cannot establish that no code was omitted.
 if(!comparison||comparison.truncated||comparison.incomplete||!Array.isArray(comparison.files)||comparison.files.length>=300||!Array.isArray(comparison.commits)||!Number.isSafeInteger(comparison.total_commits)||comparison.total_commits<0||comparison.total_commits!==comparison.commits.length||comparison.ahead_by!==comparison.total_commits)throw Error('HELPER_BRANCH_COMPARE_INCOMPLETE');
 if(comparison.base_commit?.sha!==base||!shaPattern.test(comparison.merge_base_commit?.sha||'')||comparison.commits.some(c=>!shaPattern.test(c.sha||''))||new Set(comparison.commits.map(c=>c.sha)).size!==comparison.commits.length)throw Error('HELPER_BRANCH_COMPARE_IDENTITY_MISMATCH');
 if(comparison.total_commits){if(!['ahead','diverged'].includes(comparison.status)||comparison.commits.at(-1).sha!==head)throw Error('HELPER_BRANCH_COMPARE_IDENTITY_MISMATCH');}
 else if(!['identical','behind'].includes(comparison.status)||comparison.files.length)throw Error('HELPER_BRANCH_COMPARE_IDENTITY_MISMATCH');
 return comparison.files;
}
async function harvestBranch({root,privateDir,commit,branch,api,validate=C.validateEnvelope,routing=C.routingProof}){
 const identity=branchIdentity(branch);
 if(!privateDir||!identity)return{status:'OUTSIDE_SCOPE',captured:0};
 const sourceCommit=branch.commit?.sha;
 if(!shaPattern.test(sourceCommit||''))throw Error('HELPER_BRANCH_COMMIT_REQUIRED');
 const baseCommit=await api.head('main');
 if(!shaPattern.test(baseCommit||''))throw Error('HELPER_BRANCH_BASE_COMMIT_REQUIRED');
 // Both compare endpoints and every content read are pinned to immutable SHAs.
 const files=completeCompare(await api.compare(baseCommit,sourceCommit),baseCommit,sourceCommit),record=/^control\/changes\/[A-Za-z0-9_.-]+\.txt$/;
 if(files.some(f=>f.status!=='added'||!(record.test(f.filename)||publicReceipt.test(f.filename)&&f.filename.startsWith(identity.directory))))throw Error('HELPER_BRANCH_FILES_OUTSIDE_SCOPE');
 const artifacts=[],pendingArtifacts=[];
 for(const file of files.filter(f=>f.filename.startsWith(identity.directory))){
  let artifact;
  try{
   const content=await(api.contentBytes?api.contentBytes(file.filename,sourceCommit):api.content(file.filename,sourceCommit));
   if(typeof content!=='string'&&!Buffer.isBuffer(content))throw Error('FULL_GITHUB_CONTENT_REQUIRED');
   const bytes=Buffer.isBuffer(content)?content:Buffer.from(content,'utf8');
   if(bytes.length>2_000_000)throw Error('HELPER_DELIVERY_FORMAT_LIMIT');
   artifact={path:file.filename,bytes};artifacts.push(artifact);
   let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('HELPER_JSON_ENCODING_INVALID');}
   // Preserve any BOM too; accepting a lossy decode would change source bytes.
   if(!Buffer.from(raw,'utf8').equals(bytes))throw Error('HELPER_JSON_ENCODING_INVALID');
   artifact.raw=raw;const batch=JSON.parse(raw);
   if(batch?.schema==='forge.outcome-helper-batch.v1')throw Error('PRIVATE_OUTCOME_DELIVERY_REQUIRED');
   if(batch?.schema!=='forge.shared-helper-batch.v1'||batch.provider!==identity.provider||batch.taskKey!==identity.taskKey)throw Error('HELPER_BRANCH_TASK_OR_PROVIDER_MISMATCH');
   if(file.filename!==identity.directory+batch.runId+'.json')throw Error('SOURCE_RUN_PATH_MISMATCH');
   validate(root,batch);routing(root,batch,commit);artifact.batch=batch;
  }catch(e){pendingArtifacts.push({path:file.filename,...diagnostic(e)});}
 }
 // A moving branch never produces even a private capture from a stale listing.
 if(await api.head(branch.name)!==sourceCommit)throw Error('HELPER_BRANCH_HEAD_CHANGED');
 const S=require('../programmed-coordinator/store.cjs');let captured=0;
 for(const artifact of artifacts){
  try{
   const sha256=S.hash(artifact.bytes),provenance={transport:'GITHUB_BRANCH',repository,sourceKey:identity.sourceKey,branch:branch.name,commit:sourceCommit,path:artifact.path};
   const captureId=S.hash(provenance),capture={...provenance,sha256,rawBase64:artifact.bytes.toString('base64'),...(artifact.raw!==undefined?{raw:artifact.raw}:{})};
   // Retain the exact rejected evidence privately, but never promote it to inbox.
   S.immutable(privateDir,'helper-delivery/branch-'+captureId+'.json',capture);
   if(!artifact.batch)continue;
   // A receipt/run path is immutable across branch moves and provider branches.
   S.immutable(privateDir,'helper-delivery/branch-receipt-'+S.hash({repository,path:artifact.path})+'.json',{repository,path:artifact.path,sha256});
   S.immutable(privateDir,'helper-inbox/forge-helper-'+sha256+'.json',artifact.batch);captured++;
  }catch(e){pendingArtifacts.push({path:artifact.path,...diagnostic(e.message==='Immutable evidence collision'?Error('IMMUTABLE_BRANCH_CAPTURE_COLLISION'):e)});}
 }
 return{status:pendingArtifacts.length?'PENDING':captured?'CAPTURED':'NO_RECEIPTS',captured,sourceKey:identity.sourceKey,branch:branch.name,sourceCommit,baseCommit,pendingArtifacts,...(pendingArtifacts.length?{owner:'CODE',reason:'HELPER_ARTIFACTS_PENDING'}:{})};
}
async function repair({root,commit,pr,api,validate=C.validateEnvelope,routing=C.routingProof,now=new Date()}){
 if(pr.base?.ref!=='main'||pr.head?.repo?.full_name!==repository)return{status:'OUTSIDE_SCOPE'};
 const files=await api.pages(`/repos/${repository}/pulls/${pr.number}/files`);
 if(files.some(f=>/^control\/changes\/[A-Za-z0-9_.-]+\.txt$/.test(f.filename)))return{status:'RECORD_PRESENT'};
 if(!files.length||files.some(f=>f.status!=='added'||!publicReceipt.test(f.filename)||f.filename.includes('FORGE_GROK_APPLICATION_OUTCOME_HELPER')))return{status:'OUTSIDE_SCOPE'};
 for(const f of files){
  const raw=await api.content(f.filename,pr.head.sha);if(Buffer.byteLength(raw)>2_000_000)throw Error('HELPER_DELIVERY_FORMAT_LIMIT');
  const batch=JSON.parse(raw);if(batch.schema==='forge.outcome-helper-batch.v1')throw Error('PRIVATE_OUTCOME_DELIVERY_REQUIRED');
  if(!f.filename.endsWith('/'+batch.runId+'.json'))throw Error('SOURCE_RUN_PATH_MISMATCH');
  validate(root,batch);routing(root,batch,commit);
 }
 const current=await api.head(pr.head.ref);if(current!==pr.head.sha)throw Error('HELPER_PR_HEAD_CHANGED');
 const date=now.toISOString().slice(0,10),filename=`control/changes/chatgpt-${date.replace(/-/g,'')}-helper-evidence-pr${pr.number}.txt`;
 const content=`WHAT=Publish validated evidence-only helper returns from PR ${pr.number}; preserve immutable source artifacts and require current canonical and Writer verification.\nREPO=forge-coordination\nPR=#${pr.number}\nDATE=${date}\n`;
 await api.create(filename,content,pr.head.ref,`CHATGPT FORGE-CODE-DELIVERY: add required evidence change record for PR ${pr.number}`);
 return{status:'RECORD_ADDED',pullRequest:pr.number,record:filename};
}
function github(token){
 const request=async(route,options={})=>{const r=await fetch('https://api.github.com'+route,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...options.headers},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('GITHUB_DELIVERY_HTTP_'+r.status);return r.json();};
 return{
  async pages(route){const all=[];for(let page=1;;page++){const items=await request(route+(route.includes('?')?'&':'?')+'per_page=100&page='+page);if(!Array.isArray(items))throw Error('INVALID_GITHUB_DELIVERY_PAGE');all.push(...items);if(items.length<100)return all;}},
  async content(file,ref){const r=await request(`/repos/${repository}/contents/${file}?ref=${encodeURIComponent(ref)}`);if(r.encoding!=='base64'||typeof r.content!=='string')throw Error('FULL_GITHUB_CONTENT_REQUIRED');return Buffer.from(r.content,'base64').toString('utf8');},
  async contentBytes(file,ref){const r=await request(`/repos/${repository}/contents/${file}?ref=${encodeURIComponent(ref)}`);if(r.encoding!=='base64'||typeof r.content!=='string')throw Error('FULL_GITHUB_CONTENT_REQUIRED');const bytes=Buffer.from(r.content,'base64');if(r.size!==bytes.length)throw Error('FULL_GITHUB_CONTENT_REQUIRED');return bytes;},
  async head(branch){return(await request(`/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;},
  branches(){return this.pages(`/repos/${repository}/branches`);},
  compare(base,head){if(!shaPattern.test(base)||!shaPattern.test(head))throw Error('HELPER_BRANCH_COMMIT_REQUIRED');return request(`/repos/${repository}/compare/${base}...${head}?per_page=100&page=1`);},
  create(file,content,branch,message){return request(`/repos/${repository}/contents/${file}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,branch,content:Buffer.from(content).toString('base64')})});}
 };
}
async function collect({root,privateDir,commit,api,validate=C.validateEnvelope,routing=C.routingProof}){
 const results=[];for(const pr of await api.pages(`/repos/${repository}/pulls?state=open&base=main`)){
  let artifacts;
  try{artifacts=await harvest({root,privateDir,commit,pr,api,validate,routing});const result=await repair({root,commit,pr,api,validate,routing});if(result.status!=='OUTSIDE_SCOPE'||artifacts.captured||artifacts.pendingArtifacts?.length)results.push({...result,...artifacts,pullRequest:pr.number,...(artifacts.pendingArtifacts?.length?{status:'PENDING',owner:'CODE',reason:'HELPER_ARTIFACTS_PENDING'}:{})});}
  catch(e){results.push({...artifacts,pullRequest:pr.number,status:'PENDING',owner:'CODE',...diagnostic(e)});}
 }
 // Older/mock readers retain PR-only behavior unless both read capabilities exist.
 if(privateDir&&typeof api.branches==='function'&&typeof api.compare==='function'){
  let branches;
  try{branches=await api.branches();if(!Array.isArray(branches))throw Error('INVALID_GITHUB_DELIVERY_PAGE');}
  catch(e){results.push({sourceKey:'branches:'+repository,status:'PENDING',owner:'CODE',...diagnostic(e)});}
  if(Array.isArray(branches)){
   results.push({sourceKey:'branches:'+repository,status:'LISTED'});
   for(const branch of branches){const identity=branchIdentity(branch);if(!identity)continue;
    try{results.push(await harvestBranch({root,privateDir,commit,branch,api,validate,routing}));}
    catch(e){results.push({sourceKey:identity.sourceKey,branch:branch.name,sourceCommit:branch.commit?.sha,status:'PENDING',owner:'CODE',...diagnostic(e)});}
   }
  }
 }
 return{schema:'forge.helper-delivery-repair.v1',results,merged:0,noProcessingCap:true};
}
module.exports={repair,harvest,harvestBranch,collect,github,diagnostic};
