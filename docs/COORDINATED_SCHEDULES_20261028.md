> Historical record. Current permanent homes and schedules: [AUTOMATION_OPERATING_MODEL.md](AUTOMATION_OPERATING_MODEL.md). Do not use this dated audit as current routing.

# Coordinated Forge schedules and chart coverage

Tim authorized staggered automation schedules on 2026-10-28 after assigning all Pipeline Explorer automation responsibility to ChatGPT/Codex through at least November 1. Ownership does not automatically revert. Paused discovery/enrichment/weekly tasks remain paused. This supersedes the schedule portion of [the earlier inventory](AUTOMATION_OWNERSHIP_20261028.md); that file remains the audit of the previous configuration.

## Saved schedules

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

The two ChatGPT cloud temporary launchers are paused, browser verified. Grok Bot's daily health audit and stale rotation-check reminder are paused, browser verified. Grok's other Forge tasks remain paused. Claude scheduler was inspected with Source=All and Status=Active on October 28: no scheduled tasks matched (49 hidden). Therefore there were no active Claude duplicates to pause at inspection time. The unrelated Stacy reminder was not changed.

Deployment readbacks and actual replacement IDs are recorded in the completion record; this source document alone is not proof a scheduler accepted a change.

Completed configuration readback: [scheduler evidence](../state/AUTOMATION_SCHEDULE_READBACK.json). GUI deployment, validation and remaining limitations: [completion record](../receipts/CHATGPT_20261028_PIPELINE_CONTROL_ROOM_COMPLETION.json). New native schedules have not yet supplied first-run proof.

## Live whole-system overview

Foreman cockpit PRs 201 and 202 are deployed. System → Dashboard now shows five stages, one combined all-source intake chart and a ranked health board. The red/amber alert remains visible across pages and public evidence refreshes every minute while open. Missing data and saved-but-unverified schedules remain explicit. Writer receipt activity includes direct GitHub API work; file-queue statistics are separately labeled. Research remains open rather than a final disposition. This is in-app monitoring; it does not create a push-notification service. The AUTO intake latch remains a visible blocker pending Gofer reconciliation.

## What the charts include

Read-only Writer audit on October 28:

* Master: 2,007 rows; three rows dated October 28: Tutor, Foundry Robotics and Diasorin. Their Scout cohorts are two ChatGPT-email rows and one Grok-email row. Live cohort arithmetic reproduces those counts. The master also contains 56 GitHub AUTO intake cohorts: Scout Results does not filter out GitHub.
* Scout Results uses master rows carrying `SCOUT_RUN_ID`, grouped by cohort discovery date. It counts new master entries, not salary/degree updates. Its day chart is labeled UTC; its tile called Today is implemented as a rolling one-day window, not an ET calendar-day total.
* Writer throughput reads only `WRITER_QUEUE_LOG.jsonl`. Direct API submissions used by GitHub intake/pay do not pass through that file-queue logger. Thus its 19 finished requests in the last 24 hours are **queued requests only**, not all Writer work and not 19 newly discovered jobs. Source: foreman-cockpit `pipeline-throughput.js`, `apps-script/Automation.gs` queueStats_, and `apps-script/Code.gs` dispatchWrite_.
* The Operations intake funnel reads durable operations source runs. The live store had zero runs even while it had 1,720 tracked obligations. Its zero coverage counters are missing telemetry, not proof that all sources reviewed zero messages/jobs.
* The 21:41 UTC pay report recorded one submitted/successful enrichment update to an existing job. That is not a new job intake.

## Why GitHub intake is low

The latest inspected source-intake-auto run (40772637872, October 28 21:31 UTC) exited green **without calling Writer**. Its warning says intake is latched by `receipts/auto-intake/FORGE-AUTO-20261026T2255Z.json`, with request `FORGE-SOURCE-8C33C0BC62A4EF056B707300` classified UNKNOWN in the run state. Live receipt_index and request_result now both report that request COMPLETE, write `W-20261026230758639-47ec5a`. COMPLETE alone is not sufficient to reconcile the whole run: exact-row identity/count evidence and untouched tail candidates still need to be accounted under the existing recovery procedure. Do not re-POST the request or clear the latch based only on its current COMPLETE status.

Resolved later October 28 by Tim-authorized ChatGPT recovery: [recovery evidence and disposition of all 25 original candidates](AUTO_INTAKE_RECOVERY_20261028.md). The original uncertain request was not resubmitted. Five saved inserts and one no-write were reconciled, with 19 untouched candidates carried forward. A fresh carried-forward J&T insertion subsequently passed COMPLETE receipt, exact-row, provenance and independent 2,007 → 2,008 population checks; 18 untouched candidates remain queued. Historical audit paragraphs above describe the pre-recovery state. Successful scheduled Actions and a cleared file queue alone still do not prove that jobs were admitted.
