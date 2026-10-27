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
