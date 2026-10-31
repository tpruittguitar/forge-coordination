# Where code should replace repeated AI work

Audited from local native automation TOMLs, current shared registry/procedures, runtime lane owners and repository workflow definitions on 2026-10-31. Configuration is not execution proof. Historical cloud/Grok schedules in older inventories are not asserted current by this audit. Claude's signed-in scheduled-tasks list was also read: its pay dispatcher, two usage readers, retired rotation, posting validator, Gofer, strategic/feasibility enrichment and web discovery are all shown Paused; the Stacy reminder is Paused too. No Claude task was changed. Its Job Search project is accessible; it contains 239 context files and earlier interview chats. Those are evidence sources, not governing instructions.

Keep the Writer as the sole canonical mutation service and score calculator. Use off-Writer workers for fetching, parsing, joins, dedupe, queues and reports; moving bulk network research into the Apps Script Writer would increase lock contention. Use AI for judgment and uncertain cases.

| Current local AI task | Schedule, America/New_York | Code can own | AI remains useful for |
|---|---|---|---|
| Email discovery | 03:02, 07:02, 11:02, 15:02, 19:02, 23:02 | Mail enumeration/MIME parsing, URL extraction, known identity lookup, protected-state exclusion, durable cursor and candidate accounting | Hidden-client/role ambiguity, unusual alert formats and employer eligibility interpretation |
| Application outcome tracker | Hourly :22 (moved from :42 to avoid the pay worker) | Existing thread/job bindings, explicit IDs, familiar confirmation/rejection templates, message/event dedupe, explicit calendar stages and reminders | Informal recruiter correspondence, ambiguous company/title match, unclear interview type and conflicting historical accounts |
| Posting freshness | 05:12, 13:12, 21:12 | Seven-day eligibility and supported ATS checks already run in code | Unsupported/unclear posting pages only; not main-line throughput or routine repeat checks |
| Gofer, exceptions only | 01:12, 09:12, 17:12 | Routine receipt/row checks and recovery already have programmed services | Genuinely ambiguous transactions, identity conflicts and explicit escalations |
| Usage reader | 02:05, 08:05, 14:05, 20:05 | Parsing percentages, timezone conversion, retention, Git append/validation are deterministic | No reasoning is needed for meters; current browser/tool session availability prevents claiming a reliable independent collector already exists |
| Daily stack health | 07:45 | Counts, ages, workflow status/durations, lock flags and change detection | Interpret a new material fault and choose a corrective action |

Shared native launchers still point to FORGE_SHARED_AUTOMATION_ENTRY and the common registry. No retired AI enrichment or discovery lane was reactivated. Every runtime lane remains owned by ChatGPT; lane ownership does not mean a paused lane is scheduled.

## Existing programmed services

- source-trial: six daily UTC starts, `13 */4`; board-discovery six daily UTC starts `13 2-23/4`, two hours apart. Public ATS/source fetching already needs no AI.
- source-intake-auto: after successful source/board discovery and manual dispatch. It owns deterministic admission, reconciliation and Writer transport; not applications or outreach.
- enrich-ats-pay: hourly :42 and retained three-hour :57 fallback, same concurrency group. Extracts pay/degree and supported estimates; now also copies cited site products without AI calls. It never claims a partial field write is an enrichment completion.
- writer-verify: :08/:38; receipt recovery :18, serialized under the same group. Routine persistence proof should stay here rather than in Gofer.
- process/activity observations: every ten minutes :07/:17/:27/:37/:47/:57; execution evidence :11/:41; attention assembly :06/:36. These are mechanical measurements, not AI tasks.
- Writer's deployed handlers calculate published-model scores and protect canonical writes. UI, collectors and AI supply raw evidence, not invented overall scores.

## Findings and next split

1. The outcome tracker and pay worker collided at :42. Native tracker now reads back :22; locks and Writer fences remain authoritative because staggering cannot guarantee non-overlap.
2. Routine receipts are already programmed. Do not return archive sweeps or normal verification to Gofer.
3. Product lookup/propagation is now programmed and shared by GUI and worker. Research one unknown employer/site, then reuse it for all matching jobs. Preserve location ambiguity and protect existing evidence.
4. Email/outcome automations still orchestrate connected Gmail/Calendar tools through AI. A pure classifier can reduce reasoning for familiar cases, but a fully unattended GitHub collector needs an approved authenticated ingestion path. No new mailbox OAuth grant, service account or permission scope was created.
5. Unsupported posting pages still need bounded research. The active programmed feasibility worker cannot make inaccessible sources readable; there is no active native strategic/feasibility AI schedule. Do not hide those gaps or send all routine research back to exception-only Gofer. Route only genuinely unresolved source interpretation to an explicitly scoped research mechanism when that execution path is established.
6. Fit provenance needs care: some recorded EXPERIENCE_FIT values are calculated proxies, not evidence of a separate researched assessment. Score calculation and research completeness must remain distinct.
7. Board recovery was missing from the programmed discovery watchdog. It now checks source and employer-board passes independently, with the same running/recent-attempt protections. A PR-branch success is not a current main report: the 03:15 board run was a PR run, while the canonical board report still dated 00:55 UTC. No extra AI monitor is needed for that distinction.
8. Flow publication now runs on completion of main production/verification workflows as well as its ten-minute schedule. It therefore follows actual work instead of depending only on GitHub's sometimes delayed cron. A watchdog/API failure cannot suppress measurement publication. This is not a guarantee that a cron-only system fires on time when every producer is idle; native mailbox execution still needs current receipt evidence.

These are capability/scope findings, not a measured token-saving percentage. No claim is made that every historical interview or unknown product site has been recovered.
