'use strict';

class BudgetExpired extends Error {
  constructor(phase) { super('Runtime budget exhausted: ' + phase); this.code = 'RUN_BUDGET'; }
}

// One clock governs research, transport (including response bodies), and Writer waits.
function create({researchMs, totalMs, now = () => Date.now(), pause = ms => new Promise(r => setTimeout(r, ms))}) {
  const started = now();
  let phase = 'research';
  const remaining = () => Math.max(0, started + (phase === 'research' ? researchMs : totalMs) - now());
  const canStart = (reserveMs = 1) => remaining() >= reserveMs;
  function check(reserveMs = 1) { if (!canStart(reserveMs)) throw new BudgetExpired(phase); }
  async function bounded(work, maxMs = Infinity) {
    check();
    const controller = new AbortController(), ms = Math.max(1, Math.min(remaining(), maxMs));
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => work(controller.signal)),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new BudgetExpired(phase)); }, ms); })
      ]);
    } finally { clearTimeout(timer); }
  }
  async function wait(ms) { check(ms + 1); await bounded(() => pause(ms)); check(); }
  return {remaining, canStart, check, bounded, wait, elapsed: () => now() - started,
    setPhase(value) { phase = value; }, expired: () => !canStart()};
}
module.exports = {create, BudgetExpired};
