# Permanent Forge automation homes

Effective 2026-11-02T01:55:05.135Z. ChatGPT/Codex remains accountable until Tim explicitly changes ownership. There is no expiry, quota-reset handback, WIP limit or daily processing cap.

All AI schedules are launchers for the same [shared entry](../control/FORGE_SHARED_AUTOMATION_ENTRY.txt), [registry](../control/AI_AUTOMATION_TASKS.json) and repository procedures, resolved at one main commit per run. Machine-readable homes: [operating model](../control/AUTOMATION_OPERATING_MODEL.json).

| Home | Work | Schedule (America/New_York) |
|---|---|---|
| Codex on Tim's PC | Helper collection / intake inspection / Writer coordination | Hourly :02 |
| Claude Code cloud | Relevance review, employer postings first | Hourly :08 (native UTC cron) |
| Grok Automations | Intake research | Hourly :15 |
| Codex on Tim's PC | Application / rejection / recruiter tracker | Hourly :22 |
| Grok Automations | Enrichment evidence | Hourly :35 |
| Grok Automations | Assigned outcome-email partition | Hourly :45 |
| Codex on Tim's PC | Gofer, exceptions only | 01:12, 09:12, 17:12 |
| Codex on Tim's PC | Posting freshness, background | 05:12, 13:12, 21:12 |
| Codex on Tim's PC | Weekly AI usage readings | 02:05, 08:05, 14:05, 20:05 |
| Codex on Tim's PC | Read-only stack health | 07:45 |

GitHub Actions owns existing scheduled code workers: source/board capture, admission, receipt verification/recovery, observability and execution evidence. Exact UTC cron expressions are inventoried in the machine-readable operating model; this release does not change them. Writer remains the only canonical master/archive mutator and final score calculator. Helpers return evidence, never Writer submissions.

The coordinator automatically collects complete returned batches and replenishes existing scoped assignments under the shared lock, excluding active reservations and pending original transactions. No routine user paste or activation acknowledgment is required. File and transaction batch sizes are not throughput caps. Source failures affect only dependent cases; prior receipts and lookup budgets survive every run.

Claude reuses evidence, then uses an employer posting or one targeted employer search for the missing scope fact. LinkedIn is not mandatory and is not probed repeatedly. Explicit coordinator handoffs preserve the three reported trial cards, including the unresolved Permobil search, so no research is lost or repeated.

Native active status is configuration proof only. Successful runs, actual source coverage, pending Writer obligations and current blockers remain independently evidenced. Local runs require Tim's PC and its existing connection; cloud helpers cannot replace local Writer access. Old catch-up assignments and retired native tasks remain disabled.
