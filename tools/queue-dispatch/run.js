#!/usr/bin/env node
'use strict';
/* End-of-run self/next dispatch for source-intake-auto and enrich-ats-pay.
 * Reads existing summaries, decides with decide.js, and (unless dry) calls
 * `gh workflow run`. Never opens a new ledger. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { decide } = require('./decide');
const { collect, parseStamp } = require('./signals');

function startedAt() {
  const env = process.env.QUEUE_RUN_STARTED_AT;
  if (env) return parseStamp(env);
  const stampFile = process.env.QUEUE_START_FILE;
  if (stampFile && fs.existsSync(stampFile)) return parseStamp(fs.readFileSync(stampFile, 'utf8').trim());
  return NaN;
}

function main() {
  const lane = process.env.QUEUE_LANE;
  const root = process.env.QUEUE_ROOT || '.';
  const depth = process.env.QUEUE_DEPTH || '0';
  const repo = process.env.QUEUE_REPO || process.env.GITHUB_REPOSITORY;
  const ref = process.env.QUEUE_REF || 'main';
  const parent = process.env.QUEUE_RUN_ID || process.env.GITHUB_RUN_ID || '';
  const dry = process.env.QUEUE_DRY === '1' || !(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  if (lane !== 'source-intake-auto' && lane !== 'enrich-ats-pay') {
    throw Error('QUEUE_LANE must be source-intake-auto or enrich-ats-pay');
  }
  const signals = { ...collect(lane, root, startedAt()), depth };
  if (signals.fromThisRun === false) {
    console.log(JSON.stringify({ skipped: 'report-not-from-this-run', signals }, null, 1));
    return;
  }
  const decision = decide(signals);
  console.log(JSON.stringify({ signals, decision }, null, 1));
  if (!decision.dispatch.length) return;
  if (dry) {
    console.log('dry-run: no workflow_dispatch');
    return;
  }
  if (!repo) throw Error('GITHUB_REPOSITORY or QUEUE_REPO is required to dispatch');
  for (const target of decision.dispatch) {
    const args = [
      'workflow', 'run', target.workflow,
      '--ref', ref,
      '--repo', repo,
      '-f', 'reason=' + target.reason,
      '-f', 'parent_run_id=' + parent,
      '-f', 'depth=' + String(decision.nextDepth)
    ];
    if (skipSelfDispatch(target, repo, parent)) continue;
    console.log('gh ' + args.join(' '));
    try {
      execFileSync('gh', args, { stdio: ['ignore', 'inherit', 'pipe'] });
    } catch (err) {
      const msg = String((err && err.stderr) || (err && err.message) || '');
      process.stderr.write(msg);
      // A paused (disabled) target must not stop the rest of the chain.
      if (isDisabledError(msg)) { console.log('skipped ' + target.workflow + ': workflow is disabled'); continue; }
      throw err;
    }
  }
}

function isDisabledError(text) {
  return /disabled workflow/i.test(String(text || ''));
}

// A newer workflow_dispatch makes GitHub cancel a run already pending in the source-intake-auto
// concurrency group, so a self-dispatch while another run is queued only churns (cs-59c4d9d5).
const ACTIVE_RUN_STATUSES = new Set(['queued', 'in_progress', 'pending', 'waiting', 'requested']);

function otherActiveRuns(runs, selfRunId) {
  return (Array.isArray(runs) ? runs : []).filter((run) => run && ACTIVE_RUN_STATUSES.has(String(run.status))
    && String(run.databaseId) !== String(selfRunId || ''));
}

function listRuns(workflow, repo) {
  const out = execFileSync('gh', ['run', 'list', '--workflow', workflow, '--repo', repo, '--limit', '20',
    '--json', 'databaseId,status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

function skipSelfDispatch(target, repo, selfRunId, list = listRuns) {
  if (target.workflow !== 'source-intake-auto.yml' || target.reason !== 'self') return false;
  let active;
  try {
    active = otherActiveRuns(list(target.workflow, repo), selfRunId);
  } catch (err) {
    // Fail open: without a run list, dispatch exactly as before.
    console.log('could not list ' + target.workflow + ' runs; dispatching as before');
    return false;
  }
  if (!active.length) return false;
  console.log('skipped ' + target.workflow + ': run ' + active.map((run) => run.databaseId).join(', ') + ' already queued or running');
  return true;
}

if (require.main === module) {
  main();
}

module.exports = { main, isDisabledError, otherActiveRuns, skipSelfDispatch };
