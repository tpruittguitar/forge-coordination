'use strict';
// Explicit, accounting-only repair. Never a runtime dedupe or Writer retry.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const E=require('./enrichment.cjs'),S=require('../programmed-coordinator/store.cjs');
const FILE='control/ENRICHMENT_HELPER_WORK.json',AUDITS='receipts/ENRICHMENT_MEMBERSHIP_REPAIRS';
const IDS=Object.freeze(['V2I-19960034BA90','V2I-B57B353BDDEF','V2I-1DC4DBFB8595','V2I-2B9B288A5012']);
const TASK='FORGE_CHATGPT_ENRICHMENT_RESEARCH',ASSIGNMENT='GROK-ENRICH-20261101-V1';
const RUN=/^FORGE-MEMBERSHIP-CHATGPT-[A-Za-z0-9_-]{3,100}$/;
const blob=raw=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function plan(raw,{expectedBlobSha}={}){
 if(typeof raw!=='string'||!(/^[a-f0-9]{40}$/).test(expectedBlobSha||'')||blob(raw)!==expectedBlobSha)throw Error('EXACT_MEMBERSHIP_BLOB_REQUIRED');
 const work=JSON.parse(raw);
 if(work.schema!=='forge.enrichment-helper-work.v1'||work.assignmentId!==ASSIGNMENT||work.provider!=='ChatGPT'||work.taskKey!==TASK||work.enabled!==true||work.routingActive!==true||!Array.isArray(work.items))throw Error('CURRENT_CHATGPT_MEMBERSHIP_REQUIRED');
 const groups=new Map();work.items.forEach((item,index)=>groups.set(item.primaryId,[...(groups.get(item.primaryId)||[]),{item,index}]));
 const duplicates=[...groups].filter(([,items])=>items.length>1);
 if(!isDeepStrictEqual(duplicates.map(([id])=>id).sort(),[...IDS].sort()))throw Error('EXACT_FOUR_DUPLICATE_GROUPS_REQUIRED');
 const allowed=new Set(['primaryId','provider','taskKey','owner','status','company','title','location','missingFields','sourceUrls','priorAttempts','canonicalObservedAt','rowSha256','sourceReport','researchProvenance']);
 const provenanceKeys=['schema','canonicalSourceSha256','recoveryRun','sourceFingerprint','retryAt'].sort();
 const removed=new Set(),observations=[];
 for(const [id,pair] of duplicates){
  if(pair.length!==2)throw Error('EXACT_DUPLICATE_PAIR_REQUIRED');
  for(const {item}of pair){
   const p=item.researchProvenance;
   if(Object.keys(item).some(k=>!allowed.has(k))||item.provider!=='ChatGPT'||item.owner!=='ChatGPT'||item.taskKey!==TASK||item.status!=='ASSIGNED'||!isDeepStrictEqual(item.missingFields,['SALARY'])||!isDeepStrictEqual(item.priorAttempts,[])||item.sourceReport!=='CANONICAL_WRITER_MASTER'||!Number.isFinite(Date.parse(item.canonicalObservedAt))||!(/^[a-f0-9]{64}$/).test(item.rowSha256||'')||!p||!isDeepStrictEqual(Object.keys(p).sort(),provenanceKeys)||p.schema!=='forge.enrichment-research-provenance.v1'||p.recoveryRun!==null||p.retryAt!==null||!(/^[a-f0-9]{64}$/).test(p.canonicalSourceSha256||'')||!(/^[a-f0-9]{64}$/).test(p.sourceFingerprint||''))throw Error('UNSUPPORTED_DUPLICATE_OBLIGATION');
  }
  const normalized=pair.map(({item})=>{const copy=structuredClone(item);delete copy.canonicalObservedAt;return copy;});
  if(!isDeepStrictEqual(normalized[0],normalized[1]))throw Error('DIVERGENT_DUPLICATE_OBLIGATION');
  // Preserve first-match semantics. Both full observations survive in the audit.
  const [kept,duplicate]=pair;removed.add(duplicate.index);
  observations.push({primaryId:id,keptIndex:kept.index,removedIndex:duplicate.index,kept:kept.item,removed:duplicate.item});
 }
 const result={...work,items:work.items.filter((_,index)=>!removed.has(index))};
 E.validateWork(result);
 const output=JSON.stringify(result,null,2)+'\n';
 return {schema:'forge.enrichment-membership-repair-plan.v1',file:FILE,assignmentId:ASSIGNMENT,beforeBlobSha:expectedBlobSha,afterBlobSha:blob(output),beforeSha256:digest(raw),afterSha256:digest(output),beforeEntries:work.items.length,afterEntries:result.items.length,uniqueIds:groups.size,observations,work:result,output,canonicalWrites:0,writerSubmissions:0,canonicalCompletion:false};
}
function summary(p){return {schema:p.schema,file:p.file,beforeBlobSha:p.beforeBlobSha,afterBlobSha:p.afterBlobSha,beforeEntries:p.beforeEntries,afterEntries:p.afterEntries,uniqueIds:p.uniqueIds,reconciledIds:p.observations.map(i=>i.primaryId),canonicalWrites:0,writerSubmissions:0,canonicalCompletion:false};}
// Caller owns the shared production lock for the whole repair/publication window.
// No source fetch, canonical row read, status release or transaction replay occurs.
function writeRepair(root,{expectedBlobSha,runId,checkLock}={}){
 if(!RUN.test(runId||'')||typeof checkLock!=='function')throw Error('MEMBERSHIP_REPAIR_LOCK_AND_RUN_REQUIRED');
 checkLock();const dest=path.join(root,FILE),raw=fs.readFileSync(dest,'utf8'),p=plan(raw,{expectedBlobSha});
 const auditFile=AUDITS+'/'+runId+'.json';
 const {work,output,...audit}=p;
 const record={...audit,runId,meaning:'Duplicate assignment observations consolidated only; no research, Writer transaction or canonical completion claimed'};
 checkLock();if(fs.readFileSync(dest,'utf8')!==raw)throw Error('MEMBERSHIP_CHANGED_REPLAN');
 S.immutable(root,auditFile,record);
 checkLock();if(fs.readFileSync(dest,'utf8')!==raw)throw Error('MEMBERSHIP_CHANGED_REPLAN');
 S.save(root,FILE,work);
 if(blob(fs.readFileSync(dest))!==p.afterBlobSha)throw Error('MEMBERSHIP_REPAIR_READBACK_REQUIRED');
 return {...summary(p),auditFile,published:false};
}
function git(root,args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim();}
function apply(root,{expectedBlobSha,runId,lockFile=process.env.FORGE_PRODUCTION_LOCK}={}){
 root=path.resolve(root);
 if(root!==path.resolve(__dirname,'../..')||!RUN.test(runId||''))throw Error('CURRENT_MERGED_REPAIR_EXECUTOR_REQUIRED');
 const contract=fs.readFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'utf8'),shared=contract.match(/automation-run-lock\.cjs acquire (\S+) <unique-RUN_ID>/)?.[1];
 if(!shared||!lockFile||path.resolve(shared).toLowerCase()!==path.resolve(lockFile).toLowerCase())throw Error('CURRENT_SHARED_PRODUCTION_LOCK_REQUIRED');
 const Lock=require('../automation-run-lock.cjs');
 if(!Lock.lock(lockFile,'acquire',runId).acquired)throw Error('PRODUCTION_LOCK_HELD');
 let repairStarted=false,complete=false;
 try{
  const checkLock=()=>Lock.lock(lockFile,'check',runId);
  // A retained old checkout/commit must settle independently, not be discarded.
  require('../programmed-coordinator/publish.cjs').retainedSafe(root);
  const head=git(root,['rev-parse','HEAD']),remote=git(root,['ls-remote','origin','refs/heads/main']).split(/\s/)[0];
  if(head!==remote||git(root,['status','--porcelain=v1','--untracked-files=all']))throw Error('FRESH_CLEAN_MERGED_CHECKOUT_REQUIRED');
  plan(fs.readFileSync(path.join(root,FILE),'utf8'),{expectedBlobSha});
  repairStarted=true;const result=writeRepair(root,{expectedBlobSha,runId,checkLock});
  checkLock();const publication=require('../programmed-coordinator/publish.cjs').publish(root,{beforePush:checkLock});
  checkLock();if(publication.published!==true)throw Error('MEMBERSHIP_PUBLICATION_UNCONFIRMED');
  complete=true;return {...result,published:true,commit:publication.commit};
 }catch(e){if(repairStarted)e.message+='; preserve checkout and shared lock for accounting-only reconciliation';throw e;}
 finally{if(complete||!repairStarted)Lock.lock(lockFile,'release',runId);}
}
if(require.main===module){try{
 const [mode,root,expectedBlobSha,runId,...extra]=process.argv.slice(2);
 if(!root||extra.length||mode==='plan'&&runId||!['plan','apply'].includes(mode))throw Error('Usage: enrichment-membership-repair.cjs plan <root> <expected-blob-sha> | apply <root> <expected-blob-sha> <unique-run-id>');
 console.log(JSON.stringify(mode==='plan'?summary(plan(fs.readFileSync(path.join(root,FILE),'utf8'),{expectedBlobSha})):apply(root,{expectedBlobSha,runId})));
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={FILE,AUDITS,IDS,blob,plan,summary,writeRepair,apply};
