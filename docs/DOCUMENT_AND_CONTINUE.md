# Writers process independent work; Gofer/AI reconciles exceptions

Tim's November 4 ruling: a source/card exception, Writer contention or failed audit publication must not stop unrelated work. This does not authorize replaying uncertain requests or bypassing canonical protections.

## Evaluation path

Full alert capture → `routine-handoffs/alert-recovery.cjs` → saved candidate cards → `routine-handoffs/assignments.cjs` → `relevance-screen/screen.cjs` and `prepare.cjs` → normal Writer admission and independent verification. The relevance screen admits plausible target-function roles and retains unclear scope for the assigned AI researcher. Writer still owns final admission, deduplication and Never Consider.

New LinkedIn alerts can now create source inventory, rather than requiring an entry in the historical recovery ledger. Capture is acknowledged only after candidate persistence. Handed-off emails remain pending until their visible cards have durable dispositions. Unseen result obligations remain explicit; visible-card completion never claims complete historical coverage.

## Abnormal cards and unsupported senders

The outcome-tracker AI and Gofer inspect `node tools/routine-handoffs/exceptions.cjs <live-repository>`. Read the exact saved full message privately, run the existing alert pre-parser where applicable, and investigate unclear identity or function. Do not use notification snippets or infer missing locations.

To repair a card the normal parser cannot handle, save `<privateDirectory>/alert-reviews/<sourceSha256>.json`:

```json
{"schema":"forge.alert-card-review.v1","messageId":"original Gmail ID","sourceSha256":"full source hash","reviewedBy":"CHATGPT","taskKey":"FORGE_APPLICATION_WRITER_GOFER","cards":[{"title":"exact title","company":"exact employer","location":"exact location","url":"exact observed job URL","quote":"contiguous original full-body quote containing all four fields"}]}
```

`FORGE_APPLICATION_OUTCOME_TRACKER` is also an allowed reviewer. The next normal mail pass independently checks the source binding and exact quote, persists the cards, then sends them through the existing screen. Quotes stay private. Conflicting originals, incomplete identities and unsupported evidence stay actionable AI exceptions. A review cannot declare a canonical write complete.

## Writer contention and uncertain responses

AUTO documents transport loss, malformed responses and generic Writer errors as DEFERRED, retaining the original response or durable pre-POST intent. It continues to the next independent candidate. A pending existing request is never POSTed again. Completed/skipped and deferred cases are distinguished; a partial batch is not falsely finalized.

The continuation record binds every deferred request to its original candidate hash and identity. Later AUTO runs fence those identities, but do not globally latch unrelated work. The local relevance driver likewise preserves pending items while preparing and submitting other READY jobs. A single invalid source card becomes a held review item rather than aborting selection. Waiting for a receipt is not a reason to idle the whole queue.

Gofer/AI must attempt reconciliation, not merely acknowledge the log: inspect the original payload/response and exact request; read independent receipt_index; read request_result only after COMPLETE; then read exact current rows and compare identity, provenance and write IDs. `source-intake/reconcile-probe.js` accepts current second-resolution AUTO run IDs. Resolve proven outcomes through the existing recovery path. Missing original acceptance, ambiguous identity or genuinely unknown mutation remains fenced. Record what was tried, the evidence, owner and next retry condition; no blind replay.

Writer cases appear in the shared AI exception queue with `alsoAssignedTo=FORGE_APPLICATION_WRITER_GOFER`. A source-bound WAITING_SOURCE_CHANGE review may use reason ORIGINAL_WRITER_EVIDENCE_INCOMPLETE and retryCondition ORIGINAL_WRITER_EVIDENCE_CHANGED. This records the next reconciliation condition, not success. Existing questions for Tim are raised only when an actual decision is required.

## Audit failure

The launcher retains unpublished local commits and checkpoints and records AUDIT_PENDING under the existing private `audit-failures` directory. Publication is retried on the next launch. A nested finally releases the execution lock even if publication or failure recording throws. Gofer inspects and reconciles retained accounting. Independent lanes may continue. Real source-policy conflicts still prevent using unsafe merged state; no reset, force push or evidence loss is permitted.

Explicit Writer freeze, unavailable current policy, canonical integrity failure or failed durable pre-POST checkpoint remains a real stop for affected submissions. The normal script/identity locks and protected application states remain authoritative.
