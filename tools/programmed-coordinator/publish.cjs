'use strict';
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process'), {isDeepStrictEqual}=require('node:util');
const guard='state/RELEVANCE_SCREEN_GUARD.json';
const paths=new Set(['state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json','state/RELEVANCE_INTAKE_PLAN.json',guard,'state/CLAUDE_HELPER_CONSUMPTION.json','state/EMAIL_RECOVERY_QUEUE.json','state/EMAIL_RECOVERY_SUMMARY.json','control/CLAUDE_HELPER_WORK.json','control/ENRICHMENT_HELPER_WORK.json']);
function allowed(p){return paths.has(p)||/^receipts\/FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+_(CHECKPOINT|ACCEPTANCE|VERIFIED|SCREEN|TERMINAL)\.json$/.test(p);}
function git(root,args,optional=false){
 const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_EDITOR:'true'}});
 if(r.error||r.status!==0){if(optional)return null;throw Error('Accounting Git operation failed: '+args[0]+'; preserve checkout and lock');}return r.stdout;
}
function conflicts(root){return git(root,['diff','--name-only','--diff-filter=U','-z']).split('\0').filter(Boolean);}
// All fields except the observation timestamp must agree, including unknown future fields.
// This must never choose a policy revision or silently merge disabled-rule changes.
function timestampMerge(left,right){
 const a={...left},b={...right};delete a.at;delete b.at;
 if(a.schema!=='forge.relevance-guard.v1'||!isDeepStrictEqual(a,b)||!Number.isFinite(Date.parse(left.at))||!Number.isFinite(Date.parse(right.at)))return null;
 return Date.parse(left.at)>=Date.parse(right.at)?left:right;
}
function finishRebase(root){
 while(true){
  const unresolved=conflicts(root);
  if(unresolved.length!==1||unresolved[0]!==guard)throw Error('Semantic or unrelated accounting conflict; preserve checkout and lock');
  let merged;try{merged=timestampMerge(JSON.parse(git(root,['show',':2:'+guard])),JSON.parse(git(root,['show',':3:'+guard])));}catch{throw Error('Unreadable guard conflict; preserve checkout and lock');}
  if(!merged)throw Error('Semantic guard conflict; preserve checkout and lock');
  fs.writeFileSync(path.join(root,guard),JSON.stringify(merged,null,2)+'\n');git(root,['add','--',guard]);
  if(git(root,['-c','core.editor=true','rebase','--continue'],true)!==null)return;
 }
}
function publish(root,{maxAttempts=4,beforePush}={}){
 // A pre-existing rebase is an operator recovery obligation, not permission to start production.
 if(git(root,['rev-parse','--verify','REBASE_HEAD'],true)!==null)throw Error('Prior rebase requires reconciliation; preserve checkout and lock');
 const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
 for(const line of status){const f=line.slice(3);if(!allowed(f)||/[RCU]/.test(line.slice(0,2)))throw Error('Unexpected changed accounting path; preserve checkout and lock');}
 if(status.length){git(root,['add','--',...status.map(s=>s.slice(3))]);if(git(root,['diff','--cached','--quiet'],true)===null)git(root,['-c','user.name=forge-code-coordinator','-c','user.email=forge-code-coordinator@users.noreply.github.com','commit','-m','CHATGPT FORGE-CODE-COORDINATOR: checkpoint helper processing and verified effects']);}
 // Always fetch, even with a clean checkout: a failed push can leave committed, unpublished receipts.
 for(let attempt=0;attempt<maxAttempts;attempt++){
  git(root,['fetch','origin','main']);
  const ahead=git(root,['rev-list','origin/main..HEAD']).trim();
  if(!ahead)return {published:true,commit:git(root,['rev-parse','HEAD']).trim(),attempts:attempt+1};
  const retained=git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean);
  if(retained.some(f=>!allowed(f)))throw Error('Unpublished changes outside accounting scope; preserve checkout and lock');
  if(git(root,['rebase','origin/main'],true)===null)finishRebase(root);
  if(beforePush)beforePush(attempt);
  if(git(root,['push','origin','HEAD:main'],true)===null)continue;
  const sha=git(root,['rev-parse','HEAD']).trim();git(root,['fetch','origin','main']);
  if(git(root,['merge-base','--is-ancestor',sha,'origin/main'],true)!==null)return {published:true,commit:sha,attempts:attempt+1};
 }
 throw Error('Accounting publication retry boundary reached; preserve committed receipts and lock');
}
if(require.main===module){try{console.log(JSON.stringify(publish(path.resolve(process.argv[2]||'.'))));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={publish,timestampMerge,allowed};
