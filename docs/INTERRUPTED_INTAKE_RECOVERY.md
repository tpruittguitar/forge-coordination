# Interrupted automatic intake

An intake response can be accepted and independently completed while the calling workflow stops before updating its local accounting. Previously every subsequent run stopped behind that unfinished batch and exited successfully. Increasing schedule frequency could not recover it.

`tools/source-intake/interrupted-recovery.js` now reconciles that bookkeeping before new admission. It binds the unchanged candidates to their saved hash and ordered request IDs, then inspects every captured response. Accepted inserts require their original write ID, an independently COMPLETE receipt index, the same write ID in durable request_result, and a later exact row readback. Pending entries never trigger request_result. Captured explicit no-write outcomes must have no master transaction. Complete authenticated master/archive snapshots reconcile the attempted subset against the original before snapshot.

Only a fully accounted attempted subset releases the latch. An immutable recovery proof is saved first, and the original run retains every response and halt. Untouched request IDs feed the existing carry-forward mechanism, which reapplies current admission, evidence and Writer gates. Recovery makes no POST and does not mark untouched jobs complete. Unknown transport, conflicting identity, missing acceptance, changed candidates, health failures and concurrent bookkeeping changes remain blocked. Existing transport-unknown recovery remains separately scoped.

An unresolved latch or missing Writer credential now produces a nonzero workflow exit. A successful source capture or green unrelated workflow is never evidence of successful admission. The release switch remains unchanged.

Validation: existing intake/discovery/coordinator/routing tests plus focused recovery tests cover read-only completion, untouched carry-forward, pending receipts, both write-ID bindings, identity mismatch, health, concurrent state changes, unknown responses and changed candidate bindings. Production recovery must additionally be demonstrated with original receipts and current exact rows.
