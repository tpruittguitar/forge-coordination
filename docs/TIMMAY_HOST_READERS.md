# TIMMAY read-only host binding (draft)

`tools/grant-backlog/host-readers.cjs` is executable reader integration, consumed
by `timmay-adapter.bindReaders(options)`. It does not load credentials, private
configuration, environment secrets or a different master. Live launch remains
unconditionally disabled. No production read was performed during this build.

## Checked-in interfaces and access boundary

| Interface | Access and contract |
|---|---|
| Git coordination origin | Existing Git read access to exactly `tpruittguitar/forge-coordination`; `ls-remote origin refs/heads/main`, clean HEAD equality and `git show <SHA>:control/SHARED_HELPER_WORK.json`. No fetch, checkout, commit, claims or route mutations. Remote URL must match the approved HTTPS or SSH spelling. |
| `source-intake/writer-reader.js.read` | Already-authorized Writer GET capability. Only `master`, `writer_status`, `rules` are used. The checked-in Apps Script `doGet` authenticates all actions, including ping; these are not public posting endpoints. |
| `pipeline-observability/canonical-snapshot.js.readCanonical` | Reused directly. Requires complete master marker, unique IDs, parser agreement and raw source lines. Never use writer-reader's identity-only projection for eligibility. |
| `foreman-cockpit/apps-script/PipelineWorklists.gs` | Existing reviewed host module `parseRows`, `build`, `render`, matching coordinator `run.cjs`; computes actual missing groups without a replacement parser. |
| `writer-verify/recovery.js.loadIndex` | Existing authorized read of `tpruittguitar/forge-writer-state/PIPELINE_RECEIPT_INDEX.json`, default main. Validates Git blob SHA-1 and index shape. Permission is repository contents read. No token discovery or CLI auth extraction by this adapter. |
| `state/PROGRAMMED_COORDINATOR.json` | Existing local coordinator state, read before/after the bracket. Publication/clean-checkout guard and unchanged content required; missing or unresolved state fails closed. |

The Writer currently uses a shared authenticated interface, not independently
scoped per-action tokens. The action allowlist is application-level restriction;
it must not be described as a server-enforced read-only credential. GET is not
generally synonymous with safe read: the server has GET mutation actions, and
none of those are allowed here. Public posting excerpts alone may reach a model.
Canonical rows, rules and status stay inside the trusted adapter; no documents,
resume, document_text, profile or evidence-chain actions are requested.

## Host capability contract

The existing authorized coordinator host must provide these in-memory functions;
this draft does not accept a key, connection filename or environment variable:

- `writerRead(action)` delegates to the existing `R.read(action, {key})` inside
  that host's already-authorized closure. Returns `{data,startedAt,completedAt}`.
  The adapter allows only the three actions above, requires `data.ok===true`,
  fresh ordered timestamps and sanitizes transport errors. Do not implement this
  closure by copying credentials into a worker, shell, source file or chat.
- `readReceiptIndex()` delegates to existing `recovery.loadIndex` inside the
  authorized host. Returns `{index,sha}` without credentials. It must perform a
  current read on every invocation, with no cache or anonymous fallback.
- `W` is the existing PipelineWorklists module. `root` is the clean merged
  coordination checkout. No alternative file tree or asserted revision JSON.
- `readPublicEvidence`, `reuse`, and `simulate` remain the existing offline
  adapter dependencies. This binding does not activate Responses transport.

Call `bindReaders({root,W,writerRead,readReceiptIndex,readPublicEvidence,reuse,
simulate})` in that trusted host. The returned `runDry(privateDirectory)` still
uses simulated model output only, and `launch()` always throws
`LIVE_RELEASE_DISABLED`. The optional `git` and `now` dependencies are test seams;
production must use their defaults, not mocked publication checks.

## Consistency checks

The reader brackets full master text, canonical rules, Writer safety/build
state, receipt blob/content, coordination main revision and local coordinator
state. Drift rejects the snapshot instead of combining revisions. Writer status
`now` and processing `ageMs` are observation clocks, excluded from the status
version comparison; build, health, freeze, migration, queue identities and
unverified counts are retained. Both status reads must pass existing
`transactions.healthy`. The complete read must finish within 45 seconds and
reads must be within 15 minutes, never in the future. Master fetch time, optional
count/length/modified-time metadata and canonical source lines are checked.
The existing worker's timeout/AbortSignal prevents late reader results from
starting evidence/model work. No claim of atomic multi-service transactions is
made: equal bracket observations are a conservative admission check, and live
release remains disabled.

Pending receipt entries and non-COMPLETE request entries both fence exact IDs.
An unresolved entry without exact IDs blocks globally. The existing adapter
continues to enforce protected rows, source-version/identity binding, overlaps,
missing fields and original-request fences. No protected row is rewritten or
reclassified by a reader. Public evidence is not requested until these gates pass.

## Exact remaining blocker

There is no checked-in authenticated read endpoint returning authoritative
per-row Never Consider `CLEAR`. `rules` returns canonical policy; it does not
certify a row. `source-trial/preliminary-screen.js.screen` returns
`canonicalEligibility:false`, including when its status is
`NO_CONFIRMED_EXCLUSION`. That must not be converted into CLEAR. The new reader
therefore returns an empty `neverConsiderById` and an explicit
`AUTHORITATIVE_CLEAR_UNAVAILABLE` marker. The worker stops before public evidence
or simulated/API calls for those rows. Fixing this requires an approved existing
policy-screen authority/output contract, not a guessed Boolean or new ledger.

This executor has the code but was not supplied the authorized Writer/receipt
read capabilities; none were discovered in its callable tools. Network
reachability alone cannot authorize those reads. No attempt was made to load
private config or prove access by reading a credential. Production validation
must run within the already-authorized host after route publication authority,
actual Hermes exact ACK and supported policy-screen proof exist. The restricted
OpenAI project credential is a separate gate and cannot authorize Writer reads.

## Reproducible offline procedure

From the staged repository root (including TIMMAY PowerShell with Node 24 and
its already-built checkpoint addon):

```powershell
node --test tools/grant-backlog/host-readers.test.cjs
node --test tools/grant-backlog/*.test.cjs tools/helper-routing/*.test.cjs tools/programmed-coordinator/*.test.cjs tools/pipeline-observability/canonical-snapshot.test.js tools/source-intake/writer-reader-http.test.js tools/source-intake/writer-reader-scope.test.js
```

Fixtures in `host-readers.test.cjs` create temporary synthetic shared allocations,
authorization receipts, exact Hermes ACK, canonical master and receipt index.
They mock the documented Git and authorized read contracts; they cannot establish
production permissions. No credential, external network, API spend, Writer
submission, registry edit, schedule or installation is required. Preserve normal
persistent TIMMAY checkpoint ACLs and same-state resume; do not clear holds or
increase caps to force a launch.

Exact-five update: [API_FIVE_JOB_GATE.md](API_FIVE_JOB_GATE.md). The reader now additionally requires `readPolicy`, bound to `policy-source.read({root: existingPolicyCheckout})`; current policy bytes must match Writer rules. This establishes provenance, not positive eligibility.
