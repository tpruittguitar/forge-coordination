# Job process flow measurement

Tim requested completed-job output and actual waiting queues, separate from Writer internals.

An eligible open canonical job occupies exactly one position: waiting for positive posting verification; verified and waiting for enrichment; evidence complete and waiting for review; or closed posting outside processing. Applied, declined, rejected and protected records are excluded. Review-ready is evidence readiness, not an application recommendation. No canonical job is changed by this observer.

Each observation records identity membership. For every queue: opening + arrivals - completed - other exits = closing. Other exits include closures, eligibility changes, regressions and disappearance; disappearance is never completion. Snapshot reconciliation does not establish the reason for an unexplained departure. The identity history remains in Git.

Completion output counts observed false-to-true transitions, once per job per retained window. Existing completed stock, newly seen already-complete records, partial field updates and receipt counts are not output. Sampling can miss intermediate states, so output is a lower bound, not an exact event ledger. Full 36-hour rates remain unavailable until the observation window exists without a known collection gap; whole-number rounding is display only. Baseline queue age is an observed minimum, not true arrival age.

Discovery spans sources with different identities. Current discovery throughput covers recorded automatic source reports; recovered email intake backlog is a known minimum. Neither is asserted to reconcile the entire upstream population. A future canonical candidate admission/disposition event ledger is required to close that coverage gap. Never silently substitute reports or Writer requests for jobs.

The 2026-10-31 initial snapshot partitions 946 open records into 347 awaiting posting verification, 165 awaiting enrichment, 342 evidence-ready for review and 92 closed postings. These counts sum to 946; the former display incorrectly labelled all 946 as enrichment backlog. Historical completed output cannot be reconstructed from update totals.

Enrichment runner corrections: try saved direct posting evidence when the original URL is a tracking link; only apply retry cooldown after an actual fetch; recheck protected/closed state before submitting; recover missed scheduled starts without dispatching duplicates. These fixes do not bypass Writer gates or alter eligibility.

Application outcome events in state/APPLICATION_OUTCOMES.json require verified personal contact and a canonical applied job identity. Initial coverage is incomplete and is displayed as a minimum; automated job recommendations are not recruiter contacts.
