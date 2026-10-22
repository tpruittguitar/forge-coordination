# Source discovery admission gate — phase 2

This is a **read-only** canonical-snapshot cross-check that follows the merged source-intake preview. It never submits anything to the Writer and deliberately creates **zero** submit-ready payloads.

```bash
node --test tools/source-intake/admission.test.js
node tools/source-intake/admission.js preview.json canonical-master-snapshot.json review.json 2026-10-22T12:00:00Z
```

The snapshot must be an **authorized, current, canonical master** export, not a cached trial master. The timestamp is a caller assertion and is not a cryptographic provenance check. Apparent NEW roles remain held for employer core-business verification and the live Writer's dedupe/protection authority; a snapshot alone is insufficient for production admission. No silent bypass for protected, previously applied or rejected roles. Full Never Consider evaluation, targeted registry, INTAKE_KEY case rules, writer status/freeze checks, 50-row ruling ceiling, live receipt/readback and operational authorization remain prerequisites. There is intentionally no Writer endpoint or scheduler in this code.

## Production-data audit blocker (verified 2026-10-22)

The legacy `foreman-cockpit/netlify/functions/master.js` endpoint returns HTTP 410 and explicitly states public master access is disabled; it directs callers to the **authenticated Writer**. A copy from `/api/structured` or `state/source-trial-report.json` is not an authoritative canonical Writer master snapshot. This CLI accepts a caller-supplied timestamp, which is only a freshness assertion, **not proof of source, authority or a protected-state read**. A malicious or mistaken caller can label old data as recent.

Before live intake: provide an approved, authenticated, read-only Writer snapshot with source identity, verified extraction timestamp, schema/version and full protected-state columns; independently verify counts/identity against Writer; then apply final Writer-side admission and receipt/readback. Do not use the read-only admission output as authorization to submit, even when it says `REVIEW_REQUIRED`.

## Follow-up integration contract

The new `auditAuthenticated` function **does not implement the Cockpit HTTP transport**. It accepts two dependency-injected readers solely for testable integration, requiring results identifying a Writer-origin authenticated master read and a Writer-origin authenticated archive read. The flags in those results are assertions from the reader, **not cryptographic proof**; they do not make caller-supplied data trustworthy. Do not use this method with caller-provided JSON as a production gate. Independent QA must inspect and approve the actual authenticated Cockpit reader implementation, its response schemas, authenticated source identity and protection coverage.

Both reads are mandatory and fail closed. Their actual audit acquisition times are measured inside the function, and the audit will not run if acquisition exceeds its freshness budget. This prevents acceptance of a caller-supplied timestamp *in this audit path* but does not guarantee the upstream API data is fresh; the transport must validate the Writer's own revision or as-of metadata and detect partial responses.

Admission rows now carry `tier`, `flags`, and `memphisStrongNegative`; they are informational only. Archived rejected/declined rows participate in the same protection index when actually supplied. **Production submissions remain disabled.**

## Live Cockpit Writer master reader (PR #37)

`tools/source-intake/writer-reader.js` now implements actual read-only GETs against the Writer endpoint documented by `foreman-cockpit/docs/WRITER_ACCESS.md`. It uses `FORGE_WRITER_KEY` from the execution environment, never commits a credential, checks `ping`, `writer_status`, and `master`, parses canonical master rows, requires an END marker and unique IDs, and stamps the actual transport read. Tests use a fake transport; no production credential or live read was exercised.

**Still blocked:** The Writer archive read action / response schema has not been verified. The adapter must not pretend the main master includes archived rejected/declined rows. `auditAuthenticated` continues to require a separate authenticated archive reader and emits zero Writer payloads. The production admission route must explicitly connect the two readers once the Writer archive API contract is confirmed. Do not use Cockpit's cached public structured snapshot for provenance.

## Authenticated terminal archive reader — revised 2026-10-22

Writer source `foreman-cockpit/apps-script/Code.gs` explicitly exposes authenticated GET `action=archive`; `readArchiveSafe_` returns `{ok,archiveId,mode,text,degraded}`. The source parser `parseArchive_` removes `RESTORED|PRIMARY_ID|INV|...` markers and superseded duplicate archive rows. `writer-reader.js` now implements this action, rejects degraded/unavailable archive reads, parses current terminal rows with RESTORED semantics, and exposes `auditLiveWriter(preview,{key,transport})` to fetch master and archive itself. The resulting audit is **review-only** with no intake payloads. The previous note saying the Writer archive action is unavailable is superseded by this section.

Tests with injected HTTP mocks cover transport, archived rejection hold, restoration handling and failures. **No live Writer credential has been used in this PR, and a real authenticated production response has not been independently observed.** Before operational approval, validate schema, END/count integrity and completeness against a real authenticated Writer read, verify the archive migration mode, and resolve whether Writer status exposes additional blockers. Until verified, do not use review output to authorize intake.

## Live Writer QA correction — 2026-10-22

The Writer's `bytes` field is **JavaScript string length**, not UTF-8 octet length. Validate against `text.length`; a non-ASCII fixture proves the distinction. Read freshness uses `fetchedAt`, not last-edit `modifiedTime`. HTTP attempts each have a 30-second budget; a single retry is allowed on transport failure/HTTP 5xx with a separate bounded 65-second total budget. These changes remain review-only, require independent live re-QA, and do not enable any Writer submissions.

## PR #39 transaction consistency (review only)

`transaction-preflight.js` now checks a proposed identity against a durable COMPLETE request receipt and a separately supplied canonical readback. A single exact employer/title/location match with a compatible req ID yields `CONSISTENT_PENDING_PROVENANCE_VALIDATION`, **never** `verified:true`. An ambiguous/missing row or identity mismatch fails closed. Receipt and master inputs could still be forged by a caller; the trusted production executor must authenticate both against the Writer and bind receipt requestId/intent to exact canonical row identity. No execution or Writer submissions are enabled.

## PR #39 live Writer receipt schema limitation

Writer `request_result` normally returns an index entry with status and durability but **does not guarantee a canonical PRIMARY_ID**. The `receipt_index` response can confirm GitHub source, revision and a per-request COMPLETE state without binding that request to one exact row. The collector now explicitly returns `PENDING_CANONICAL_ID_BINDING` rather than manufacturing a PRIMARY_ID, skipping `row_readback` until a trusted request-to-row binding exists. Caller hints cannot supply this binding. This is a remaining production blocker; all results have `verified:false` and no Writer mutations occur.

## PR #39 live receipt correction (Grok QA)

Modern COMPLETE receipt entries bind one or more canonical IDs through `entry.items[].pid`; compare that sequence with `receipt_index.request.items[].pid`. The collector obtains the GitHub receipt index **first** and only calls `request_result` when the index marks the request COMPLETE, because pending result lookups may execute Writer verification and update the index. Check index SHA and timestamp (15-minute freshness), require all (up to 25) canonical rows from `row_readback` and exactly one role identity match; legacy receipts without `items` remain unbound. No `lineSha256`/item `a` hash equality is asserted: their representation equivalence has not been established. All outputs remain `verified:false` and zero submissions.

## PR #39 index timestamp correction

`receipt_index.updatedAt` is the last **write** time, not the fetch time. Quiet indices remain valid: require a nonempty revision SHA, parseable nonfuture `updatedAt` (2-minute clock tolerance), and `request.at <= updatedAt` where available. Record idle age diagnostically, never use it as a 15-minute validity cutoff. Live GET response acquisition is timed separately by Writer transport. No `lineSha256` versus item `a` comparison is claimed because equivalent hash input formats are not established.
