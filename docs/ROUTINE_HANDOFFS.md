# Direct handoffs and routine processing

The normal coordinator is the existing Windows five-minute task. GitHub evidence-only PR collection, validation, assignment replenishment, source extraction, deduplication, scoring, Writer transactions/verification, pagination and accounting run as code. Local Chrome is the saved-search worker; no recurring metered browser service is required.

The existing hourly outcome tracker is the single connector host for Gmail and private Drive artifacts. `node tools/routine-handoffs/source-bridge.cjs script <existing-private-config>` emits trusted JavaScript for `functions.exec`. It has no browser or AI calls. Source bodies go straight to private files; only summary counts return to the model. This still requires one AI-host wake-up because connector authorization belongs to the app. A fully unattended Gmail API collector would need its own authorized Google connection. Do not extract connector credentials or introduce another recurring AI run.

Drive delivery uses plain-text (text/plain MIME) immutable `forge-helper-<runId>.json` files in the existing AI_Coordination folder. Code follows opaque page tokens even across empty filtered pages, validates unchanged metadata, exact byte count and full JSON, then feeds the existing schema/assignment/routing validator. Outcomes stay private. Upload is not canonical acceptance. Incomplete, changed or invalid artifacts remain pending. Public GitHub evidence-only PR collection remains independently scheduled every five minutes.

New native report-page polling is disabled by default. Already captured full reports still drain through the existing validator; old malformed reports and historical coverage gaps remain explicit. `nativeReportPolling: true` is an explicit recovery option, not a new AI browsing schedule. TinyFish launches remain disabled in the existing private configuration.

Gmail enumeration retains the fixed window, 48-hour overlap, every pending ID and complete opaque-token page chain. Full existing captures are reused; partial/missing bodies are retried. Capturing messages does not advance processed coverage until durable dispositions are written. Code applies conservative templates, canonical matching, stable Writer request IDs, unknown-POST fences, independent COMPLETE receipts and exact later row readback. Private source-bound reviews and protected decisions remain intact. Job alerts stay discovery obligations, even after outcome classification.

`node tools/routine-handoffs/exceptions.cjs <live-repository>` emits only unresolved AI cases with stable source/reason IDs. The retained outcome tracker handles those and its existing calendar/manual-note duties. Research, posting freshness and Gofer exceptions remain active. No source, worklist or daily processing cap is introduced.

Retire only the redundant hourly helper-coordinator heartbeat after verifying a successful scheduled code run, full source capture, direct artifact delivery and the retained outcome-tracker prompt. Save actual automation status, last successful code receipt and outstanding gaps in the checksheet. A schedule being enabled is not proof of execution. Restore or repair the affected route if source coverage regresses; do not silently discard pending work.

The 30–50% token reduction remains an estimate. Record eliminated scheduled wake-ups separately from measured tokens per verified disposition, backlog throughput and oldest pending age.

Validation: run the Node suite in `.github/workflows/programmed-coordinator-test.yml`, rebuild instruction packets with `python scripts/build_runtime.py`, then check the runtime and Python tests. Live capture can be verified privately without applying unmerged code to canonical state.
