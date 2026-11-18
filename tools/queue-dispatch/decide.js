'use strict';
/* Pure dispatch decision for queue-driven Forge step 1.
 * Signals come from existing lane summaries; this module does not read the repo or call GitHub.
 * Depth is the incoming chain depth (0 for a cron, workflow_run, or manual start). */
const DEPTH_CAP = 6;

function parseDepth(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function decide(signals = {}) {
  const depth = parseDepth(signals.depth);
  const nextDepth = depth + 1;
  if (depth >= DEPTH_CAP) {
    return { dispatch: [], stopReason: 'depth-cap', depth, nextDepth: depth };
  }
  const dispatch = [];
  if (signals.lane === 'source-intake-auto') {
    const wroteRows = Number(signals.wroteRows) > 0;
    const waiting = Number(signals.waiting) > 0;
    if (wroteRows) dispatch.push({ workflow: 'enrich-ats-pay.yml', reason: 'next' });
    // Self-dispatch only when this run also wrote rows. UPSTREAM_FLOW.json is
    // published by pipeline-observability, so it can stay stale across a chain
    // of intake runs and would otherwise dispatch empty work up to the cap.
    if (waiting && wroteRows) dispatch.push({ workflow: 'source-intake-auto.yml', reason: 'self' });
  } else if (signals.lane === 'enrich-ats-pay') {
    const remaining = Number(signals.notAttempted) > 0;
    const exhausted = signals.researchBudgetExhausted === true;
    if (remaining && !exhausted) dispatch.push({ workflow: 'enrich-ats-pay.yml', reason: 'self' });
  }
  return { dispatch, depth, nextDepth };
}

module.exports = { decide, parseDepth, DEPTH_CAP };
