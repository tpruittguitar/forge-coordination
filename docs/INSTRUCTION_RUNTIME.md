# Forge instruction runtime

This release replaces historical instruction traversal with a fresh manifest and one generated packet per production lane. It changes instruction delivery, not native schedules, provider assignments, business rules, Writer deployment or canonical data.

## Worker path

Native prompt: `PROVIDER=<actual provider> TASK_KEY=<assigned key or ROTATION> ENTRY=https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_AUTOMATION_ENTRY.txt`.

ENTRY -> fresh `runtime/current.json` -> its selected immutable packet -> the lane's fresh work/state sources. The manifest is authoritative for operational routing. Seven packets cover email, web, strategic, feasibility, posting validation, application/Writer gofer and ZipRecruiter weekly. All include common operational invariants and the resolved provider adapter. The small Claude usage-reader utility stays in `lanes/CLAUDE_AI_USAGE_READER.txt` and does not inherit job-search preflight.

Tim reassigned all Pipeline Explorer automation responsibility to ChatGPT/Codex on 2026-10-28, through at least Sunday 2026-11-01; revert only on Tim's instruction. All seven lane owners are ChatGPT. ChatGPT rotation is Gofer at 01/09/17 ET and Posting Validation at 05/13/21 ET. The historical Grok rotation map is retained because the existing ChatGPT temporary launcher reads rotations.Grok; the provider check uses the lane owner, so Grok and Claude cannot execute these lanes. Paused web, enrichment and ZipRecruiter tasks stay paused. Native schedules and scheduler-hosted utilities are separate from manifest ownership; see [the audited automation inventory](AUTOMATION_OWNERSHIP_20261028.md) for verified hosting, schedules, unresolved migrations and the authority for this temporary change. A quota reset never restores ownership.

Legacy lane URLs are generated pointers. CONTROL and STANDARD keep their historical bodies with explicit supersession notices. Evidence/provenance URLs never imply recursive reads. Missing or inconsistent artifacts hold mutations; there is no fallback to full historical policy or superseded Drive authorities. Existing substantive business-rule interpretations still require current forge-policy evidence, and row-specific saved Tim decisions remain authoritative.

## Authoring and publication

- Edit `policy/current/COMMON.txt`, shared source rules, the logical task procedure or provider adapter. Edit `policy/current/registry.json` for approved routing/schema/budget changes. Do not edit generated packets or pointers.
- Examples in `examples/` are valid JSON producer payloads. The Python checks cover documented producer invariants; they are not a replacement for the live Writer schema/admission code.
- Run `python scripts/build_runtime.py`, `python -m unittest discover -s tests -v`, and `python scripts/build_runtime.py --check`.
- Include source, generated release, current manifest and generated pointers in one reviewed PR. Keep published release directories immutable. The content-derived release ID covers source hashes, builder and schema; `provenance.json` records each input fingerprint and the historical audit basis. The manifest is written last after all artifacts validate.
- Review semantic changes against the provenance source and record approval. A successful build proves coherent generation, not that an AI summary preserved every policy nuance or a native task adopted the change.

Workers compare RELEASE_ID/task/provider and validate SHA-256 of exact bytes or the GitHub connector/Contents blob SHA. Metadata permits fingerprint validation without requiring a local interpreter in every scheduled app. The worker fetches the manifest once per run; a release published mid-run applies from the next run. A runtime that cannot check the packet fingerprint records PACKET_HASH_UNVERIFIED and continues; only a positive mismatch blocks. Operational freeze, protection and in-flight state remain live checks. The Writer's existing admission/idempotency gates remain decisive; this repo does not add a transactional release lease to Writer.

Before using packet business-rule projections, compare the current canonical rules blob SHA against the manifest binding using GitHub directory metadata. A rules change triggers a relevant current-section read, not full STANDARD/CONTROL traversal. This is needed because forge-policy can change independently. Priority employers remain a fresh dynamic digest, not a copied static company list.

## Producer validation

`python scripts/validate_payload.py <serialized-request.json>` reparses the exact bytes, validates the supported intake/ENRICH/application producer shape, and prints byte length/SHA-256. It sends nothing. If GROSS_FOUND exceeds the submitted record count, supply `--accounting <ledger.json>` with nonnegative integer counters `submitted`, `existing`, `excluded`, `held`, `unresolved`, `separately_submitted`; they must sum to GROSS_FOUND and submitted must equal records.length. Keep this accounting artifact separate from the Writer payload, together with the required candidate-level source ledger. Counters alone never prove every candidate was evaluated.

## Receipts and discovery hints

Receipt locations, uppercase counters and create-only evidence remain compatible. A small START record precedes production, immutable checkpoints preserve batch/cursor/request progress, and the concise terminal record comes last. Pending/accepted/verified are separate. VERIFIED always needs write RESULT SUCCESS, later independent COMPLETE index, and matching exact-row readback after COMPLETE. Email keeps full-body and per-candidate accounting, including provider-hidden/unseen obligations. No checkpoint may silently advance past unfinished email/candidate work.

`python scripts/index_receipts.py` generates `state/latest.json`: latest terminal receipt hints, latest email-state snapshot and weekly-pass receipt paths. The `index-receipts` Action refreshes this after main-branch receipt changes, retries bounded concurrent pushes, and never mutates Writer data. Its bot commit does not recursively trigger itself. INDEX-BOT and existing APPLY-BOT commits are machine-generated provenance labels; provider/run labels remain mandatory for AI commits.

The hint is neither a lock nor a pending ledger. Workers read its source artifact and validate fresh Writer state. A missing, stale, future-dated or inconsistent pointer uses a scoped receipt listing. Carry-forward must preserve all pending obligations; the newest receipt's existence does not prove older writes resolved. Before a lane is paused/reassigned, the gofer reconciles remaining durable requests. This is an explicit lane duty, not a claim that a new verification daemon was deployed.

## Conflict resolutions and retained limits

Resolved mechanically: all lanes have one explicit read path; full-document version fallback is removed; all packets carry three-proof verification; checkpoint vs final-receipt duties are distinct; pending writes cannot be labeled COMPLETE; GitHub receipt-storage outage differs from unavailable current policy/live index; schedule offsets are not locks.

The historical agency amendment conflicts about a client discovered before first intake. This release does not invent a new agency/company identity rule. It holds only that ambiguous identity decision for Tim, preserving source evidence, while ordinary unknown-client agency intake and unrelated work continue. Existing separate agency/client rows remain separate, and an existing agency COMPANY is never renamed. A ruling should replace this hold in the source rules and regenerate the release.

The edit-request Action now accepts only `proposals/` and `usage/` targets and requires base_blob_sha for an existing target. Controls, runtime, state and immutable receipts/handoffs cannot be rewritten through a self-declared requested_by field. Approved instruction changes use reviewed PRs. This is a data-integrity convention/check, not an assertion that free-plan repository permissions enforce every owner rule.

Still required: actual scheduled-runtime acceptance, live throughput measurement, authoritative claim/lease support if the Writer does not already supply it, and a bounded identity/work-page endpoint if existing master reads prove costly. The email lane retains its current master/archive/in-flight dedupe obligation; this repository does not pretend row_readback can discover unknown identities. No new Writer API, scheduler integration, service, cloud account or auto-merge was added.

## Rollout and rollback

1. Review semantic preservation, owner map, examples, schema and generated hashes in the PR. A merge updates the stable ENTRY pointer for all native tasks that already use it; it is an instruction cutover. No native automation was changed merely by opening this PR.
2. For a staged pilot, publish candidate artifacts on the review branch and run one authorized read-only/captured-fixture posting-validation check against that branch. Do not start duplicate production owners. Only promote ENTRY/current manifest to main when the delivery path and semantics are accepted. A full shadow execution in provider runtimes is not claimed by local tests.
3. On cutover, inspect actual native prompt pointers and connectors. Verify one independent scheduled run per lane: fresh release/hash, live gate, useful output, durable pending state, and RESULT/COMPLETE/row-readback for any claimed VERIFIED write. Check the weekly addon in its due window and the Grok stand-down case. An unsupported runtime is an exact blocker, never an invented successful adoption.
4. Compare at least ten representative runs per active lane, plus a weekly pass and source-failure/no-work case. Track setup calls/bytes/seconds, time to first useful action, full-body/source coverage, unique submitted/verified rows, pending age, repeated holds and useful outcomes per available budget. Do not equate fewer input characters with equal savings in billed usage or wall time.
5. Roll back instructions with a reviewed revert or previously validated release/current-manifest pair. For the initial migration, revert generated ENTRY/pointers and their supersession notices together if necessary. Reconcile any in-flight requests; never restore old Writer index data, reactivate superseded Drive policy or blindly replay work. Native schedule rollback is a separate approved operation.

## Baseline and budgets

The audited full fixed path was roughly 60,700 tokens (character count / 4), excluding state and research. Initial generated packets are roughly 3,100–4,200; ENTRY plus manifest is approximately 1,640 more. Total normal startup is therefore roughly 4,800–5,800 fixed tokens, about 90% less than the full path. Existing compact enrichment lanes were already around 5,000, so this mainly removes the heavier paths and ambiguity; it does not promise every lane gets faster.

The build caps ordinary packet estimates at 3,500, email at 5,000, and the conditional weekly addon at 1,600. These are explicit reviewed ceilings, not exact tokenizer counts. The initial 3,000-token packet goal was relaxed to preserve operational gates and email completeness. Dynamic worklists, priority digest, email bodies, live policy changes, candidate ledgers, source evidence, and per-batch current-manifest refreshes are additional measured costs. CI rejects budget drift and stale generated artifacts.

## Application outcome ownership — Tim 2026-10-31

FORGE_APPLICATION_OUTCOME_TRACKER is an independent scheduler-hosted utility using lanes/CHATGPT_APPLICATION_OUTCOME_TRACKER.txt, hourly at :42 America/New_York. It owns routine application confirmations, rejections and recruiter correspondence, including inherited routine Gofer archive cursors. Gofer retains its existing :12 schedule but handles exceptions only. The new permission for grounded company/title matching and the requirement to ask before adding missing jobs supersede the October 26 automatic CREATE_NEW instruction. The native prompts must adopt this cutover as well as the regenerated Gofer/email packets. Existing paused lanes remain paused.

## Shared native automation launcher — 2026-10-31

All six active Codex Forge automations now launch through control/FORGE_SHARED_AUTOMATION_ENTRY.txt with only actual provider and task identity in their saved prompts. The entry reads control/AI_AUTOMATION_TASKS.json and policy/current/AI_AUTOMATION_COMMON.txt at one resolved repository revision. Production lanes continue through the existing immutable packet runtime; outcome tracker, usage reader and stack health use centrally routed procedure files. Schedules and notification settings remain in the native scheduler. Task behavior and shared rules are no longer maintained in isolated native prompt copies.
