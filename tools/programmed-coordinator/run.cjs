'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), vm = require('node:vm');
const S = require('./store.cjs'), C = require('./collect.cjs'), Source = require('./source.cjs'), T = require('./transactions.cjs');
const R = require('../source-intake/writer-reader'), Lock = require('../automation-run-lock.cjs');
const ROOT = path.resolve(__dirname,'../..'), STATE = 'state/PROGRAMMED_COORDINATOR.json';
const terminal = status => /^(VERIFIED|PROTECTED|EXISTING|NO_MISSING)/.test(status);
function exception(state, item, reason, owner) {
  item.status = 'EXCEPTION';
  state.exceptions[item.key] = {key:item.key, itemVersion:item.version, batch:item.batch, reason, owner, attempts:item.attempts,
    retryCondition:owner === 'CODE' ? 'Changed source evidence or retryAfter' : 'Resolved identity, scope or conflicting evidence'};
}
function publicReport(state, coverage, at) {
  const statuses = {}; for (const i of Object.values(state.items)) statuses[i.status]=(statuses[i.status] || 0)+1;
  const exceptions=[...Object.values(state.exceptions),...(state.routineHandoffs?.transport?.exceptions||[]),...(state.routineHandoffs?.assignments?.exceptions||[]),...(state.routineHandoffs?.mail?.exceptions||[]),...(state.directReturns?.transport?.exceptions||[])];
  return {schema:'forge.programmed-coordinator-report.v1', at, instructionCommit:state.instructionCommit,
    batches:Object.keys(state.batches).length, statuses, transactions:Object.values(state.transactions).map(t => ({requestId:t.requestId,status:t.status,items:t.ids.length})),
    codeExceptions:exceptions.filter(x => x.owner === 'CODE'), aiExceptions:exceptions.filter(x => x.owner === 'AI'),
    canonicalSource:state.canonicalSource||null, coverage, noProcessingCap:true, savingsMeasured:false};
}
async function inspectReturns({root, privateDir, state, snapshot, apply, sourceVerify = Source.verify, now = Date.now(), select = () => true}) {
  const cache = new Map(),discovery=require('../source-intake/discovery-inputs').index(root);
  for (const item of Object.values(state.items)) {
    if (!select(item)) continue;
    const parserUpgrade=item.sourceParserVersion!==Source.PARSER_VERSION&&/^(?:STRUCTURED_POSTING_UNAVAILABLE|INCOMPLETE_POSTING|INCOMPLETE_ATS_POSTING_IDENTITY|SOURCE_ROUTE_BACKOFF|FIT_RESUME_MAPPING_REQUIRED|LINKEDIN_SOURCE_EXTRACTION_FAILED|MICRODATA_SOURCE_EXTRACTION_FAILED)$/.test(state.exceptions[item.key]?.reason||'');
    const routeUpgrade=item.sourceRetryVersion!==Source.RETRY_VERSION&&/^(?:SOURCE_ROUTE_BACKOFF|SOURCE_HTTP_403|SOURCE_HTTP_429)$/.test(state.exceptions[item.key]?.reason||'');
    const sourceOnly=/^(?:WORKING_SOURCE_ROUTE_REQUIRED|SOURCE_HTTP_\d+|SOURCE_ROUTE_BACKOFF|STRUCTURED_POSTING_UNAVAILABLE|INCOMPLETE_POSTING|INCOMPLETE_ATS_POSTING_IDENTITY|LINKEDIN_SOURCE_EXTRACTION_FAILED|MICRODATA_SOURCE_EXTRACTION_FAILED)$/.test(state.exceptions[item.key]?.reason||'');
    const retryHeld=!parserUpgrade&&!routeUpgrade&&item.retryAfter&&Date.parse(item.retryAfter)>now;
    if (terminal(item.status) || item.transactionId || T.rejectedUnchanged(item,snapshot.status?.build?.commit) || retryHeld&&!sourceOnly) continue;
    if (state.batches[item.batch]?.status !== 'VALIDATED') continue;
    if (/OUTCOME/.test(item.taskKey)) { exception(state,item,'PRIVATE_MAIL_SOURCE_AND_EVENT_RECONCILIATION_REQUIRED','CODE'); continue; }
    if (!cache.has(item.batch)) cache.set(item.batch,S.read(root,item.batch));
    const batch = cache.get(item.batch);let evidence = batch.items.find(i => (i.key || i.primaryId) === item.itemKey);
    if (!evidence) { exception(state,item,'SOURCE_BOUND_ITEM_MISSING','CODE'); continue; }
    try{evidence=require('../routine-handoffs/exception-work.cjs').evidence(root,item,evidence);}catch(e){exception(state,item,e.message,'AI');continue;}
    const sourceBlocked=['SOURCE_BLOCKED','NEEDS_SOURCE_EVIDENCE'].includes(evidence.recommendation);
    if (!['INTAKE_READY','ENRICHMENT_EVIDENCE_READY'].includes(evidence.recommendation)&&!sourceBlocked) {
      exception(state,item,'AMBIGUOUS_SCOPE_OR_IDENTITY','AI'); continue;
    }
    const shared=batch.schema==='forge.shared-helper-batch.v1';
    if(shared){try{require('../helper-routing/shared.cjs').assertCurrent(root,evidence,batch);}catch(e){exception(state,item,e.message,'CODE');continue;}}
    const enrichment = shared?evidence.kind==='ENRICHMENT':/ENRICHMENT/.test(item.taskKey);
    let row, expected, initiatingUrl;
    if (enrichment) {
      const rows = snapshot.rows.filter(r => r.PRIMARY_ID === evidence.primaryId);
      if (rows.length !== 1) { exception(state,item,'EXACT_LIVE_IDENTITY_REQUIRED','AI'); continue; }
      row = rows[0];
      if (T.protectedRow(row)) { item.status='PROTECTED_SKIP'; delete state.exceptions[item.key]; continue; }
      if (T.fenced(root,state,row.PRIMARY_ID)) { exception(state,item,'ORIGINAL_TRANSACTION_FENCE','CODE'); continue; }
      expected = T.identity(row);
      if (!T.same(row,evidence.sourceEvidence)) { exception(state,item,'CONFLICTING_SOURCE_IDENTITY','AI'); continue; }
    } else {
      // Original assignment card is authoritative for identity, not helper prose.
      const registry = S.read(root,'control/AI_AUTOMATION_TASKS.json'), work=S.read(root,registry.tasks[item.taskKey].workAssignments);
      let card=shared?work.items.find(i=>i.key===evidence.key)?.sourceEvidence:null;
      for (const page of work.pages || []) { const match=S.read(root,page.path).items.find(i => i.key === evidence.key); if (match) {card=match.sourceEvidence || match;break;} }
      if (!card) { exception(state,item,'ORIGINAL_ASSIGNMENT_CARD_REQUIRED','CODE'); continue; }
      try{card=require('../routine-handoffs/source-card.cjs').recover(root,evidence.key,card);}catch{exception(state,item,'CONFLICTING_ORIGINAL_SOURCE_CARDS','AI');continue;}
      expected={company:card.company,title:card.title,location:card.location};initiatingUrl=card.url;
      const hits=snapshot.rows.concat(snapshot.archiveRows).filter(r => T.same(r,expected));
      if (hits.length === 1) { item.status='EXISTING_CANONICAL'; item.primaryId=hits[0].PRIMARY_ID; delete state.exceptions[item.key]; continue; }
      if (hits.length > 1) { exception(state,item,'CONFLICTING_CANONICAL_IDENTITIES','AI'); continue; }
    }
    try {
      const options={item:evidence,expected,privateDir,root,discovery,now,requireRoleText:enrichment,validateClaims:enrichment,sourceUrls:row?require('../enrich-ats-pay/lib.js').ATS_URL_KEYS.map(k=>row.p?.[k]).filter(v=>typeof v==='string'&&/^https:\/\/\S+$/.test(v)):[initiatingUrl].filter(Boolean)};
      const captured=Source.capturedSource(options);
      if(!captured&&retryHeld)continue;
      if(!captured&&sourceBlocked){exception(state,item,'WORKING_SOURCE_ROUTE_REQUIRED','CODE');continue;}
      item.attempts++;item.sourceParserVersion=Source.PARSER_VERSION;item.sourceRetryVersion=Source.RETRY_VERSION;
      const source=captured||await sourceVerify(options);
      if (enrichment) {
        const fields=Source.enrichmentFields(source,row);
        if (!Object.keys(fields).length) { if(source.sourceCaptured){exception(state,item,'CAPTURED_EVIDENCE_MISSING_REQUESTED_FIELDS','CODE');continue;}item.status='NO_MISSING_SUPPORTED_FIELDS'; delete state.exceptions[item.key]; continue; }
        item.prepared={primaryId:row.PRIMARY_ID,itemKey:item.key,identity:expected,fields,sourceSha256:source.sourceSha256};
        item.status='READY_ENRICHMENT';
      } else {
        item.sourceEvidence={...expected,url:source.sourceUrl,initiatingUrl,observedAt:source.observedAt,sourceSha256:source.sourceSha256,independentlyVerified:!source.sourceCaptured,postingStatus:source.postingStatus||'UNVERIFIED',...(source.sourceCaptured?{discoveryEvidence:source.discoveryEvidence,fullPosting:source.fullPosting,contentBasis:source.contentBasis}:{}),...(typeof source.description==='string'&&source.description?{description:source.description,descriptionSha256:S.hash(source.description),contentBasis:source.contentBasis||'CAPTURED_ROLE_CONTENT'}:{})};
        item.status=source.sourceCaptured?'SOURCE_CAPTURED':'SOURCE_VERIFIED';
      }
      delete item.retryAfter; delete state.exceptions[item.key];
    } catch(e) {
      const ambiguous=/IDENTITY|QUOTE|CONFLICT/.test(e.message);
      exception(state,item,e.message,ambiguous?'AI':'CODE');
      // Access retries happen in code. An unchanged ambiguity is only revisited
      // after a changed item version, not repeatedly sent to AI.
      item.retryAfter=ambiguous?'9999-01-01T00:00:00.000Z':new Date(Number.isFinite(e.retryAfter)&&e.retryAfter>now?e.retryAfter:now+6*3600000).toISOString();
    }
    if (apply) S.save(root,STATE,state);
  }
}
async function drain({ready, step, reconcile, gated = () => false}) {
  await reconcile();
  while (!gated()) {
    const before=await ready(); if (!before) return {exhausted:true};
    const result=await step();
    const after=await ready();
    if (result?.pending && after >= before) return {pending:true}; if (after >= before) throw Error('NO_DURABLE_PROGRESS');
  }
  return {gated:true};
}
function child(root,args,env) {
  return new Promise((resolve,reject) => {
    const proc=cp.spawn(process.execPath,[path.join(root,'tools/relevance-screen/local.cjs'),...args],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let out='',err='';proc.stdout.on('data',x=>{out+=x;if(out.length>1000000)proc.kill();});proc.stderr.on('data',x=>{err+=x;if(err.length>1000000)proc.kill();});
    proc.on('error',reject);proc.on('close',code=>{
      if(code!==0)return reject(Error('INTAKE_DRIVER_FAILED: '+err.slice(0,300)));
      const lines=out.trim().split(/\r?\n/).filter(Boolean);try{resolve(JSON.parse(lines.at(-1)||'{}'));}catch{reject(Error('INTAKE_DRIVER_INVALID_OUTPUT'));}
    });
  });
}
async function submitEnrichment({root,privateDir,state,runId,deps,select=()=>true}) {
  const queue=Object.values(state.items).filter(i=>select(i)&&!i.transactionId&&i.status==='READY_ENRICHMENT'&&state.batches[i.batch]?.status==='VALIDATED');
  while(queue.length) {
    // Bounded envelopes, not a run quota. Keep repeated canonical IDs in separate
    // envelopes so the first transaction's durable fence governs the next one.
    const items=[],ids=new Set();
    for(let n=0;n<queue.length&&items.length<T.MAX_ENRICHMENT_BATCH;) {
      const item=queue[n];
      if(!item.prepared?.primaryId){exception(state,item,'PREPARED_ENRICHMENT_REQUIRED','CODE');queue.splice(n,1);continue;}
      if(ids.has(item.prepared.primaryId)){n++;continue;}
      ids.add(item.prepared.primaryId);items.push(item);queue.splice(n,1);
    }
    if(!items.length){S.save(root,STATE,state);continue;}
    let tx;
    try {
      tx=await T.submit({root,privateDir,state,jobs:items.map(i=>i.prepared),runId,deps,
        onInvalid:(job,error)=>exception(state,state.items[job.itemKey],error.message,'CODE')});
      if(tx&&T.pending(tx,root)) {
        await T.reconcile({root,privateDir,state,tx,deps});
        if(T.pending(tx,root))state.exceptions['tx:'+tx.requestId]={owner:'CODE',requestId:tx.requestId,reason:'WRITER_RECONCILIATION_REQUIRED'};
      }
    } catch(e) {
      for(const item of items) {
        // A checkpoint may exist even if submit never returned. Preserve its
        // original item status/fence and reconcile it, never resubmit its rows.
        if(item.transactionId)state.exceptions['tx:'+item.transactionId]={owner:'CODE',requestId:item.transactionId,reason:e.message};
        else exception(state,item,e.message,'CODE');
      }
      if(e.message==='LIVE_WRITER_GATE'){S.save(root,STATE,state);break;}
    }
    S.save(root,STATE,state);
  }
}
async function processReturnedEvidence({root,privateDir,state,snapshot,apply,runId,deps,select=()=>true,sourceVerify=Source.verify}) {
  await inspectReturns({root,privateDir,state,snapshot,apply,select,sourceVerify});
  if(!apply)return snapshot;
  const before=Object.keys(state.transactions).length;
  await submitEnrichment({root,privateDir,state,runId,deps,select});
  return Object.keys(state.transactions).length===before?snapshot:await deps.snapshot();
}
async function main(mode='inventory', options={}) {
  if (!['inventory','preview','apply'].includes(mode)) throw Error('Use inventory, preview or apply');
  const apply=mode==='apply', root=ROOT, state=C.empty(), direct=require('./direct-returns.cjs');
  const {returnsOnly, batches}=direct.options(options), select=returnsOnly?direct.selector(root,batches):()=>true;
  Object.assign(state,S.read(root,STATE,state));
  if(state.schema!=='forge.programmed-coordinator.v1'||!state.batches||!state.items||!state.transactions||!state.exceptions)throw Error('INVALID_DURABLE_COORDINATOR_STATE');
  const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const runId=process.env.FORGE_COORDINATOR_HELD_RUN_ID || 'FORGE-CODE-CHATGPT-'+new Date().toISOString().replace(/[^0-9TZ]/g,'');
  const privateDir=process.env.FORGE_PRIVATE_WORK_DIR, lock=process.env.FORGE_PRODUCTION_LOCK;
  let owned=false, deps;
  if(apply) {
    if (!lock || !privateDir) throw Error('Shared production lock and private work directory required');
    const contract=fs.readFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'utf8'), shared=contract.match(/automation-run-lock\.cjs acquire (\S+) <unique-RUN_ID>/)?.[1];
    if(!shared || path.resolve(shared).toLowerCase()!==path.resolve(lock).toLowerCase()) throw Error('CURRENT_SHARED_PRODUCTION_LOCK_REQUIRED');
    // Production uses merged code plus a single fresh routing snapshot. A PR
    // checkout is suitable for inventory/preview, never a schedule cutover.
    const remote=cp.execFileSync('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8'}).trim().split(/\s/)[0];
    if(remote!==commit || cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()) throw Error('FRESH_CLEAN_MERGED_CHECKOUT_REQUIRED');
    if(process.env.FORGE_COORDINATOR_HELD_RUN_ID) Lock.lock(lock,'check',runId);
    else {owned=Lock.lock(lock,'acquire',runId).acquired;if(!owned)throw Error('PRODUCTION_LOCK_HELD');}
  }
  try {
    state.instructionCommit=commit;
    let routine=null;
    if(mode!=='inventory'){
      if(!privateDir||!path.isAbsolute(privateDir)||path.resolve(privateDir).toLowerCase()===root.toLowerCase()||path.resolve(privateDir).toLowerCase().startsWith(root.toLowerCase()+path.sep))throw Error('Private output must be outside the public checkout');
      routine=returnsOnly?direct.capture({root,privateDir,commit,runId,apply}):(await require('../routine-handoffs/run.cjs').run({root,privateDir,commit,runId,apply})).report;
    }
    if(apply&&!returnsOnly)require('../routine-handoffs/return-repair.cjs').repair(root,commit,{apply:true});
    const collected=C.collect({root,state,commit});
    if(returnsOnly)direct.checkSelected(state,batches);
    if(mode!=='inventory') {
      if(!privateDir || !path.isAbsolute(privateDir) || path.resolve(privateDir).toLowerCase()===root.toLowerCase() || path.resolve(privateDir).toLowerCase().startsWith(root.toLowerCase()+path.sep)) throw Error('Private output must be outside the public checkout');
      const cfg={}, fc=process.env.ACTIVITY_FC_DIR;
      vm.runInNewContext(fs.readFileSync(process.env.FORGE_CONNECTION_FILE,'utf8'),cfg);
      const W=require(path.join(fc,'apps-script/PipelineWorklists.gs')), key=cfg.PipelineConnection.key;
      const snapshot=async()=>{
        const [m,a,s]=await Promise.all([require('../pipeline-observability/canonical-snapshot').readCanonical({key,W}),R.fetchAuthenticatedArchive({key}),R.read('writer_status',{key})]);
        const built=W.build(m.rows.map(r=>r.line).join('\n')),needsById=Object.fromEntries(m.rows.map(r=>[r.PRIMARY_ID,[]]));for(const r of built.lanes.FORGE_ENRICH_FEASIBILITY)needsById[r.PRIMARY_ID]=(W.render('FORGE_ENRICH_FEASIBILITY',{lanes:{FORGE_ENRICH_FEASIBILITY:[r]}},{generatedAt:'snapshot'}).match(/NEED=([A-Z,]*)/)?.[1]||'').split(',').filter(Boolean);
        return {rows:m.rows,archiveRows:a.rows.map(r=>W.parseRows(r.RAW_ROW)[0]),status:s.data,source:m.source,needsById};
      };
      deps={snapshot,checkLock:()=>Lock.lock(lock,'check',runId),index:()=>require('../writer-verify/recovery').loadIndex({token:cp.execFileSync('gh',['auth','token'],{encoding:'utf8'}).trim()}),
        status:async()=>(await R.read('writer_status',{key})).data,
        source:async revision=>cp.execFileSync('git',['show',revision+':apps-script/Code.gs'],{cwd:fc,encoding:'utf8',maxBuffer:4e6,stdio:['ignore','pipe','pipe']}),
        result:async rid=>(await R.read('request_result',{key,requestId:rid})).data,
        witness:async(rid,sha)=>S.read(privateDir,'writer-refusal-witnesses/'+sha+'.json',null),
        exists:async rid=>(await R.read('receipt_index',{key,requestId:rid})).data.request!=null,
        // The current endpoint exposes receipts, not retained acceptance bodies.
        // Missing original acceptance remains a recovery obligation, without POST.
        original:async rid=>{await R.read('request_result',{key,requestId:rid});return null;},
        post:async payload=>{const r=await fetch(cfg.PipelineConnection.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({...payload,key}),signal:AbortSignal.timeout(240000)});return r.json();},
        rows:(rid,ids)=>require('./readback.cjs').rows({requestId:rid,ids,key,W})};
      if(apply) for(const tx of Object.values(state.transactions).filter(tx=>T.pending(tx,root)&&(!returnsOnly||tx.itemKeys?.some(k=>select(state.items[k]))))) {
        try {await T.reconcile({root,privateDir,state,tx,deps});} catch(e) {state.exceptions['tx:'+tx.requestId]={owner:'CODE',reason:e.message,requestId:tx.requestId};}
      }
      let canonical=await snapshot();
      state.canonicalSource=canonical.source;
      const sourceReviews=apply&&!returnsOnly?require('../routine-handoffs/exception-work.cjs').applySourceReviews({root,state}):null;
      // Existing scheduled runs automatically write validated enrichment before
      // unrelated mail, assignment work and the large intake plan.
      canonical=await processReturnedEvidence({root,privateDir,state,snapshot:canonical,apply,runId,deps,select});
      state.canonicalSource=canonical.source;
      let discoveryScreenContext;
      if(!returnsOnly) {
        if(apply)state.interviewReviews=require('../routine-handoffs/interview-reviews.cjs').consume({root,privateDir,snapshot:canonical,checkLock:deps.checkLock});
        discoveryScreenContext=await require('../source-trial/preliminary-screen').context({key});
        const mail=await require('../routine-handoffs/mail-pipeline.cjs').run({root,privateDir,runId,deps,apply,screenContext:discoveryScreenContext});
        if(mail.masterVerifiedThisRun){canonical=await snapshot();state.canonicalSource=canonical.source;}
        const assignments=require('../routine-handoffs/assignments.cjs').replenish({root,state,snapshot:canonical,runId,apply,screenContext:discoveryScreenContext});
        state.routineHandoffs={transport:routine,assignments,mail,sourceReviews};
        let writerReceipts=null;
        try{writerReceipts=await deps.index();}catch{state.exceptions['grok-writer-receipts']={owner:'CODE',reason:'GROK_WRITER_RECEIPTS_UNAVAILABLE'};}
        state.routineHandoffs.sharedHelpers=require('../helper-routing/shared-assignments.cjs').replenish({root,state,snapshot:canonical,runId,apply,checkLock:deps.checkLock,writerReceipts});
      }
      if(apply) {
        S.save(root,STATE,state);
        const intakeKeys=returnsOnly?direct.intakeKeys(root,state,select):null;
        if(returnsOnly)state.directReturns={transport:routine,selectedBatches:batches};
        const accounting=returnsOnly?state.directReturns:state.routineHandoffs;
        accounting.verifiedIntake=require('../routine-handoffs/intake-state.cjs').seedVerified(root,state,true,select);
        if(!returnsOnly||intakeKeys.size) {
          discoveryScreenContext=discoveryScreenContext||await require('../source-trial/preliminary-screen').context({key});
          const screenContextFile=path.join(privateDir,'discovery-screen-context.json');
          fs.writeFileSync(screenContextFile,JSON.stringify({runId,context:discoveryScreenContext})+'\n',{mode:0o600});
          const env={...process.env,FORGE_RUN_ID:runId,FORGE_DISCOVERY_SCREEN_CONTEXT:screenContextFile};
          delete env.FORGE_INTAKE_SCOPE;
          if(returnsOnly)env.FORGE_INTAKE_SCOPE=require('../relevance-screen/scope.cjs').save({privateDir,runId,keys:[...intakeKeys]});
          const pendingIds=[...new Set(S.read(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[]}).items.filter(i=>i.status==='POST_IN_FLIGHT_UNKNOWN'&&(!intakeKeys||intakeKeys.has(i.key))).map(i=>i.requestId))];
          let intakePending=false;
          for(const id of pendingIds) {
            try{const result=await child(root,['verify',id],env);if(!result.verified&&result.phase!=='VERIFIED')intakePending=true;else delete state.exceptions['intake:'+id];}
            catch(e){
              try{await require('../relevance-screen/not-accepted.cjs').recover({root,privateDir,requestId:id,runId,deps:{checkLock:deps.checkLock,status:async()=>(await R.read('writer_status',{key})).data,result:async rid=>(await R.read('request_result',{key,requestId:rid})).data,index:async rid=>(await R.read('receipt_index',{key,requestId:rid})).data,source:async revision=>cp.execFileSync('git',['show',revision+':apps-script/Code.gs'],{cwd:fc,encoding:'utf8',maxBuffer:4e6,stdio:['ignore','pipe','pipe']})}});delete state.exceptions['intake:'+id];}
              catch{intakePending=true;state.exceptions['intake:'+id]={owner:'CODE',requestId:id,reason:'ORIGINAL_INTAKE_RECONCILIATION_REQUIRED'};}
            }
          }
          // Existing preparation owns canonical dedup, relevance and source-ledger
          // accounting. Its transaction count is never a coordinator run quota.
          { // Pending requests fence their own items; independent READY jobs continue.
            try{
              await child(root,['prepare','--apply'],env);
              await drain({ready:async()=>S.read(root,'state/RELEVANCE_INTAKE_PLAN.json').items.filter(i=>i.status==='READY'&&(!intakeKeys||intakeKeys.has(i.key))).length,
                reconcile:async()=>{},step:()=>child(root,['step','100'],env)});
              delete state.exceptions['intake-driver'];
            }catch(e){state.exceptions['intake-driver']={owner:'CODE',reason:'INTAKE_DRIVER_GATE_OR_RECONCILIATION_REQUIRED'};}
          }
        }
        if(returnsOnly) {
          const latest=await snapshot();state.canonicalSource=latest.source;
          state.directReturns.reservations=direct.settleShared({root,state,snapshot:latest,select,checkLock:deps.checkLock});
        }
      }
    }
    const coverage=S.read(root,'state/EMAIL_RECOVERY_SUMMARY.json',null), at=new Date().toISOString();
    const report={...publicReport(state,coverage,at),runId,mode,collected,scope:returnsOnly?'RETURNED_EVIDENCE_ONLY':'FULL_COORDINATOR',selectedBatches:batches,directReturns:returnsOnly?state.directReturns||{transport:routine}:null,routineHandoffs:state.routineHandoffs||null};
    if(apply) {
      const exceptionWork=require('../routine-handoffs/exception-work.cjs').sync({root,state,report,apply:true});report.exceptionWork={counts:exceptionWork.counts,owner:'FORGE_APPLICATION_OUTCOME_TRACKER',reviewErrors:exceptionWork.reviewErrors};
      S.save(root,STATE,state);S.save(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',report);
      const catchUp=require('./catch-up.cjs');S.save(root,catchUp.FILE,catchUp.summarize(root,runId));
      S.immutable(root,'receipts/'+runId+'_TERMINAL.json',report);
    } else if(privateDir) {S.save(privateDir,'coordinator-'+mode+'.json',report);}
    console.log(JSON.stringify({mode,collected,statuses:report.statuses,aiExceptions:report.aiExceptions.length,codeExceptions:report.codeExceptions.length,noProcessingCap:true}));
    return report;
  } finally {if(owned) Lock.lock(lock,'release',runId);}
}
if(require.main===module) main(process.argv[2],require('./direct-returns.cjs').arguments(process.argv.slice(3))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={inspectReturns,publicReport,drain,submitEnrichment,processReturnedEvidence,main};
