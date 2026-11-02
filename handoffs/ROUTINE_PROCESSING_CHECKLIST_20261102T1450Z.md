# Routine processing checksheet

Updated 2026-11-02T14:50:25.404Z. PR #191 remains live. [PR #196](https://github.com/tpruittguitar/forge-coordination/pull/196) contains the new exception routing and mail template fixes; it is not activated yet.

| Work | Status | Evidence / remaining scope |
|---|---|---|
| Five saved-search pagination sources | Complete | Prior verified 65 page observations, 1,570 card observations and 800 new unique candidates. Historical gaps are separate. |
| Collect returns, validate batches, update cursors | Code live | PR #191 corrected return accepted; pending writes and real evidence exceptions preserved. |
| Direct helper delivery | Code live | GitHub/Drive artifacts collected directly. Historical native run-list coverage remains unproven. |
| Deduplicate master/archive and protect decisions | Code/Writer live | Exact canonical matches and pending transactions remain guarded. |
| Apply explicit relevance rules | Code live | Nuanced scope stays with AI. |
| Fetch/extract structured posting facts | Code live for accessible supported sources | Persistent source failures now have a durable AI escalation path prepared in PR #196. |
| Reuse company/location/product references | Code live | Shared references retained. |
| Calculate salary estimates and final scores | Code/Writer live | Missing evidence remains research work. |
| Verify writes, retry reads, reconcile receipts | Code live | Independent verification required; ambiguous writes cannot replay. |
| Backlog, throughput and schedule health | Code live | Existing five-minute schedule remains enabled; no processing cap added. |
| Standard email matching, events and Writer persistence | Code live; two template fixes awaiting activation | The selected newsletter and a newly arrived connection-acceptance notice were reviewed. Both classify as non-recruiting in PR #196; production disposition verification awaits merge. |
| Ambiguous identity, correspondence and conflicting evidence | Existing AI reviewer retained; escalation improvement awaiting activation | PR #196 adds source-bound reviews/holds and independently verified source proposals to the existing hourly tracker. No extra AI schedule. |
| Two historical evidence gaps | Reviewed; still open | Twelve full original/neighboring alerts examined. Missing LinkedIn historical identities and the Howmet identity remain unproven. Immutable WAITING_SOURCE_CHANGE reviews preserve the gaps until new original evidence arrives. |

The selected email and the newly arrived notice have both been reviewed; neither supports a recruiting event or a Writer mutation. The production queue still reports 2 pending messages until the template fix is activated. Historical gap review does not establish missing job identities or complete coverage.

Current published run: `FORGE-CODE-CHATGPT-20261102T144524227Z` at 2026-11-02T14:47:06.945Z. Source queue: 5796 candidates, 1668 verified inserted, 530 verified existing, 227 out of scope. Exception entries: 147 AI and 217 code/source; these are not unique-job counts.

Backlog processing continues under the existing schedule. The duplicate helper coordinator remains paused; this change starts no TinyFish runs, native AI report polling or additional AI schedules. The earlier 30–50% token-savings estimate is still unmeasured.

Validation: 207 unique Node tests and 27 Python tests passed; runtime consistency and change-record checks passed. [Investigation and source hashes](https://github.com/tpruittguitar/forge-coordination/blob/main/handoffs/OPEN_EXCEPTION_REVIEW_20261102T1450Z.json) · [Production receipt](https://github.com/tpruittguitar/forge-coordination/blob/main/receipts/FORGE-CODE-CHATGPT-20261102T144524227Z_TERMINAL.json)
