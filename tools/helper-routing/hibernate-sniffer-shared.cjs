'use strict';
// Temporary coordinator handoff while Sniffer hibernates. Tim, Nov 20, 2026, 9:42 AM ET, in the Forge project chat:
// "Sniffer need to be hibernating" (answering whether Sniffer's waiting jobs and new intake should go to Claude's lane
// until Sunday, Nov 22, while Grok also hibernates). Every still-ASSIGNED Sniffer item moves to the Claude shared helper
// through shared.transfer() (history kept, assignmentVersion bumped), and Sniffer is marked unavailable and HIBERNATING,
// so replenish() routes new shared work to Claude only. Returned, skipped and consumed items keep their owner and proof.
// Sunday handback is a separate, Tim-initiated change: set Sniffer available again (and move items back only if he says so).
// Run on a fresh main checkout while holding the shared production lock:
//   node tools/helper-routing/hibernate-sniffer-shared.cjs [--apply] [--lock <lock-file> <run-token>]
// Re-runnable: a second run finds nothing to move.
const H = require('./shared.cjs'), S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const FROM = 'FORGE_SNIFFER_SHARED_HELPER', TO = 'FORGE_CLAUDE_SHARED_HELPER';
const CHECKPOINT = 'control/changes/claude-20261120-1450-hibernate-sniffer-shared-helper.txt';
const REASON = 'Tim 2026-11-20 09:42 ET in Forge project chat: "Sniffer need to be hibernating"; Sniffer ASSIGNED shared items move to FORGE_CLAUDE_SHARED_HELPER and Sniffer is set unavailable until the Sunday 2026-11-22 handback';

function hibernate(work, { at = new Date().toISOString() } = {}) {
  H.validateWork(work);
  const sniffer = work.providers[FROM];
  if (!sniffer) throw Error('SNIFFER_PROVIDER_MISSING');
  if (!work.providers[TO]?.available) throw Error('CLAUDE_SHARED_HELPER_UNAVAILABLE');
  const moved = [];
  for (const item of work.items) {
    if (item.taskKey !== FROM || item.status !== 'ASSIGNED') continue;
    // Sniffer never completed a real run (FIRST_REAL_RUN_PENDING) and holds no pending transaction.
    H.transfer(work, H.key(item), TO, { checkpoint: CHECKPOINT, terminalRun: true, reason: REASON });
    moved.push(H.key(item));
  }
  const wasAvailable = sniffer.available;
  if (sniffer.readiness !== 'HIBERNATING') sniffer.readinessBeforeHibernation = sniffer.readiness;
  sniffer.available = false;
  sniffer.readiness = 'HIBERNATING';
  sniffer.hibernatedAt = sniffer.hibernatedAt || at;
  sniffer.hibernationBasis = REASON;
  sniffer.handbackDue = '2026-11-22';
  H.validateWork(work);
  return { moved: moved.length, movedKeys: moved, snifferWasAvailable: wasAvailable };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), argv = process.argv.slice(2), apply = argv.includes('--apply');
  const li = argv.indexOf('--lock');
  const checkLock = li >= 0 ? () => { const Lock = require('../automation-run-lock.cjs'); Lock.lock(argv[li + 1], 'check', argv[li + 2]); } : null;
  if (apply && !checkLock) throw Error('SHARED_PRODUCTION_LOCK_REQUIRED');
  const work = S.read(root, H.FILE), before = work.items.filter(i => i.taskKey === FROM && i.status === 'ASSIGNED').length;
  const claudeBefore = work.items.filter(i => i.taskKey === TO && i.status === 'ASSIGNED').length;
  const result = hibernate(work);
  if (apply) {
    checkLock();
    S.save(root, H.FILE, work);
    require('./shared-pages.cjs').generate(root, { checkLock });
  }
  console.log(JSON.stringify({ apply, snifferAssignedBefore: before, claudeAssignedBefore: claudeBefore, moved: result.moved,
    claudeAssignedAfter: work.items.filter(i => i.taskKey === TO && i.status === 'ASSIGNED').length, snifferWasAvailable: result.snifferWasAvailable }));
}
module.exports = { hibernate, FROM, TO, CHECKPOINT, REASON };
