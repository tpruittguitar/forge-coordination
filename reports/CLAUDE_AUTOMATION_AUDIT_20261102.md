# Claude automation audit — 2026-11-02 (Tim directive)

Run: CLAUDE-AUTOMATION-AUDIT-20261102T0247Z · Read at main c424de17e7c74f79a627adea9a8dad907a195ce5 · Native config read via Claude scheduled-task API at 2026-11-03T02:46Z.
Scope: Claude-hosted schedules only. No GitHub workflow, Writer code, canonical rule, ownership or other-provider schedule was changed.

## Inventory (all Claude scheduled tasks on the account)

| Task | ID | Cadence | State after audit | Last run | Decision |
|---|---|---|---|---|---|
| FORGE_CLAUDE_RELEVANCE_REVIEW | trig_01Bv6sqH17RCX6Duz4Z9U99f | hourly :08 UTC | ENABLED | 2026-11-03T02:09Z SUCCEEDED | KEEP ACTIVE |
| Forge pay job hourly start (enrich-ats-pay dispatcher, Haiku) | trig_01PfbsRJxFsXkwRDRtKUKta9 | hourly :27 UTC | ENABLED | 2026-11-03T02:28Z SUCCEEDED | CONDITIONAL PAUSE (Tim decision) |
| FORGE_APPLICATION_WRITER_GOFER (Claude, Sonnet) | trig_019T6TN2s6xHaufZ98FkKHdU | every 2 h :50 ET | **DISABLED by this audit** | 2026-11-03T01:50Z (SKIP) | RETIRED → paused |
| Forge AI Usage Reader (on Tim's PC, Opus) | trig_01PD3R3v24kYgznTgRLerCiR | every 3 h :05 ET | **DISABLED by this audit** | 2026-11-03T02:05Z OK | PAUSE (duplicated) |
| Usage Reader cloud (old) | trig_015gQd3iNBRZ9MdQPheTMcQn | — | disabled since 2026-10-14 | — | RETIRED |
| FORGE_CLAUDE_LANE_ROTATION | trig_01Ta1QP7TFiwk1Ca8pJ6RbnT | — | disabled since 2026-10-19 | — | RETIRED |
| FORGE_POSTING_VALIDATION (Claude) | trig_01XESwmbe9JnCSjUP5VTqwUe | — | disabled since 2026-10-28 | — | RETIRED |
| FORGE_ENRICH_FEASIBILITY (Claude) | trig_01MUoAjWHF6ZAbD5uMYYZKth | — | disabled since 2026-10-12 | — | RETIRED |
| FORGE_ENRICH_STRATEGIC (Claude) | trig_015etBbScjc8PCfmn9zBNvcf | — | disabled since 2026-10-12 | — | RETIRED |
| FORGE_WEB_CAREER_DISCOVERY (Claude) | trig_01PsGY5AobpiE5vyw2rYjnoS | — | disabled since 2026-10-11 | — | RETIRED |
| Stacy Straatemeier note reminder (non-Forge) | trig_01CPf9gYuSxmazCYrVyRie4W | — | disabled | — | out of scope, untouched |
| Re-check PR #4 (one-shot, foreman-cockpit) | trig_01S5snUYGkQgzRgKgKsDGNut | — | disabled | — | out of scope, untouched |

Desktop/local Claude scheduling: both `scheduled-tasks.json` stores on Tim's PC (claude-code-sessions and local-agent-mode-sessions) contain `scheduledTasks: []`. No local Claude schedules exist.

## Executed pauses

1. **FORGE_APPLICATION_WRITER_GOFER (Claude)** — registry and runtime manifest set `owner=ChatGPT`; every Claude run ends `REASON=PROVIDER_MISMATCH, NO_PRODUCTION` (receipts/FORGE-GOFER-CLAUDE-20261102-1852ET-SKIP.txt, FORGE-GOFER-CLAUDE-20261103-SKIP.txt). 12 Sonnet sessions/day producing zero work plus skip-receipt commits. Codex gofer (01:12/09:12/17:12 ET) is the owner. Risk of pausing: none; the task performed no work.
2. **Forge AI Usage Reader (Claude, Tim's PC)** — registry `FORGE_AI_USAGE_READER.owner=ChatGPT`; operating model assigns it to Codex 02:05/08:05/14:05/20:05 ET. Codex is demonstrably writing: commits 46ee92d (08:03 ET), 5d1ffa7 (14:03 ET), 8268d2b (20:08 ET) on 2026-11-02, each 3 readings. Claude was adding 8 more Opus runs/day of the same three weekly meters. Both versions depend on Tim's PC + Chrome, so pausing Claude removes no independent coverage. Readback in state/AUTOMATION_EXECUTION_EVIDENCE.json now credits whichever writer ran last; after this pause it will reflect Codex only.

Verification: `list_triggers(enabled=true)` after the updates returns exactly two tasks (relevance review, pay dispatcher). Both paused tasks report `enabled:false`.

## Retained

**FORGE_CLAUDE_RELEVANCE_REVIEW — KEEP ACTIVE.** Unique AI judgment (one targeted employer lookup per unclear card). No code replacement exists. Assignment CLAUDE-RELEVANCE-20261101-V2: 2,425 assigned, 197 returned, 13 coordinator-owned, 2,215 pending (state/HELPER_HANDOFFS.json). Receipts exist through CLAUDE-RELEVANCE-20261102T2000Z-P11. Transport ledger shows 8 IMPORTED / 9 DUPLICATE for this task.
Weak points: (a) throughput is low relative to backlog — at the observed rate the pending 2,215 keys take weeks; (b) 9 DUPLICATE transport results mean some runs re-deliver already-returned batches (wasted delivery, no wasted research proven); (c) HELPER_ROUTING_CURRENT shows `routingActive:false` for this task while `enabled:true`; (d) handoff checkpoint last advanced 2026-11-02T13:52Z, after which P11 (20:00Z) is not yet reflected. (c) and (d) are coordinator-side (ChatGPT/code) and outside my authority.

**Forge pay job hourly start — CONDITIONAL PAUSE, retained pending Tim.** Replacement exists and is proven in production: `tools/pipeline-observability/enrichment-watchdog.js` (run by pipeline-observability every ~10 min) dispatched enrich-ats-pay as github-actions[bot] 11 times on 2026-11-01/02 whenever no run existed for 90 min. GitHub `schedule` events remain unreliable: on 2026-11-02 only 6 schedule-triggered runs occurred, with gaps of up to 9 h (02:44Z→11:41Z), even after #207 moved the cron to every 15 min (no schedule run since 21:57Z). Pausing Claude drops guaranteed cadence from ~60 min to ~90–100 min, which reverses Tim's 2026-10-21 hourly ruling. Collision evidence: Claude's 00:27Z dispatch was cancelled by a later queued run (concurrency group, cancel-in-progress=false keeps one pending). Cost: one Haiku session/hour, ~12 min each when it watches a run.

## Overlap and usage (before → after)

| Window | Before | After |
|---|---|---|
| Usage meters | Claude 8/day (Opus) + Codex 4/day | Codex 4/day |
| Gofer | Claude 12/day (Sonnet, all skips) + Codex 3/day | Codex 3/day |
| Pay-job starts | Claude hourly + watchdog 90-min + flaky cron | unchanged pending decision |
| Relevance | Claude hourly :08 | unchanged |

Removed: 20 AI sessions/day (8 Opus, 12 Sonnet), plus ~12 skip/duplicate commits/day to main.

## Uncovered responsibilities / gaps

- Registry lists FORGE_CLAUDE_INTAKE_A, FORGE_CLAUDE_INTAKE_B and FORGE_CLAUDE_ENRICHMENT (owner Claude) with no native schedule anywhere and no home in the operating model. Either deliberately dormant or orphaned; Tim/ChatGPT should mark them retired in the registry or assign a home. No coverage was removed by this audit.
- control/AUTOMATION_OPERATING_MODEL.json inventories enrich-ats-pay cron as `42 * * * *, 57 */3 * * *`; main now has `12,27,42,57 * * * *` (#207). Inventory is stale.
- Gofer and posting-validation Codex runs report DEFERRED_SHARED_LOCK / executionVerified=false in the latest evidence; Claude pausing does not change that, and Claude was not covering it.

## Proposed consolidation (not executed)

Lower the watchdog threshold in enrichment-watchdog.js from 90 to ~35 min. Then the Claude pay dispatcher becomes fully redundant and can be paused with no cadence loss. This is a code change for the code owner, outside this audit's authority.
