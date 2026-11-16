# Exception reconciliation evidence planning

`tools/programmed-coordinator/exception-reconcile.cjs` exports `plan({root, pins, exceptionIds, now})`. This is a read-only forensic API, not a recovery command. It does not write a file, stage a conflict, continue a rebase, acquire/release locks, publish, call Writer, or assert canonical completion. The automatic publisher and its fail-closed merger are unchanged.

Each of `pins.base`, `pins.left`, `pins.right`, and `pins.current` must contain a full 40-character Git commit, the Git blob ID for `state/AI_EXCEPTION_WORK.json`, and the SHA-256 of its exact bytes. The implementation currently supports SHA-1 Git repositories only. Supply the exact disputed case IDs. Current must descend from at least one side, and all sides must descend from base. Neither ancestry nor timestamps establish source truth.

The planner accepts only a narrow closure versus evidenced service conflict with unchanged bindings, starting from ACTION_REQUIRED. It preserves the nominated current open/waiting cases verbatim. Unknown changed fields on disputed cases, expired waits, missing/rewritten evidence, hidden newer evidence and equal-time divergent evidence are refused. Unrelated case additions/changes and top-level semantic changes (including dispatch) are retained in full snapshots and explicitly listed as UNASSESSED residual changes with a blocker; they are never merged or declared harmless. Normal observation metadata may differ. This intentionally cannot plan every production conflict.

The result contains a SHA-256-addressed body with complete original snapshot bytes and refs, all retained AI exception run/review bytes and origin commit/blob refs, exact disputed historical closures, and current cases. No file is made immutable merely by returning this object: a future authorized consumer must persist the content-addressed bundle in private immutable storage and verify it. The bundle can contain sensitive operational data. Do not commit real bundles, attach them to public PRs, or log them to public CI. Public tests use synthetic fixtures only.

Every result is `executable: false` and records unresolved closure escrow, not a closure decision. All returned bytes must be retained together. This API neither merges other accounting nor changes its files. It cannot prove candidate coverage, actual row completion, same-request replacement obligations, or truthful external evidence merely from a valid hash/review. In particular, a transaction-level VERIFIED receipt can include held rows; it cannot establish completion for every identity.

Before any future apply implementation, separately establish current candidate coverage and original row-level obligations, exact Git/index/worktree fingerprints, a shared-lock protocol, durable private escrow, and atomic mutation with a second fingerprint check. A failed or ambiguous condition must leave the operation and lock intact. Do not use this plan as permission to resume the publisher.

## Separate candidate coverage correction

The relevance intake plan candidate filter now also recognizes exact `HELD_WRITER_IDENTITY`. It uses the existing key, original request ID, reason (or existing `WRITER_RECONCILIATION_REQUIRED` default), and sourceProof-derived hash unchanged. It does not rename/reopen a prior differently bound case. Existing terminal-item and drain-owned suppression still apply. A matching incomplete-evidence review survives sync while the same held obligation remains present. This correction performs no Writer calls or replay and does not resolve the held identity.

## Checks

Run the new `exception-reconcile.test.cjs` and `held-identity.test.cjs` alongside the existing coordinator/routine-handoff suites. The normal programmed-coordinator CI glob includes both. Run the change-register preflight for the accompanying change record. A passing synthetic plan is not evidence that a private live conflict is safe to apply.
