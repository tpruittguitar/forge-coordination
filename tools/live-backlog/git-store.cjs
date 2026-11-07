'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const Model=require('./model.cjs'),{annotate}=require('./occurrences.cjs');
const REMOTE='https://github.com/tpruittguitar/forge-coordination.git';
const MAX_PUSH_ATTEMPTS=3;
// Only a completed porcelain rejection for our one target proves this push did not write.
function rejectedPush(error,commit){
 if(error.status!==1||error.signal||error.killed||error.code==='ETIMEDOUT')return null;
 const prefix='!\t'+commit+':refs/heads/main\t';
 const lines=String(error.stdout||'').split(/\r?\n/).filter(line=>line.startsWith(prefix));
 if(lines.length!==1)return null;
 const status=lines[0].slice(prefix.length);
 if(/^\[rejected\] \((?:fetch first|non-fast-forward)\)$/.test(status))return 'race';
 return /^\[(?:remote rejected|rejected)\] \([^\r\n]+\)$/.test(status)?'rejected':null;
}
function validateRead(revision,file){if(!/^[a-f0-9]{40}$/.test(revision)||typeof file!=='string'||!/^(state|receipts)\/[A-Za-z0-9_./-]+\.json$/.test(file)||file.includes('..'))throw Error('INVALID_SOURCE_PATH');}
class GitStore{
 constructor({root,remote=REMOTE,allowTestRemote=false}){this.root=root;this.remote=remote;this.failed=new Map();this.uncertain=new Set();this.fetchRef='refs/forge-worksheet/'+crypto.randomUUID();if(remote!==REMOTE&&!allowTestRemote)throw Error('ONLY_FORGE_COORDINATION_REMOTE_ALLOWED');this.git(['rev-parse','--git-dir']);}
 git(args,input,extra={},encoding='utf8'){return cp.execFileSync('git',args,{cwd:this.root,encoding,maxBuffer:100*1024*1024,input,timeout:90000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',...extra},stdio:['pipe','pipe','pipe']});}
 fresh(){this.git(['fetch','--no-tags','--no-write-fetch-head',this.remote,'refs/heads/main:'+this.fetchRef]);return this.git(['rev-parse',this.fetchRef]).trim();}
 read(revision,file){validateRead(revision,file);return this.git(['show',revision+':'+file]);}
 readMany(revision,files){
  if(!Array.isArray(files)||!/^[a-f0-9]{40}$/.test(revision))throw Error('INVALID_SOURCE_PATH');
  const paths=[...new Set(files)];for(const file of paths)validateRead(revision,file);
  const values=new Map();if(!paths.length)return values;
  // One process, exact revision, no worktree reads or cross-revision cache.
  // Batch sizes are byte counts, so decode each UTF-8 blob only after framing.
  const raw=this.git(['cat-file','--batch'],paths.map(file=>revision+':'+file+'\n').join(''),{},null);let offset=0;
  for(const file of paths){
   const end=raw.indexOf(10,offset);if(end<0)throw Error('INVALID_GIT_BATCH');
   const header=raw.subarray(offset,end).toString('utf8');offset=end+1;
   if(header===revision+':'+file+' missing')continue;
   const match=/^[a-f0-9]{40} blob (\d+)$/.exec(header),size=match?Number(match[1]):NaN;
   if(!Number.isSafeInteger(size)||size<0||size>raw.length-offset-1||raw[offset+size]!==10)throw Error('INVALID_GIT_BATCH');
   values.set(file,raw.subarray(offset,offset+size).toString('utf8'));offset+=size+1;
  }
  if(offset!==raw.length)throw Error('INVALID_GIT_BATCH');return values;
 }
 snapshot(){const revision=this.fresh(),source=Model.load(p=>this.read(revision,p));return {revision,source,salaryIndex:require('./salary.cjs').savedIndex(p=>this.read(revision,p)),holdIndex:require('./hold-reason.cjs').savedIndex(p=>this.read(revision,p),source,paths=>this.readMany(revision,paths))};}
 receiptsAt(revision){
  const paths=this.git(['ls-tree','-r','--name-only',revision,'receipts/live-backlog']).trim().split('\n').filter(Boolean);
  const bodies=this.readMany(revision,paths);
  return paths.map(p=>JSON.parse(bodies.get(p)));
 }
 committedAt(revision,requestId){
  const receipt=this.receiptsAt(revision).find(r=>r.requestId===requestId);
  return receipt?{...receipt,ok:true,revision}:null;
 }
 receipt(requestId){
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))throw Error('INVALID_REQUEST_ID');
  const committed=this.committedAt(this.fresh(),requestId);
  if(committed)return committed;
  return this.failed.has(requestId)?{ok:false,status:'failed',definitive:true,error:this.failed.get(requestId)}:{ok:false,status:'unknown',error:'No committed receipt found. Refresh and check again before another mutation.'};
 }
 matchingReceipt(receipt,input,kind){
  const keys=kind==='delete'&&Array.isArray(input.keys)?JSON.stringify([...input.keys].sort()):null;
  const priorKeys=JSON.stringify([...new Set(receipt.items.map(i=>i.groupKey))].sort());
  if(receipt.operation!==kind||(receipt.selectionRevision||receipt.baseRevision)!==input.revision||(kind==='delete'?keys!==priorKeys:receipt.restores!==input.receiptId))throw Error('REQUEST_ID_REUSED_FOR_DIFFERENT_EDIT');
  this.failed.delete(input.requestId);this.uncertain?.delete(input.requestId);
  return receipt;
 }
 isAncestor(before,after){
  try{this.git(['merge-base','--is-ancestor',before,after]);return true;}
  catch(error){if(error.status===1)return false;throw error;}
 }
 validateSelection(input,kind,revision,source,selection){
  if(!this.git(['show',revision+':tools/pipeline-observability/upstream-flow.js']).includes("require('../live-backlog/model.cjs').activeDeletion(e)"))throw Error('MERGE_WORKSHEET_SUPPORT_BEFORE_LIVE_EDITS');
  if(revision===input.revision)return;
  if(!this.isAncestor(input.revision,revision))throw Error('SOURCE_HISTORY_CHANGED_REFRESH_AND_RESELECT');
  if(kind!=='delete')return;
  if(!Array.isArray(input.keys))throw Error('SELECT_UNIQUE_DISCOVERY_ROWS');
  const before=new Map(selection.items.map(x=>[x.key,x])),after=new Map(source.items.map(x=>[x.key,x]));
  const identity=x=>x&&JSON.stringify([x.key,x.company,x.title,x.location,x.sourceUrl]);
  for(const key of input.keys)if(!before.has(key)||!after.has(key)||identity(before.get(key))!==identity(after.get(key)))throw Error('SELECTED_ROW_CHANGED_REFRESH_AND_RESELECT');
  const oldRepeats=new Map(annotate(selection.items).map(x=>[x.key,x])),newRepeats=new Map(annotate(source.items).map(x=>[x.key,x]));
  for(const key of input.keys){const prior=oldRepeats.get(key),next=newRepeats.get(key);if((prior.occurrences>1||next.occurrences>1)&&prior.repeatSignature!==next.repeatSignature)throw Error('REPEAT_GROUP_CHANGED_REFRESH_AND_RESELECT');}
 }
 prepare(input,kind,revision,source){
  const original=kind==='restore'?JSON.parse(this.read(revision,Model.receiptPath(input.receiptId))):null;
  const {files,receipt}=Model.mutate(source,{...input,revision,selectionRevision:input.revision},kind,original);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-worksheet-index-')),env={GIT_INDEX_FILE:path.join(dir,'index')};
  try{
   this.git(['read-tree',revision],undefined,env);
   for(const [file,body]of files){if(body===null)this.git(['update-index','--force-remove','--',file],undefined,env);else{const blob=this.git(['hash-object','-w','--stdin'],body).trim();this.git(['update-index','--add','--cacheinfo','100644',blob,file],undefined,env);}}
   const tree=this.git(['write-tree'],undefined,env);
   return this.git(['commit-tree',tree.trim(),'-p',revision],`TIM WORKSHEET ${input.requestId}: ${kind} ${receipt.removed??receipt.restored} discovery cards\n`,env).trim();
  }catch{throw Error('Local commit preparation failed before any push. No rows changed. Check this worksheet checkout before retrying.');}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
 apply(input,kind){
  if(!/^[a-f0-9]{40}$/.test(input.revision||'')||!/^[a-f0-9-]{36}$/i.test(input.requestId||''))throw Error('INVALID_REQUEST');
  this.uncertain??=new Set();
  let revision,selection;
  try{revision=this.fresh();}catch(error){if(this.uncertain.has(input.requestId))throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');throw error;}
  for(let attempt=0;attempt<MAX_PUSH_ATTEMPTS;attempt++){
   let existing;
   try{existing=this.committedAt(revision,input.requestId);}catch(error){if(this.uncertain.has(input.requestId))throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');throw error;}
   if(existing)return this.matchingReceipt(existing,input,kind);
   // A repeated HTTP request must not turn an ambiguous transport outcome into a new write.
   if(this.uncertain.has(input.requestId))throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');
   let commit;
   try{
    try{this.git(['var','GIT_AUTHOR_IDENT']);this.git(['var','GIT_COMMITTER_IDENT']);}
    catch{throw Error('This worksheet checkout needs a Git author name and email. No rows changed. Configure its local identity, then refresh.');}
    const source=Model.load(p=>this.read(revision,p));
    selection??=revision===input.revision?source:Model.load(p=>this.read(input.revision,p));
    this.validateSelection(input,kind,revision,source,selection);
    commit=this.prepare(input,kind,revision,source);
   }catch(error){this.failed.set(input.requestId,error.message);throw error;}
   this.failed.delete(input.requestId);this.uncertain.add(input.requestId);
   try{this.git(['push','--porcelain',this.remote,commit+':refs/heads/main']);}
   catch(error){
    let checkedRevision,confirmed;
    try{checkedRevision=this.fresh();confirmed=this.committedAt(checkedRevision,input.requestId);}catch{throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');}
    if(confirmed)return this.matchingReceipt(confirmed,input,kind);
    const rejection=rejectedPush(error,commit);
    if(!rejection)throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');
    this.uncertain.delete(input.requestId);
    const message='SOURCE_CHANGED_OR_PUSH_REJECTED_REFRESH_AND_RESELECT';
    this.failed.set(input.requestId,message);
    // Rebuild, never cherry-pick/force, only after a proven rejection plus remote receipt absence.
    // Revalidate against the ORIGINAL selection and preserve all newer unrelated source data.
    if(rejection!=='race'||attempt+1===MAX_PUSH_ATTEMPTS||checkedRevision===revision||!this.isAncestor(revision,checkedRevision))throw Error(message);
    revision=checkedRevision;
    continue;
   }
   let confirmed;
   try{confirmed=this.committedAt(this.fresh(),input.requestId);}catch{throw Error('COMMIT_READBACK_UNCONFIRMED_CHECK_RECEIPT');}
   if(!confirmed)throw Error('COMMIT_READBACK_UNCONFIRMED_CHECK_RECEIPT');
   return this.matchingReceipt(confirmed,input,kind);
  }
 }
}
module.exports={GitStore,REMOTE};
