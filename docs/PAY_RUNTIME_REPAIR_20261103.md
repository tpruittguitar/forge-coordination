# Pay worker runtime repair

Five enrich-ats-pay runs were cancelled at the 25-minute job limit after #207:
41553038770, 41556173430, 41566348843, 41572414763 and 41575367966. Their tests
passed; enrichment emitted no phase progress and report publication was never
reached. The last published report therefore understated actual Writer activity.
The receipt index records 464 COMPLETE child aliases in 19 transactions from
those runs. Cancelled workflow status does not mean those writes were cancelled.
All 464 were bound to saved Writer events and durable COMPLETE results, and all
464 exact IDs and salary values were read back. No original request was replayed.
Evidence: receipts/CHATGPT_PAY_CANCELLED_RECONCILIATION_20261103.json.

The worker now shares a deadline across nested research, network headers and
bodies, Writer readback/POSTs, receipt polling and fence/cooldown waits. Research
stops after nine minutes; Writer operations stop at eighteen minutes from startup,
leaving room for publication before twenty minutes. The Actions emergency timeout
remains twenty-five minutes. Source-read limits and BLS quotas remain in force.
Two batches of 25 replace four. There is no cooldown after the final batch.
Decision-waiting repairs remain first, followed by decision-first active review
and the existing worklist ordering. Priority uses the same evidence-complete
identities as the app's Waiting on Me queue, calculated from this run's canonical
rows, as well as explicit TIM_DECISION_REQUIRED records. The live bucket was empty;
bucket-only priority in #207 did not reach the app's real decision queue.
Phase and per-row/batch progress is logged.

No uncertain POST is retried. Pending records include the submitted child IDs,
canonical IDs and fields. Compact GitHub COMPLETE aliases plus durable RESULT
and exact row/field readback are required to resolve a lost reply. SALARY_NOTE
is evidence-sidecar content, so master-cell comparison excludes that field.
Older pending records without submitted payloads remain fenced for manual
reconciliation. Reports and pending records are retained in Actions artifacts
when the runner can execute cleanup; artifacts alone do not prove acceptance.

Regression coverage includes expiry during decision repair, bounded stalled
transport/body operations, refusal to start an oversized wait, Writer-fence
expiry, compact-index lost replies, changed salary/duplicate-row rejection,
protected records, concurrent-change guards and existing decision priority.
The scoped PR adds a pay-worker CI job alongside the repository checks.

Rollout: reconcile cancelled-run submissions without replay, pass the PR checks,
then merge within Tim's approved repair scope. Require two consecutive successful
production runs below twenty minutes before the Waiting on Me salary audit.
The seven NEEDS_TIM DECIDE entries are administrative decisions, not salary jobs;
audit the actual app queue rather than treating that count as seven salary records.
Readback must establish model employer-upper-range-v5 for estimates, the salary
ceiling and policy score point, plus bound Writer acceptance. Exact employer-posted
pay keeps its posted basis. A workflow success alone is not salary-audit proof.

Rollback: revert the scoped PR through a reviewed PR if needed; preserve pending
write records and reconciliation evidence. Do not replay uncertain submissions.
Claude's pay starter and cutover monitor are outside this change and remain untouched.
