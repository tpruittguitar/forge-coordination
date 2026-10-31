# Employer salary-source audit — 2026-10-31

Read-only authenticated master/archive snapshot: 2,533 master jobs plus 782 terminal-archive identities = 3,315 unique
jobs. RESTORED archive markers were applied, repeated archive primary IDs consolidated, and master identities took
precedence where present. The source snapshots are private; public output contains only company, role/location,
canonical IDs, salary amounts/dates and public posting URLs. No application, decision or salary was changed.

## Repeated documented sources

| Company | Distinct dated, source-linked employer-posted ranges | States in those saved disclosures |
| --- | ---: | --- |
| Tesla | 10 | CA |
| Applied Materials | 8 | TX, MA |
| Ford Motor Company | 7 | MI, OH, KS, CA |
| Anduril Industries | 6 | CA, OH, MA |
| Boeing | 6 | KS, CA, AL |
| Blue Origin | 5 | AL, TX; one location lacks a parsed state |
| Carrier | 4 | FL, TN, NC |
| Eaton | 4 | NC, PA |
| Northrop Grumman | 4 | UT, MN, MD |
| Oracle | 3 | CA, TX |
| Stryker | 3 | IL, GA, AZ |

These 11 employers meet the conservative three-distinct-disclosure source threshold. Insight Global also has three
saved examples, but is retained separately as a staffing/recruiter source, not treated as the unnamed client's salary
policy or company context. Official category evidence: https://insightglobal.com/services/talent-services/staffing/

Slate and Scout remain source candidates: each has one dated source-linked record meeting this strict classifier.
Slate also has saved mirrored employer text for Head of Quality, Troy MI; Scout has a legacy POSTED_ROLE_RANGE record.
Those remain provenance-review evidence, not silently normalized into algorithm-ready employer anchors. This audit
does not conclude that either employer rarely publishes pay. Other employers with one/two examples stay in the file
as LIMITED_DOCUMENTED_SOURCE rather than disappearing.

## Why these are not publication-rate percentages

2,081 jobs have no saved SALARY_BASIS. Others have estimates, mirrors, legacy labels, missing dates/URLs or conflicting
source identity. Missing collection evidence does not prove missing employer pay. There is no representative sample
of complete posting reads with recorded pay-present/pay-absent outcomes, so an actual company disclosure consistency
rate cannot be estimated honestly. Applied Materials (8 documented of 9 saved role/location identities) and Boeing
(6 of 7) have particularly dense saved coverage, but those fractions remain capture coverage, not universal policies.

The audit retains 328 conservative distinct disclosures across all employers, from 360 strict EMPLOYER_POSTED records;
it separately reports 112 records needing provenance review. These categories overlap at company/role level and are
not a partition of the 3,315 jobs. Repeated same-role/location copies count once; the newest dated disclosure wins and
equal-date conflicting ranges are withheld. A stored EMPLOYER_POSTED flag is not a fresh public-page verification.

## Algorithmic use

Shared inventory: `reference/EMPLOYER_PAY_SOURCES.json`, schema `forge.employer-pay-sources.v1`.
Reusable builder and selector: `tools/enrich-ats-pay/source-profile.js` (`build`, `sourcesFor`).

1. Prefer the exact target posting regardless of employer/state; identity-matched employer copies come next.
2. Reuse already valid target and comparable pay evidence before making network requests.
3. When another source is needed, `sourcesFor(target, profile, sharedCompanyContext)` ranks the repeated documented
   employer candidates using the existing level/function, geography, age, company/site size and responsibility rules.
   Explicit role-scope conflicts are rejected. Undated/old sources and stale (>90-day) profiles are not search inputs.
4. Open the returned PUBLIC posting URLs, verify exact role/location and base-pay meaning. Copies are not independent
   comparables. Tesla's ten saved examples are all CA: they do not establish an Austin Tesla range.
5. A company being a frequent publisher never raises its salary amount, overrides comparability or boosts estimate
   confidence. Recruiter client pay must not become the recruiter's corporate pay scale. Keep base/bonus/equity separate.
6. Keep single-example employers, voluntary disclosures, Slate and Scout in fallback research. The directory prioritizes
   sources; it must not make all other employers ineligible as genuine comparables.

Offline regeneration from privately parsed canonical rows (each has PRIMARY_ID, COMPANY, TITLE, LOCATION, store and p):
`node tools/enrich-ats-pay/source-profile.js <private-structured-rows.json> reference/EMPLOYER_PAY_SOURCES.json`
Do not commit the input snapshot, correspondence, keys or raw notes. Regenerate after a fresh complete authenticated
master/archive audit; never replace complete coverage with a failed or partial archive read.

## Connected worker behavior (2026-10-31)

The existing programmed `enrich-ats-pay` worker now calls the selector when exact target sources and same-employer
evidence have not supplied pay and a comparable estimate is needed. Recent saved source ranges are reused without
network reads. Older/missing source evidence receives at most six public checks per run, two per target job, inside
the existing run deadline. A refreshed source requires an employer-owned or recognizable employer ATS page, an exact
company/title/site full JobPosting, and explicit USD annual baseSalary. A saved aggregator URL may lead to the same
canonical job's known ATS page; an aggregator's structured salary alone cannot establish new employer pay. Missing
structured evidence, failed pages, wrong identities, expired postings and unclear pay are
skipped; they never block the original target or become its employer-posted salary. Estimates retain the existing
level/scope/size/geography/age weighting and confidence rules. Salary-repair and no-network upgrade passes do not
trigger these additional source checks.

Successful public evidence is cached for 14 days, failures back off for 24 hours, and cached entries expire after 60
days. The worker rebuilds the shared directory only after complete master AND effective archive reads; otherwise it
retains the previous directory. Publication preserves a concurrently generated newer snapshot. Dry runs do not change
the shared directory. No new AI task or schedule is needed.

`state/enrich-ats-pay-report.json` includes `pay_source_search`: targets/candidates, saved ranges reused, cache hits,
public reads, found/failed checks, backoff and estimates containing profile sources. These are source-read/planning
metrics, not verified master-completion counts or proof of an accuracy gain. Samples include the exact source identity,
range, date and public URL. Existing Writer guards and verification still control canonical outcomes.

## Active estimate review

Filled `FORGE-ESTIMATE` salaries also receive a separate programmed review in the existing pay worker. Missing-data
selection alone cannot revisit them. Each run reviews at most five active estimates, with at most six exact-target
reads, two per job, and a 90-second review budget checked between operations. These reviews share the existing
50-row submission cap and six comparable-source reads; there is no additional AI automation or schedule.

Never-reviewed jobs come first, then weaker confidence and older evidence. Pending Writer requests, closed postings,
applied/rejected/declined states, anti-resurrection and do-not-rework protections are excluded. The review uses already
saved exact posting URLs on supported employer/ATS routes. Promotion to `EMPLOYER_POSTED` requires a complete matching
title and city/state, plus explicit USD annual structured base pay; a snippet or another role's salary cannot qualify.
Unsupported formats remain estimated. Otherwise the shared source selector may improve the estimate: higher confidence,
or same-employer evidence at equal or higher confidence. A different number alone is not an improvement. Lower/higher
exact posted pay replaces an estimate because it is direct evidence, not because the number increased.

`salaryReview` in `state/enrich-ats-pay.json` stores input fingerprints and retry history. Unchanged unsuccessful reviews
wait 24 hours; planned improvements wait seven days after their expected salary readback. Changed job/salary/source
inputs can trigger reconsideration. Independent cases continue; unresolved writes remain fenced, never replayed.
Before submission the worker rereads each row and drops reviewed salary fields if identity, pay or decision changed.

`salary_review` in the report distinguishes eligible/due/reviewed jobs, exact-target reads, exact-pay and stronger-estimate
plans, unchanged outcomes and concurrent-change drops. Planned improvements and Writer acknowledgments are not independently
verified completions. Existing receipt/readback verification remains required. Old estimates without stronger evidence stay
unchanged; the review is gradual, not an immediate rescore of every job.
