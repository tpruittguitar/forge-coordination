'use strict';
// One-time release of ChatGPT enrichment returns that found no source (Tim approved 2026-11-17 11:20 AM ET,
// recorded in handoffs/CLAUDE_20261117_0900ET_OPTION_A_STATUS.md). Selects control/ENRICHMENT_HELPER_WORK.json
// items that are RETURNED_PENDING_REVIEW, whose returned batch item says NEEDS_SOURCE_EVIDENCE and whose
// coordinator item is an EXCEPTION for WORKING_SOURCE_ROUTE_REQUIRED, and marks them RELEASED. A released job no
// longer reserves its ID, so the coordinator's shared replenish() offers it to the Sniffer shared helper only
// (Tim 2026-11-18 01:18 ET, #448). Fenced, protected and identity cases are not touched.
// Run on a fresh main checkout: node tools/helper-routing/release-enrichment-returns.cjs [--apply]
const S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const WORK = 'control/ENRICHMENT_HELPER_WORK.json', STATE = 'state/PROGRAMMED_COORDINATOR.json';
const APPROVAL = 'Tim 2026-11-17 11:20 ET release; Tim 2026-11-18 01:18 ET via President: reassign NEEDS_SOURCE_EVIDENCE returns to the Sniffer shared helper';

function select(root, work, state) {
  const pending = new Set(work.items.filter(i => i.status === 'RETURNED_PENDING_REVIEW').map(i => i.primaryId)), out = new Set(), cache = new Map();
  for (const [key, item] of Object.entries(state.items)) {
    if (!pending.has(item.itemKey) || item.status !== 'EXCEPTION' || state.exceptions[key]?.reason !== 'WORKING_SOURCE_ROUTE_REQUIRED') continue;
    if (!cache.has(item.batch)) cache.set(item.batch, S.read(root, item.batch, { items: [] }));
    const returned = cache.get(item.batch).items.find(i => (i.key || i.primaryId) === item.itemKey);
    if (returned?.recommendation === 'NEEDS_SOURCE_EVIDENCE') out.add(item.itemKey);
  }
  return out;
}
function release(work, ids, { at = new Date().toISOString() } = {}) {
  let released = 0;
  for (const item of work.items) {
    if (!ids.has(item.primaryId) || item.status !== 'RETURNED_PENDING_REVIEW') continue;
    item.release = { previousStatus: item.status, at, reason: 'NO_SOURCE_FOUND_REASSIGN_TO_SHARED_HELPER', approvedBy: APPROVAL };
    item.status = 'RELEASED'; released++;
  }
  return released;
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), apply = process.argv.includes('--apply');
  const work = S.read(root, WORK), ids = select(root, work, S.read(root, STATE)), released = release(work, ids);
  if (apply && released) S.save(root, WORK, work);
  console.log(JSON.stringify({ apply, selected: ids.size, released }));
}
module.exports = { select, release, APPROVAL };
