# Enrichment membership observation repair

The November 11 diagnosis found 719 entries but 715 distinct IDs in `control/ENRICHMENT_HELPER_WORK.json` (blob `c53cbc2ae9685d52cb7a259fcd285a7675fb2d62`). Two publications independently appended the same four salary research obligations. The pairs differ only in `canonicalObservedAt`. This is not a duplicate canonical job: the invalid assignment inventory blocks the enrichment validator, including the production pay worker's `researchIds()` call and ordinary coordinator replenishment.

The explicit repair handles only `V2I-19960034BA90`, `V2I-B57B353BDDEF`, `V2I-1DC4DBFB8595`, and `V2I-2B9B288A5012`, under the existing ChatGPT assignment. Each must occur exactly twice, remain `ASSIGNED`, request only `SALARY`, have no prior attempts, and agree on every field except a valid observation timestamp. Unknown duplicate metadata, other duplicate IDs, pending/returned/protected states, changed provenance, or a changed approved source blob stop the operation. It keeps the first occurrence to preserve existing first-match behavior, without changing its timestamp or status.

Every other item and top-level field is preserved. An immutable `receipts/ENRICHMENT_MEMBERSHIP_REPAIRS/<run-id>.json` stores both observations, original indices, before/after blob and content hashes, and explicit zero-write accounting before the membership file is replaced. Original Git history remains intact. Neither a repair plan nor its audit claims research completion or canonical admission. The shared-helper pool, Grok returns, transaction ledger, original request IDs and Writer receipts are outside the repair's write scope.

## Review and deployment are separate from application

This implementation does not repair membership during merge, normal coordinator startup, or a workflow. Applying it requires a separately reviewed concrete action, target blob, run ID and normal production environment. Do not dispatch, restart, kill or replay anything to activate it.

1. Let any coordinator already running old code finish naturally, including its final accounting publication. A newly merged publisher does not constrain code already loaded by that run. Confirm its exit and the existing production lock's ordinary release. If it retains unpublished changes or an interrupted rebase, reconcile those first without discarding evidence or rerunning Writer.
2. Confirm the existing production checkout naturally adopted the merged repair and publisher guard, is clean, has no retained commits/operation, and matches live `main`. Do not apply from a separate stale checkout or a draft PR. If an old publisher remains active, wait.
3. Read the current membership blob and run the read-only plan. Review the exact before/after hashes and IDs. The diagnosed blob plans 719 to 715 entries, with output blob `35a76dbc905052e54ecaf862f838b4f9b1453929`. If the input changed, produce and review a new plan; never silently substitute a new approval target.
4. After explicit application approval, use the command below in that same production checkout with its existing `FORGE_PRODUCTION_LOCK` configuration. The command independently acquires the current policy's shared lock, then rechecks the clean merged head and exact source blob. A held/abandoned lock stops it; no expiry or deletion is allowed. It retains the lock through audit creation, replacement, rechecks and guarded accounting publication.
5. Confirm the published membership has 715 distinct entries, the audit is present, and subsequent normal runs adopt it. This proves accounting repair only. Use normal independent Writer evidence for actual job outcomes.

Read-only planning:

```sh
node tools/helper-routing/enrichment-membership-repair.cjs plan <repo-root> <approved-current-blob-sha>
```

Explicitly approved application, never automatic:

```sh
node tools/helper-routing/enrichment-membership-repair.cjs apply <repo-root> <approved-current-blob-sha> FORGE-MEMBERSHIP-CHATGPT-<unique-suffix>
```

Any failure after the repair starts retains the checkout, audit/commits, and shared lock for accounting-only operator reconciliation. Inspect the actual outcome before retrying. Do not clear that lock, roll back a canonical row, or replay submissions to recover publication. A pre-mutation rejection can release its own newly acquired lock safely. Successful publication releases it normally.

## Prevent recurrence without blocking unrelated accounting

The coordinator publisher validates changed enrichment membership before staging, from the actual staged blob before committing, and from the final committed blob after every rebase and before push. Two individually valid appends can merge cleanly into duplicate IDs; that now stops publication while preserving both retained observations and original checkpoints. The guard never silently chooses one obligation. An invalid membership already inherited from main does not prevent unrelated receipts from being published, but any local change to it must validate.

This protects the supported updated coordinator publisher. It does not retrofit an old running publisher or constrain independent writers that bypass it, which is why the rollout sequence above is required. AUTO intake stages only `receipts/auto-intake` and `state/INTAKE_DRAIN.json`; its run-record publisher does not write enrichment membership. The pay workflow publishes its pay state/reports and named reference paths, not this membership file.

LF attributes pin both the membership and audit paths so the approved Git blob binding survives Windows `core.autocrlf` settings. The repair does not release salary obligations to the model, change research ownership or weaken current source/Writer gates.

## Checks

Run `node --test tools/helper-routing/enrichment-membership-repair.test.cjs tools/programmed-coordinator/publish.test.cjs`, the full programmed-coordinator test command, Python tests and runtime consistency check. Tests cover unchanged protected/returned/pending items, unknown metadata, hash leases, lock loss, concurrent file changes, immutable audit collisions, apply failures, LF bytes under a real CRLF checkout, clean Git rebase duplication, push-race retries and retained original transaction evidence. All mutation/publication tests use isolated local fixtures; they do not invoke production Writer.
