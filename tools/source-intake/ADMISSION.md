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
