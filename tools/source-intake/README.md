# Source trial intake adapter — dry run only

This adapter previews a candidate Writer `action=intake` payload from `state/source-trial-report.json` or the successful workflow artifact. It NEVER contacts Writer, never edits master, never changes cadence and never updates scoring. Run: `node tools/source-intake/preview.js state/source-trial-report.json /tmp/forge-source-preview.json FORGE-SOURCE-TRIAL-REVIEW`; test: `node --test tools/source-intake/preview.test.js`.

## Deliberate limitations
- This is a first-pass triage only. `CANDIDATE_REQUIRES_WRITER_CHECK` is NOT a verified new job or approval to submit. Exclusions based on company and title are provisional and cannot replace canonical Never Consider evaluation with full JD evidence.
- Neither the GitHub trial report nor this adapter carries canonical Writer master identity/protected state or application history. Only the live Writer can authoritatively reject existing/protected entries. DO NOT submit the generated batches until live rules, intake-key/dedupe, source-of-truth verification, and anti-resurrection have been reviewed.
- The batches are **preview data, not write instructions**; run gross count is based on report.new_roles only and must be reconciled to GROSS_FOUND for an authorized production run. Run IDs must be unique and case-sensitive INTAKE_KEY mapping remains Writer-owned. No salary, degree, FLEX or score values are fabricated.
- WEST geography flags are review holds pending current pay-worth and location controls, not permanent hard rejections.
- Existing/protected records in report are not emitted as new submissions; the current master snapshot is not authoritative for later runs.
- A true old-vs-new discovery A/B still needs identical baseline execution; no claim is made here.

## Staged Writer intake (after the five-job intake)
`control/SOURCE_INTAKE_RELEASE.json` has exactly two armed states, both set only by Tim's approved commit on `main`:
- `STAGE`: `revision: SOURCE_INTAKE_STAGE_V1`, `maxBatch: 5`; exactly five cases covering NEW, EXISTING_MATCH and PROTECTED_NOOP.
- `STAGE`: `revision: SOURCE_INTAKE_STAGE_V1`, `maxBatch: 25` or `200`, `approvedBy: "<Tim's approval>"`; 1..maxBatch reviewed cases, any mix.

Run a stage with the same operator and proof as the intake:
1. Re-run the read-only pull and Writer dry run for the approved candidates.
2. `intake-cli.js snapshot before --mode STAGE ...`, arm the switch (`STAGE`), then `intake-cli.js auto ...`: it runs, waits read-only on
   the receipt index for each accepted insert to reach COMPLETE, and runs again; it stops on anything else (UNKNOWN, HOLD, a mode
   mismatch, a switch turned off).
3. `snapshot after`, `finalize` (STAGE reconciliation: exact insert set, no deletions, archive checks), disarm the switch.
Every case keeps the intake's gates: durable recorder, receipt-index-first, one Writer transaction at a time, no retries.

## Posted salary provenance

A salary disclosure captured from the exact source posting is verified source evidence. Discovery retains a source-bound `postedPay` disclosure separately from strict `payFacts` used for annual USD base-pay scoring. Preserve the original amounts, wording, URL, company/title/location and observation date through saved reports, evidence manifests, waiting pages, intake candidates and carry-forward recovery. Unknown currency, period or base/total basis stays unknown; estimates remain explicitly estimated. Neither missing scoring metadata nor an expired full-posting freshness window requires a second salary verification.

Only identity-bound, explicitly annual USD base-pay facts enter canonical `SALARY_*` intake fields. Older salary remains reusable when a newer complete posting merely omits it; newer contradictory amounts or units block obsolete reuse. Degree review and posting liveness retain their own freshness and provenance. These rules do not waive identity, source-scope, protected-state or Writer intake gates, and publication does not backfill live rows.

## Reusing captured discovery text

AUTO intake uses the same identity-bound source text already reviewed by discovery before fetching the posting again. `evidence-store.index().forIntake()` checks the immutable evidence cache and the current saved source/board reports. Reading a report directly closes the timing gap when intake starts before the asynchronous evidence publisher. The report's raw-byte hash, text hash, source observation time, normalized identity and completeness flag are retained with the full text in the candidate receipt. The source report is read once per intake index; no cache file or canonical row is written by this lookup.

The existing six-hour intake freshness window and exact company/title/location/source-URL checks still apply. Direct report content must match discovery's reviewed text hash and source URL. Captured role text can supply positive employer-business evidence without being labeled a complete posting. Alerts, selected quotes, explicit incomplete content and access-error pages are not upgraded. Salary qualification, complete-posting degree/absence checks, current exclusions, protected decisions and original Writer-request fences are unchanged. Missing or unusable captured text follows the existing source-fetch path.

This change preserves text for downstream research; it does not itself fill every qualification field or claim a source is still live. Publishing or testing this code does not submit jobs, replay requests, merge the PR or deploy it.
