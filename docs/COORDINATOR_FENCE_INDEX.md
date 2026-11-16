# Coordinator fence lookup lifetime

The coordinator indexes unresolved primary IDs once per returned-evidence inspection pass. It includes the same transaction ledger, pay pending writes, helper-consumption states and legacy checkpoint forms as the prior lookup. Proven releases and verified checkpoint markers retain their existing meaning. Malformed ID collections fail closed, rather than accidentally indexing string characters.

This is not a process-global cache or permission to replay. Inspection only prepares candidate evidence. Every submission builds a new fence index **after** its fresh canonical snapshot and before synchronous envelope validation. A newly added checkpoint between inspection and submission therefore still blocks the affected ID. Each later submission repeats that fresh check. Lock ownership, source binding, protected rows, Writer health and independent completion/readback checks remain unchanged.

Inspection may defer an ID whose earlier fence is released during that pass; the next pass sees the release. It may prepare an ID newly fenced during a network source read, but the fresh submission check rejects it before POST. No inspection index is passed into submission.

A deterministic fixture checks 1,000 candidate lookups over 250 checkpoints: only 250 checkpoint reads occur in the indexed pass, rather than repeating the full scan per candidate. This is a disk/JSON-work reduction, not a measured production runtime promise.

Tests: `node --test tools/programmed-coordinator/fence-index.test.cjs tools/programmed-coordinator/coordinator.test.cjs tools/programmed-coordinator/throughput.test.cjs tools/programmed-coordinator/captured-source.test.cjs`.
