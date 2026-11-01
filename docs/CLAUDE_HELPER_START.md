# Claude catch-up helpers

Tim authorized two intake helpers and one enrichment helper on November 1, 2026. These are supplemental **evidence preparation** tasks; existing native task ownership and schedules remain unchanged. No helper is authorized to submit to Writer or change canonical jobs. The cloud session does not need the PC folder, Writer key, local lock or Git push credentials.

Use three separate Claude chats with these launchers. Each chat reads the same current central entry, registry, common contract and assigned procedure. There is no copied private instruction set.

```
PROVIDER=Claude TASK_KEY=FORGE_CLAUDE_INTAKE_A.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow its utility route, common contract and assigned procedure from one resolved main commit. Work only your centrally reserved items. Mode is EVIDENCE_ONLY; return batches through chat if Git push is unavailable. No Writer or PC access is required. Start the first batch now.
```

```
PROVIDER=Claude TASK_KEY=FORGE_CLAUDE_INTAKE_B.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow its utility route, common contract and assigned procedure from one resolved main commit. Work only your centrally reserved items. Mode is EVIDENCE_ONLY; return batches through chat if Git push is unavailable. No Writer or PC access is required. Start the first batch now.
```

```
PROVIDER=Claude TASK_KEY=FORGE_CLAUDE_ENRICHMENT.
Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<epoch> and follow its utility route, common contract and assigned procedure from one resolved main commit. Work only your centrally reserved items. Mode is EVIDENCE_ONLY; return batches through chat if Git push is unavailable. No Writer or PC access is required. Start the first batch now.
```

The actual item lists live in `control/CLAUDE_HELPER_WORK.json`. Intake uses a stable SHA-256 key partition, excluding existing holds/in-flight work and the current ChatGPT continuation. The initial enrichment reservation covers 25 failed-source cases, leaving other work with the programmed worker. Reservations do not assert new intake or enrichment completion and do not expire automatically. ChatGPT releases each completed reservation after durable processing, or explicitly returns unavailable work with a reason. Disable `enabled` to return all reserved work to normal routing, preserving source histories and original Writer transactions.

Cloud helpers can read a clean public clone without a valid authenticated `gh` session. Do not retry an invalid Git token or request additional local permissions merely to prepare evidence. If private source access is unavailable, report the exact missing source and continue other assigned items. Source dates must come from actual source evidence; bulk-import `firstSeen` is not a posting/message date.

ChatGPT validates a returned JSON batch with `node tools/helper-routing/reservations.cjs validate <batch.json>`, then independently checks source evidence, current master/archive and pending requests before consuming it under the normal local production lock. Validation proves only routing and shape, never correctness or permission to write. Accepted source facts use the established intake/ENRICH routes and Writer verification. Terminal dispositions, original request IDs, proof references and reservation release must remain durably linked. Helpers may neither clear original holds nor force identities. Remaining holds stay explicit and do not stop unrelated items.
