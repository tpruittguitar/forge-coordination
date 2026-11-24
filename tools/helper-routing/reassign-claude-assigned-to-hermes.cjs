'use strict';
// Coordinator handoff (cs-e24804d8). Tim, Nov 23, 2026, 9:27 PM ET, told Hermes that Claude is out for the
// week and Hermes can take Claude's IDs (verified by President). Every still-ASSIGNED Claude shared-helper
// item moves to FORGE_HERMES_SHARED_HELPER through shared.transfer() (history kept, assignmentVersion bumped).
// The Hermes provider is added. Claude stays available. PROTECTED_SKIP and every other helper's holds are
// left untouched, as are Claude items that are not ASSIGNED.
// Run on a fresh main checkout: node tools/helper-routing/reassign-claude-assigned-to-hermes.cjs [--apply]
// Re-runnable: a second run finds nothing to move. Does not regenerate shared-helper-pages.
const H = require('./shared.cjs'), S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const FROM = 'FORGE_CLAUDE_SHARED_HELPER', TO = 'FORGE_HERMES_SHARED_HELPER';
const CHECKPOINT = 'control/changes/chatgpt-20261123-2129-reassign-claude-assigned-holds-to-hermes.txt';
const REASON = 'Tim 2026-11-23 21:27 ET to Hermes, verified by President: Claude is out for the week; Hermes may take Claude ASSIGNED IDs (cs-e24804d8)';
const HERMES = { provider: 'Hermes', available: true, readiness: 'FIRST_REAL_RUN_PENDING',
  activationBasis: REASON };

function counts(work) {
  const out = { byProviderStatus: {}, byProvider: {}, claudeAssigned: 0, hermesAssigned: 0, hermesItems: 0, protectedSkip: 0 };
  for (const item of work.items) {
    const k = `${item.provider}|${item.taskKey}|${item.status}`;
    out.byProviderStatus[k] = (out.byProviderStatus[k] || 0) + 1;
    out.byProvider[item.provider] = (out.byProvider[item.provider] || 0) + 1;
    if (item.taskKey === FROM && item.provider === 'Claude' && item.status === 'ASSIGNED') out.claudeAssigned++;
    if (item.taskKey === TO && item.status === 'ASSIGNED') out.hermesAssigned++;
    if (item.taskKey === TO || item.provider === 'Hermes') out.hermesItems++;
    if (item.status === 'PROTECTED_SKIP') out.protectedSkip++;
  }
  return out;
}
function unchangedBuckets(before, after) {
  const keys=new Set([...Object.keys(before.byProviderStatus),...Object.keys(after.byProviderStatus)]);
  const movedFrom=`Claude|${FROM}|ASSIGNED`, movedTo=`Hermes|${TO}|ASSIGNED`;
  const drift=[];
  for (const k of keys) {
    if (k===movedFrom||k===movedTo) continue;
    if ((before.byProviderStatus[k]||0)!==(after.byProviderStatus[k]||0)) drift.push([k,before.byProviderStatus[k]||0,after.byProviderStatus[k]||0]);
  }
  return drift;
}

function reassign(work) {
  H.validateWork(work);
  if (!work.providers[TO]) work.providers[TO] = { ...HERMES };
  else if (work.providers[TO].provider !== 'Hermes' || typeof work.providers[TO].available !== 'boolean') {
    throw Error('INVALID_HERMES_SHARED_HELPER_PROVIDER');
  } else {
    work.providers[TO].available = true;
  }
  const moved = [];
  for (const item of work.items) {
    if (item.taskKey !== FROM || item.provider !== 'Claude' || item.status !== 'ASSIGNED') continue;
    H.transfer(work, H.key(item), TO, { checkpoint: CHECKPOINT, terminalRun: true, reason: REASON });
    moved.push(H.key(item));
  }
  H.validateWork(work);
  return { moved: moved.length, movedKeys: moved };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), apply = process.argv.includes('--apply');
  const work = S.read(root, H.FILE);
  const before = counts(work);
  const result = reassign(work);
  const after = counts(work);
  const drift = unchangedBuckets(before, after);
  if (after.claudeAssigned !== 0 || after.hermesAssigned !== before.claudeAssigned + before.hermesAssigned
      || after.protectedSkip !== before.protectedSkip || after.hermesItems !== before.hermesItems + result.moved
      || drift.length) {
    throw Error('REASSIGN_COUNT_MISMATCH');
  }
  if (apply) S.save(root, H.FILE, work);
  const summary = { apply, before, after, moved: result.moved };
  summary.drift = drift;
  console.log(JSON.stringify(summary, null, 2));
}
module.exports = { reassign, counts, FROM, TO, CHECKPOINT, REASON, HERMES };
