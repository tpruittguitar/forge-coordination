# Lightweight research preflight

Before loading resumes, collecting source text, or starting browser research, run:

```sh
node tools/research-preflight/check.cjs <TASK_KEY> [fresh-repository-directory]
```

Use the existing shared entry, one freshly resolved main revision, registered task
procedure, and bounded workspace first. This local, read-only check does not
launch network research, mutate a queue, acquire a production lock or call Writer.
It avoids full research setup, not the required routing or workspace bootstrap.

Supported research stages are the three intake-drain tasks and ChatGPT
enrichment research. All other tasks are deliberately outside the gate, including
the outcome tracker: its exception ledger may lag newer mail/source reports, so
an empty ledger alone must never suppress its work.

- `RESEARCH_REQUIRED`: use the lane's normal queue and continue successive chunks.
  An unchanged fingerprint never suppresses eligible work or imposes a quota.
- `IDLE`: there are no currently eligible research items. Skip only research setup
  for that stage. Retain waiting, proposed and pending obligations. Record the
  compact result in the lane's existing terminal accounting, remain quiet unless
  there is a meaningful result/blocker, and release a clean completed workspace.
  This is not canonical completion or permission to cancel another duty.
- `INSPECT_QUEUE`: a source, route, review, status or freshness check needs normal
  inspection. Missing/stale/error data never proves zero work. Keep other lanes
  moving and report a concrete blocker when needed.

## Change and retry behavior

Intake uses the existing queue's source-version comparison and immutable reviews,
not a second cache. Changed source/resume/fence inputs reopen only the affected
case. Unchanged source-bound waits remain held; valid `retryAfter` timestamps and
failed independent-source-validation timers become eligible at the exact boundary.
The compact result includes the earliest future research retry. There is no new
schedule: the next existing invocation evaluates the clock again.

Enrichment uses the current enabled effective ChatGPT assignment. Assigned items
remain eligible; returned, consumed, released, protected and already-complete
items are not reoffered merely because the automation woke. Missing current
ownership or an obsolete empty assignment requires inspection.

Separately, exception queue reads and progress accounting now re-evaluate due `WAITING_SOURCE_CHANGE` research timers
without requiring the coordinator to rewrite the snapshot first. They do not
reopen `AWAITING_TIM`, closed or untimed waiting cases. Code retries do not release
AI holds. New source bindings still come from the normal coordinator. Research
proposals remain open until existing independent verification changes them.

A diagnostic fingerprint and counts allow comparison without dumping whole cards
into model context. Never use the fingerprint, main SHA, elapsed time alone, or a
prior idle result as permission to skip current eligible work. Each invocation
recomputes eligibility. An empty state older than 24 hours, future-dated state,
unknown status or invalid review cannot yield IDLE; the intake queue retains its
existing current-upstream validation too.

## Preserved work and limits

- No new service, automation, daily/run cap, schedule or ownership change.
- No Writer write, lock change, replay, canonical completion or automatic closure.
- Existing source refusals and retry-after rules still apply after eligibility.
- No change to mail capture, calendar/manual-note coverage, code processing,
  source verification or original pending-request reconciliation.
- No measured native-run token, time or throughput savings are claimed. Local
  tests establish selection behavior; deployment/adoption needs review and merge.

Run `node --test tools/research-preflight/*.test.cjs` and the existing intake,
helper-routing and routine-handoff suites. The programmed-coordinator CI includes
the new regression tests.
