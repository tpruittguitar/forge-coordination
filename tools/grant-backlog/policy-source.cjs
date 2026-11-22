'use strict';
// Read-only current policy source proof; never a positive eligibility decision.
const cp=require('node:child_process'),crypto=require('node:crypto');
const S=require('../programmed-coordinator/store.cjs');
const FILE='rules/TIM_PIPELINE_RULES_CANONICAL.txt',REPO='tpruittguitar/forge-policy';
function read({root,now=Date.now,git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:2000000,stdio:['ignore','pipe','pipe']})}){
 try{
  const remote=git(['remote','get-url','origin']).trim();
  if(!['https://github.com/'+REPO,'https://github.com/'+REPO+'.git','git@github.com:'+REPO+'.git'].includes(remote))throw Error('POLICY_REMOTE_MISMATCH');
  const commit=git(['rev-parse','HEAD']).trim(),head=()=>git(['ls-remote','origin','refs/heads/main']).trim().split(/\s/)[0];
  if(!/^[a-f0-9]{40}$/.test(commit)||head()!==commit||git(['status','--porcelain']).trim())throw Error('FRESH_PUBLISHED_POLICY_REQUIRED');
  const raw=git(['show',commit+':'+FILE]),blob=git(['rev-parse',commit+':'+FILE]).trim(),bytes=Buffer.from(raw);
  const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(blob!==actual||!/^SECTION=NEVER_CONSIDER\s*$/m.test(raw)||head()!==commit)throw Error('POLICY_SOURCE_CHAIN_INVALID');
  return {raw,proof:{repo:REPO,path:FILE,branch:'main',commit,blob,rawSha256:S.hash(raw),readAt:new Date(now()).toISOString()}};
 }catch(e){if(/^[A-Z][A-Z0-9_]+$/.test(e.message))throw e;throw Error('POLICY_SOURCE_READ_FAILED');}
}
module.exports={read,FILE,REPO};
