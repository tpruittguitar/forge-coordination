# Accounting publication conflict boundary

The existing programmed-coordinator publisher can resolve a relevance-guard timestamp conflict together with an exception-work conflict. It never runs the coordinator again or invokes Writer, and it does not change schedules, policy, transaction checkpoints, or immutable receipts.

The guard still requires equality of every field except `at`, including unknown fields. Exception-work recovery is deliberately narrower than recursive JSON merging:

- All three inputs must have source-hashed case identities, noncanonical completion flags, recognized statuses, and accurate derived counts.
- A case cannot disappear, change binding, or lose an existing review/attempt pointer. Concurrent same-case changes are allowed only for monotonic `lastSeen` observation versus review/status/attempt updates. Other overlaps stop.
- Changed reviews must match their immutable record, its content-hashed path, source binding, and the existing review validator. Older or equal-time divergent decisions stop. A newer immutable review cannot be hidden behind the selected pointer.
- Changed attempts must match a checkpoint projection and the original START selection hash/binding, source evidence, and time bounds. Review-linked attempts also validate their review. Existing evidence files are never rewritten.
- Dispatch is atomic and must have source-bound review/attempt evidence when changed. A proved service advance may cross only the specific same-observation normalization from `SOURCE_BOUND_ATTEMPT` to `ACCEPTED_IMMUTABLE_REVIEW`. This is not a general newest-timestamp winner. Regressions and equal-time different service decisions stop.
- A one-sided `SOURCE_BOUND_ATTEMPT` cursor may serve a different case or kind after the last review. Its served case, source version, and observation time must match the immutable START/CHECKPOINT attempt proof. Its retained review kind and earlier-or-equal time must independently match an accepted immutable review in the same work snapshot. The served case does not need its own review. Merely relabeling this mixed cursor as an accepted review is not a valid normalization.
- Counts are recomputed from the preserved cases only after all inputs and resolutions validate. Unknown top-level fields remain atomic. Every conflict is validated before any conflict file is staged.

Conservative unsupported cases require reconciliation: expiring waits; awaiting-Tim decisions; dispatch without provable retained review metadata; unknown dispatch fields; new cases already carrying review/attempt pointers; simultaneous semantic updates; conflicting closures; missing or malformed proofs; unrelated conflicted paths. The publisher still rejects a pre-existing interrupted rebase before doing work. This change cannot automatically clear an already-stopped production checkout; that requires a separately authorized, audited operator reconciliation. An automatic stop preserves the checkout and lock. It is not permission to replay the run, discard retained commits, or weaken gates.

## Verification

Run `node --test tools/programmed-coordinator/{publish,exception-merge}.test.cjs`. Tests use genuine local review/START/CHECKPOINT producers and isolated bare Git repositories, including two-file rebases, repeated push races, immutable transaction preservation, malformed proofs, lost cases/attempts, newer reviews, dispatch provenance, guard policy/disabled-rule changes, and unrelated conflicts. No production credentials or canonical calls are used.

Run the complete Node command in `.github/workflows/programmed-coordinator-test.yml`, Python unit tests, and `python scripts/build_runtime.py --check` before requesting review. A draft PR and passing local fixtures do not establish production adoption. Deployment/merge and any retained production recovery remain separate operations.

### Independent exception event dimensions

The exception accounting resolver additionally preserves these narrow overlaps:

- A source case's coordinator-only `attempts` and `lastSeen` advance alongside
  an independently validated `SOURCE_EVIDENCE` review/attempt. The counter must
  be a strictly increasing safe integer, equal the current coordinator item's
  count with the exact same source version. The case must still be a candidate.
- A later source-bound attempt can remain inert history on a case independently
  marked `NO_LONGER_OPEN`. The coordinator report must match the closure's run
  and observation time, and its candidate computation must still exclude that
  exact case. No status, review decision, binding, or canonical completion is
  inferred from that attempt.

Both require the existing local coordinator report/state schemas and a report
within one second of the coordinator accounting timestamp. Candidate membership
is computed lazily once per publication merge. Missing/stale evidence, changed
bindings, concurrent decisions, unknown fields, regressed counters, or a current
candidate contradicting closure remain conflicts. Immutable review and attempt
proof validators are unchanged. The resolver never posts, retries, or releases
Writer requests. This does not repair a previously interrupted checkout.
