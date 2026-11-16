# Preserve an earlier Writer wait review across evidenced closure

A coordinator can stop observing a Writer exception after its original effects
are independently reconciled, while a concurrent exception reviewer publishes
an earlier WAITING_SOURCE_CHANGE review. Both facts must survive publication.

This resolver extension permits only that narrow two-dimensional change:
- closure changes only status and closedAt, as in the existing closure rule;
- the other side changes only status and review on a Writer case, optionally
  adding a source-bound lastAttempt;
- its immutable latest review validates, is WAITING_SOURCE_CHANGE, has no timed
  retryAfter, and does not postdate the closure or regress a prior review;
- a changed lastAttempt validates its immutable start/checkpoint receipts and
  projection, does not postdate closure, and advances any existing attempt;
- the exact coordinator report/run/timestamp and current state recompute the
  candidates, proving that this exception is no longer observed.

The output retains the closed status and original review as history. It does
not infer canonical completion, discard attempts, reopen work, release fences,
or replay writes. Missing evidence, active candidates, later or competing
reviews, unknown field changes and unproved or later attempt changes remain conflicts.

Tests include real Git publication/rebase, unchanged historical attempts,
symmetry, combined review/attempt history, and negative proof/timing/active-candidate/unknown-field scenarios.
