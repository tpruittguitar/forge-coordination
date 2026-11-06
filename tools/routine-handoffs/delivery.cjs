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
  async head(branch){return(await request(`/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;},
  create(file,content,branch,message){return request(`/repos/${repository}/contents/${file}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,branch,content:Buffer.from(content).toString('base64')})});}
 };
}
async function collect({root,privateDir,commit,api}){
 const results=[];for(const pr of await api.pages(`/repos/${repository}/pulls?state=open&base=main`)){
  let artifacts;
  try{artifacts=await harvest({root,privateDir,commit,pr,api});const result=await repair({root,commit,pr,api});if(result.status!=='OUTSIDE_SCOPE'||artifacts.captured||artifacts.pendingArtifacts?.length)results.push({...result,...artifacts,pullRequest:pr.number,...(artifacts.pendingArtifacts?.length?{status:'PENDING',owner:'CODE',reason:'HELPER_ARTIFACTS_PENDING'}:{})});}
  catch(e){results.push({...artifacts,pullRequest:pr.number,status:'PENDING',owner:'CODE',...diagnostic(e)});}
 }
 return{schema:'forge.helper-delivery-repair.v1',results,merged:0,noProcessingCap:true};
}
module.exports={repair,harvest,collect,github,diagnostic};
