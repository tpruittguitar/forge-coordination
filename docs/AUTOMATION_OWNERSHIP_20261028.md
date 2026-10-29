# Pipeline Explorer automation ownership and schedule audit

Schedule changes authorized later on October 28 are tracked in [Coordinated schedules and chart coverage](COORDINATED_SCHEDULES_20261028.md). Tables below preserve the earlier observed configuration; use the coordinated schedule document and its completion record for current execution.

Authority: Tim, 2026-10-28, in Codex chat `01a184da-4336-7221-8a99-5e405f1af7ad`: "all belong to you for at lease the rest of the week / update documentation accordingly" and "list them all with a schedule when you are finshed".

**Accountable owner: ChatGPT/Codex for all Pipeline Explorer / Forge automations through at least Sunday, November 1, 2026. TEMPORARY — REVERT ONLY ON TIM'S INSTRUCTION.** No automatic ownership handback on a quota reset or calendar date. This supersedes earlier temporary Claude-to-Grok / Grok-to-ChatGPT ownership notes. Tim remains the decision authority. Business rules, Writer-only mutations, proof requirements and existing pauses are unchanged. The unrelated Stacy reminder is outside the Pipeline Explorer scope.

This inventory distinguishes accountable ownership, manifest execution ownership, scheduler host and actual enabled state. An active scheduler is not proof of useful work. This documentation update does not itself migrate native schedules, pause another app's task or prove a successful production run. Before the ownership PR merges, main still has its preceding owner map; after merge all seven manifest lanes use the ChatGPT adapter and actor CHATGPT.

## Verified AI schedules

Audited directly in the signed-in ChatGPT Scheduled page, all four pages of Grok Automations, and local Codex automation files on October 28. Times below are Eastern unless explicitly UTC; GitHub schedules use UTC and shift relative to ET with daylight saving time.

| Automation / lane | Scheduler host | Observed state | Schedule / effective work |
| --- | --- | --- | --- |
| Forge Temporary Email Coverage | ChatGPT cloud | Active | UI says Daily; next run during audit approximately 20:00 ET. Prompt allows work only at 03/07/11/15/19/23, skips other 03–23 hours. Exact recurrence needs reconciliation: UI summary does not prove all six eligible times are scheduled. |
| Forge Temporary Lane Rotation | ChatGPT cloud | Active, ends Nov 1 | Hourly; handoff specifies :10. Gofer 01:10/09:10/17:10; Posting Validation 05:10/13:10/21:10. Other hours rest. Prompt is PROVIDER=ChatGPT and reads rotations.Grok. |
| FORGE_AI_USAGE_READER | Codex local, this chat | Active; manual collection/push verified | 02:05/08:05/14:05/20:05 America/New_York. ID forge-ai-usage-reader. First commit e09dd734e835f543faef57f1b9b118b448d76adf. |
| PE_STACK_HEALTH_DAILY | Grok Bot | Active, still hosted at Grok | Daily around 07:00. Read-only stack audit. Ownership is reassigned to ChatGPT/Codex; native execution has not been migrated by this documentation update. |
| Check 12:10 Grok rotation run | Grok Bot | Active, stale one-shot | UI shows once October 20 at 12:25 PM, next run in 11 months. Treat as a stale schedule requiring review, not current daily production coverage. |
| FORGE_TEMP_EMAIL_DISCOVERY_GROK | Grok | Paused | Hourly 03:00–23:00; historical work hours 03/07/11/15/19/23. |
| FORGE_GROK_LANE_ROTATION | Grok | Paused | Hourly 00:10–23:10. Retained map: Gofer 01/09/17, validation 05/13/21. |
| FORGE_WEB_CAREER_DISCOVERY (two copies) | Grok and Grok Bot | Both paused | Hourly :10; one copy displays 00:10–23:10. |
| FORGE_ENRICH_FEASIBILITY | Grok | Paused | Hourly 02:35–23:35. |
| FORGE_ENRICH_STRATEGIC | Grok | Paused | Hourly 01:20–23:20. |
| Forge — ZipRecruiter Weekly | ChatGPT cloud | Paused | Weekly; precise day/time not inspected. Last run shown Monday. |
| Forge — Email Discovery | ChatGPT cloud | Paused | Original cadence not inspected; superseded by temporary coverage. Last run shown Oct 27. |
| Forge — Web Discovery | ChatGPT cloud | Paused | Historical hourly :10; current recurrence not inspected. Last run Oct 18. |
| Forge — Posting Validation | ChatGPT cloud | Paused | Current recurrence not inspected; superseded by temporary rotation. Last run Oct 16. |
| Forge — Application and Writer Gofer | ChatGPT cloud | Paused | Historical hourly :50; current recurrence not inspected. Last run Oct 11. |
| Forge — Strategic Enrichment | ChatGPT cloud | Paused | Historical hourly :20; current recurrence not inspected. Last run Oct 11. |
| Forge — Feasibility Enrichment | ChatGPT cloud | Paused | Historical hourly :35; current recurrence not inspected. Last run Oct 11. |

Cloud ChatGPT IDs: rotation `6ae2849a038881919be7b99e13b7d541`; email `6ae2849900508191bec4e47ca529aef8`. These differ from the historical Grok task IDs and must not be conflated.

## Claude schedules: reported, current state not independently verified

Claude's desktop was available for context, but native scheduler inspection was blocked when the window was minimized/user-controlled. These schedules come from Tim's supplied October 28 handoff and visible historical Claude conversation, not current task-list readback. Do not call them disabled or migrated.

| Task | Reported cadence | Last known host / material note |
| --- | --- | --- |
| FORGE_POSTING_VALIDATION | Every 2 hours at :28 ET | Claude; main's Grok owner map already prevents Claude from owning this lane. New ChatGPT owner preserves that rejection. |
| FORGE_APPLICATION_WRITER_GOFER | Every 2 hours at :50 ET | Claude; same provider guard. Pending verification obligations transfer to ChatGPT Gofer. |
| Pay job dispatcher, enrich-ats-pay | Hourly at :27 ET | Claude, reportedly switched to Haiku. It dispatches a GitHub job that also has native schedules; duplicate host may remain. |
| Forge AI Usage Reader | Every 3 hours at :05 ET | Claude; left unchanged for the handoff test. Potential overlap with the verified local Codex reader. |

## Autonomous GitHub schedules

All six recurring workflows below were API-verified `active` in `tpruittguitar/forge-coordination` (the pay workflow has two clock triggers). Each had a successful scheduled execution in the retrieved October 28 run history. Accountable owner is ChatGPT/Codex; executor remains GitHub Actions, under Tim's repository. A successful workflow does not by itself prove a verified Writer update.

| Workflow | Configured UTC schedule | October 28 ET equivalent |
| --- | --- | --- |
| enrich-ats-pay | Hourly :17; fallback :47 every 3 UTC hours | Hourly :17; fallback 02:47/05:47/08:47/11:47/14:47/17:47/20:47/23:47 EDT |
| source-trial | Every 4 UTC hours at :23 | 00:23/04:23/08:23/12:23/16:23/20:23 EDT |
| board-discovery | Every 4 UTC hours at :53 | 00:53/04:53/08:53/12:53/16:53/20:53 EDT |
| writer-verify | Hourly :11 and :41 | Hourly :11 and :41 |
| build-needs-tim | Hourly :07 and :37, also relevant pushes | Hourly :07 and :37 |
| change-register | Hourly :23, also relevant pushes | Hourly :23 |

GitHub may delay or drop scheduled launches; configured time is not actual start time.

## Event-driven automation (no fixed clock schedule)

| Automation | Executor | Trigger |
| --- | --- | --- |
| source-intake-auto | GitHub, forge-coordination | Successful source-trial or board-discovery completion on main; also manual dispatch. Execution gates/latches still apply. |
| Index receipt discovery hints | GitHub, forge-coordination | Main pushes changing receipts or its indexer; also manual dispatch. |
| apply-edit-requests | GitHub, forge-coordination | Push of edit-requests/*.json; target restrictions unchanged. |
| Validate instruction release | GitHub, forge-coordination | Relevant PRs and main pushes. |
| change-record-check | GitHub, forge-coordination | PR validation. |
| Source-intake admission / controlled admission / preview / production / reconcile / recover checks | GitHub, forge-coordination | Manual dispatch and/or scoped PR events; these are tests/recovery, not independent recurring discovery schedules. |
| unit-tests, visual-golden, writer-impact, unreviewed-push-alarm | GitHub, foreman-cockpit | PR, push and/or manual events; API-verified active, no cron schedules found. |
| target-companies-digest, unreviewed-push-alarm | GitHub, forge-policy | Push and/or manual events; API-verified active, no cron schedules found. |
| Writer queue processing / installed Apps Script triggers | Apps Script | Writer remains the sole mutator. Installed trigger inventory and cadence were not inspected; do not infer them from source alone. |
| Explorer polling / background timers | Cloudflare app and browser clients | Request/event/timer driven; production deployed timer inventory not inspected in this audit. |

forge-writer-state had no GitHub workflows in the inspected API/tree results.

## Retired and legacy schedules: keep off

ChatGPT paused: Temporary Foreman Brief, Job Brief Delivery Watchdog, Daily Job Brief Email, Daily Job Intelligence Pipeline, Claude Job Post Extract, OEM Career Site Search, PR 33 CI Gate. Multi-AI Capability Watch is also paused but broader than Pipeline Explorer. Exact old recurrence was not inspected except Daily Job Intelligence Pipeline, Claude Job Post Extract and OEM Career Site Search, which display Daily.

Grok paused: GROK-TEMP-CLAUDE-TAKEOVER-EXPIRE (Oct 12 00:15 one-shot); GROK-TEMP-FOREMAN-RANK-BRIEF (hourly 07:30–22:30); GROK-TEMP-CLAUDE-ENRICH-COORD (hourly :10); GROK-01_SCALEUP_V2_1520 (daily 15:20); GROK-02_COMMS_LOG (daily 00:25); GROK-01_SCALEUP_V2_PARALLEL (daily 10:20); GROK-03_SCOUT_V2_RESOLVE (daily 23:20); GROK-10_SCOUT_V2_RESOLVE (daily 02:20); GROK-07_SCOUT_V2_MORNING_DELTA (daily 06:00); GROK-05_SCOUT_V2_RUNNING_LIST (daily 04:30); WEEKLY DEEP CLEAN (Sunday 15:00); DAILY PIPELINE MAINTENANCE (daily 06:30); Watch Grok's first Forge enrich runs (hourly :47).

Grok completed, not recurring: forge-github-bg-scheduled-test-3 (Oct 12 14:40), -2 (Oct 12 14:15), unsuffixed (Oct 12 14:05), GROK-08_SCOUT_V2_ENRICH (Oct 4 21:20).

## Outstanding operational reconciliation

1. Merge/read back the scoped ownership release before claiming main routes all lanes to ChatGPT. Validate actual scheduled runs; no production Writer execution was attempted as part of this documentation change.
2. Inspect exact ChatGPT email recurrence: visible Daily summary and next 20:00 launch do not match the prompt's six allowed work hours. Do not claim six runs/day until verified/corrected.
3. Inspect Claude task enabled states; reconcile potential duplicate usage readings and pay dispatcher. Do not silently disable them based only on a handoff.
4. Migrate PE_STACK_HEALTH_DAILY execution from Grok if required; it remains active there despite reassigned accountable ownership. Review the stale rotation-check one-shot.
5. ChatGPT temporary rotation expires November 1, while ownership does not automatically revert. Review continuation with Tim before that expiry; keep paused lanes off absent explicit instruction to resume.
6. No recurring tasks were created, resumed, paused, deleted or edited during this audit/documentation update. Existing local Usage Reader was created earlier after a verified test.

Evidence: [live routing manifest](../runtime/current.json), [registry](../policy/current/registry.json), [workflow sources](../.github/workflows), signed-in [ChatGPT Scheduled](https://chatgpt.com/scheduled), signed-in [Grok Automations](https://grok.com/automations), and local Codex saved automation. Earlier handoffs are historical and cannot substitute for these scheduler readbacks.
