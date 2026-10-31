# Chromalloy timeout and 36-hour rate evidence

Original failed Actions run: https://github.com/tpruittguitar/forge-coordination/actions/runs/41010691873
Original code commit: f21fa496f13670590af4f480ffb9d3a0e8fe80fa, tools/source-intake/production-executor.js lines 150-151.

The client used a 60-second AbortSignal timeout for the POST. Its catch classified POST_UNCONFIRMED as skipped and continued. That was a real accounting defect: transport failure does not establish a no-write outcome. The current executor waits up to 180 seconds and durably captures intent before submission, then halts UNKNOWN on transport failure. Neither a longer timeout nor an absent receipt proves whether an old request ran. The server execution reason for this individual timeout has not been established from client evidence.

Fresh observation 2026-10-31T03:26:59.788Z: request FORGE-SOURCE-99E748FF965C97ABBF761805 has no canonical receipt. Neither current master nor archive has LinkedIn 4485233648 or the Orangeburg Director, Quality Assurance - Engine Component Repair Services job. Other Chromalloy rows are distinct declined roles: Tampa Director of Engineering - Investment Castings and Newnan Senior Manager, Quality Assurance. No submission or decision was made during this investigation. Tim asked to investigate, not decline the role.

An exact canonical saved row can establish that the practical intake obligation is satisfied. It must not fabricate an acceptance receipt for an earlier uncertain transaction. In this case the exact row has not been found, so missing receipt is not the sole reason for the hold. Other candidates continue.

Rate root cause: apps-script/ReceiptIndexStore.gs intentionally drops row details beyond the most recent 100 COMPLETE request aliases. The reporting sidecar now preserves 36-hour details and recovers missing data from integrity-checked Git blobs. Historical data is used only when status, write ID, timestamp and snapshot hash match a current COMPLETE receipt. It never changes canonical receipts or authorizes replay. Initial recovery found 428 distinct verified jobs, 233 inserted jobs and 132 jobs enriched over 36 hours, with zero remaining metadata gaps; rates naturally change as the window advances.

Email limitation from the saved 19:02ET run: eleven LinkedIn view-all links required sign-in and one Glassdoor link was bot-blocked. The 149 advertised unshown occurrences are not 149 proven distinct jobs. They remain in the pending source ledger; neither a cursor advance nor a successful coverage claim is justified. These access restrictions cannot be fixed by treating inaccessible results as processed.
