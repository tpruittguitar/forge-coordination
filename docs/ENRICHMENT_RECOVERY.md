# Enrichment recovery

Enrichment fills missing decision inputs, rather than repeating complete discovery/intake research. Existing readable fit, pay and posting-based degree fields are reused; the Writer rechecks missing fields before applying a batch and derives scores using the published scoring model. Applied/declined and other protected jobs are excluded.

The 2026-10-31 snapshot had 411 active unfinished jobs: 109 missing degree, 28 missing salary, 274 missing both. All had a readable fit value (this can be a derived legacy EXPERIENCE_FIT; it does not prove a human/AI researched fit assessment). The automatic worker covers feasibility, not strategic fit research.

Root causes: limited posting readers, 48-hour per-row cooldown even after partial success, unsupported/blocked source pages, and a new shared module dependency not loaded by the worker. An update is not a completed job.

Repair: load the shared posting freshness dependency, support full JobPosting JSON-LD on custom public source pages, require one exact normalized company/title match and substantial description, retain unresolved identities with reasons in the report, retry incomplete work after six hours and immediately when required fields change. Never derive NOT_STATED from a preview or generic page. The Worker still caps submissions at 50 rows, preserves Writer readback guards, protected states and uncertain-write recovery, and uses existing hourly workflow concurrency. No AI lane is reactivated.

This does not make inaccessible Indeed pages readable or claim that all pending jobs are resolved. Such rows remain explicit pending research. Review-ready and historical scoring are separate: a score alone is not evidence completeness.

Final scoring is the final enrichment step (Tim, same session). The existing Writer already derives the overall rating and model provenance when raw evidence is written. Flow completion now requires that score as well as complete inputs. All 431 review-ready rows in the audit already have numeric final ratings under published model revision 26, so no duplicate research or score writes are required for those rows.
