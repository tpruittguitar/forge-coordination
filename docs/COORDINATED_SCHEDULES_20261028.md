# Coordinated Forge schedules and chart coverage

Tim authorized staggered automation schedules on 2026-10-28 after assigning all Pipeline Explorer automation responsibility to ChatGPT/Codex through at least November 1. Ownership does not automatically revert. Paused discovery/enrichment/weekly tasks remain paused. This supersedes the schedule portion of [the earlier inventory](AUTOMATION_OWNERSHIP_20261028.md); that file remains the audit of the previous configuration.

## Target schedules

AI times use America/New_York, including daylight saving changes. GitHub uses UTC; the ET column is the October 28 EDT equivalent and shifts by one hour on November 1.

| Work | Executor | Schedule |
| --- | --- | --- |
| Email discovery | Local Codex heartbeat, this chat | 03:02, 07:02, 11:02, 15:02, 19:02, 23:02 ET |
| Application / Writer Gofer | Local Codex heartbeat, this chat | 01:12, 09:12, 17:12 ET |
| Posting validation | Local Codex heartbeat, this chat | 05:12, 13:12, 21:12 ET |
| AI Usage Reader | Local Codex heartbeat, this chat | 02:05, 08:05, 14:05, 20:05 ET, unchanged |
| Stack health audit | Local Codex heartbeat, this chat | Daily 07:45 ET |
| Source trial | GitHub Actions | 00/04/08/12/16/20 UTC at :13 (same EDT hour list on October 28) |
| Board discovery | GitHub Actions | 02/06/10/14/18/22 UTC at :13 (same EDT hour list on October 28) |
| Pay enrichment | GitHub Actions | Hourly :42; fallback every three UTC hours at :57 |
| Writer verification | GitHub Actions | Hourly :08 and :38; also new verification requests |
| Needs-Tim refresh | GitHub Actions | Hourly :06 and :36; also relevant pushes |
| Change register | GitHub Actions | Hourly :56; also relevant pushes |
| Source intake | GitHub Actions | After successful source-trial / board-discovery; safety latch and release gates unchanged |
| Receipt indexing, edit requests and CI | GitHub Actions | Existing event triggers; no extra clock schedule |

## Exclusion and duplicate handling

Staggering reduces bursts but cannot guarantee that long runs never overlap. GitHub may delay starts. The existing per-workflow concurrency groups remain; the Writer remains the only mutator and its existing locks/idempotency guards serialize canonical writes. No global GitHub concurrency group was added: GitHub can cancel older pending jobs within such a group, losing queued work.

The three local production AI schedules additionally use `tools/automation-run-lock.cjs` and the same absolute local lock path: `C:/Users/Tim/Documents/Codex/2026-10-28/referenced-chatgpt-conversation-this-is-an/work/forge-ai-production.lock.json`. Run `node <script> acquire <lock-path> <unique-RUN_ID>` before production work. Exit 2 means another/abandoned run owns it: preserve pending work, report/defer, and do not submit anything. Only the matching run token may check/release it. Release in a finally path after durable checkpoints/terminal accounting. Locks never expire automatically; an abandoned lock requires checking the prior run before removal. Independent-process exclusion and wrong-owner/stale-lock refusal are tested.

Retire the two ChatGPT cloud temporary launchers after the local replacements are active, so the misleading Daily email recurrence and hourly rest wakes do not persist. Pause Grok Bot's daily health audit after its local replacement is active. Keep Grok's other paused tasks off. Claude scheduler was inspected with Source=All and Status=Active on October 28: no scheduled tasks matched (49 hidden). Therefore there were no active Claude duplicates to pause at inspection time. Do not touch the unrelated Stacy reminder.

Deployment readbacks and actual replacement IDs are recorded in the completion record; this source document alone is not proof a scheduler accepted a change.

## What the charts include

Read-only Writer audit on October 28:

* Master: 2,007 rows; three rows dated October 28: Tutor, Foundry Robotics and Diasorin. Their Scout cohorts are two ChatGPT-email rows and one Grok-email row. Live cohort arithmetic reproduces those counts. The master also contains 56 GitHub AUTO intake cohorts: Scout Results does not filter out GitHub.
* Scout Results uses master rows carrying `SCOUT_RUN_ID`, grouped by cohort discovery date. It counts new master entries, not salary/degree updates. Its day chart is labeled UTC; its tile called Today is implemented as a rolling one-day window, not an ET calendar-day total.
* Writer throughput reads only `WRITER_QUEUE_LOG.jsonl`. Direct API submissions used by GitHub intake/pay do not pass through that file-queue logger. Thus its 19 finished requests in the last 24 hours are **queued requests only**, not all Writer work and not 19 newly discovered jobs. Source: foreman-cockpit `pipeline-throughput.js`, `apps-script/Automation.gs` queueStats_, and `apps-script/Code.gs` dispatchWrite_.
* The Operations intake funnel reads durable operations source runs. The live store had zero runs even while it had 1,720 tracked obligations. Its zero coverage counters are missing telemetry, not proof that all sources reviewed zero messages/jobs.
* The 21:41 UTC pay report recorded one submitted/successful enrichment update to an existing job. That is not a new job intake.

## Why GitHub intake is low

The latest inspected source-intake-auto run (40772637872, October 28 21:31 UTC) exited green **without calling Writer**. Its warning says intake is latched by `receipts/auto-intake/FORGE-AUTO-20261026T2255Z.json`, with request `FORGE-SOURCE-8C33C0BC62A4EF056B707300` classified UNKNOWN in the run state. Live receipt_index and request_result now both report that request COMPLETE, write `W-20261026230758639-47ec5a`. COMPLETE alone is not sufficient to reconcile the whole run: exact-row identity/count evidence and untouched tail candidates still need to be accounted under the existing recovery procedure. Do not re-POST the request or clear the latch based only on its current COMPLETE status.

The Gofer owns this reconciliation priority. Scheduling changes leave the safety latch intact. Successful scheduled Actions and a cleared file queue do not prove that new jobs were admitted.
