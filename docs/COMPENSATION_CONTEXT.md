# Shared salary context

For locating employer-disclosed pay, use [the shared pay-disclosure search guide](PAY_DISCLOSURE_SEARCH_GUIDE.md).
It records official state sources and coverage dates; check exact postings everywhere, including voluntary disclosures.

`reference/COMPANY_SITE_CONTEXT.json` is the common reference for programmed enrichment and AI exceptions. It complements
`reference/COMPANY_SITE_PRODUCTS.json`; global employer size, local site size and a particular role's responsibility are
different facts. Never copy global headcount into a site or team field. Do not estimate a site headcount from output,
floor area or the employer's total size.

Schema: `forge.company-site-context.v1`. `companies[]` contains `company`, optional exact `aliases`, `facts` and `sites[]`.
Company facts: `employees`, `revenueUsd`, `industry`. Sites match exact `location` or explicit `aliases`; their `facts.employees`
is local headcount. `roles[]` binds `primaryId`, `company`, `title`, `location` and `facts` with `teamSize`, `management`
(`INDIVIDUAL_CONTRIBUTOR`, `MANAGES_PEOPLE`, `MANAGES_MANAGERS`) and `reach` (`SINGLE_SITE`, `MULTI_SITE`). Budget/P&L
details may be retained as sourced context but do not receive a numeric salary adjustment in this model.

Every fact is `{value, asOf, sourceUrl, quote, status: "CONFIRMED"}`. Use an employer posting, employer disclosure or official
filing. `asOf` is the disclosure's measurement date when stated, otherwise explicitly the posting observation date.
The source must be a public HTTPS URL; preserve a short supporting quote. No email bodies, contact details or meeting links.
Do not silently promote AI judgment to confirmed fact. Facts older than 548 days, future dates or unsourced/conflicting
identities do not participate. Unknown facts remain unknown; they do not stop intake, enrichment or decisions.

Discovery/intake should reuse explicit posting facts. Enrichment learns narrowly explicit team size, management scope,
multi-site responsibility and explicitly named worldwide employer headcount while already reading an identity-matched
posting. AI/Gofer handles missing or ambiguous information only as an exception: research an official source, then add the
sourced fact to this same reference, never an isolated automation memory. No additional recurring AI task is required.
The workflow merges learned facts by source date, preserving concurrent company/site edits and newer role facts.

The `employer-role-scope-v3` model uses source age, same employer, geography and company/site/team scale to rank and weight valid
same-level/function/management-track posted comparables. Explicit responsibility conflicts are excluded. Weighted medians
set the base range; company size never multiplies salary. Salary estimates are not allowed to anchor other estimates.
Posting copies are deduplicated before weighting. Missing comparison context/date caps confidence at LOW. A manager title
alone does not establish that someone manages managers. Bonus/equity remain excluded from base pay.

Existing active FORGE estimates migrate through the bounded repair pass, up to ten per run. `SALARY_MODEL_VERSION` and
`SALARY_CONTEXT_KEY` record the calculation version and target context fingerprint. Newly learned target facts trigger a
new bounded recalculation. Posted pay and protected decisions are untouched; fresh salary readback and existing uncertain
request guards still apply. Completion requires the existing Writer verification procedure, not merely a planned report.

An additional active-estimate review (five jobs per existing worker run) checks weak filled estimates for exact posted pay
or stronger comparable evidence. It reuses the shared source selector and keeps durable retry history; see
`docs/EMPLOYER_PAY_SOURCE_AUDIT.md`, Active estimate review, for limits, matching and concurrency guards. This is programmed
work, not another AI task. No job decision state changes as part of salary review.

`state/enrich-ats-pay-calibration.json` reports leave-one-distinct-posting-out diagnostics: typical absolute error, signed
bias, underestimation frequency, posted-midpoint range coverage and the share of jobs for which a comparison was possible.
Every alias of the held-out salary source is excluded. Cases include an unweighted comparison error when available.
This is a diagnostic on the available sample, not proof of future accuracy or a guaranteed improvement. Do not raise
estimates simply to make them exceed a desired salary. Model weighting is a transparent heuristic pending calibration.

### Employer-first anchor selection

Comparable eligibility separates manufacturing technology/engineering, plant operations, manufacturing operations,
supply chain, quality, general engineering and other operations. Chief, senior-VP and ordinary VP scopes cannot anchor
one another merely because the old broad executive band matched. Existing level, AI/ML specialty and program-management
guards still apply. Explicit sourced management and multi-site responsibility conflicts remain disqualifying.

After eligibility, deduplication and age checks, compatible same-employer evidence forms its own tier; numerous peer
postings cannot outvote it. Exact employer names and unambiguous curated company aliases establish this tier. Missing
employer identity never inherits the target employer's facts. When dated evidence exists, undated records cannot displace
it. Without employer evidence, compatible peers use the existing sourced scale, industry, geography and freshness weights.
No employer-name salary multiplier is introduced. Shared source search prioritizes compatible same-employer sources
within its existing read budget. One distinct posting stays LOW confidence, including the same-employer board route.

The version bump puts older active FORGE estimates into the existing bounded repair pass (ten per worker run); posted
pay, protected decisions, concurrent-change guards and uncertain requests remain protected. No new AI automation or
larger read/write budget is introduced. This changes evidence selection; it does not guarantee an error percentage.

### AI manufacturing and tracking-link regression

Explicit AI/ML leadership titles require comparable AI/ML specialty evidence as well as the existing level, function
and management-track match. Generic plant-management and plant-operations salaries cannot anchor an AI manufacturing
enablement director. This is an evidence compatibility guard, not a technology/company pay multiplier; without suitable
evidence the worker retains a missing/low-confidence result under the existing fallback rules. Saved estimates with
incompatible named anchors enter the existing bounded repair pass; protected decisions remain excluded.

For Recruitics sources, recover the explicit public HTTPS `rx_url` before attempting the tracking wrapper. A Meta job
path with an intact numeric identity is usable even when trailing tracking query parameters were clipped. Retain the
initiating URL; never rewrite source identity or infer a new job from a generic redirect. Direct pages still require the
normal title/company/location checks. Structured USD annual `baseSalary` takes precedence over a computed estimate.
For US-remote rows, require explicit US remote eligibility rather than assuming a local or foreign range applies.

Meta `V2I-E955D669D095` was corrected through Writer from a LOW $153,000–$180,000 generic estimate to the published
$245,000–$309,000 annual base range. Meta's exact careers requisition established the remote-US identity; employer-provided
LinkedIn pay and the matching remote Indeed posting established the range. The Meta careers JSON-LD itself did not
contain salary, so it is not claimed as the pay disclosure. Bonus/equity remain separate and unestimated. Receipt:
`receipts/FORGE-META-PAY-CHATGPT-20261101T0136Z-B01_VERIFIED.json`.

### Employer evidence outside the master and uncertainty

`reference/EMPLOYER_PAY_BENCHMARKS.json` holds independently sourced employer annual-base disclosures, without adding jobs to the master. Exact title, location, source URL, observation time and either a quoted base range or structured annual USD baseSalary are required. Records expire from use after 30 days. Full indexed employer posting evidence is labeled separately from a successful direct page read. Search follows observed first-party links only; access failures back off 24 hours and remain explicit. These reads share the existing six-read source budget; no AI schedule or budget increase. Reuse saved compatible employer evidence before peer estimates. One posting remains LOW; geographic adjustment remains explicit, and bonus/equity are never folded into base.

Production control/planning and production technology are different from production leadership. Missing known target size/responsibility facts downweight comparators rather than count as a match; explicit conflicts remain excluded. Narrow posting facts include stated experience requirements and greenfield launch scope. Never infer team headcount or a salary premium from volume.

Tim authorized weak-estimate scoring safeguards on 2026-11-01: LOW or unclassified estimates retain their raw PAY_WORTH diagnostic, but produce CHECK_PAY_ESTIMATE_LOW_CONFIDENCE rather than a derived pay hold or pass. Ranking uses 25% of the raw deviation from neutral 50. Exact employer-posted pay retains full influence; explicit operator floor rulings remain authoritative. Browser and Writer use identical scoring, and derived-refresh request identities include this calculation revision. This reduces false certainty; it is not a claim that the numerical salary is accurate.

A shared company/site product entry can restrict applicable title terms. Exact primary-ID-bound posting evidence overrides an older company/site copy, while custom operator product evidence stays intact. Brookshire solar req 278729 must not inherit Megapack context from another posting.
