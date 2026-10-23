# PR #40 five-job source-intake canary: RESULTS (2026-10-22, for Grok's canary-results review)

Run by Claude Code on Tim's approval ("Deploy, arm and run"). Machine-readable evidence: `receipts/PR40_CANARY_RESULTS_20261022.json`
(collected read-only after the run; contains no Writer key).

## Setup
- Writer: REV-196 deployed first ([foreman-cockpit#186](https://github.com/tpruittguitar/foreman-cockpit/pull/186), build `4e011a9`, Apps Script version 80; deploy state check PASS; only `Code.gs` changed).
- Pre-arm re-check (00:45 UTC, read-only): all five cases predicted correctly with the deployed code; rules hash `876a618c…` bound.
- Switch armed on `main` at `1354343` (REV-198); **disarmed at `741e1e0` (REV-199)** right after reconciliation.
- Operator: `tools/source-intake/canary-cli.js` with the fsync'd file recorder: 5 Writer responses recorded and read back before classification; no retries; 2 planned halts.

## Outcomes
| # | Case | Writer response | Durable proof | Master readback |
|---|---|---|---|---|
| 1 | EXISTING: BETA Technologies, Director of Supplier Quality | `EXISTING_MATCH` → `V2I-9E30CCE0E70B` | no receipt-index entry (no master transaction); receipts-log result | exactly 1 row, SCOUT_INTAKE |
| 2 | PROTECTED: Anduril, Deputy Head of Production (Fury) | `EXISTING_MATCH` → archived `V2S-ANDURIL-FURY-5577` | no receipt-index entry; receipts-log result | **not in master** (still archived, not re-inserted) |
| 3 | EXISTING (APPLIED): Outrider, Sr Mgr AV Assembly Ops | `EXISTING_MATCH` → `V2I-029CE63ACABD` | no receipt-index entry; receipts-log result | exactly 1 row, APPLIED |
| 4 | NEW: Anduril Industries, Director of Production, Optics | `SCOUT_INTAKE_WRITTEN` → **`V2I-EFD35D57DD0D`**, write `W-20261023004905773-12682e` | receipt index COMPLETE, items `[{V2I-EFD35D57DD0D, INSERT}]`; durable request_result | exactly 1 row, SCOUT_INTAKE |
| 5 | NEW: nVent, Director of Manufacturing Automation | `SCOUT_INTAKE_WRITTEN` → **`V2I-B1BFE4DC6AF3`**, write `W-20261023005256393-49f943` | receipt index COMPLETE, items `[{V2I-B1BFE4DC6AF3, INSERT}]`; durable request_result | exactly 1 row, SCOUT_INTAKE |

## Reconciliation (independent authenticated snapshots)
- Master **1,699 → 1,701**; inserted IDs exactly `V2I-EFD35D57DD0D`, `V2I-B1BFE4DC6AF3`; no deletions; no other inserts during the window.
- Archive **785 → 785**; the protected role stayed archived with matching identity.
- Result: `COUNT_AND_IDENTITY_CONSISTENT_REQUIRES_INDEPENDENT_QA`, `verified:false`, `scaleUpAllowed:false`.

## Invariants (from the handoff)
- Existing roles created zero new rows. ✔ (cases 1, 3)
- Protected archived role created zero new rows. ✔ (case 2)
- New eligible roles produced exactly their intended insertions. ✔ (cases 4, 5)
- No unrelated inserts or deletions. ✔
- All returned job IDs match the authenticated master/readback. ✔

## Not done / for review
- Grok's canary-results review is pending; **no scale-up** (25 / 200 stages) until that review and Tim's decision.
- Grok's open conditions for scale-up: writer-reader freshness check and a Writer reply-code spot-check (the reply shapes here were the live Writer's).
- The two new rows enter the normal SCOUT_INTAKE workflow (enrichment/scoring) like any discovery.
