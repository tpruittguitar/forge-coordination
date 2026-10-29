# Receipt recovery

Tim authorized this worker on October 29, 2026. It is ordinary JavaScript on GitHub Actions, not a recurring AI task. `receipt-recovery.yml` runs hourly at :18 UTC (also :18 Eastern), serialized with `writer-verify`. GitHub scheduling can be delayed. Manual dispatch is available. No model calls or AI tokens are required for normal runs.

The worker reads the GitHub receipt index at a verified blob revision and uses the existing authenticated Writer GET routes for exact row and terminal-archive checks. It does not POST, use `submit`, invoke pending `request_result`, change the master, edit canonical receipt states, release locks or replay writes. Original failures and their replay fences remain intact. No Apps Script deployment or expanded credentials are needed.

For a failed write, every saved after-image hash must match one exact current/archive row. A changed row can be proven only through a chronological chain of other independently COMPLETE Writer transactions whose before/after hashes connect the original after-image to the observed row. Conflicting aliases, duplicate/missing rows, the original before-image, unrelated later changes, invalid times or missing bindings remain escalated. A current row merely having the same ID/title is insufficient. Full row text is never published; the proof records IDs, Writer hashes, independent SHA-256 hashes and read times.

Saved verification requests are also inspected. Canonical COMPLETE must be authoritative and durable, and requested IDs must be bound to its saved items and present exactly in the master or terminal archive. Missing batch-envelope/child-ID bindings are escalated, never guessed. The ordinary verifier now retries unresolved results indefinitely, slowing to a six-hour cadence after 24 hours. Malformed requests remain rejected.

`verify/recovery/latest.json` is the current bounded sweep. Up to 100 cases are checked per run, oldest checks first; a persistent per-request check map prevents starvation when the backlog exceeds one pass. Deferred cases remain visible. Partial reports carry `inProgress: true` and cannot clear GUI warnings. An unavailable source fails the workflow; a failed per-case read is explicitly recorded and retried on the next sweep.

Immutable evidence is added under `verify/recovery/resolutions/` or `verify/recovery/escalations/`. An escalation names the missing evidence, ChatGPT Gofer as owner and the next action. These are recovery records, not a second job master. They do not automatically authorize changes to application states or any resubmission.

Pipeline Explorer displays only current faults and unresolved verification needs. Distinct write incidents are separate from receipt references: seventeen aliases for one failed batch are one incident. Proven recoveries disappear from the fault panels; their immutable evidence remains on GitHub and never adds to today's completed-write throughput.

A saved exact recovery is a durable, point-in-time resolution. An older report or a later legitimate row change does not reopen it. Reuse requires the exact unchanged canonical receipt, its saved item bindings, complete row/hash evidence and no contradictory receipt-chain evidence. Changed receipts, conflicting aliases or invalid proof are checked again and remain visible when unresolved. The GUI independently validates those bindings. A stale or unavailable sweep remains an observation-health issue; it does not turn a proven old failure into a new fault.

Inspect the Actions run, its artifact and the saved case evidence when a check fails. Manual investigations or newly authorized repairs can be performed by Gofer through the Writer; the recovery worker itself never resends the original request.
