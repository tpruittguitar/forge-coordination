# Gofer: admit work before investigation

At the fresh shared revision, before loading source/resume text, rereading prior
Writer receipts, or downloading the whole master for AI inspection, run:

```sh
node tools/research-preflight/gofer.cjs <repository> --state-dir <existing-private-gofer-state> --private-dir <existing-private-coordinator-evidence> --run-id <FORGE-GOFER-CHATGPT-run>
```

The private directories must already be authorized on this executor. Never copy
credentials. Omit `--private-dir` if unavailable and report that original local
acceptance evidence was not checked. The command records an immutable preflight
receipt and a compact evidence-watch checkpoint, sends no network requests, does
not acquire the production lock, and does not mutate shared queues or canonical
data. Output contains IDs, counts and hashes, not private original responses.

- `IDLE`: stop quietly after normal compact terminal accounting. All source gaps,
  returned work, requests, original payloads and pending obligations remain.
- `INPUT_REFRESH_REQUIRED`: perform only the named code refresh, then rerun the
  gate. Stale/missing input is not proof of zero work. It does not authorize broad
  AI investigation. A repeated unchanged blocker stays quiet after its first
  report. Other actionable work may still proceed.
- `WORK_AVAILABLE`: handle the listed exception IDs and research role IDs. A
  diagnostic fingerprint never suppresses eligible work.

The native heartbeat currently launches a model before it can run this command.
This avoids repeated expensive investigation after bootstrap, not all model
startup usage. No schedule, cadence, native enablement or owner changes are part
of this fix. Verify actual invocation evidence before claiming native adoption.

## Exception retries

The gate uses the existing immutable source-bound exception reviews. Only Gofer's
assigned cases are selected; outcome-tracker mail and intake-drain work keep their
owners. A future `retryAfter` waits until due. Untimed source waits do not reopen
merely because time passed. Tim decisions wait for the actual resolved answer.

For Writer cases the watch hashes only the original request's saved transaction,
payload/acceptance and exact checkpoint/verification/refusal receipts. Global
HEAD, observation timestamps, unrelated rows and the production lock are not
retry triggers. Newly available original evidence opens a bounded reconciliation
on first bootstrap. A changed case remains actionable until a new durable review
acknowledges it; running the gate cannot consume that obligation. Include the
returned `retryEvidenceSha256` in a new waiting review to bind the next retry to
what was actually inspected. Evidence availability is not verification or replay
permission. Use the existing original RESULT + independent COMPLETE + subsequent
exact-row proof path.

The preflight watch is only an admission aid, never the original-request ledger.
Deleting or losing it cannot release a fence. Unknown pending originals absent
from the exception queue produce a code-refresh blocker instead of a false idle.

## Current salary gaps, independent of the write lock

Before a global idle conclusion, the gate requires a fresh complete canonical
research plan. An empty recovery report or historical assignment cannot prove
that no new gaps exist. Obtain one fresh canonical snapshot through an existing
authorized read path, reuse it within its freshness window, and keep large rows
out of AI context. Use parsed full canonical rows,
not identity-only `master.rows`. The source must be `CANONICAL_WRITER_MASTER` with its real read timestamp, or
`CANONICAL_DRIVE_MASTER` bound to the exact canonical Drive file ID, SHA-256 and
actual observed/download time. Either must be at most 15 minutes old. Document
modification time is not observation time. Never relabel an old snapshot.

```sh
node tools/helper-routing/enrichment-plan.cjs plan <repository> <snapshot.json> --output <private-plan.json>
node tools/research-preflight/gofer.cjs <repository> --snapshot <snapshot.json> --state-dir <private-gofer-state> --private-dir <private-coordinator-evidence> --run-id <new-run-id>
```

The planner compares fresh canonical protection/missing fields, current recovery
status/retry times, returned work, current reservations and every original pending
write fence. It includes authorized `NOT_YET_ATTEMPTED` salary gaps as well as
`SOURCE_RESEARCH_REQUIRED`. It does not redo returned evidence or infer that an
inaccessible posting states no pay. Every new membership item carries its exact
source fingerprint. The supported accounting owner publishes appended membership
before a helper return references that revision; there is no separate evidence PR
requirement. Existing pending items and historical provenance stay unchanged.

Read-only research can run in an isolated workspace while the production lock is
held. Save complete source-bound research durably. Use the current salary policy,
posted evidence before estimates, and existing estimator/Writer safeguards. The
helper source adapter must not promote AI-proposed numeric fields to verified
posted pay. A lock defers submission only. Use the supported Writer adapter when
available, without starting a competing processor, replaying an unknown outcome,
or changing protected decisions.

## Reporting and execution proof

Record `rolesResearched`, `salaryEstimatesPrepared`, `submitted`,
`independentlyVerified` and `receiptChecks` separately, with exact durable source
and request references. A preflight emits all five as zero: planning and receipt
checks are not salary progress. Never count an accepted, uploaded or prepared
batch as independently verified. Meaningful results, new failures and decisions
can notify Tim; unchanged/idle runs cannot.

Test evidence and candidate-branch runs are not proof the scheduled task adopted
this code. Verify two unchanged invocations with no repeated AI investigation,
then actual eligible salary preparation/submission where available. Report any
remaining merge, access, live-data or original-evidence limit honestly.

## Durable policy preparation without Writer

The existing pay runner supports `--prepare-only`. It skips original receipt
recovery and all POSTs, keeps original pending requests fenced, and durably saves
complete source-bound salary preparation. It does not convert AI-proposed numbers
into posted pay. Existing normal pay processing consumes compatible preparation
through its original Writer path with current policy/input/row/protection checks.

For a captured fresh canonical Drive snapshot and guarded research plan, use:

```sh
ENRICH_FC_DIR=<current-policy-checkout> node tools/enrich-ats-pay/run.js --prepare-only --snapshot <manifest.json> --plan <private-plan.json> --preparation-dir <private-output-directory> --saved-evidence-only
```

The manifest names the exact local master text and its verified source metadata.
This route loads no Writer connection and makes no network requests. It reuses
existing saved posting/comparable/BLS evidence and retains remaining source gaps.
It must not use an old snapshot timestamp or the synthetic-master test flag. Keep
private outputs outside the public checkout. Prepared envelopes contain only safe
role identity, generated fields and evidence hashes, not full canonical notes or
private original responses. Keep complete evidence in its existing authorized
source stores.

Saved preparation is not canonical completion. A changed policy, source or row
may require safe recomputation, including when live archive anchors were absent
from a captured snapshot. Missing original acceptance still prevents a replay.
Normal live processing remains with the existing authorized owner; never launch
a competing Writer just to demonstrate a prepared estimate.
