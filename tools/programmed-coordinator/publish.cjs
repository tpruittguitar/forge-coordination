'use strict';
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process'), {isDeepStrictEqual}=require('node:util');
const Pages=require('../helper-routing/shared-pages.cjs');
const guard='state/RELEVANCE_SCREEN_GUARD.json',enrichment='control/ENRICHMENT_HELPER_WORK.json';
const paths=new Set(['control/SHARED_HELPER_WORK.json','state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json','state/RELEVANCE_INTAKE_PLAN.json',guard,'state/CLAUDE_HELPER_CONSUMPTION.json','state/EMAIL_RECOVERY_QUEUE.json','state/EMAIL_RECOVERY_SUMMARY.json','control/CLAUDE_HELPER_WORK.json','control/ENRICHMENT_HELPER_WORK.json']);
for(const p of ['state/HELPER_TRANSPORT.json','state/ROUTINE_HANDOFFS_REPORT.json','state/HELPER_HANDOFFS.json','state/HELPER_ROUTING_CURRENT.json','state/CODE_INTAKE_CONSUMPTION.json','control/GROK_INTAKE_HELPER_WORK.json','control/CLAUDE_RELEVANCE_WORK.json'])paths.add(p);
paths.add('state/DIRECT_RETURN_TRANSPORT.json');paths.add('state/AI_EXCEPTION_WORK.json');paths.add('state/AI_EXCEPTION_PROGRESS.json');paths.add('state/COORDINATOR_CATCH_UP.json');
for(const p of ['state/MAIL_PROCESSING.json','state/MAIL_PROCESSING_REPORT.json','state/MAIL_SOURCE_HANDOFFS.json','state/APPLICATION_TRACKER_EVENTS.json','state/APPLICATION_OUTCOMES.json','state/APPLICATION_TRACKER_CURSOR.json','control/OUTCOME_HELPER_WORK.json'])paths.add(p);
for(const task of Object.keys(require('../helper-routing/shared.cjs').TASKS))paths.add(Pages.indexPath(task));
const membershipAudit=p=>/^receipts\/ENRICHMENT_MEMBERSHIP_REPAIRS\/FORGE-MEMBERSHIP-CHATGPT-[A-Za-z0-9_-]{3,100}\.json$/.test(p);
function allowed(p){return paths.has(p)||membershipAudit(p)||Pages.classify(p)==='IMMUTABLE'||/^receipts\/AI_EXCEPTION_RUNS\/FORGE-EXCEPTION-CHATGPT-[A-Za-z0-9_-]{3,100}_(START|CHECKPOINT)\.json$/.test(p)||/^receipts\/FORGE-ENRICH_ATS-ATSBOT-[A-Za-z0-9_-]+_NOT_ACCEPTED\.json$/.test(p)||/^receipts\/AI_EXCEPTION_REVIEWS\/[a-f0-9]{64}-[a-f0-9]{64}\.json$/.test(p)||/^receipts\/FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+_(CHECKPOINT|ACCEPTANCE|VERIFIED|NOT_ACCEPTED|SCREEN|TERMINAL|TRANSPORT|HANDOFFS|MAIL|DEFERRED)\.json$/.test(p)||/^receipts\/FORGE-MAIL-CHATGPT-[a-f0-9]{32}(?:-A[1-9][0-9]{0,5})?_(CHECKPOINT|VERIFIED|NOT_ACCEPTED)\.json$/.test(p)||/^control\/(grok-intake|claude-relevance)\/FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+-\d{4}\.json$/.test(p)||/^receipts\/(CLAUDE_HELPERS|GROK_HELPERS|CHATGPT_HELPERS)\/FORGE_[A-Z0-9_]+\/[A-Za-z0-9_-]+\.json$/.test(p)||/^receipts\/CLAUDE_RELEVANCE\/[A-Za-z0-9_-]+\.json$/.test(p);}
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
  const exception='state/AI_EXCEPTION_WORK.json';
  if(!unresolved.length||unresolved.some(f=>![guard,exception].includes(f)))throw Error('Semantic or unrelated accounting conflict; preserve checkout and lock');
  // Validate every resolution before modifying or staging any conflicted file.
  const resolutions=[];
  for(const file of unresolved){
   let merged;
   if(file===guard){
    try{merged=timestampMerge(JSON.parse(git(root,['show',':2:'+guard])),JSON.parse(git(root,['show',':3:'+guard])));}catch{throw Error('Unreadable guard conflict; preserve checkout and lock');}
    if(!merged)throw Error('Semantic guard conflict; preserve checkout and lock');
   }else{
    try{merged=require('./exception-merge.cjs').mergeExceptionWork(root,...[1,2,3].map(stage=>JSON.parse(git(root,['show',':'+stage+':'+file]))));}catch{throw Error('Semantic exception accounting conflict; preserve checkout and lock');}
   }
   resolutions.push([file,merged]);
  }
  for(const [file,merged]of resolutions){fs.writeFileSync(path.join(root,file),JSON.stringify(merged,null,2)+'\n');git(root,['add','--',file]);}
  if(git(root,['-c','core.editor=true','rebase','--continue'],true)!==null)return;
 }
}
// Validate only projection-related local deltas. An independently published main
// may contain stale indexes: readers reject those, but unrelated accounting must
// remain publishable so the next locked coordinator can regenerate projections.
function validateProjectionDelta(root,files){
 for(const file of new Set(files))if(Pages.classify(file)==='IMMUTABLE')Pages.validateImmutableFile(root,file);
 const projection=files.some(f=>Pages.classify(f));
 if(projection||files.includes('control/SHARED_HELPER_WORK.json'))Pages.validateStored(root,{allowExpired:true,required:projection});
}
// A valid working copy is insufficient: Git clean filters/newline conversion
// must not change the bytes that will actually be published. Check the staged
// source, indexes and referenced pages, including newly added historical pages.
function validateProjectionIndex(root,files){
 const source='control/SHARED_HELPER_WORK.json';
 if(!files.some(f=>Pages.classify(f)||f===source))return;
 const bound=new Set([source,...files.filter(f=>Pages.classify(f))]);
 for(const task of Object.keys(require('../helper-routing/shared.cjs').TASKS)){
  const file=Pages.indexPath(task);if(!fs.existsSync(path.join(root,file)))continue;
  bound.add(file);for(const page of JSON.parse(fs.readFileSync(path.join(root,file),'utf8')).pages)bound.add(page.file);
 }
 // Enumerate fixed prefixes rather than one argument per page: Windows has a
 // short command-line limit, while projection history can contain many pages.
 const staged=new Map(git(root,['ls-files','--stage','-z','--',source,Pages.BASE]).split('\0').filter(Boolean).map(line=>{
  const match=/^\d+ ([a-f0-9]+) 0\t(.+)$/.exec(line);
  if(!match)throw Error('Unmerged projection index; preserve checkout and lock');
  return [match[2],match[1]];
 }));
 for(const file of bound)if(staged.get(file)!==Pages.blob(fs.readFileSync(path.join(root,file))))
  throw Error('Shared projection Git bytes differ from validated bytes; preserve checkout and lock');
}
// A clean Git rebase can combine two valid appends into duplicate obligations.
// Validate the actual staged/committed membership, not just a pre-rebase worktree.
// Unrelated receipts can still publish when main independently has bad membership.
function validateEnrichmentDelta(root,files,ref=null){
 if(!files.includes(enrichment))return;
 const raw=ref?git(root,['show',(ref===':'?'':ref)+':'+enrichment]):fs.readFileSync(path.join(root,enrichment),'utf8');
 try{require('../helper-routing/enrichment.cjs').validateWork(JSON.parse(raw));}
 catch(e){throw Error('Invalid enrichment membership; preserve checkout and lock: '+e.message);}
}
function retainedSafe(root){
 for(const name of ['rebase-merge','rebase-apply','MERGE_HEAD','CHERRY_PICK_HEAD'])if(fs.existsSync(path.resolve(root,git(root,['rev-parse','--git-path',name]).trim())))throw Error('Interrupted Git operation requires reconciliation');
 const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
 if(status.some(line=>!allowed(line.slice(3))||/[RCU]/.test(line.slice(0,2))))throw Error('Unexpected retained checkout changes');
 for(const line of status)if((Pages.classify(line.slice(3))==='IMMUTABLE'||membershipAudit(line.slice(3)))&&!['??','A'].includes(line.slice(0,2).trim()))throw Error('Immutable accounting evidence changed; preserve checkout and lock');
 const changes=git(root,['diff','--name-status','--no-renames','-z','origin/main...HEAD']).split('\0').filter(Boolean);
 for(let n=0;n<changes.length;n+=2)if((Pages.classify(changes[n+1])==='IMMUTABLE'||membershipAudit(changes[n+1]))&&changes[n]!=='A')throw Error('Committed immutable evidence changed; preserve checkout and lock');
 const retained=git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean);
 if(retained.some(f=>!allowed(f)))throw Error('Unpublished code requires reconciliation');
 validateProjectionDelta(root,[...status.map(s=>s.slice(3)),...retained]);
 validateEnrichmentDelta(root,[...status.map(s=>s.slice(3)),...retained]);
 return {safe:true};
}
function publish(root,{maxAttempts=4,beforePush}={}){
 // REBASE_HEAD can survive a finished/quit rebase. Git's actual operation
 // directories identify an interrupted rebase; a leftover pseudoref alone does not.
 // Retained commits and immutable evidence still pass the checks below.
 if(['rebase-merge','rebase-apply'].some(name=>fs.existsSync(path.resolve(root,git(root,['rev-parse','--git-path',name]).trim()))))
  throw Error('Prior rebase requires reconciliation; preserve checkout and lock');
 const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
 for(const line of status){const f=line.slice(3);if(!allowed(f)||/[RCU]/.test(line.slice(0,2)))throw Error('Unexpected changed accounting path; preserve checkout and lock');if(!paths.has(f)&&!['??','A'].includes(line.slice(0,2).trim()))throw Error('Immutable accounting evidence changed; preserve checkout and lock');}
 validateProjectionDelta(root,[...status.map(s=>s.slice(3)),...git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean)]);
 validateEnrichmentDelta(root,[...status.map(s=>s.slice(3)),...git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean)]);
 if(status.length){git(root,['add','--',...status.map(s=>s.slice(3))]);validateProjectionIndex(root,status.map(s=>s.slice(3)));validateEnrichmentDelta(root,status.map(s=>s.slice(3)),':');if(git(root,['diff','--cached','--quiet'],true)===null)git(root,['-c','user.name=forge-code-coordinator','-c','user.email=forge-code-coordinator@users.noreply.github.com','commit','-m','CHATGPT FORGE-CODE-COORDINATOR: checkpoint helper processing and verified effects']);}
 // Always fetch, even with a clean checkout: a failed push can leave committed, unpublished receipts.
 for(let attempt=0;attempt<maxAttempts;attempt++){
  git(root,['fetch','origin','main']);
  const ahead=git(root,['rev-list','origin/main..HEAD']).trim();
  if(!ahead)return {published:true,commit:git(root,['rev-parse','HEAD']).trim(),attempts:attempt+1};
  const retained=git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean);
  if(retained.some(f=>!allowed(f)))throw Error('Unpublished changes outside accounting scope; preserve checkout and lock');
  const changes=git(root,['diff','--name-status','--no-renames','-z','origin/main...HEAD']).split('\0').filter(Boolean);
  for(let n=0;n<changes.length;n+=2)if(!paths.has(changes[n+1])&&changes[n]!=='A')throw Error('Committed immutable evidence changed; preserve checkout and lock');
  if(git(root,['rebase','origin/main'],true)===null)finishRebase(root);
  validateProjectionDelta(root,git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean));
  validateProjectionIndex(root,git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean));
  validateEnrichmentDelta(root,git(root,['diff','--name-only','-z','origin/main...HEAD']).split('\0').filter(Boolean),'HEAD');
  if(beforePush)beforePush(attempt);
  if(git(root,['push','origin','HEAD:main'],true)===null)continue;
  const sha=git(root,['rev-parse','HEAD']).trim();git(root,['fetch','origin','main']);
  if(git(root,['merge-base','--is-ancestor',sha,'origin/main'],true)!==null)return {published:true,commit:sha,attempts:attempt+1};
 }
 throw Error('Accounting publication retry boundary reached; preserve committed receipts and lock');
}
if(require.main===module){try{console.log(JSON.stringify(process.argv.includes('--check-retained')?retainedSafe(path.resolve(process.argv[2]||'.')):publish(path.resolve(process.argv[2]||'.'))));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={publish,timestampMerge,allowed,retainedSafe};
