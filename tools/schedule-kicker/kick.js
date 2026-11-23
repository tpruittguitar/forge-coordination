'use strict';
/* GitHub creates only a few of this repo's scheduled runs (writer-verify fired 3-4 times a day on an
 * every-30-minute cron; receipt-recovery's hourly cron about every 6 hours). Pushes to main fire reliably,
 * so .github/workflows/schedule-kicker.yml runs this on every push and dispatches an overdue workflow.
 * Both targets share the writer-verify concurrency group, where a second pending run cancels the first,
 * so this dispatches at most one run, and none while any run in the group is active. */
const TARGETS = [
  { workflow: 'writer-verify.yml', maxMinutes: 35 },
  { workflow: 'receipt-recovery.yml', maxMinutes: 65 }
];
const ACTIVE = new Set(['queued', 'in_progress', 'pending', 'waiting', 'requested']);
const STALE_ACTIVE_MINUTES = 180; // a run "queued" for hours is a GitHub ghost, not real work

/* latest: { workflow, maxMinutes, run: {status, created_at} | null }[] -> workflow to dispatch or null */
function pick(latest, now) {
  const age = r => (now - Date.parse(r.created_at)) / 60000;
  if (latest.some(t => t.run && ACTIVE.has(t.run.status) && age(t.run) < STALE_ACTIVE_MINUTES)) return null;
  let best = null, bestLate = 0;
  for (const t of latest) {
    const late = t.run ? age(t.run) - t.maxMinutes : Infinity;
    if (late > bestLate) { best = t.workflow; bestLate = late; }
  }
  return best;
}

if (require.main === module) {
  const { execFileSync: exec } = require('node:child_process');
  const repo = process.env.GITHUB_REPOSITORY || 'tpruittguitar/forge-coordination';
  const latest = TARGETS.map(t => {
    const runs = JSON.parse(exec('gh', ['api', `repos/${repo}/actions/workflows/${t.workflow}/runs?branch=main&per_page=1`], { encoding: 'utf8' })).workflow_runs;
    return { ...t, run: runs[0] || null };
  });
  latest.forEach(t => console.log(t.workflow, t.run ? `${t.run.status} ${t.run.created_at}` : 'no runs'));
  const target = pick(latest, Date.now());
  if (!target) { console.log('nothing overdue, or a writer-verify group run is active'); return; }
  exec('gh', ['workflow', 'run', target, '--ref', 'main', '--repo', repo], { stdio: 'inherit' });
  console.log('dispatched ' + target);
}

module.exports = { pick, TARGETS };
