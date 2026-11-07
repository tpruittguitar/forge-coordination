'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const Model=require('./model.cjs');
const REMOTE='https://github.com/tpruittguitar/forge-coordination.git';
class GitStore{
 constructor({root,remote=REMOTE,allowTestRemote=false}){this.root=root;this.remote=remote;this.failed=new Map();this.fetchRef='refs/forge-worksheet/'+crypto.randomUUID();if(remote!==REMOTE&&!allowTestRemote)throw Error('ONLY_FORGE_COORDINATION_REMOTE_ALLOWED');this.git(['rev-parse','--git-dir']);}
 git(args,input,extra={}){return cp.execFileSync('git',args,{cwd:this.root,encoding:'utf8',maxBuffer:100*1024*1024,input,timeout:90000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',...extra},stdio:['pipe','pipe','pipe']});}
 fresh(){this.git(['fetch','--no-tags','--no-write-fetch-head',this.remote,'refs/heads/main:'+this.fetchRef]);return this.git(['rev-parse',this.fetchRef]).trim();}
 read(revision,file){if(!/^[a-f0-9]{40}$/.test(revision)||!/^(state|receipts)\/[A-Za-z0-9_./-]+\.json$/.test(file)||file.includes('..'))throw Error('INVALID_SOURCE_PATH');return this.git(['show',revision+':'+file]);}
 snapshot(){const revision=this.fresh(),source=Model.load(p=>this.read(revision,p));return {revision,source};}
 receipt(requestId){if(!/^[a-f0-9-]{36}$/i.test(requestId||''))throw Error('INVALID_REQUEST_ID');const revision=this.fresh();let paths=this.git(['ls-tree','-r','--name-only',revision,'receipts/live-backlog']).trim().split('\n').filter(Boolean);for(const p of paths){const r=JSON.parse(this.read(revision,p));if(r.requestId===requestId)return {ok:true,revision,...r};}return this.failed.has(requestId)?{ok:false,status:'failed',definitive:true,error:this.failed.get(requestId)}:{ok:false,status:'unknown',error:'No committed receipt found. Refresh and check again before another mutation.'};}
 apply(input,kind){
  if(!/^[a-f0-9]{40}$/.test(input.revision||'')||!/^[a-f0-9-]{36}$/i.test(input.requestId||''))throw Error('INVALID_REQUEST');
  const revision=this.fresh(),existing=this.git(['ls-tree','-r','--name-only',revision,'receipts/live-backlog']).trim().split('\n').filter(Boolean);
  for(const p of existing){const r=JSON.parse(this.read(revision,p));if(r.requestId===input.requestId){const keys=kind==='delete'&&Array.isArray(input.keys)?JSON.stringify([...input.keys].sort()):null,priorKeys=JSON.stringify([...new Set(r.items.map(i=>i.groupKey))].sort());if(r.operation!==kind||(r.selectionRevision||r.baseRevision)!==input.revision||(kind==='delete'?keys!==priorKeys:r.restores!==input.receiptId))throw Error('REQUEST_ID_REUSED_FOR_DIFFERENT_EDIT');return {ok:true,revision,...r};}}
  const source=Model.load(p=>this.read(revision,p));if(!this.git(['show',revision+':tools/pipeline-observability/upstream-flow.js']).includes("require('../live-backlog/model.cjs').activeDeletion(e)"))throw Error('MERGE_WORKSHEET_SUPPORT_BEFORE_LIVE_EDITS');if(revision!==input.revision){this.git(['merge-base','--is-ancestor',input.revision,revision]);if(kind==='delete'){if(!Array.isArray(input.keys))throw Error('SELECT_UNIQUE_DISCOVERY_ROWS');const old=Model.load(p=>this.read(input.revision,p)),before=new Map(old.items.map(x=>[x.key,x])),after=new Map(source.items.map(x=>[x.key,x]));const identity=x=>x&&JSON.stringify([x.key,x.company,x.title,x.location,x.sourceUrl]);for(const key of input.keys)if(!before.has(key)||!after.has(key)||identity(before.get(key))!==identity(after.get(key)))throw Error('SELECTED_ROW_CHANGED_REFRESH_AND_RESELECT');}}
  const original=kind==='restore'?JSON.parse(this.read(revision,Model.receiptPath(input.receiptId))):null;
  const {files,receipt}=Model.mutate(source,{...input,revision,selectionRevision:input.revision},kind,original),dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-worksheet-index-')),env={GIT_INDEX_FILE:path.join(dir,'index')};let commit;
  try{this.git(['read-tree',revision],undefined,env);for(const [file,body]of files){if(body===null)this.git(['update-index','--force-remove','--',file],undefined,env);else{const blob=this.git(['hash-object','-w','--stdin'],body).trim();this.git(['update-index','--add','--cacheinfo','100644',blob,file],undefined,env);}}
   const tree=this.git(['write-tree'],undefined,env);commit=this.git(['commit-tree',tree.trim(),'-p',revision],`TIM WORKSHEET ${input.requestId}: ${kind} ${receipt.removed??receipt.restored} discovery cards\n`,env).trim();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  // Normal fast-forward push is an atomic compare-and-swap: never force or replay.
  try{this.git(['push',this.remote,commit+':refs/heads/main']);}
  catch(e){let checked=false;try{const check=this.receipt(input.requestId);if(check.ok)return check;checked=true;}catch{}if(checked&&/\[rejected\].*(?:fetch first|non-fast-forward)|\[remote rejected\]/i.test(String(e.stderr||''))){this.failed.set(input.requestId,'SOURCE_CHANGED_OR_PUSH_REJECTED_REFRESH_AND_RESELECT');throw Error('SOURCE_CHANGED_OR_PUSH_REJECTED_REFRESH_AND_RESELECT');}throw Error('PUSH_NOT_CONFIRMED_CHECK_RECEIPT');}
  let confirmed;try{confirmed=this.receipt(input.requestId);}catch{throw Error('COMMIT_READBACK_UNCONFIRMED_CHECK_RECEIPT');}if(!confirmed.ok)throw Error('COMMIT_READBACK_UNCONFIRMED_CHECK_RECEIPT');return confirmed;
 }
}
module.exports={GitStore,REMOTE};
