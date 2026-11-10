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

## Rollout and adoption

Instruction changes go through a reviewed PR; native runs read merged main. The first real assigned run verifies setup and transport while doing useful work. Separate or repeated zero-job readiness probes are not a prerequisite. Do not change provider availability, assignments, schedules or native enabled state as part of an instruction update. Existing coordinator ownership and production locks remain authoritative.

Verify the next actual provider run's instruction SHA, source-bound artifacts, collector capture and original RESULT / independent COMPLETE / exact row readback. Local fixture tests prove the continuation and validation behavior, not provider runtime capacity, live research, transport access or canonical writes.

## Compact current work without a shell

The canonical assignment pool remains `control/SHARED_HELPER_WORK.json`. This PR does not publish a frozen live-work copy. After merge, the existing authorized coordinator generates the first current pages from its actual assignment state; use the exact full-work fallback until those pages exist. The coordinator also publishes derived indexes at `control/shared-helper-pages/<TASK_KEY>/current.json`, with immutable content-addressed 20-item pages for each provider. These are projections, not new reservations, leases or authority to start overlapping runs. Returned, consumed, protected, unavailable and future-retry jobs stay excluded by the same selector as the shell command.

1. Resolve fresh **operational main** independently from the instruction SHA pinned for the run. At that exact commit, read your provider index and GitHub directory/nonrecursive tree metadata for `control/SHARED_HELPER_WORK.json`. Compare the metadata blob SHA to `index.source.gitBlobSha`; a matching path or timestamp is not enough. Use a directory listing or descend nonrecursive Git trees to the exact path. Do not fetch the full base64 file body or recursively scan the repository just to obtain a blob SHA.
2. Require the correct task/provider, routing gates, and unexpired `validUntil` when present. Read only `pages[n].file` at the same operational commit and check its `gitBlobSha` against GitHub file metadata, or hash the actual bytes against `sha256`. Keep `source`, page number, assignment and source versions bound together. Tool-only providers do not need to calculate SHA-256 when they can verify actual Git blob metadata. Never claim a hash check that was not performed.
3. Recheck `validUntil` and the current work-file blob through fresh-main metadata before each item and return. Reuse the page only while the blob is unchanged and the index remains unexpired. If changed, load the new bound index/pages, recheck ownership, protection and versions, and skip matching per-item checkpoints. A returned item disappearing from the actionable projection is not permission to research it again or silently drop its delivery obligation.
4. Missing, stale, expired, mismatched or incomplete pages require the exact fresh full-work file and existing selector/ownership rules, or a scoped refresh blocker if that fallback cannot be read reliably. Never keep using an older projection. Shell execution can always read the canonical source directly. When counting manually, count distinct eligible assigned jobs across available providers; order lanes by descending count, ties Research, Enrichment, Intake, Discovery, then assignedAt/key. Work only your own reservations.

The coordinator binds each page set to the **exact source bytes** with SHA-256 and Git blob SHA, writes immutable pages before switching current indexes, and regenerates after assignment updates and return settlement. Publication validates their source/content bindings rather than accepting arbitrary files under a broad directory permission. A retry boundary can change eligibility without changing source bytes; `validUntil` prevents an old priority view from surviving that boundary. No page is evidence that provider transport or Writer execution succeeded.

## Preparing complete returns

Use [the shared return guide](SHARED_HELPER_RETURN.md) only at delivery time for the generated assignment-bound draft, no-shell checklist and exact-byte preflight. Publish complete actual JSON, then read back the remote receipt content. A real commit SHA containing placeholder text is not evidence delivery. The template is intentionally invalid until real research fills it; no generated defaults assert source or Writer success.

## Sustained work in each invocation

There is no fixed two-item sample, twenty-item run limit, target batch count, or assumed number of minutes. Each provider should make sustained progress on its assigned eligible backlog until an actual limit or justified stop applies. The shared work-page and artifact limit stays at **20 items** and **2 MB per artifact**. The Writer's separate 25-row transaction envelope is not a research cap.

1. Respect one active invocation per provider, including manual starts. Skip an overlapping run; do not infer duplicate schedules or expire another run’s ownership. A local lock is not a cross-app lock unless all invocations demonstrably share it. Reuse already-prepared pending artifacts before researching those jobs again. Start at fresh assigned work with current ownership/protection checks. Use the available source, file and delivery tools already authorized in that provider's actual session. A connector or local Writer configuration in another app is not proof of access here. Record concrete errors or visible limits rather than assuming provider quotas.
2. Research and capture evidence for distinct assigned items. Reuse previous evidence and instruction reads. A source failure blocks that item or source route, not unrelated assigned jobs. No sample-size target substitutes for working through the queue.
3. Validate and publish each artifact as it is ready through the existing supported route. Partial artifacts are valid: do not wait to fill 20 before saving useful evidence. If output or payload size binds, flush a smaller artifact and continue with the next one in the **same invocation**. Never truncate source evidence to increase counts. Use unique run IDs and immutable files. Do not wait for every researched job or Writer result before continuing independent research.
4. Keep a per-item checkpoint of exact identity, assignmentVersion/sourceVersion, artifact path/run ID and delivery state. A page cursor covers the whole returned page, not just the two jobs a provider happened to finish. Advance `nextAfter` unchanged only after every item on that page is durably accounted for; otherwise retain and finish the remaining page items first. On `cursorReset`, skip previously checkpointed items only when the assignment/source versions still match. Never silently omit unfinished work or repeat completed research because collector state has not caught up.
5. Continue later pages and then other eligible assigned lanes. The helper `next` output explicitly distinguishes `continuation.maxArtifactItems` from `runItemCap: null`, reports remaining items after the page and requests `CONTINUE_THIS_INVOCATION` when more are available. `RECHECK_FRESH_WORK` means recheck current eligibility and local checkpoints, not canonical completion or permission to self-assign.
6. If the existing delivery route is unavailable, preserve exact artifacts as `TRANSPORT_PENDING` and continue independent research while evidence can be preserved. A claimed local path, chat summary or prepared JSON does not prove remote delivery. No new credentials, endpoint, manual relay or permissions are implied. Stop affected work if no safe evidence-preservation route exists; continue other authorized work when possible.

### Legitimate stopping and continuation

Stop only when no eligible assigned work remains, an observed provider/tool limit prevents further work, an actual runtime deadline requires final checkpointing, a necessary access/safety dependency blocks the remaining work, or Tim stops the task. Do not invent a fixed runtime allowance or treat an unknown quota as exhausted. Leave enough of the **actual available** runtime to flush partial artifacts and preserve continuation. Neither one completed artifact nor the next hourly schedule is a reason to stop an otherwise productive invocation.

The terminal checkpoint must record elapsed time, the exact stop condition with observed limit/error when applicable, cumulative distinct attempted/prepared/delivered/verified/blocked counts, artifact paths and delivery state, cursor, unfinished page items and retry condition. Explain when counts are unknown; never invent capacity or completion. Retain pending artifacts for delivery rather than researching their jobs again. Resume on the next already-configured invocation only after a real stop, refreshing ownership, source versions and protection. No schedule changes, overlapping provider invocations, reassignment, manual batch-copy requests, or Writer replay are authorized.

Review actual runs on useful source-bound artifacts, distinct jobs covered, delivered versus verified effects, elapsed time and concrete stop reasons. An assertion that 2 of 298 jobs is an “artifact size” does not establish a runtime limitation. These instructions do not guarantee all 298 can be researched in one invocation; that depends on observed source and provider capacity.

## Coordination and scope

The coordinator alone reserves work, under the existing production lock, and atomically saves one shared assignment file. Stable key hashing splits new assignments between available providers. Existing reservations are not redistributed when a provider availability flag changes. Existing ChatGPT enrichment, intake-drain, active legacy helper work and uncertain canonical transactions are excluded. Complete intake cards remain code-owned. Each invocation starts with the largest current eligible backlog across Research, Enrichment, Intake and Discovery, counting distinct actionable jobs after ownership, protection, returned-work and retry exclusions. It then works the other lanes as capacity allows. Research is not an unconditional override. Existing reservations stay intact; changing backlog sizes does not steal jobs or replay completed work. Helpers cannot self-assign or bypass existing-first discovery rules.

For Grok, ready new enrichment goes directly to the existing Drive WRITER_QUEUE under [Grok direct Writer](GROK_DIRECT_WRITER.md), without the helper coordinator or its local lock. Do not duplicate previously delivered or uncertain work. Other ready returned work proceeds through the existing locked returns-only Writer adapter; it remains reserved during validation and timestamps do not expire ownership. Do not wait for unrelated mailbox/source intake work or an evidence PR approval. Explicit transfer requires a terminal-run checkpoint, reason, no pending transaction and an incremented assignment version. Historical and current per-item ownership must match on return and again before POST. Late evidence remains immutable and quarantined instead of being replayed. Provider exhaustion does not discard returned evidence.

Salary/degree reuse the existing extractor. Fit maps exact posting requirements to the current resume competency profile and stores validated evidence for the existing scoring flow; it does not invent a numeric raw score. Exact links require source self-binding or ID-bound ATS provenance. Writer's existing ENRICH route receives only allowlisted raw facts/evidence; protected decisions, identities and final score fields remain forbidden. Research exceptions stay AI/CODE-owned, not new Needs Tim work.

No production execution, Writer request, merge or deployment is part of the implementation PR. A merge alone does not prove native adoption, reservation publication, schedule configuration or verified canonical completion.
