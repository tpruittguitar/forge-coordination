'use strict';
const S = require('./store.cjs'), {normalizeCell:cell} = require('../source-intake/writer-cell');
const Source = require('./source.cjs');
const allowed = new Set(['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','DEGREE_ASOF','REQUIREMENTS_REVIEWED',
  'SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_MIDPOINT','SALARY_BASIS','SALARY_SOURCE','SALARY_ASOF','SALARY_CONF']);
const pending = tx => !['VERIFIED','HELD'].includes(tx.status);
function healthy(status) {
  if (!Object.hasOwn(status, 'freeze') || status.freeze !== null || String(status.level).toUpperCase() !== 'OK' ||
      !Array.isArray(status.errors) || status.errors.length || !status.unverified || status.unverified.count !== 0) throw Error('LIVE_WRITER_GATE');
}
function identity(row) { return {company:row.COMPANY, title:row.TITLE, location:row.LOCATION}; }
function same(row, expected) { return Source.norm(row.COMPANY) === Source.norm(expected.company) && Source.norm(row.TITLE) === Source.norm(expected.title) && Source.location(row.LOCATION) === Source.location(expected.location); }
function protectedRow(row) { return !['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'].includes(row.BUCKET) || /^YES/i.test(row.p?.ANTI_RESURRECTION || '') || !!row.p?.DO_NOT_REWORK || !!row.p?.TIM_DECISION; }
function fenced(root, state, id) {
  if (Object.values(state.transactions).some(tx => tx.status !== 'VERIFIED' && tx.ids.includes(id))) return true;
  const ledger = S.read(root, 'state/enrich-ats-pay.json', {});
  if (Object.values(ledger.pendingWrites || {}).some(tx => tx.ids?.includes(id))) return true;
  const consumption = S.read(root, 'state/CLAUDE_HELPER_CONSUMPTION.json', {items:[]});
  if(consumption.items.some(i => (i.primaryId === id || i.key === id) && /POST_IN_FLIGHT|SUBMITTED|HELD_WRITER/.test(i.status)))return true;
  // Earlier local coordinators used immutable checkpoints without this new
  // ledger. Their unresolved originals remain fences across the cutover.
  const dir=require('node:path').join(root,'receipts'),fs=require('node:fs');
  if(fs.existsSync(dir)) for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('_CHECKPOINT.json'))) {
    if(fs.existsSync(require('node:path').join(dir,name.replace('_CHECKPOINT.json','_VERIFIED.json'))))continue;
    const cp=S.read(root,'receipts/'+name),ids=[...(cp.ids||[]),...(cp.primaryIds||[]),...(cp.requests||[]).map(r=>r.primaryId),...(cp.evidence||[]).map(e=>e.primaryId)];
    if(ids.includes(id))return true;
  }
  return false;
}
async function submit({root, privateDir, state, jobs, runId, deps}) {
  if (!jobs.length || jobs.length > 25 || new Set(jobs.map(j => j.primaryId)).size !== jobs.length) throw Error('Invalid transaction size or duplicate job');
  deps.checkLock();
  const snapshot = await deps.snapshot(); healthy(snapshot.status);
  for (const job of jobs) {
    const rows = snapshot.rows.filter(r => r.PRIMARY_ID === job.primaryId);
    if (rows.length !== 1 || protectedRow(rows[0]) || !same(rows[0], job.identity) || fenced(root,state,job.primaryId)) throw Error('CANONICAL_IDENTITY_OR_TRANSACTION_FENCE');
    if (!Object.keys(job.fields).length || Object.keys(job.fields).some(k => !allowed.has(k))) throw Error('Unsupported enrichment fields');
    if (Object.entries(job.fields).some(([k,v]) => Source.known(rows[0].p?.[k]) && cell(rows[0].p[k]) !== cell(v))) throw Error('CONFLICTING_CURRENT_EVIDENCE');
  }
  const n = Object.keys(state.transactions).length + 1, requestId = runId + '-E' + String(n).padStart(5,'0');
  if (await deps.exists(requestId)) throw Error('ORIGINAL_REQUEST_ALREADY_EXISTS');
  const requests = jobs.map((j,n) => ({action:'ruling', ruling:{requestId:requestId+'-R'+(n+1), primaryId:j.primaryId, kind:'ENRICH', actor:'CHATGPT', fields:j.fields}}));
  const payload = {action:'batch', requestId, requests};
  S.immutable(privateDir, requestId + '-payload.json', payload);
  const tx = {requestId, ids:jobs.map(j => j.primaryId), itemKeys:jobs.map(j => j.itemKey), status:'POST_IN_FLIGHT_UNKNOWN',
    at:new Date().toISOString(), payloadSha256:S.hash(payload), requests:requests.map((r,n) => ({requestId:r.ruling.requestId, primaryId:r.ruling.primaryId,
      identity:jobs[n].identity, fields:r.ruling.fields, sourceSha256:jobs[n].sourceSha256}))};
  // The public checkpoint and item fences reach disk before the one POST.
  state.transactions[requestId] = tx;
  for (const j of jobs) Object.assign(state.items[j.itemKey], {status:'POST_IN_FLIGHT_UNKNOWN', transactionId:requestId});
  S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);
  S.immutable(root,'receipts/'+requestId+'_CHECKPOINT.json',tx);
  deps.checkLock();
  try {
    const response = await deps.post(payload);
    S.immutable(privateDir, requestId + '-acceptance.json', response);
    tx.acceptanceSha256 = S.hash(response); tx.status = 'AWAITING_VERIFICATION';
  } catch { tx.status = 'POST_IN_FLIGHT_UNKNOWN'; }
  S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);
  return tx;
}
async function reconcile({root, privateDir, state, tx, deps}) {
  if (!pending(tx)) return tx.status;
  deps.checkLock();
  const payload = S.read(privateDir, tx.requestId+'-payload.json', null);
  if (!payload || S.hash(payload) !== tx.payloadSha256) throw Error('ORIGINAL_PAYLOAD_MISSING_OR_CHANGED');
  let response = S.read(privateDir, tx.requestId+'-acceptance.json', null);
  if (!response) {
    // Recover only the original retained response. A receipt alone is not the
    // original acceptance, and never permits another POST.
    response = await deps.original(tx.requestId);
    if (!response) { tx.status='POST_IN_FLIGHT_UNKNOWN'; return tx.status; }
    S.immutable(privateDir, tx.requestId+'-acceptance.json', response);
  }
  if (tx.acceptanceSha256 && S.hash(response) !== tx.acceptanceSha256) throw Error('ACCEPTANCE_CHANGED');
  const results = response.results;
  if (!Array.isArray(results) || results.length !== tx.requests.length) throw Error('ORIGINAL_RESULT_BINDING_MISSING');
  const bound = tx.requests.map(r => results.filter(x => x.requestId === r.requestId && (!x.primaryId || x.primaryId === r.primaryId)));
  if (bound.some(xs => xs.length !== 1 || xs[0].ok !== true)) {
    tx.status='HELD';tx.reason='ORIGINAL_RESULT_REQUIRES_REVIEW';
    for(const key of tx.itemKeys){state.items[key].status='HELD_WRITER_REVIEW';state.exceptions[key]={owner:'CODE',key,requestId:tx.requestId,reason:tx.reason};}
    S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);return tx.status;
  }
  const noWrite = response.mode === 'BATCH_RULING_NO_WRITE' && !response.writeId;
  let index = null;
  if (!noWrite) {
    if (!response.writeId) throw Error('ACCEPTANCE_WRITE_ID_MISSING');
    index = await deps.index();
    if (tx.requests.some(r => { const e=index.index.requests[r.requestId]; return e?.s !== 'COMPLETE' || e.w !== response.writeId || !e.items?.some(i => i.pid === r.primaryId); })) { tx.status='AWAITING_VERIFICATION'; return tx.status; }
  }
  const completeObservedAt = new Date().toISOString(), rows = await deps.rows(tx.requestId,tx.ids);
  if (!Number.isFinite(Date.parse(rows.startedAt)) || Date.parse(rows.startedAt) < Date.parse(completeObservedAt)) throw Error('EARLY_CANONICAL_READBACK');
  const proofs = tx.requests.map(r => {
    const hits = rows.rows.filter(x => x.PRIMARY_ID === r.primaryId);
    if (hits.length !== 1 || !same(hits[0],r.identity) || Object.entries(r.fields).some(([k,v]) => cell(hits[0].p?.[k]) !== cell(v))) throw Error('EXACT_ROW_EFFECT_NOT_PROVEN');
    return {primaryId:r.primaryId, requestId:r.requestId, rowSha256:S.hash(hits[0].line), fields:Object.keys(r.fields),...(hits[0].evidenceProof?{evidence:hits[0].evidenceProof}:{})};
  });
  const proofFile='receipts/'+tx.requestId+'_VERIFIED.json',priorProof=S.read(root,proofFile,null);
  if(priorProof) {
    if(priorProof.requestId!==tx.requestId||priorProof.acceptanceSha256!==S.hash(response)||!Array.isArray(priorProof.proofs)||
      priorProof.proofs.length!==proofs.length||proofs.some(p=>!priorProof.proofs.some(q=>q.primaryId===p.primaryId&&q.requestId===p.requestId&&S.hash(q.fields)===S.hash(p.fields))))throw Error('IMMUTABLE_VERIFICATION_PROOF_CHANGED');
  } else S.immutable(root,proofFile,{schema:'forge.programmed-coordinator-verification.v1',requestId:tx.requestId,
    acceptanceSha256:S.hash(response), independentIndexSha:index?.sha || null, completeObservedAt, proofs, noWrite, claimedCompletedJobs:0});
  const work=S.read(root,'control/ENRICHMENT_HELPER_WORK.json',null);
  if(work) {
    let changed=false;
    for(const r of tx.requests) {
      const item=work.items.find(i=>i.primaryId===r.primaryId),row=rows.rows.find(i=>i.PRIMARY_ID===r.primaryId);
      if(!item||item.taskKey!=='FORGE_GROK_ENRICHMENT')continue;
      const complete=(item.missingFields||[]).length>0&&(item.missingFields||[]).every(f=>f==='DEGREE'?(Source.known(row.p.DEGREE_REQ)||Source.known(row.p.DEGREE_TEXT)):f==='SALARY'?Source.known(row.p.SALARY_BASE_LOW):false);
      item.coordinatorConsumption={requestId:tx.requestId,proof:proofFile,verifiedFields:Object.keys(r.fields),sourceSha256:r.sourceSha256};
      item.status=complete?'CONSUMED':'RETURNED_PARTIALLY_CONSUMED';changed=true;
    }
    if(changed)S.save(root,'control/ENRICHMENT_HELPER_WORK.json',work);
  }
  tx.status='VERIFIED'; tx.verifiedAt=new Date().toISOString();
  for (const key of tx.itemKeys) {Object.assign(state.items[key], {status:'VERIFIED',proof:'receipts/'+tx.requestId+'_VERIFIED.json'});delete state.exceptions[key];}
  delete state.exceptions['tx:'+tx.requestId];
  S.save(root,'state/PROGRAMMED_COORDINATOR.json',state);
  return tx.status;
}
module.exports = {healthy, identity, same, protectedRow, fenced, pending, submit, reconcile};
