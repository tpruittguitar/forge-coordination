'use strict';
const H = require('./shared.cjs'), S = require('../programmed-coordinator/store.cjs'), path = require('node:path');
const FROM = 'FORGE_GROK_SHARED_HELPER', TO = 'FORGE_CHATGPT_SHARED_HELPER';
const CHECKPOINT = 'control/changes/chatgpt-20261118-0120-retire-grok-shared-helper.txt';
const REASON = 'FORGE_GROK_SHARED_HELPER retired in President card Nov 18 2026 01:14 ET (Tim 01:12 option b): move ASSIGNED items to FORGE_CHATGPT_SHARED_HELPER and set Grok unavailable';
const CHATGPT_BASIS = 'President card Nov 18 2026 01:14 ET (Tim 01:12 option b): ChatGPT takes the retired Grok helper work on the OpenAI API credit; research only, no Writer authority';

function retire(work, { at = new Date().toISOString() } = {}) {
  H.validateWork(work);
  if (!work.providers[TO]) {
    work.providers[TO] = { provider: 'ChatGPT', available: true, readiness: 'FIRST_REAL_RUN_PENDING', activationBasis: CHATGPT_BASIS };
  }
  const moved = [];
  for (const item of work.items) {
    if (item.taskKey !== FROM || item.status !== 'ASSIGNED') continue;
    H.transfer(work, H.key(item), TO, { checkpoint: CHECKPOINT, terminalRun: true, reason: REASON });
    moved.push(H.key(item));
  }
  const grok = work.providers[FROM];
  grok.available = false;
  grok.readiness = 'RETIRED';
  grok.retiredAt = grok.retiredAt || at;
  grok.retiredBasis = REASON;
  H.validateWork(work);
  return { moved: moved.length, movedKeys: moved };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..'), apply = process.argv.includes('--apply');
  const work = S.read(root, H.FILE), before = work.items.filter(i => i.taskKey === FROM && i.status === 'ASSIGNED').length;
  const result = retire(work);
  if (apply) {
    S.save(root, H.FILE, work);
    require('./shared-pages.cjs').generate(root, { checkLock: () => {} });
  }
  console.log(JSON.stringify({ apply, grokAssignedBefore: before, moved: result.moved }));
}
module.exports = { retire, FROM, TO };
