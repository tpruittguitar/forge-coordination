'use strict';
const C=require('../programmed-coordinator/collect.cjs');
const repository='tpruittguitar/forge-coordination',publicReceipt=/^receipts\/(?:CLAUDE_RELEVANCE\/[A-Za-z0-9_-]+|(?:CLAUDE_HELPERS|GROK_HELPERS)\/FORGE_[A-Z0-9_]+\/[A-Za-z0-9_-]+)\.json$/;
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
async function collect({root,commit,api}){
 const results=[];for(const pr of await api.pages(`/repos/${repository}/pulls?state=open&base=main`)){
  try{const result=await repair({root,commit,pr,api});if(result.status!=='OUTSIDE_SCOPE')results.push({...result,pullRequest:pr.number});}
  catch(e){results.push({pullRequest:pr.number,status:'PENDING',owner:'CODE',reason:/^[A-Z][A-Z0-9_0-9]{3,100}$/.test(e.message)?e.message:'HELPER_PR_VALIDATION_REQUIRED'});}
 }
 return{schema:'forge.helper-delivery-repair.v1',results,merged:0,noProcessingCap:true};
}
module.exports={repair,collect,github};
