# Intake assignment health versus code correctness

Mutable assignment ledgers are operational state, not deterministic PR test fixtures. Code tests now exercise the same overlap, terminal/request fence, source presence and queued-submission invariants using isolated fixtures.

`node tools/automation-health/intake-assignments.js <repo-root>` reads the current assignment and dependencies without changing them. It exits nonzero for `ACTION_REQUIRED` or `UNKNOWN`. Results include counts, bounded findings, observation time and input hash. Disabled routing is `INACTIVE`; repositories without this assignment are `NOT_CONFIGURED`.

The existing scheduled pipeline-evidence workflow includes the diagnostic in `PIPELINE_EXECUTION_EVIDENCE.json`; relevant ledger pushes also trigger it. The existing Needs Tim refresh separately inspects current inputs and emits an ACTION card for unhealthy or unreadable assignments. Healthy current evidence clears that card. No production problem is suppressed or repaired by passing code CI.

Reconciliation remains scoped to affected assignments and original request evidence. This change does not release fences, replay requests, edit ledgers, enable helpers or submit Writer work. Unrelated implementation PRs need not wait for operational ledger reconciliation.
