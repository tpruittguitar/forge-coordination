'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),file=path.resolve(__dirname,'../../control/ENRICHMENT_HELPER_WORK.json');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function effectiveWork(w){
 let p;try{p=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../control/ENRICHMENT_RESEARCH_OWNER.json')));}catch{return w;}
 if(p.schema!=='forge.research-owner.v1'||p.assignmentId!==w.assignmentId||p.provider!=='ChatGPT')return w;
 return {...w,provider:p.provider,taskKey:p.taskKey,takeover:p,items:w.items.map(i=>({...i,...(!i.previousResearchOwner&&i.owner!=='ChatGPT'?{previousResearchOwner:{provider:i.owner,taskKey:i.taskKey}}:{}),owner:p.provider,taskKey:p.taskKey}))};
}
function owner(w){w=effectiveWork(w);return{provider:w.provider||'Grok',taskKey:w.taskKey||'FORGE_GROK_ENRICHMENT'};}
function validateWork(w){w=effectiveWork(w);if(w?.schema!=='forge.enrichment-helper-work.v1'||typeof w.enabled!=='boolean'||!w.assignmentId||!Array.isArray(w.items))throw Error('Invalid enrichment helper work');const who=owner(w);if(!['Grok','ChatGPT'].includes(who.provider)||who.taskKey!==(who.provider==='ChatGPT'?'FORGE_CHATGPT_ENRICHMENT_RESEARCH':'FORGE_GROK_ENRICHMENT'))throw Error('Invalid enrichment research owner');const seen=new Set();for(const i of w.items){if(!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.primaryId)||seen.has(i.primaryId)||i.owner!==who.provider||i.taskKey!==who.taskKey)throw Error('Invalid or overlapping helper research assignment');seen.add(i.primaryId);}return w;}
function load(f=file){return validateWork(JSON.parse(fs.readFileSync(f,'utf8')));}
function assignedIds(w=load()){return new Set(w.enabled?w.items.filter(i=>!['CONSUMED','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE'].includes(i.status)).map(i=>i.primaryId):[]);}
function validateBatch(b,w=load()){
 w=effectiveWork(w);const who=owner(w),legacy=who.provider==='ChatGPT'&&b?.provider==='Grok'&&b.taskKey==='FORGE_GROK_ENRICHMENT';
 if(legacy&&!w.takeover?.acceptedHistoricalBatches?.some(x=>x.runId===b.runId&&x.sha256===digest(b)))throw Error('Retired Grok route: only exact already accepted historical evidence may be reused');
 const pair=legacy?{provider:'Grok',taskKey:'FORGE_GROK_ENRICHMENT'}:who;
 if(!w.enabled||b?.schema!=='forge.enrichment-helper-batch.v1'||b.provider!==pair.provider||b.taskKey!==pair.taskKey||b.assignmentId!==w.assignmentId||!(pair.provider==='Grok'?/^GROK-/:/^FORGE-CHATGPT-/).test(b.runId||'')||!/^[a-f0-9]{40}$/.test(b.instructionCommit||'')||!Array.isArray(b.items)||!b.items.length||b.items.length>20)throw Error('Invalid enrichment evidence-only envelope');
 // This validates immutable evidence, not current permission to process a job.
 // routingProof separately binds membership at the instruction revision. Live
 // protection, missing fields and original Writer fences are checked by the
 // consumer before effects; a later completion must not invalidate siblings.
 const assignment=new Set(w.items.map(i=>i.primaryId)),seen=new Set();
 for(const i of b.items){
  if(seen.has(i.primaryId))throw Error('DUPLICATE_ENRICHMENT_ITEM');
  if(!assignment.has(i.primaryId))throw Error('ENRICHMENT_ITEM_OUTSIDE_ASSIGNMENT');
  if(i.writerSubmitted!==false)throw Error('HELPER_WRITER_SUBMISSION_FORBIDDEN');
  if(!i.sourceEvidence||!i.recommendation)throw Error('ENRICHMENT_ITEM_EVIDENCE_REQUIRED');
  seen.add(i.primaryId);const f=i.sourceEvidence.proposedRawFields||{};
  if(Object.keys(f).some(k=>/^(COMPANY|TITLE|LOCATION|PRIMARY_ID|BUCKET|DISPOSITION|STATE_|OVERALL_|SCORE_|TIM_|ACTOR)/.test(k)))throw Error('HELPER_PROTECTED_FIELDS_FORBIDDEN');
 }
 return{valid:true,items:seen.size,productionAuthorized:false};
}
function next(w,after){w=effectiveWork(w);const all=w.items,active=assignedIds(w),eligible=i=>active.has(i.primaryId)&&!/^RETURNED/.test(i.status||''),index=after?all.findIndex(i=>i.primaryId===after):-1;if(after&&index<0)throw Error('Unknown cursor; never restart');const items=all.slice(index+1).filter(eligible).slice(0,20);return{assignmentId:w.assignmentId,taskKey:owner(w).taskKey,provider:owner(w).provider,mode:'EVIDENCE_ONLY',total:all.filter(eligible).length,items,nextAfter:items.at(-1)?.primaryId||null};}
if(require.main===module){try{const w=load();if(process.argv[2]==='validate')console.log(JSON.stringify(validateBatch(JSON.parse(fs.readFileSync(process.argv[3])),w)));else{if(!w.enabled)throw Error('Helper assignment disabled');console.log(JSON.stringify(next(w,process.argv[2]==='--after'?process.argv[3]:null)));}}catch(e){console.error(e.message);process.exitCode=1;}}
// ChatGPT and the programmed coordinator share the same evidence-first queue. Old external
// research reservations must not prevent ordinary code from using readable sources.
function reconcileResearch(w,snapshot){
 w=effectiveWork(w);if(owner(w).provider!=='ChatGPT'||!snapshot.needsById)return w;
 const rows=new Map([...snapshot.rows,...snapshot.archiveRows||[]].map(r=>[r.PRIMARY_ID,r]));
 for(const item of w.items){if(['CONSUMED','RELEASED','PROTECTED_SKIP','ALREADY_COMPLETE'].includes(item.status))continue;const row=rows.get(item.primaryId);if(!row)continue;
  if(!['SCOUT_INTAKE','DISCOVERY_LEAD','MANUAL_RESEARCH','BLOCKED','READY_TO_PURSUE','TIM_DECISION_REQUIRED'].includes(row.BUCKET)||/^YES/i.test(row.p?.ANTI_RESURRECTION||'')||row.p?.DO_NOT_REWORK){item.status='PROTECTED_SKIP';continue;}
  const needs=snapshot.needsById[item.primaryId];if(!Array.isArray(needs))continue;
  if(!(item.missingFields||['SALARY','DEGREE']).some(f=>needs.includes(f))){item.status='ALREADY_COMPLETE';item.researchCompletion={source:snapshot.source,meaning:'Requested source fields already present; no new research or canonical-write completion claimed'};}
 }
 return w;
}
function researchIds(w=load()){return owner(w).provider==='ChatGPT'?new Set():w.routingActive===true?assignedIds(w):new Set();}
module.exports={validateWork,load,assignedIds,researchIds,validateBatch,next,owner,effectiveWork,reconcileResearch};
