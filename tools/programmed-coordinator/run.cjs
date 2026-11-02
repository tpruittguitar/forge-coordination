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
  return {schema:'forge.programmed-coordinator-report.v1', at, instructionCommit:state.instructionCommit,
    batches:Object.keys(state.batches).length, statuses, transactions:Object.values(state.transactions).map(t => ({requestId:t.requestId,status:t.status,items:t.ids.length})),
    codeExceptions:Object.values(state.exceptions).filter(x => x.owner === 'CODE'), aiExceptions:Object.values(state.exceptions).filter(x => x.owner === 'AI'),
    canonicalSource:state.canonicalSource||null, coverage, noProcessingCap:true, savingsMeasured:false};
}
async function inspectReturns({root, privateDir, state, snapshot, apply, sourceVerify = Source.verify, now = Date.now()}) {
  const cache = new Map();
  for (const item of Object.values(state.items)) {
    if (terminal(item.status) || item.transactionId || item.retryAfter && Date.parse(item.retryAfter) > now) continue;
    if (state.batches[item.batch]?.status !== 'VALIDATED') continue;
    if (!cache.has(item.batch)) cache.set(item.batch,S.read(root,item.batch));
    const batch = cache.get(item.batch), evidence = batch.items.find(i => (i.key || i.primaryId) === item.itemKey);
    if (!evidence) { exception(state,item,'SOURCE_BOUND_ITEM_MISSING','CODE'); continue; }
    if (/OUTCOME/.test(item.taskKey)) { exception(state,item,'PRIVATE_MAIL_SOURCE_AND_EVENT_RECONCILIATION_REQUIRED','CODE'); continue; }
    if (!['INTAKE_READY','ENRICHMENT_EVIDENCE_READY'].includes(evidence.recommendation)) {
      exception(state,item,evidence.recommendation === 'SOURCE_BLOCKED' || evidence.recommendation === 'NEEDS_SOURCE_EVIDENCE' ? 'WORKING_SOURCE_ROUTE_REQUIRED' : 'AMBIGUOUS_SCOPE_OR_IDENTITY',
        evidence.recommendation === 'SOURCE_BLOCKED' || evidence.recommendation === 'NEEDS_SOURCE_EVIDENCE' ? 'CODE' : 'AI'); continue;
    }
    const enrichment = /ENRICHMENT/.test(item.taskKey);
    let row, expected;
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
      let card;
      for (const page of work.pages || []) { const match=S.read(root,page.path).items.find(i => i.key === evidence.key); if (match) {card=match.sourceEvidence || match;break;} }
      if (!card) { exception(state,item,'ORIGINAL_ASSIGNMENT_CARD_REQUIRED','CODE'); continue; }
      expected={company:card.company,title:card.title,location:card.location};
      const hits=snapshot.rows.concat(snapshot.archiveRows).filter(r => T.same(r,expected));
      if (hits.length === 1) { item.status='EXISTING_CANONICAL'; item.primaryId=hits[0].PRIMARY_ID; delete state.exceptions[item.key]; continue; }
      if (hits.length > 1) { exception(state,item,'CONFLICTING_CANONICAL_IDENTITIES','AI'); continue; }
    }
    try {
      item.attempts++;
      const source=await sourceVerify({item:evidence,expected,privateDir,now});
      if (enrichment) {
        const fields=Source.enrichmentFields(source,row);
        if (!Object.keys(fields).length) { item.status='NO_MISSING_SUPPORTED_FIELDS'; delete state.exceptions[item.key]; continue; }
        item.prepared={primaryId:row.PRIMARY_ID,itemKey:item.key,identity:expected,fields,sourceSha256:source.sourceSha256};
        item.status='READY_ENRICHMENT';
      } else {
        item.sourceEvidence={...expected,url:source.sourceUrl,observedAt:source.observedAt,sourceSha256:source.sourceSha256,independentlyVerified:true};
        item.status='SOURCE_VERIFIED';
      }
      delete item.retryAfter; delete state.exceptions[item.key];
    } catch(e) {
      const ambiguous=/IDENTITY|QUOTE|CONFLICT/.test(e.message);
      exception(state,item,e.message,ambiguous?'AI':'CODE');
      // Access retries happen in code. An unchanged ambiguity is only revisited
      // after a changed item version, not repeatedly sent to AI.
      item.retryAfter=ambiguous?'9999-01-01T00:00:00.000Z':new Date(now+6*3600000).toISOString();
    }
    if (apply) S.save(root,STATE,state);
  }
}
async function drain({ready, step, reconcile, gated = () => false}) {
  await reconcile();
  while (!gated()) {
    const before=await ready(); if (!before) return {exhausted:true};
    const result=await step();
    if (result?.pending) return {pending:true};
    const after=await ready(); if (after >= before) throw Error('NO_DURABLE_PROGRESS');
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
async function main(mode='inventory') {
  if (!['inventory','preview','apply'].includes(mode)) throw Error('Use inventory, preview or apply');
  const apply=mode==='apply', root=ROOT, state=C.empty();
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
    const collected=C.collect({root,state,commit});
    if(mode!=='inventory') {
      if(!privateDir || !path.isAbsolute(privateDir) || path.resolve(privateDir).toLowerCase()===root.toLowerCase() || path.resolve(privateDir).toLowerCase().startsWith(root.toLowerCase()+path.sep)) throw Error('Private output must be outside the public checkout');
      const cfg={}, fc=process.env.ACTIVITY_FC_DIR;
      vm.runInNewContext(fs.readFileSync(process.env.FORGE_CONNECTION_FILE,'utf8'),cfg);
      const W=require(path.join(fc,'apps-script/PipelineWorklists.gs')), key=cfg.PipelineConnection.key;
      const snapshot=async()=>{
        const [m,a,s]=await Promise.all([require('../pipeline-observability/canonical-snapshot').readCanonical({key,W}),R.fetchAuthenticatedArchive({key}),R.read('writer_status',{key})]);
        return {rows:m.rows,archiveRows:a.rows.map(r=>W.parseRows(r.RAW_ROW)[0]),status:s.data,source:m.source};
      };
      deps={snapshot,checkLock:()=>Lock.lock(lock,'check',runId),index:()=>require('../writer-verify/recovery').loadIndex({token:cp.execFileSync('gh',['auth','token'],{encoding:'utf8'}).trim()}),
        exists:async rid=>(await R.read('receipt_index',{key,requestId:rid})).data.request!=null,
        // The current endpoint exposes receipts, not retained acceptance bodies.
        // Missing original acceptance remains a recovery obligation, without POST.
        original:async rid=>{await R.read('request_result',{key,requestId:rid});return null;},
        post:async payload=>{const r=await fetch(cfg.PipelineConnection.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({...payload,key}),signal:AbortSignal.timeout(240000)});return r.json();},
        rows:(rid,ids)=>require('./readback.cjs').rows({requestId:rid,ids,key,W})};
      if(apply) for(const tx of Object.values(state.transactions).filter(T.pending)) {
        try {await T.reconcile({root,privateDir,state,tx,deps});} catch(e) {state.exceptions['tx:'+tx.requestId]={owner:'CODE',reason:e.message,requestId:tx.requestId};}
      }
      const canonical=await snapshot();
      state.canonicalSource=canonical.source;
      await inspectReturns({root,privateDir,state,snapshot:canonical,apply});
      if(apply) {
        S.save(root,STATE,state);
        const env={...process.env,FORGE_RUN_ID:runId};
        const pendingIds=[...new Set(S.read(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[]}).items.filter(i=>i.status==='POST_IN_FLIGHT_UNKNOWN').map(i=>i.requestId))];
        let intakePending=false;
        for(const id of pendingIds) {
          try{const result=await child(root,['verify',id],env);if(!result.verified&&result.phase!=='VERIFIED')intakePending=true;}
          catch(e){intakePending=true;state.exceptions['intake:'+id]={owner:'CODE',requestId:id,reason:'ORIGINAL_INTAKE_RECONCILIATION_REQUIRED'};}
        }
        // Existing preparation owns canonical dedup, relevance and source-ledger
        // accounting. Its transaction count is never a coordinator run quota.
        if(!intakePending) {
          try{
            await child(root,['prepare','--apply'],env);
            await drain({ready:async()=>S.read(root,'state/RELEVANCE_INTAKE_PLAN.json').items.filter(i=>i.status==='READY').length,
              reconcile:async()=>{},step:()=>child(root,['step','100'],env)});
          }catch(e){state.exceptions['intake-driver']={owner:'CODE',reason:'INTAKE_DRIVER_GATE_OR_RECONCILIATION_REQUIRED'};}
        }
        // One row per transaction keeps receipt waiting independent of batch
        // quantity; each successful transaction immediately admits the next.
        for(const item of Object.values(state.items).filter(i=>i.status==='READY_ENRICHMENT'&&state.batches[i.batch]?.status==='VALIDATED')) {
          try {
            const tx=await T.submit({root,privateDir,state,jobs:[item.prepared],runId,deps});
            for(let n=0;n<8 && T.pending(tx);n++) {
              await T.reconcile({root,privateDir,state,tx,deps});
              if(T.pending(tx)) await new Promise(r=>setTimeout(r,20000));
            }
          } catch(e) {exception(state,item,e.message,'CODE');if(e.message==='LIVE_WRITER_GATE')break;}
        }
      }
    }
    const coverage=S.read(root,'state/EMAIL_RECOVERY_SUMMARY.json',null), at=new Date().toISOString();
    const report={...publicReport(state,coverage,at),runId,mode,collected};
    if(apply) {
      S.save(root,STATE,state);S.save(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',report);
      S.immutable(root,'receipts/'+runId+'_TERMINAL.json',report);
    } else if(privateDir) {S.save(privateDir,'coordinator-'+mode+'.json',report);}
    console.log(JSON.stringify({mode,collected,statuses:report.statuses,aiExceptions:report.aiExceptions.length,codeExceptions:report.codeExceptions.length,noProcessingCap:true}));
    return report;
  } finally {if(owned) Lock.lock(lock,'release',runId);}
}
if(require.main===module) main(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={inspectReturns,publicReport,drain,main};
