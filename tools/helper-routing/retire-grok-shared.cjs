'use strict';
// One-time coordinator handoff for the retired Grok shared helper (#398). Tim, Nov 18, 2026, 1:18 AM ET, relayed by
// President: Sniffer takes this work on the free research tool. Every still-ASSIGNED Grok item moves to the Sniffer
// shared helper through shared.transfer() (history kept, assignmentVersion bumped), the Sniffer provider is added, and
// Grok is marked unavailable and RETIRED. Returned, skipped and consumed items keep their owner and returnProof.
// Run on a fresh main checkout: node tools/helper-routing/retire-grok-shared.cjs [--apply]
// Re-runnable: a second run finds nothing to move.
const H = require('./shared.cjs'), S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const FROM = 'FORGE_GROK_SHARED_HELPER', TO = 'FORGE_SNIFFER_SHARED_HELPER';
const CHECKPOINT = 'control/changes/chatgpt-20261118-0130-retire-grok-shared-helper-to-sniffer.txt';
const REASON = 'FORGE_GROK_SHARED_HELPER retired in #398; Tim 2026-11-18 01:18 ET via President: reassign its ASSIGNED items to FORGE_SNIFFER_SHARED_HELPER and set Grok unavailable';
const SNIFFER = { provider: 'Sniffer', available: true, readiness: 'FIRST_REAL_RUN_PENDING',
  activationBasis: 'President relayed Tim 2026-11-18 01:18 ET approval: Sniffer takes the retired Grok shared helper work on the free research tool only; research only, no Writer authority' };

function retire(work, { at = new Date().toISOString() } = {}) {
  H.validateWork(work);
  if (!work.providers[TO]) work.providers[TO] = { ...SNIFFER };
  const moved = [];
  for (const item of work.items) {
    if (item.taskKey !== FROM || item.status !== 'ASSIGNED') continue;
    // Grok's helper is retired, so its last run is terminal and no transaction is pending.
    H.transfer(work, H.key(item), TO, { checkpoint: CHECKPOINT, terminalRun: true, reason: REASON });
    moved.push(H.key(item));
  }
  const grok = work.providers[FROM], wasAvailable = grok.available;
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
