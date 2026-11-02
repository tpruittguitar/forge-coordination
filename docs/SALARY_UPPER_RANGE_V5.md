# Upper-range screening estimate

Model `employer-upper-range-v5` retains existing source, role/seniority, specialty, geographic, recency, duplication and responsibility checks. It does not add arbitrary Tesla/company premiums or use unverified H-1B wages as employer salary ceilings.

Low endpoints retain the prior weighted-median calculation. High endpoints use the weighted 75th percentile of compatible employer-posted ceilings. Compatible same-employer upper-quartile evidence is retained when peer weighting would lower it. The selector retains an eligible same-employer comparator if the employer weight cap would otherwise evict all of them. Same-employer geographic adjustments remain in place. `Mgr` now normalizes to manager before seniority classification.

This is a screening range. The upper endpoint is not the expected offer or a guarantee. Sparse evidence can still understate or overstate pay; one comparator remains provisional. The unanchored BLS fallback remains governed by the existing policy rather than inventing seniority multipliers. Exact target-posted salary remains unchanged. No DOL ingestion was added: prevailing wage, offered wage, unit and worksite matching need a separate validated source adapter.

The model version causes eligible existing estimates to enter the existing bounded repair path after merge. Protected decisions remain protected. This change does not bulk-rewrite the master or replay ambiguous submissions.

## Validation on saved disclosures

Leave one distinct posting out, excluding its aliases. 516 industrial leadership disclosures, 499 with estimates. This diagnostic does not fetch fresh postings, apply production geographic ratios or measure future offers.

| Floor | Posted reaches floor | Old false exclusions | New false exclusions | Old false inclusions | New false inclusions |
|---|---:|---:|---:|---:|---:|
| $200K | 270 | 77 | 21 | 84 | 169 |
| $210K | 220 | 92 | 30 | 84 | 154 |
| $220K | 189 | 81 | 30 | 77 | 135 |

The tradeoff is deliberate retention for review: fewer likely opportunities fall below the floor, but more jobs pass whose actual posted maximum is lower. Mean signed ceiling error moves from approximately -$1K to +$33.5K. Midpoint absolute percentage error increases from 18.75% to 22.48%; this is not an improvement in expected-offer prediction. Do not describe the method as calibrated offer forecasting.

The production calibration report now records posted/estimated low and high endpoints, signed ceiling error and false exclusions/inclusions at multiple floors, so future checks can measure the failure Tim actually experiences.
