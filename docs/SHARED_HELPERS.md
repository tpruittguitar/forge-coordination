# Shared Claude/Grok research helpers

Two utility slots use one central procedure, `lanes/FORGE_SHARED_HELPER.txt`. All behavior remains centrally versioned. The routes use WRITE_THROUGH_SUPPORTED_WRITER: ready facts go through the existing locked adapter immediately when accessible, otherwise the existing durable automatic transport. See [direct processing](DIRECT_WRITER_PROCESSING.md). No manual relay, approval or evidence PR is a routine prerequisite. Each route selects `policy/current/SHARED_HELPER_COMMON.txt` instead of the general production/email contract. Read entry → registry → selected common + procedure once at one resolved main SHA, then fresh assigned work. Conditional references are read only when that kind of work is reached; command execution does not require reading its source code. Native prompts contain provider, task key and the shared-entry URL only.

## Launchers

Claude:

```text
PROVIDER=Claude TASK_KEY=FORGE_CLAUDE_SHARED_HELPER.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow it.
```

Grok:

```text
PROVIDER=Grok TASK_KEY=FORGE_GROK_SHARED_HELPER.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow it.
```

Desired hourly cadence: Claude :25, Grok :55, America/New_York. Registry `scheduleIntent` is not native configuration readback. No schedule has been installed by this implementation. Existing native schedules, retired routes and production ownership stay unchanged.

## Rollout gates

1. Review and merge this implementation. Do not enable provider runs from an unmerged branch.
2. Verify native setup. Before marking a provider available, have that provider return the zero-job [readiness probe](SHARED_HELPER_READINESS.md) through its existing PR or private Drive transport and verify both `artifactValidated` and `returnTransportVerified` on the coordinator with its private delivery evidence. Only then centrally mark that provider available. Do not change current provider availability during this contract update; a merge alone cannot reserve work for an unconfigured app. Let the existing local coordinator publish a fresh `SHARED_HELPER_WORK.json` from authenticated canonical rows while holding its existing production lock. Empty pre-activation work is intentional; no live job list is invented from repository snapshots.
3. With fresh assignments, verify each provider can deliver one complete source-bound batch into the supported Writer adapter through its existing authorized execution or automatic transport route. Fixture tests prove behavior, not live source or Writer execution.
4. Verify coordinator acceptance and original RESULT / independent COMPLETE / exact row readback for a small permitted batch. Then configure/read back the intended native schedules. The user will paste launchers into Claude/Grok; do not duplicate full procedure text there.

## Coordination and scope

The coordinator alone reserves work, under the existing production lock, and atomically saves one shared assignment file. Stable key hashing splits new assignments between available providers. Existing reservations are not redistributed when a provider availability flag changes. Existing ChatGPT enrichment, intake-drain, active legacy helper work and uncertain canonical transactions are excluded. Complete intake cards remain code-owned. Each invocation starts with the largest current eligible backlog across Research, Enrichment, Intake and Discovery, counting distinct actionable jobs after ownership, protection, returned-work and retry exclusions. It then works the other lanes as capacity allows. Research is not an unconditional override. Existing reservations stay intact; changing backlog sizes does not steal jobs or replay completed work. Helpers cannot self-assign or bypass existing-first discovery rules.

Ready returned work proceeds through the existing locked returns-only Writer adapter; it remains reserved during validation and timestamps do not expire ownership. Do not wait for unrelated mailbox/source intake work or an evidence PR approval. Explicit transfer requires a terminal-run checkpoint, reason, no pending transaction and an incremented assignment version. Historical and current per-item ownership must match on return and again before POST. Late evidence remains immutable and quarantined instead of being replayed. Provider exhaustion does not discard returned evidence.

Salary/degree reuse the existing extractor. Fit maps exact posting requirements to the current resume competency profile and stores validated evidence for the existing scoring flow; it does not invent a numeric raw score. Exact links require source self-binding or ID-bound ATS provenance. Writer's existing ENRICH route receives only allowlisted raw facts/evidence; protected decisions, identities and final score fields remain forbidden. Research exceptions stay AI/CODE-owned, not new Needs Tim work.

No production execution, Writer request, merge or deployment is part of the implementation PR. A merge alone does not prove native adoption, reservation publication, schedule configuration or verified canonical completion.
