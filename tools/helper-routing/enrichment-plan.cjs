'use strict';
// Read-only planning. Production locks are deliberately not consulted: this
// selects source research, never Writer operations. Existing originals remain
// fenced and assignment membership must be persisted/published before returns.
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs'),Source=require('../programmed-coordinator/source.cjs'),E=require('./enrichment.cjs');
const WORK='control/ENRICHMENT_HELPER_WORK.json',REPORT='state/enrich-ats-pay-recovery.json';
// Match PipelineWorklists.parsePayload, including embedded keys, continuation
// segments and duplicate-key accumulation. Never trust caller-supplied p values
// independently of the canonical raw line used for its provenance hash.
function rawPayload(text){
 const out={};let last=null;
 String(text||'').split('; ').forEach(seg=>seg.split(/\s+(?=[A-Z][A-Z0-9_]{2,}=)/).forEach((part,i)=>{
  const m=part.match(/^([A-Z][A-Z0-9_]*)=([\s\S]*)$/);
  if(m){last=m[1];out[last]=out[last]?out[last]+'; '+m[2]:m[2];}
  else if(last)out[last]+=(i?' ':'; ')+part;
 }));
 return out;
}
function fullSnapshot(snapshot){
 // writer-reader's identity-only projection intentionally omits salary and
 // protection facts. It is not a research eligibility input. Require the full
 // canonical source line plus the Writer worklist's explicit needs mapping.
 for(const row of snapshot.rows){
  const cells=typeof row.line==='string'?row.line.split(' | '):[],payload=rawPayload(cells.slice(9).join(' | '));
  if(!/^\d+ \| /.test(row.line||'')||cells.length<10||!row.p||!Object.hasOwn(snapshot.needsById||{},row.PRIMARY_ID)||!Array.isArray(snapshot.needsById[row.PRIMARY_ID])||
   [[1,'PRIMARY_ID'],[2,'COMPANY'],[3,'TITLE'],[4,'BUCKET'],[8,'LOCATION']].some(([n,k])=>cells[n]?.trim()!==row[k])||
   Object.keys(payload).length!==Object.keys(row.p).length||Object.entries(payload).some(([key,value])=>row.p[key]!==value))throw Error('FULL_CANONICAL_RESEARCH_SNAPSHOT_REQUIRED');
 }
}
const terminal=s=>/^(CONSUMED|RELEASED|PROTECTED_SKIP|ALREADY_COMPLETE|RETURNED)/.test(s||'');
function plan({root,snapshot,now=Date.now(),state=S.read(root,'state/PROGRAMMED_COORDINATOR.json',{items:{},batches:{},transactions:{}}),work=S.read(root,WORK),recovery=S.read(root,REPORT,{schema:'forge.enrichment-recovery.v1',rows:[]})}){
 const source=snapshot?.source,readAt=Date.parse(source?.readAt);
 const supportedSource=source?.kind==='CANONICAL_WRITER_MASTER'||source?.kind==='CANONICAL_DRIVE_MASTER'&&source.fileId==='1My9QYVPBblw8c7vFMFxGOAqgTSuH9gS8'&&/^[a-f0-9]{64}$/.test(source.sha256||'')&&source.observedAt===source.readAt;
 if(!supportedSource||!Number.isFinite(readAt)||now-readAt>900000||readAt>now+120000||!Array.isArray(snapshot.rows))throw Error('FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED');
 fullSnapshot(snapshot);
 work=E.validateWork(structuredClone(work));
 if(!work.enabled||!work.routingActive||E.owner(work).provider!=='ChatGPT')return {items:[],appended:[],work,counts:{disabled:1},fingerprint:S.hash({disabled:true})};
 if(recovery?.schema!=='forge.enrichment-recovery.v1'||!Array.isArray(recovery.rows))throw Error('ENRICHMENT_RECOVERY_REQUIRED');
 const rows=new Map(),old=new Map(work.items.map(i=>[i.primaryId,i])),counts={},items=[],appended=[];
 const skip=why=>{counts[why]=(counts[why]||0)+1;};
 for(const row of snapshot.rows){rows.set(row.PRIMARY_ID,rows.has(row.PRIMARY_ID)?null:row);}
 const reserved=require('./shared.cjs').reservedKeys(S.read(root,'control/SHARED_HELPER_WORK.json',null));
 const claude=S.read(root,'control/CLAUDE_HELPER_WORK.json',{enabled:false});
 if(claude.enabled)for(const i of claude.enrichment||[])reserved.add(i.primaryId);
 const seen=new Set(),returned=new Set(Object.values(state.items||{}).filter(i=>['FORGE_CHATGPT_ENRICHMENT_RESEARCH','FORGE_GROK_ENRICHMENT'].includes(i.taskKey)&&state.batches?.[i.batch]?.status==='VALIDATED').map(i=>i.itemKey));
 const pending=new Set(Object.values(recovery.pendingWrites||{}).flatMap(tx=>tx.ids||[]));
 const ledger=S.read(root,'state/enrich-ats-pay.json',{}),Recovery=require('../enrich-ats-pay/recovery');
 const recoveryIds=new Set(recovery.rows.map(r=>r.id));
 const candidates=recovery.rows.concat(snapshot.rows.filter(row=>!recoveryIds.has(row.PRIMARY_ID)&&snapshot.needsById[row.PRIMARY_ID].includes('SALARY')).map(row=>({id:row.PRIMARY_ID,company:row.COMPANY,title:row.TITLE,status:'NOT_YET_ATTEMPTED',needs:['SALARY'],attempts:[],canonicalOnly:true})));
 for(const r of candidates){
  if(seen.has(r.id))throw Error('DUPLICATE_RECOVERY_ID');seen.add(r.id);
  const previous=old.get(r.id),row=rows.get(r.id);
  if(previous&&terminal(previous.status)||returned.has(r.id)){skip('alreadyAssignedOrReturned');continue;}
  if(!['SOURCE_RESEARCH_REQUIRED','NOT_YET_ATTEMPTED'].includes(r.status)){skip('notSourceResearch');continue;}
  if(!row||T.protectedRow(row)){skip('missingOrProtected');continue;}
  if(previous&&!T.same(row,previous)){skip('assignmentIdentityChanged');continue;}
  if(r.company&&Source.employer(r.company)!==Source.employer(row.COMPANY)||r.title&&Source.norm(r.title)!==Source.norm(row.TITLE)){skip('recoveryIdentityChanged');continue;}
  if(reserved.has(r.id)){skip('reservedElsewhere');continue;}
  if(pending.has(r.id)||T.fenced(root,state,r.id)){skip('pendingOriginal');continue;}
  const needs=snapshot.needsById[r.id];
  const missing=(r.needs||[]).filter(f=>needs.includes(f)&&(f==='SALARY'?!Source.known(row.p?.SALARY_BASE_LOW):f==='DEGREE'?!Source.known(row.p?.DEGREE_REQ)&&!Source.known(row.p?.DEGREE_TEXT):false));
  if(!missing.length){skip('alreadyComplete');continue;}
  if(!Recovery.due(row,needs,ledger,now)){skip('retryNotDue');continue;}
  // A malformed recorded retry is not permission to repeat source work.
  if(r.retryAt&&(!Number.isFinite(Date.parse(r.retryAt))||Date.parse(r.retryAt)>now)){skip('retryNotDue');continue;}
  const sourceUrls=[...new Set([...(r.attempts||[]).map(a=>a.url),...(String(row.p?.SOURCE_URL||'').match(/https:\/\/[^ ;|]+/g)||[])].filter(u=>typeof u==='string'&&/^https:\/\//.test(u)))];
  const sourceFingerprint=S.hash({id:r.id,identity:T.identity(row),missing,sourceUrls,attempts:r.attempts||[],lastAttemptAt:r.lastAttemptAt||null});
  const item=previous||{primaryId:r.id,...E.owner(work),owner:E.owner(work).provider,status:'ASSIGNED',...T.identity(row),missingFields:missing,sourceUrls,priorAttempts:r.attempts||[],canonicalObservedAt:snapshot.source.readAt,rowSha256:S.hash(row.line),sourceReport:r.canonicalOnly?snapshot.source.kind:REPORT,researchProvenance:{schema:'forge.enrichment-research-provenance.v1',canonicalSourceSha256:snapshot.source.sha256||null,recoveryRun:r.canonicalOnly?null:recovery.run,sourceFingerprint,retryAt:r.retryAt||null}};
  items.push({...item,missingFields:missing,sourceUrls,sourceFingerprint,assignmentSourceFingerprint:item.researchProvenance?.sourceFingerprint||null});
  if(!previous){appended.push(item);work.items.push(item);}
 }
 E.validateWork(work);
 return {schema:'forge.enrichment-research-plan.v1',assignmentId:work.assignmentId,canonicalSource:snapshot.source,items,appended,work,counts,fingerprint:S.hash(items.map(i=>({id:i.primaryId,sourceFingerprint:i.sourceFingerprint}))),requiresPublishedMembership:appended.length>0,writerSubmissions:0};
}
function persistMembership({root,snapshot,now=Date.now()}){
 const prepared=plan({root,snapshot,now});
 // Local control update only; the normal supported publication path still owns
 // committing/publishing this file. Never rewrite pending or historical items.
 const current=E.validateWork(S.read(root,WORK));
 if(current.assignmentId!==prepared.work.assignmentId||S.hash(current.items)!==S.hash(prepared.work.items.slice(0,current.items.length)))throw Error('ENRICHMENT_ASSIGNMENT_CHANGED_REPLAN');
 if(S.hash({...current,items:[]})!==S.hash({...prepared.work,items:[]}))throw Error('ENRICHMENT_ROUTING_CHANGED_REPLAN');
 if(prepared.appended.length)S.save(root,WORK,prepared.work);
 return {appended:prepared.appended.length,published:false,requiresInstructionCommit:true};
}
if(require.main===module){
 try{
  const [mode,root,snapshotFile,...flags]=process.argv.slice(2);
  if(mode!=='plan'||!root||!snapshotFile||flags.some((v,i)=>i%2===0?v!=='--output':!v)||flags.length>2||flags.length%2)throw Error('Usage: enrichment-plan.cjs plan <root> <snapshot.json> [--output <private-plan.json>]');
  const fs=require('node:fs'),path=require('node:path'),result=plan({root:path.resolve(root),snapshot:JSON.parse(fs.readFileSync(snapshotFile,'utf8'))});
  if(flags.length){const dest=path.resolve(flags[1]);S.immutable(path.dirname(dest),path.basename(dest),result);}
  console.log(JSON.stringify({schema:result.schema,assignmentId:result.assignmentId,eligible:result.items.length,appended:result.appended.length,counts:result.counts,fingerprint:result.fingerprint,requiresPublishedMembership:result.requiresPublishedMembership,writerSubmissions:0}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={plan,persistMembership};
