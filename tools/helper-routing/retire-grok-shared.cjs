'use strict';
// One-time coordinator handoff for the retired Grok shared helper (#398; President decision
// Nov 17, 2026, 9:05 AM ET, Tim delegated). Moves every still-ASSIGNED Grok item to the
// Claude shared helper through shared.transfer() (history kept, assignmentVersion bumped),
// marks the Grok provider unavailable so replenish() assigns nothing new to it, and
// regenerates the helper pages. Returned, skipped and consumed items keep their owner and
// returnProof: their evidence stays with the run that produced it.
// Run on a fresh main checkout: node tools/helper-routing/retire-grok-shared.cjs [--apply]
// Re-runnable: a second run finds nothing to move.
const H = require('./shared.cjs'), S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const FROM = 'FORGE_GROK_SHARED_HELPER', TO = 'FORGE_CLAUDE_SHARED_HELPER';
const CHECKPOINT = 'handoffs/CLAUDE_20261117_0900ET_OPTION_A_STATUS.md#president-decision';
const REASON = 'FORGE_GROK_SHARED_HELPER retired in #398; President decision 2026-11-17 09:05 ET (Tim delegated): reassign its ASSIGNED items to FORGE_CLAUDE_SHARED_HELPER and set Grok unavailable';

function retire(work, { at = new Date().toISOString() } = {}) {
  H.validateWork(work);
  const moved = [];
  for (const item of work.items) {
    if (item.taskKey !== FROM || item.status !== 'ASSIGNED') continue;
    // Grok's helper is retired, so its last run is terminal and no transaction is pending.
    H.transfer(work, H.key(item), TO, { checkpoint: CHECKPOINT, terminalRun: true, reason: REASON });
    moved.push(H.key(item));
  }
  const grok = work.providers[FROM];
  const wasAvailable = grok.available;
  grok.available = false;
  grok.readiness = 'RETIRED';
  grok.retiredAt = grok.retiredAt || at;
  grok.retiredBasis = REASON;
  H.validateWork(work);
  return { moved: moved.length, movedKeys: moved, grokWasAvailable: wasAvailable };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), apply = process.argv.includes('--apply');
  const work = S.read(root, H.FILE), before = work.items.filter(i => i.taskKey === FROM && i.status === 'ASSIGNED').length;
  const result = retire(work);
  if (apply) {
    S.save(root, H.FILE, work);
    // Not the PC coordinator: this runs on a branch checkout with no concurrent writer.
    require('./shared-pages.cjs').generate(root, { checkLock: () => {} });
  }
  console.log(JSON.stringify({ apply, grokAssignedBefore: before, moved: result.moved, grokWasAvailable: result.grokWasAvailable }));
}
module.exports = { retire, FROM, TO };
