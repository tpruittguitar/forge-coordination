# Direct OpenAI pilot admission — disabled by default

The existing `FORGE_APPLICATION_WRITER_GOFER` coordinator owns this narrow operation. OpenAI is the execution provider of the explicitly selected pilot, not a replacement for any legacy helper. No registry record, schedule, release or live job is added by this implementation. No Hermes identity is needed. Existing claims—including disabled legacy schedules—still exclude work.

## Host invocation

The authorized TIMMAY coordinator host embeds this callable entry point using its existing read-only capabilities. It must not call the general coordinator `apply` launcher.

```js
const pilot = require('./tools/programmed-coordinator/direct-pilot.cjs');
await pilot.launch('reserve', {
  root: coordinationDirectory,
  ids: reviewedFiveCanonicalIds,
  grantId: uniquePilotRunId, // FORGE-OPENAI-PILOT-...; never reuse for new work
  checkpointDir: durablePrivateDirectory,
  readerOptions: existingAuthorizedReadCapabilities,
  readFunding: existingVerifiedGrantOnlyFundingReader,
  readEvidence: existingReviewedPublicCaptureReader
});
// Separate explicit invocation, after successful accounting publication:
await pilot.launch('run', {
  root: coordinationDirectory, grantId: uniquePilotRunId,
  readerOptions: existingAuthorizedReadCapabilities,
  readFunding: existingVerifiedGrantOnlyFundingReader,
  readEvidence: existingReviewedPublicCaptureReader
});
```

These names denote in-process host functions, not JSON assertions, arbitrary module paths, CLI secrets or new services. The reader capabilities are the existing `host-readers.cjs` interface: `W`, `writerRead`, `readReceiptIndex`, `readPolicy`, `readAdmissionEvidence`, `classifyNeverConsider`, `writerSourceRoot`. `createPilot` reuses the current canonical/policy/receipt consistency checks and source-bound research admission; its publication check uses the direct release instead of the old ChatGPT/Hermes route. `readFunding` returns genuinely verified `{project, credit, expectedSid}` in the native-five contract. `readEvidence` returns `{evidence, priorEvidenceReviewed:true, reusableResult?}` after inspecting saved/returned work. Never manufacture these assertions from missing data.

`launch` checks fresh clean main and the published release before acquiring the production lock identified in the current common contract. It uses that exact existing lock throughout each invocation. Reserve re-reads the canonical view and all claims, compares before save, and atomically writes both five claims and worst-case budget into **control/SHARED_HELPER_WORK.json**. Its `directPilot` accounting is part of that existing authority, not a second ledger. The existing shared-page generator and accounting publisher publish the reservation. A publication failure preserves the reservation and prevents `run` from passing its fresh-published check; retry existing accounting publication, never create replacement claims.

Run reads the persisted grant and each current row, then invokes `native-five.cjs` with the implemented authority verifier. Claims must be published, exact, unreturned, disjoint and unchanged. Native credential access is reached only after these checks and durable local reservation. All result data stays in the private checkpoint; public accounting contains counts/status and hashes only. Run records completion/hold and publishes accounting using the existing publisher; it never submits to Writer or collects helper return envelopes.

## Explicit release, absent in this patch

The coordinator owner must review/publish `control/OPENAI_DIRECT_PILOT_RELEASE.json` through the normal code/config authority. There is deliberately no live release file or command to enable one. Its schema is `forge.direct-pilot-release.v1`: `enabled:true`, `ownerTask:FORGE_APPLICATION_WRITER_GOFER`, `ownerProvider` equal to the current registry owner, `provider:OpenAI`, `host:TIMMAY`, `purpose:FIVE_JOB_LOCAL_EVIDENCE_ONLY`, a real `authorizationReference`, bounded `expiresAt`, `maxGrants` and `budgetMicrousd`. First activation should use `maxGrants:1`, `budgetMicrousd:10240`. Published intent is not proof of fresh grant credit; the funding reader verifies that separately.

No release, absent/expired source proofs, missing host capabilities or unknown ownership means no live launch. The existing installed restricted Default credential is not read during review/testing.

## Continuity and Writer boundary

Each grant pre-reserves $0.01024 without refunds, including ambiguous outcomes. All grant reservations accumulate in the same work-file accounting and cannot exceed the reviewed release budget (hard maximum $1), current credit less $10, or the existing Nov 29 cutoff. New output directories or grant IDs cannot reset this accounting. No automatic loop is provided.

A subsequent exact-five grant additionally requires the previous grant to be LOCAL_COMPLETE and a separately published `reviews[previousGrantId]` containing `outcome:VERIFIED`, an independent `reviewer`, and the exact `resultSha256`. That digest binds the result summary and the private checkpoint SHA-256, not just counts. Review does not mean Writer verification. Unknown/held batches cannot authorize continuation. The source rows and claims are rechecked for every new grant.

Pilot claims fence the existing shared allocator, legacy enrichment planner and ATS/Writer transaction gate. Its own reader can exclude only its active pilot reservation, never original Writer transaction fences. Results remain RETURNED_PENDING_REVIEW; no automatic release, transfer, expiry or reclassification is implemented. Normal coordinator reconciliation and Writer authority must explicitly take over any approved effects later. The helper return validator refuses this pilot identity, so local results cannot silently become Writer submissions.

## Review and verification

Synthetic tests cover release-off behavior, exact-five reservations, late competing owners, disabled legacy ownership, protected rows, original receipts, failed persistence/publication, grant verification, cumulative limits, continuation gating and unchanged helpers. Native tests cover local evidence, credential-before-request ordering, capped transport, timeouts, unknown outcomes and resume.

This is a draft implementation. Review the code and host capability binding before publishing an enabled release. This patch itself activates nothing and contains no real job IDs, grants or credentials.
