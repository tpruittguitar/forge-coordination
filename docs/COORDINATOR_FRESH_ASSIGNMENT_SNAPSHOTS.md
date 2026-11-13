# Fresh assignment snapshots and failure diagnostics

Long mail processing can age the canonical snapshot even when mail makes no
verified master changes. Before routine assignment planning, the coordinator
refreshes snapshots at least 14 minutes old (or invalid/future-dated), and still
forces a refresh when mail verified a master change. It repeats the age check
before shared assignment planning, after receipt-index loading.

The existing 15-minute assignment freshness checks remain unchanged. Failed
refresh reads propagate; no stale fallback, write-fence relaxation, automatic
replay, or synthetic work is introduced. A reader returning an old snapshot is
still rejected by the original assignment checks.

Failures inside the coordinator processing block are saved under the configured
private directory's `coordinator-failures/<runId>.json`, then rethrown. Reports
contain stage, instruction revision, timestamp, a safe uppercase reason code (or
UNCLASSIFIED_COORDINATOR_FAILURE) and a message hash. They never contain arbitrary
exception text, URLs, request bodies, credentials, or stack traces. Diagnostics
are not completion receipts and are not published to the repository. A failure
to save diagnostics does not hide the original error. Preflight failures before
processing and hard process termination remain outside this diagnostic boundary.

This is a proposed fix for the observed incomplete cycle; the historical error
string was not captured, so stale-snapshot failure remains a source-and-timing
inference, not an observed stderr message.
