# enrich-ats-pay (REV-116)

Company/site scale and role responsibility use the shared [compensation context contract](../../docs/COMPENSATION_CONTEXT.md)
and `reference/COMPANY_SITE_CONTEXT.json`. The programmed worker owns matching, weighting, deduplication, diagnostics and
bounded migration; Writer owns canonical updates/scoring. AI research is for ambiguous evidence, not every calculation.
See [salary data sources](../../docs/SALARY_DATA_SOURCES.md) for posted-pay priority, public DOL/BLS data and calibration requirements.

Hourly GitHub Action (`.github/workflows/enrich-ats-pay.yml`, :40) that fills SALARY and DEGREE on FORGE_ENRICH_FEASIBILITY
rows without loading the Writer.

Order per row (Tim 2026-10-20 18:17 and 18:21 ET):
1. Employer ATS posting (Lever, Greenhouse, Ashby public APIs): posted pay -> `SALARY_BASIS=EMPLOYER_POSTED`.
2. Aggregator posting (LinkedIn guest page, Indeed, ZipRecruiter): posted pay -> `EMPLOYER_POSTED`; pay the site labels as
   its own estimate -> `THIRD_PARTY_ESTIMATE`.
   `config.json` `aggregatorsOff` lists sites that are never fetched (Tim 2026-10-26: `indeed`, 401 on every read from the
   runner; Indeed roles still arrive through JobSpy and HiringCafe in source-trial).
3. Only when a posting was read (this run, or `FEASIBILITY_ATTEMPT_ASOF` set by a lane) and showed no pay:
   `FORGE-ESTIMATE` from employer-posted comparables in the master (same level and function; same region first;
   1 comparable = LOW, 2+ close = MED), with comparables, basis, uncertainty and ASOF recorded.

Reads: Cloudflare structured copy and the Writer's own worklist code (same selection and order as the Grok lane).
Writes: at most `maxBatches` x 25 rows per run, one Writer `batch` call at a time; a `remainder` waits for the next run.
`state/enrich-ats-pay.json` keeps submitted / tried rows for `resubmitHours`. `state/enrich-ats-pay-report.json` is the
per-run report. `config.json` `"submit": false` = dry run: report only, Writer untouched, ledger unchanged.

Tests: `ENRICH_FC_DIR=../foreman-cockpit node --test tools/enrich-ats-pay/lib.test.js tools/enrich-ats-pay/run.test.js`

Salary anchor repair (2026-10-31): associate/assistant manager, manager and senior manager are distinct comparison levels.
Every anchor path recomputes level from the source title, including remembered postings. Site-labelled estimates cannot
be employer-posted anchors. Each run audits existing named-anchor estimates, including rows outside the missing-salary
worklist, and plans up to 10 recalculations before new missing-field work. Unrepaired IDs and invalid anchor IDs remain
in `salary_invalid` in the report. The pre-submit readback requires the original salary fields to be unchanged.
Protected application/decline states, closed jobs and pending Writer requests are excluded. Missing historical anchor
records alone do not prove a bad estimate. Replacements retain estimate provenance; they do not claim employer-posted
pay or include equity/bonus. This corrects comparison errors in either direction, without an invented salary floor.
