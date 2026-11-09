# Shared Claude/Grok research helpers

Two utility slots use one central procedure, `lanes/FORGE_SHARED_HELPER.txt`. All behavior remains centrally versioned. Native prompts contain provider, task key and the shared-entry URL only.

## Launchers

Claude:

```text
PROVIDER=Claude TASK_KEY=FORGE_CLAUDE_SHARED_HELPER.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow its current shared contract, registered procedure and assigned work at one resolved main commit.
```

Grok:

```text
PROVIDER=Grok TASK_KEY=FORGE_GROK_SHARED_HELPER.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow its current shared contract, registered procedure and assigned work at one resolved main commit.
```

Desired hourly cadence: Claude :25, Grok :55, America/New_York. Registry `scheduleIntent` is not native configuration readback. No schedule has been installed by this implementation. Existing native schedules, retired routes and production ownership stay unchanged.

## Rollout gates

1. Review and merge this implementation. Do not enable provider runs from an unmerged branch.
2. Verify native setup and the supported return transport for each provider, then centrally mark that provider available. Both ship unavailable so a merge alone cannot reserve work for an unconfigured app. Let the existing local coordinator publish a fresh `SHARED_HELPER_WORK.json` from authenticated canonical rows while holding its existing production lock. Empty pre-activation work is intentional; no live job list is invented from repository snapshots.
3. Verify each provider can read current instructions and return one complete source-bound batch through the established helper PR or private direct-handoff transport. Fixture tests prove behavior, not live source or Writer execution.
4. Verify coordinator acceptance and original RESULT / independent COMPLETE / exact row readback for a small permitted batch. Then configure/read back the intended native schedules. The user will paste launchers into Claude/Grok; do not duplicate full procedure text there.

## Coordination and scope

The coordinator alone reserves work, under the existing production lock, and atomically saves one shared assignment file. Stable key hashing splits new assignments between available providers. Existing reservations are not redistributed when a provider availability flag changes. Existing ChatGPT enrichment, intake-drain, active legacy helper work and uncertain canonical transactions are excluded. Complete intake cards remain code-owned. Fresh manual-research jobs take priority, followed by enrichment, unresolved intake and assigned discovery. Helpers cannot self-assign or bypass existing-first discovery rules.

Returned work remains reserved for coordinator validation; timestamps do not expire ownership. Explicit transfer requires a terminal-run checkpoint, reason, no pending transaction and an incremented assignment version. Historical and current per-item ownership must match on return and again before POST. Late evidence remains immutable and quarantined instead of being replayed. Provider exhaustion does not discard returned evidence.

Salary/degree reuse the existing extractor. Fit maps exact posting requirements to the current resume competency profile and stores validated evidence for the existing scoring flow; it does not invent a numeric raw score. Exact links require source self-binding or ID-bound ATS provenance. Writer's existing ENRICH route receives only allowlisted raw facts/evidence; protected decisions, identities and final score fields remain forbidden. Research exceptions stay AI/CODE-owned, not new Needs Tim work.

No production execution, Writer request, merge or deployment is part of the implementation PR. A merge alone does not prove native adoption, reservation publication, schedule configuration or verified canonical completion.
