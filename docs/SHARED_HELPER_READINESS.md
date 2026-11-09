# Shared-helper transport check

Setup only. The actual Claude/Grok session returns this zero-job envelope while its slot is
unavailable. It needs no assignments, source research, Writer access or production lock.
Do not fabricate another provider's receipt. The current registry/work still must be valid,
`enabled=true` and `routingActive=true`.

Copy `assignmentId` from fresh `control/SHARED_HELPER_WORK.json`, use the actual provider/task,
a new provider-prefixed run ID and the resolved 40-character main commit. Send no extra fields:

```json
{
  "schema": "forge.shared-helper-batch.v1",
  "provider": "Grok",
  "taskKey": "FORGE_GROK_SHARED_HELPER",
  "assignmentId": "<current assignmentId>",
  "runId": "FORGE-GROK-<unique run suffix>",
  "instructionCommit": "<current 40-character main SHA>",
  "mode": "READINESS_ONLY",
  "returnTransport": "GITHUB_PR",
  "researchPerformed": false,
  "writerSubmitted": false,
  "items": []
}
```

For Claude use `Claude`, `FORGE_CLAUDE_SHARED_HELPER` and `FORGE-CLAUDE-...`.
Use `returnTransport=DRIVE` for the existing private Drive handoff, otherwise `GITHUB_PR`.
Use the normal immutable receipt path/change record or private `forge-helper-<runId>.json`
file, under the selected helper procedure. Chat output alone is transport pending, not acceptance.
If the route is inaccessible, preserve the exact blocker; do not claim delivery or seek new access.

The existing collector validates and records the probe without creating research items or
canonical transactions. The coordinator can inspect acceptance with:

`node tools/helper-routing/readiness.cjs <TASK_KEY> [repo-root] [private-work-dir]`

Run this on the existing coordinator with its private work directory (or `FORGE_PRIVATE_WORK_DIR`).

`artifactValidated=true` confirms the envelope. `returnTransportVerified=true` additionally
requires matching private collector evidence of the actual PR capture or consumed Drive packet;
the envelope's claimed transport alone cannot pass. Require both before confirming transport.
Neither proves provider authentication, source coverage, research, Writer success, native schedule
readback or provider activation. It never enables a slot or assigns jobs. Preserve the real provider/session
and transport evidence when confirming setup. After accepted setup, do not emit duplicate probes;
the coordinator must explicitly mark the slot available and publish fresh disjoint assignments.
Normal research batches still require 1–20 assigned items.
