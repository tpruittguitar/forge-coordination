# Complete shared-helper returns

Optional deliver-time reference for every provider using `forge.shared-helper-batch.v1`. Read this when preparing an artifact, not as extra startup preflight. Use the common source/ownership rules and [supported delivery path](DIRECT_WRITER_PROCESSING.md). This guide adds no transport, permissions, assignments or Writer authority.

## Generate a draft from current assignments

With a current checkout and authorized shell, run:

```sh
node tools/helper-routing/shared-return.cjs template <TASK_KEY> <actual-instruction-main-SHA> <unique-runId> [nextAfter] > return.json
```

The generator uses the same current selector as `shared.cjs`, for either provider. It copies exact assignment IDs/versions and initial company/title/location, at most 20 items. It does not fetch sources or mark research complete. Optional `nextAfter` has the same checkpoint rules as normal work selection. Never advance it past unfinished page items.

The generated JSON has this shape. The abbreviated identity strings below are explanatory, not usable evidence; the generator supplies actual values. Nulls intentionally fail validation:

```json
{
  "schema": "forge.shared-helper-batch.v1",
  "provider": "<actual provider>",
  "taskKey": "<assigned task>",
  "assignmentId": "<current assignment>",
  "runId": "<unique FORGE-provider-run>",
  "instructionCommit": "<actual 40-character instruction SHA>",
  "writerSubmitted": false,
  "items": [{
    "kind": "ENRICHMENT",
    "primaryId": "<exact assigned ID; use key for a candidate>",
    "assignmentVersion": 1,
    "sourceVersion": "<exact assigned version>",
    "writerSubmitted": false,
    "recommendation": null,
    "sourceEvidence": {
      "company": null, "title": null, "location": null,
      "url": null, "observedAt": null, "quote": null,
      "capture": {"kind": "TEXT_EXTRACT", "text": null}
    }
  }]
}
```

Without shell, construct the same full object from fresh, verified assignment pages. Do not publish this example, a template, `PLACEHOLDER_AGAIN`, a Markdown block, an abbreviated object, or a promise to upload later. The file/commit tool's **content argument must contain the complete actual serialized JSON**. If the tool cannot carry it, split into smaller complete artifacts or preserve `TRANSPORT_PENDING` through the already-authorized route. Never replace the content with a placeholder to obtain a commit SHA.

## Fill only what was actually researched

- Recheck exact employer/title/location/requisition and assignment/source versions. Assigned identity is not proof that the source matches. Keep immutable originals and their provenance.
- Ready items use `ENRICHMENT_EVIDENCE_READY` or `INTAKE_READY` according to kind. Supply the actual source URL and observation time, one exact contiguous quote, and either the real source-byte SHA-256 or verbatim `capture.text`. With capture and no hashing tool, omit `sourceSha256`; never invent one. Preserve captured text including line breaks. Do not join separated snippets, paraphrase quotes, reconstruct postings, or edit the capture to fit a quote. Capture minimum is 300 characters, maximum 200,000 UTF-8 bytes.
- Optional `sourceEvidence.fit.requirements` contains actual 30–1500 character source quotes. Salary facts must be employer-posted base pay with currency/period for this exact role. Similar-posting salaries, search summaries and aggregator estimates are not employer-posted evidence for the assigned job. No inferred scores, qualifications, protected decisions or identity changes.
- Non-ready items use `SOURCE_BLOCKED`, `RESEARCH_INCOMPLETE`, `EXISTING_CANONICAL` or `PROTECTED_SKIP`, with actual `reason`, `researchOwner`, `retryCondition` and source identity. Remove unused null capture/proof fields rather than inventing source facts. A blocked or truncated page does not prove `NOT_STATED`. Do not use a blocker to claim research that never occurred.
- Keep `writerSubmitted:false` only as a truthful evidence-return declaration. Prefer explicit per-item false for compatibility. An item may omit it only when the batch explicitly declares false; missing at both levels, null, non-boolean or contradictory flags are rejected. Never alter an old artifact to add flags. Validation of a new return does not authorize replay of an original Writer attempt.

## Check exact bytes before and after publication

```sh
node tools/helper-routing/shared-return.cjs validate return.json
```

This read-only preflight reparses the actual UTF-8 file, enforces current shared-return validation and the 2 MB artifact limit, and prints its exact byte count/SHA-256. It never repairs JSON, edits source bytes, publishes files, invokes Writer or changes assignments. Fix errors before delivery, split oversized artifacts without truncating evidence, and rerun after any edit. A valid envelope is not independent source verification or completion.

Without shell, parse the complete serialized JSON using an available parser and check the same required fields, real evidence, flags and limits. If no parser/validator is available, explicitly record validation as unperformed; do not invent a passing preflight. Preserve complete evidence through the existing transport for coordinator validation.

After the existing authorized delivery step, read back the exact remote file at the returned commit/version. Check that it parses as the full batch and matches the validated original bytes/SHA-256, or that its Git blob ID equals the expected Git blob ID derived from those original bytes. A remote blob SHA on its own proves nothing about the submitted content. Without hashing tools, compare the complete parsed remote object with the original, including every captured character and field, and record hash checks as unperformed. Never substitute a matching path, item count or commit's existence for content readback. A successful commit containing placeholder text is failed evidence delivery. Preserve that immutable failure; publish a new uniquely named complete artifact only when authorized and without replaying writes. Record prepared, delivered and independently verified effects separately. Writer completion still requires original RESULT SUCCESS, later independent COMPLETE and exact post-COMPLETE row effects.
