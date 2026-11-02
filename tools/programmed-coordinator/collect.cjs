'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const S = require('./store.cjs');
const validators = {
  'forge.claude-helper-batch.v1': require('../helper-routing/reservations.cjs').validateBatch,
  'forge.intake-helper-batch.v1': require('../helper-routing/intake.cjs').validate,
  'forge.enrichment-helper-batch.v1': require('../helper-routing/enrichment.cjs').validateBatch,
  'forge.outcome-helper-batch.v1': require('../helper-routing/outcome.cjs').validateBatch,
  'forge.relevance-helper-batch.v1': require('../helper-routing/relevance.cjs').validate
};
const historyCache = new Map();
function show(root, commit, file) {
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^(control|lanes|policy)\/[A-Za-z0-9_./-]+$/.test(file) || file.includes('..')) throw Error('Invalid instruction reference');
  const key=root+':'+commit+':'+file;
  if(!historyCache.has(key)) historyCache.set(key,cp.execFileSync('git', ['show', commit + ':' + file], {cwd: root, encoding: 'utf8', maxBuffer: 8e6, stdio: ['ignore','pipe','pipe']}).replace(/\r\n/g,'\n'));
  return historyCache.get(key);
}
// Bot commits and wording updates do not discard saved source facts. Changed
// ownership/assignment/cutover does block this return; current code rechecks facts.
function routingProof(root, batch, current, historical = show) {
  const registry = 'control/AI_AUTOMATION_TASKS.json', common = 'policy/current/AI_AUTOMATION_COMMON.txt';
  const old = JSON.parse(historical(root, batch.instructionCommit, registry));
  const now = S.read(root, registry), task = now.tasks[batch.taskKey], prior = old.tasks?.[batch.taskKey];
  const route = t => t && ({owner:t.owner, route:t.route, procedure:t.procedure, executionMode:t.executionMode, workAssignments:t.workAssignments});
  if (!task || task.owner !== batch.provider || S.hash(route(task)) !== S.hash(route(prior))) throw Error('STALE_TASK_ROUTING');
  const contractChanged = [common, task.procedure].some(file => historical(root, batch.instructionCommit, file) !== fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'));
  const work = S.read(root, task.workAssignments), before = JSON.parse(historical(root, batch.instructionCommit, task.workAssignments));
  const partition = w => ({assignmentId: w.assignmentId, enabled: w.enabled, routingActive: w.routingActive, routing: w.routing});
  if (S.hash(partition(work)) !== S.hash(partition(before))) throw Error('STALE_ASSIGNMENT_ROUTING');
  if (batch.routing?.cutoverAt && batch.routing.cutoverAt !== work.routing?.cutoverAt) throw Error('STALE_REPORTED_ROUTING');
  return {instructionCommit: batch.instructionCommit, checkedAgainst: current, contractChanged, currentPolicyRecheckRequired:true};
}
const empty = () => ({schema:'forge.programmed-coordinator.v1', batches:{}, items:{}, transactions:{}, exceptions:{}});
function collect({root, state, commit, routing = routingProof}) {
  const registry = S.read(root, 'control/AI_AUTOMATION_TASKS.json');
  const legacy = new Set(S.read(root,'state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]}).items.map(i=>i.batch));
  const paths = ['receipts/CLAUDE_HELPERS', 'receipts/GROK_HELPERS', 'receipts/CLAUDE_RELEVANCE'];
  let newBatches = 0, newItems = 0, updatedItems = 0;
  for (const dir of paths) for (const file of S.files(path.join(root, dir))) {
    const rel = path.relative(root, file).replace(/\\/g, '/'), raw = fs.readFileSync(file, 'utf8'), sha256 = S.hash(raw);
    if(dir !== 'receipts/CLAUDE_RELEVANCE' && rel.split('/').length < 4) continue; // ACKs/manifests are not returns.
    const prior = state.batches[rel];
    if (prior && prior.sha256 !== sha256) { prior.status='QUARANTINED';state.exceptions['batch:' + rel] = {owner:'CODE', reason:'IMMUTABLE_BATCH_CHANGED', path:rel}; continue; }
    if (prior?.checkedAgainst === commit) continue;
    let batch;
    try {
      batch = JSON.parse(raw);
      const validate = validators[batch.schema], task = registry.tasks[batch.taskKey];
      if (!validate || !task || task.owner !== batch.provider) throw Error('UNKNOWN_ENVELOPE_OR_PROVIDER');
      const work = S.read(root, task.workAssignments);
      validate(batch, work);
      if(legacy.has(rel)) {
        state.batches[rel]={id:batch.taskKey+':'+batch.runId,sha256,checkedAgainst:commit,status:'LEGACY_TRACKED',items:batch.items.length,
          dispositionLedger:'state/CLAUDE_HELPER_CONSUMPTION.json',productionAuthorized:false};
        delete state.exceptions['batch:'+rel];continue;
      }
      const proof = routing(root, batch, commit);
      const id = batch.taskKey + ':' + batch.runId;
      const collision = Object.values(state.batches).find(b => b.id === id && b.sha256 !== sha256);
      if (collision) throw Error('IMMUTABLE_RUN_ID_COLLISION');
      state.batches[rel] = {id, sha256, checkedAgainst:commit, status:'VALIDATED', items:batch.items.length, ...proof};
      delete state.exceptions['batch:' + rel];
      if(prior?.status==='VALIDATED') continue;
      for (const item of batch.items) {
        // The immutable item digest prevents an unchanged exception from being
        // resent to AI on every poll; task/key identity prevents cross-lane loss.
        const key = batch.taskKey + ':' + (item.key || item.primaryId || require('../helper-routing/outcome.cjs').eventKey(item.gmailMessageId, item.type, item.primaryId));
        const version = S.hash(item), existing = state.items[key];
        if(existing?.version===version||/^PROTECTED|^EXISTING/.test(existing?.status||''))continue;
        if(existing?.transactionId&&state.transactions[existing.transactionId]?.status!=='VERIFIED') {
          const returns=existing.deferredReturns||(existing.deferredReturns=[]);
          if(!returns.some(r=>r.version===version))returns.push({version,batch:rel,batchSha256:sha256});
          continue;
        }
        const history=existing?[...(existing.history||[]),{version:existing.version,status:existing.status,transactionId:existing.transactionId||null,proof:existing.proof||null,batch:existing.batch}]:[];
        state.items[key] = {key, version, taskKey:batch.taskKey, batch:rel, batchSha256:sha256, itemKey:item.key || item.primaryId || null, status:'RETURNED', attempts:0,history};
        if(existing)updatedItems++;else newItems++;
      }
      if (!prior) newBatches++;
    } catch (e) {
      const items = Array.isArray(batch?.items) ? batch.items : [];
      state.batches[rel] = {id:batch?.taskKey + ':' + batch?.runId, sha256, checkedAgainst:commit, status:'QUARANTINED', items:items.length};
      state.exceptions['batch:' + rel] = {owner:'CODE', reason:e.message, path:rel,
        invalidUrlKeys:items.filter(i => i.sourceEvidence?.url !== undefined && !/^https:\/\/\S+$/.test(i.sourceEvidence.url)).map(i => i.key || i.primaryId)};
    }
  }
  // A new source return arriving during an uncertain original is retained, then
  // promoted only after that exact transaction verifies. No original is replayed.
  for(const item of Object.values(state.items)) {
    if(!item.deferredReturns?.length||state.transactions[item.transactionId]?.status!=='VERIFIED')continue;
    const eligible=item.deferredReturns.filter(r=>state.batches[r.batch]?.status==='VALIDATED');
    const next=eligible.at(-1);if(!next)continue;
    const history=[...(item.history||[]),{version:item.version,status:item.status,transactionId:item.transactionId,proof:item.proof||null,batch:item.batch}];
    state.items[item.key]={key:item.key,version:next.version,taskKey:item.taskKey,batch:next.batch,batchSha256:next.batchSha256,itemKey:item.itemKey,status:'RETURNED',attempts:0,history};
    updatedItems++;
  }
  return {newBatches, newItems, updatedItems, validated:Object.values(state.batches).filter(b => b.status === 'VALIDATED').length,
    quarantined:Object.values(state.batches).filter(b => b.status === 'QUARANTINED').length};
}
module.exports = {empty, collect, routingProof};
