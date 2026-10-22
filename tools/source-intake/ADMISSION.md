# Source discovery admission gate — phase 2

This is a **read-only** canonical-snapshot cross-check that follows the merged source-intake preview. It never submits anything to the Writer and deliberately creates **zero** submit-ready payloads.

```bash
node --test tools/source-intake/admission.test.js
node tools/source-intake/admission.js preview.json canonical-master-snapshot.json review.json 2026-10-22T12:00:00Z
```

The snapshot must be an **authorized, current, canonical master** export, not a cached trial master. The timestamp is a caller assertion and is not a cryptographic provenance check. Apparent NEW roles remain held for employer core-business verification and the live Writer's dedupe/protection authority; a snapshot alone is insufficient for production admission. No silent bypass for protected, previously applied or rejected roles. Full Never Consider evaluation, targeted registry, INTAKE_KEY case rules, writer status/freeze checks, 50-row ruling ceiling, live receipt/readback and operational authorization remain prerequisites. There is intentionally no Writer endpoint or scheduler in this code.
