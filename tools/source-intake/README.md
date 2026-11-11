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

Only identity-bound, explicitly annual USD base-pay facts enter canonical `SALARY_*` intake fields. Older salary remains reusable when a newer complete posting merely omits it; newer contradictory amounts or units block obsolete reuse. Degree facts retain their original observation date; posting liveness remains unverified by a saved capture. These rules do not waive identity, source-scope, protected-state or Writer intake gates, and publication does not backfill live rows.

## Reusing captured discovery evidence

AUTO intake uses the recorded job details from JobSpy, HiringCafe, LinkedIn, recruiting sites and employer sources equally. `discovery-inputs.index()` reads saved source/board reports, the catch-up inventory, upstream records and immutable text documents. Reading the source report directly removes the timing dependency on the asynchronous cache publisher. It retains an exact source artifact hash, a job-only card hash, company/title/location/URL, capture date and completeness label. If an older handoff lost the provider name, provenance uses the recorded URL's actual host rather than guessing a provider.

Age alone does not require another posting lookup. Captured full descriptions use the same content-based completeness rule regardless of provider. Explicit partial content and selected quotes remain incomplete; challenge pages supply no description. A metadata-only card can still identify a lead: missing employer-business text remains blank/unknown, never independently verified. Country-wide source locations remain country-wide and are not invented as a particular worksite. Saved qualification facts retain their actual capture date, not the date of reuse. None of these facts proves current posting liveness.

AUTO candidates use the `CAPTURED_DISCOVERY` contract with `evidenceVerified:false`, `businessEvidenceApproved:false` and `postingStatus:UNVERIFIED`. The executor validates the bound card again, keeps the original Writer request identity, and evaluates the current canonical rules. A rule refresh re-screens the retained facts rather than fetching the posting again. The existing separately verified STAGE path is unchanged. When neither bound saved details nor source evidence exists, the normal source-recovery path remains.

Catch-up source-only retries (`SOURCE_EVIDENCE_UNAVAILABLE`) release when captured details are available. Prior attempt history stays recorded; release claims no canonical completion. Identity conflicts, explicit exclusions, protected decisions, current helper reservations, release/freeze controls and original Writer-request fences still apply. Writer still owns deduplication and final admission, with one transaction and durable intent/receipt verification at a time. No previously attempted request is replayed.

Salary disclosures stay separate from job-text completeness. Site-labeled estimates remain estimated; unknown units/basis stay unknown. Only supported annual USD base-pay facts populate canonical posted-salary fields. This change does not itself fill every qualification field. Publishing or testing it does not submit jobs, merge the PR or deploy it.
