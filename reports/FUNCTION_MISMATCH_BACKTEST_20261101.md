# Read-only fit-screen comparison and Claude ownership transfer

Observed 2026-11-01T21:21:30.503Z. Source main: `56ddc59`. Full machine-readable results: [backtest JSON](FUNCTION_MISMATCH_BACKTEST_20261101.json).

## Ownership and held-count reconciliation

Claude preparation is complete. Assignment CLAUDE-CATCHUP-20261101-V1 is disabled (`enabled=false`); all 4,185 remaining intake identities and 21 enrichment IDs belong to ChatGPT local coordination. Historical assignment arrays and every batch remain intact for evidence validation. There are zero active Claude reservations. Existing source ledgers, disposition history and pending Writer requests were not changed.

There are **112 HELD_WRITER_IDENTITY cases**: six inherited from the first pass plus 106 additional cases from the next pass. The **106 SOURCE_REVALIDATION_REQUIRED items are a separate group**. The earlier 106 identity-hold figure described only that later pass, not the total.

## Proposed mismatch-term comparison — not enabled

The known positive cohort contains **576 jobs**: 353 currently APPLIED and 223 REJECTED_BY_EMPLOYER. No current READY_TO_PURSUE rows or extra positives were recovered from explicit application dates/events. Automated fit/pursuit recommendations were not treated as Tim decisions. The decline cohort is **1,633 DECLINED_BY_TIM jobs**, with no overlap with the recovered positive cohort.

An operations or quality word alone does not exempt a title. The analysis requires explicit manufacturing context (`manufacturing`, `production`, `plant`, `factory`, `assembly`, `industrialization`, `NPI` or `process engineering`) before applying that exemption. Exact candidate regexes are in the JSON. These are analysis definitions, not approved forge-policy rules.

| Candidate category | Known positive jobs falsely closed | Historical declines matched | Pending intake cards matched |
|---|---:|---:|---:|
| FM_TAX | 0 | 0 | 0 |
| FM_CLINICAL_CARE | 0 | 0 | 62 |
| FM_FOOD_SERVICE | 0 | 0 | 23 |
| FM_CLAIMS | 0 | 0 | 5 |
| FM_RETAIL_STORE | 0 | 0 | 6 |
| FM_PUBLIC_SAFETY | 0 | 0 | 0 |
| FM_SOFTWARE_ONLY | 0 | 1 | 2 |
| FM_DATACENTER_OPS | 0 | 0 | 9 |
| FM_HUMAN_RESOURCES | 0 | 0 | 5 |
| FM_SALES_MARKETING | 0 | 0 | 32 |
| FM_FINANCE_ACCOUNTING | 0 | 1 | 9 |

The **original seven categories combined** match **0/576 known positives**, **1/1,633 declines (0.06%)**, and **98/4,185 pending intake cards**. Four separately labeled exploratory categories—data-center operations, HR, sales/marketing and finance/accounting—raise the combined historical decline matches to two and pending-card matches to 153, still with zero observed positive matches. They are not approved or enabled. Category counts overlap and must not be added as distinct jobs.

The one original-list historical decline example is in the JSON. Zero observed false closures is not proof of zero future false closures. The test uses current canonical title/company/location fields, not a complete historical replay of every original card. Earlier Pursue decisions overwritten by later states may be missing. This narrow function list alone does not substantiate an assertion that about 1,600 pending cards can safely be closed.

## Decisions per day

In the rolling 30-day window 2026-10-02T21:21:30.503Z through 2026-11-01T21:21:30.503Z, **1,354 distinct jobs retain an explicit Tim-attributed latest state decision**, averaging **45.1 recorded job decisions per calendar day**. Both TIM/TIM_EXPLORER provenance and an explicit TIM_RULING decision type are required. This counts decided jobs, including bulk dispositions—not UI clicks, time spent reviewing, or only applications.

This is a **lower bound on recorded job decisions**, not a complete event count or stable daily review capacity: rows keep their latest state action only. The daily distribution is uneven, including large bulk-action days. No hard WIP limit, daily admission cap or application quota is derived from it.

The **30-day pursue-per-enriched-job rate cannot be reliably calculated**. Complete enrichment-to-exposure-to-decision cohorts are missing; PROCESS_COMPLETIONS starts October 31, retains eight days and records enrichment transitions rather than every Tim decision. Dividing current applied/declined stocks by current enrichment totals would create a misleading rate.

## Source-search diagnostics

The JSON reports 20 saved result-search groups. For example, the broad `Head of Operations` search has 898 captured identities, 63 linked canonical jobs and two known applied/pursued jobs. These are partial, overlapping current-identity links, not complete 30-day or causal conversion rates. Linked jobs include already-known roles, new admissions have not all been reviewed, and unread pages remain unknown. Unrecorded board-alert denominators cannot be treated as zero. No alert search was changed.

## Other sensitivity checks

Geography was examined only as a ranking signal. A strict saved EMPLOYER_POSTED pay diagnostic (estimates excluded) had known ranges for only eight positives and 240 declines; a hypothetical 190k upper-range cutoff matched zero of those eight positives and 93 declines. This sparse, retrospectively enriched subset cannot justify a new universal pay floor. No pay closure was enabled.

## What changed

Only ownership/work-routing metadata, historical-batch validation after transfer, and these read-only reports changed. The validator preserves evidence reuse without giving Claude production authority; disabled helpers cannot launch more preparation. Master/archive rows, scoring, forge-policy, native schedules, pending Writer requests and WIP limits are unchanged. No FUNCTION_MISMATCH closure or automatic screen is enabled.
