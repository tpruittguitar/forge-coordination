# Grant backlog worker build

`forge-grant-luna` is an offline-tested worker core and an **unwired** direct
Responses transport. The only executable command is synthetic dry-run. This is
not yet an unattended production service. No API call, Writer submission,
allocation change, publication of a helper return, deployment, merge, schedule
change or Hermes action is part of this build.

The selected host is now **TIMMAY (Windows)**. See
[Windows credential adapter and exact no-secret commands](GRANT_BACKLOG_WINDOWS.md)
for the approved Default-project scope, fixed Credential Manager target,
native build, private checkpoint directory and current allocation preflight.

## Reproduce without credentials or network

Node 22 or newer, from an existing coordination checkout:

```sh
node --test tools/grant-backlog/worker.test.cjs
node tools/grant-backlog/run.cjs --dry-run /absolute/private/path/grant-dry-checkpoint
# Repeat the same command: exact same counts, no repeated model simulation.
```

The demo contains 31 synthetic IDs, three batches (15 + 15 + 1), 62 prepared
raw fields, one job reused through Forge's existing degree parser, 30 simulated
model calls and $0 actual spend. Its permanently retained simulated reservation
is $0.061440. Submitted jobs/fields and independently verified jobs/fields are
all zero. The checkpoint holds local preparation, not published helper returns.
No real backlog was researched or declared complete. These synthetic counts are
not the earlier five-job Playground experiment.

## Checked contracts and current blockers

Engineering base: `4e0a5ff12f4de2a4861b9677927cd227d4595584`, resolved by the
fresh shallow coordination checkout on November 22, 2026. The mounted
`foreman-cockpit` was inspected separately and not modified. No AGENTS.md or
SKILL.md was present in the coordination tree; `/workspace/.agents` was empty.
Read fresh shared entry, utility registry/common, enrichment procedure and owner,
DIRECT_WRITER_PROCESSING, production wrapper/protection and Writer outcome and
durable verification contracts. The runtime manifest's ordinary enrichment
lanes are not authority to substitute for this utility task.

**Current ownership conflicts:** `control/AI_AUTOMATION_TASKS.json` assigns
`FORGE_CHATGPT_ENRICHMENT_RESEARCH` to Claude, while
`control/ENRICHMENT_RESEARCH_OWNER.json` and its selected procedure say ChatGPT.
The shared entry explicitly blocks conflicting routing. Historical assignment
ID `GROK-ENRICH-20261101-V1` is provenance, not permission to run as Grok.
No ownership file was changed. No authoritative Hermes/per-worker disjoint
allocation was found in the inspected supported routing contracts.

Other live gates remain unverified:

- Issuance/storage and host verification of the restricted credential: Tim has
  approved the Default project only and the Windows adapter is implemented,
  but its real native execution and project binding remain unverified.
  Exact project identity, grant eligibility and global no-paid-fallback evidence
  remain required at live startup.
  No credential or unrelated authentication store was read. No account/project
  changes were made. A project budget alert is not a billing hard cap.
- A fresh balance observation. $37.47 and November 30 expiry are user-supplied
  verified historical facts, not a fresh API balance check in this build.
- Fresh canonical rows/missing fields, Never Consider evaluation, live Writer
  health/freeze/receipt index and original-request fences on the authorized host.
- Current supported returns-only connection, production protection and the
  independent RESULT/COMPLETE/readback verification path on that host.
- Durable single-host storage and the host integration described below.

`liveBlockers()` always includes `LIVE_RELEASE_DISABLED` even if assertions are
passed in. Neither a JSON attestation nor this dry test enables spending. A
reviewed host integration is still necessary; the live implementation must call
the gates before every batch/request, not just on startup. It must stop on
revocation, ownership drift, unavailable current proof, or balance/expiry drift.

## Limits and accounting

| Limit | Value |
| --- | --- |
| Named worker / concurrent instances | forge-grant-luna / one on one shared durable host |
| Batch size | 15 jobs; resume successive batches |
| Job / batch deadline | 45 seconds / 10 minutes |
| Model / endpoint | gpt-6-luna / https://api.openai.com/v1/responses |
| Service / tools | standard (`service_tier=default`); none |
| Input / output | 8,192 token upper bound / 1,024 maximum output tokens |
| Public excerpt | at most 6,000 UTF-8 bytes; request byte bound plus 512 framing tokens |
| Response body | at most 65,536 bytes |
| Standard input / output pricing | $0.10 / $0.50 per million tokens |
| Per-attempt reservation | $0.002048, retained even after timeout/unknown result |
| Full-batch maximum reservation | $0.030720 |
| Entire checkpoint lifetime cap | $1.00; at most 488 fully reserved model attempts |
| Required remaining-balance cushion | at least $10 beyond the $1 allocation |
| Fresh balance proof | at most one hour old, from authoritative billing evidence |
| Hard cutoff | November 29, 2026 00:00 UTC, earlier than reported expiry |

Rates were checked against the [official model page](https://developers.openai.com/api/docs/models/gpt-6-luna)
on November 22. The standard maximum nominal cost is $0.0013312 per attempt;
the $0.002048 reservation also exceeds a 1.25x input cache-write rate. No cache
discount, Batch/Flex discount, regional endpoint, background execution or Fast
mode is assumed. The checkpoint ledger reserves dollars before invocation,
never frees uncertain reservations, and stops below the cap. Application-level
accounting cannot enforce an organization-wide billing prohibition by itself:
other consumers and delayed billing must be excluded/accounted for by the
approved host/project gate. Do not enable live mode without that proof.

Input contains only reviewed public posting excerpts, source URL and missing
field group names. It never serializes canonical rows, resumes, private job
search artifacts, full state, credentials or arbitrary metadata. The trusted
host must obtain those excerpts from the existing public source-evidence path;
`publicReviewed=true` alone is not an independent privacy review. Signed/query
URLs and Drive/mail sources fail closed. Unsupported source URLs remain held.

Degree requirement, equivalence and confidence are recorded separately. A
required degree with unknown equivalency is not a reason to erase the supported
degree requirement. Absent equivalency is never inferred. Partial excerpts
cannot establish NOT_STATED or REQUIREMENTS_REVIEWED. Raw-field evidence is
checked by the existing helper-fields validator; Writer still independently
rechecks source and policy before any effect. This worker proposes no fit,
salary estimate, score or protected decision.

## Host integration still required before live release

The adapter boundary in `worker.cjs` is intentionally read-only. A production
adapter must reuse the existing coordinator, not become another master/router:

1. Resolve fresh shared entry at one current main SHA. Require registry and owner
   agreement; use `Enrichment.validateWork` and the supported allocation output.
   Supply the *complete* authoritative per-ID allocation, including Hermes and
   other active helpers. `allocation()` only consumes a snapshot; it does not
   assign jobs. No heuristic hashing, inferred remainder or automatic handback.
   The current repository does not provide a verified worker/Hermes split for
   this task, so do not invent its proof string or mark it complete.
2. `authority(signal)` and `current(id, signal)` must read current membership,
   exact canonical row, current missing groups and Never Consider through
   existing readers/screens. Reuse `Transactions.fenceIndex` and live receipt
   state for original-request fences; snapshots are not substitutes for live
   Writer authority. Check protected decisions before public-source work.
3. `reuse(current, signal)` tries retained identity-bound posting captures,
   `Source.verify/capturedSource`, current accepted evidence and code parsers
   first. `reuseDegree` supplies a narrow real parser fast path. If supported
   current evidence resolves everything, spend zero and fetch nothing. Never
   send a resume or private artifact through this interface. Unresolved source
   access is recorded as a hold; the model has no search tools.
4. Replace synthetic `simulate` with the reviewed `responses.response` transport
   only after live gates pass and the reservation is durable. The host passes
   scoped `secureRuntime(use)` access; no CLI key, .env file, credential creation,
   secret-return tool, credential logging, or unrelated auth-store reads. The
   fixed project header and fixed standard model have no fallback. Provide an
   abort-aware transport and persist usage/response identity separately; do not
   mistake timeout for no bill. Auth/credit/429 failures halt globally, including
   future resumes, until independent review. There is no automatic retry.
5. Prepare the existing `forge.enrichment-helper-batch.v1` envelope (at most 15
   ready jobs). Validate and durably deliver through the existing supported
   receipt route, then use the authorized locked returns-only wrapper from
   DIRECT_WRITER_PROCESSING. The current core retains one validated envelope per
   prepared job in its checkpoint; it does **not** deliver any. Do not publish
   dry/synthetic envelopes to a collector path. No direct master or Writer POST
   is implemented here. No new endpoint or second production lock.
6. Use the coordinator's own durable transaction ledger for actual Writer
   accounting. Keep envelope `writerSubmitted=false`; separately count exact
   pending/submitted/independently verified jobs and fields from original
   request IDs. VERIFIED requires original RESULT SUCCESS, independently later
   COMPLETE, and exact post-COMPLETE row effects. Unknown writes stay fenced;
   never generate a replacement request or infer completion from row presence.

The production adapter, collection/delivery wiring and live accounting are
remaining engineering work, not features proven by the synthetic fixture.

## Durable operation and recovery

Place the entire checkpoint directory on an existing approved persistent volume
outside both public repositories, with owner-only permissions. Use one fixed
directory for this named worker on one host; different directories or hosts
would bypass the local single-instance lock. The reviewed host must enforce
that fixed location. Keep the existing production mutation lock separate and
acquire it only through the existing Writer wrapper, never during research.

Checkpoint saves use exclusive sibling files and fsync. POSIX uses atomic rename
and directory fsync; Windows uses the native write-through replacement described
in the Windows runbook. Filesystem/durability errors stop processing. Test those
guarantees on the intended volume: native execution is not yet validated on
TIMMAY. Preserve staging files after any
failure. The existing run lock never expires or steals an abandoned lock.

On normal exit the same directory resumes without repeating any recorded job.
After a crash, reconcile the abandoned lock with the owning process first;
do not remove it merely because it is old. MODEL_IN_FLIGHT becomes
MODEL_OUTCOME_UNKNOWN and is not replayed. Holds/timeouts retain explicit review
conditions. Budget/auth stops persist across restarts; do not erase checkpoints
to get more budget. Independent review may create a separately accounted retry
only after proving its safety and preserving the old evidence/reservation.

Back up/export the checkpoint, lock and any staged files together while the
worker is stopped, and verify restored hashes before resuming. A local artifact
or cloud container is not durable hosting and cannot be assumed to run forever.
No supervisor/schedule was installed here. Use the existing approved host after
the integration and gates are reviewed, with explicit lifecycle and stop handling.

**Smallest next action:** resolve the contradictory enrichment owner using the
existing shared authority and obtain the supported exact per-ID worker/Hermes
allocation. This requires no model spend, credential disclosure or Writer write.
Then wire and test the host adapter against read-only current state before
considering a separately authorized first live batch.
