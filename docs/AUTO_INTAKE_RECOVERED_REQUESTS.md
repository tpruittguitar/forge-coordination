# Recovered existing intake requests

An AUTO run can encounter a deterministic request already completed by an earlier run even when the saved acceptance response is missing. Do not submit it again, invent an acceptance response, or clear a latch from COMPLETE status alone.

Operator recovery must bind the original candidate file/hash, independent durable receipt and write ID, exact canonical employer/title/location/source URL, prior-run provenance, and before/after population accounting. Keep original results and halts unchanged. Preserve untouched candidates in `carryForwardRequestIds`; do not mark the whole candidate list processed.

For an existing row independently proved to predate the interrupted run, the operator reconciliation may record `preExistingCompleteRequests` entries with `requestId`, `primaryId`, `receiptState: COMPLETE`, `exactRowVerified: true` and a `proof` path included in that reconciliation's `proofs` list. The reconciliation status must be `RECONCILED_INTERRUPTED_RUN_WITH_CARRY_FORWARD`.

`known-requests.js` includes these proven requests alongside captured Writer responses when selecting new discovery and carry-forward work. This prevents a repeat stop on the same recovered request. It does not automatically resolve new uncertain writes, change Writer admission rules, create an acceptance response, or discard the untouched tail. Malformed recovery bindings fail closed.

October 29 recovery: `receipts/auto-intake/probes/20261029T1952Z-operator-recovery.json` proves nine writes from the interrupted run, one pre-existing completed request, two captured no-write outcomes and thirteen untouched candidates. No Writer POST was made during recovery.
