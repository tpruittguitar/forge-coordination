# Shared helper source yield review, November 9, 2026

## What the evidence establishes

The three Claude research packets each contain 20 items. They do not show an early stop within a 20-item page:

| Packet | Evidence-ready | Source-blocked | Ready items containing an explicitly unmapped requirement |
| --- | ---: | ---: | ---: |
| `FORGE-CLAUDE-SHARED-20261109T0330Z-B001` | 17 | 3 | 10 |
| `FORGE-CLAUDE-SHARED-20261109T0425Z-B002` | 12 | 8 | 7 |
| `FORGE-CLAUDE-SHARED-20261109T0530Z-B003` | 16 | 4 | 14 |
| Total | 45 | 15 | 31 |

B001 and B002 are committed under `receipts/CLAUDE_HELPERS/FORGE_CLAUDE_SHARED_HELPER/`. B003 was inspected from the delivered original provider packet; it is not present in the independently checked main coordinator ledger below. These counts are research outcomes, not completed canonical updates.

At main `19ff5e475e725899a388da168309675aa5e24328`, the coordinator ledger contains only the first 40 shared-helper items: 22 `SOURCE_ROUTE_BACKOFF`, 11 `WORKING_SOURCE_ROUTE_REQUIRED`, 3 `SOURCE_IDENTITY_AMBIGUOUS`, 1 `STRUCTURED_POSTING_UNAVAILABLE`, 1 `FIT_QUOTE_NOT_IN_POSTING`, 1 `FIT_RESUME_MAPPING_REQUIRED`, and 1 `VERIFIED`. This snapshot cannot independently establish the reported second verified update or B003's final downstream outcome.

## Later operational evidence

At 2026-11-09T06:33:57Z, a read-only operator check independently verified the original acceptance, later COMPLETE receipt and exact post-COMPLETE master/companion effects for Gates `V2I-25E4E5DC5BB1`, request `FORGE-CODE-CHATGPT-20261109T062023479Z-E00045`, write `W-20261109062413443-7eff4b`. This establishes a second shared-helper fit-evidence update after REGENT, not two fully enriched jobs. The active coordinator's older ledger was awaiting its next reconciliation; no original write was replayed.

Grok's two-item branch return `593f8cbd63cd4a16cd48c8cb7a5f07869f2d91be` remains invalid: placeholder source hashes, invalid/missing resume metadata, and inferred related-job degree text cannot be silently repaired or treated as Grok-observed evidence. Independent source recovery found exact Blue Origin R70681 degree text but a live source identity discrepancy; Tesla's alternate Indeed posting was expired and did not bind either official same-title requisition. These specific returns are not promised writes.

## Unnecessary losses corrected

1. The source verifier ignored the public LinkedIn guest route used successfully by helpers. Public job URLs commonly hit backoff or lack structured JobPosting markup. The new adapter derives the guest route only from a recognized LinkedIn job URL; it does not trust arbitrary `fetchUrl` values. It independently checks the returned route, embedded job ID, top-card link, title, employer, location, complete description and closed-posting marker. Existing host backoff remains enforced.
2. `helperEvidence` rejected every requirement with `competencyIds: []`. That field was explicitly used to preserve requirements for which the resume had no observed support. One such requirement caused the entire source result to fail, including otherwise supported facts. The 31 affected packets are a conditional opportunity, not 31 promised updates: their sources and exact quotations still must pass independent validation. Empty mappings now remain visible as `NO_OBSERVED_RESUME_OVERLAP`, with no positive fit or score claim.
3. Helpers can omit resume hashes and competency IDs. Code derives omitted values from the actual current resume profile after validating exact quotes against the independently fetched posting. Explicit stale hashes, invented competencies, duplicate mappings and fabricated quotations still fail.
4. A parser-version change permits a single reevaluation of the corrected source-backoff/mapping failure classes. Current host backoff, protected rows, original transaction fences and verified outcomes remain respected; unchanged failures do not loop.

## Real-source checks

Read-only independent fetches, with no Writer call:

- Smardt `V2I-1A6BA5D95AD2`, LinkedIn job `4481710055`: guest endpoint returned HTTP 200 and 21,259 bytes. Exact identity and all five original requirement quotes passed. Four mappings and one explicitly unmapped requirement were retained; degree, exact source link and fit-evidence preparation passed.
- Anduril `V2I-136B9F1281A3`, Greenhouse job `5242311007`: job and company APIs returned HTTP 200. Exact identity and all four original requirement quotes passed. One mapping and three explicitly unmapped requirements were retained. The previous `FIT_RESUME_MAPPING_REQUIRED` failure is resolved without claiming those three requirements are supported by the resume.

These are source-validation/preparation checks, not verified master updates. No canonical data was changed by this investigation.

## Genuine unresolved cases

The 15 helper-reported source blocks include closed postings, unavailable pages, an unusable tracking redirect and absent ATS IDs. Missing access does not establish missing job facts. The identity ambiguities and quotation mismatch in the coordinator ledger remain explicit blockers; this change does not force an employer, title, location, requisition or quotation match. A malformed nonempty fit claim can still block a source result; durable per-field partial processing is a separate follow-up requiring explicit field-level failure and retry accounting.

## Original source-fix validation

- 145 coordinator tests pass, including exact-route/ID spoofing rejection, cache revalidation, closed/incomplete pages, preserved backoff, unmapped requirements, current-resume derivation and transaction fences.
- Broad coordinator workflow suite: 543 pass; 8 browser-DOM tests cannot start because the Playwright Chromium executable is absent. The attempted official browser download returned an invalid/truncated archive. This is not a full green aggregate run.
- 9 Python automation-health tests pass.
- Runtime build check, Python syntax compilation, change-record preflight and whitespace checks pass.
- Windows installer checks were not run in this Linux executor.

## Provider delivery fixes in the combined change

Shared providers without hashing tools may submit exact bounded text captures. The validator computes an explicitly untrusted transport hash without changing their original receipt. Live source verification still controls all fields. Current-main resolution and first-real-run setup prevent stale unavailable-slot reports and repeated setup probes. Dedicated shared receipt branches are collected without requiring a PR or merge, preserving exact commit/path/byte provenance and all ownership checks. Malformed originals remain preserved and blocked, not relabeled as corrected provider research.

## Final combined validation

- 562 JavaScript tests pass across the coordinator workflow's non-browser suites, including 21 branch/existing delivery tests. The eight browser-DOM cases remain excluded locally for the Chromium installation limitation above; CI runs the full suite.
- 89 instruction/configuration Python tests pass, with one existing optional skip; 9 automation-health tests pass.
- Independent review found no blocker in immutable branch capture, provider ownership, collision handling, untrusted capture isolation or source verification. Runtime generation/check, change-record preflight and whitespace checks pass.
