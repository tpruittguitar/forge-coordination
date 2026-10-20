# enrich-ats-pay (REV-116)

Hourly GitHub Action (`.github/workflows/enrich-ats-pay.yml`, :40) that fills SALARY and DEGREE on FORGE_ENRICH_FEASIBILITY
rows without loading the Writer.

Order per row (Tim 2026-10-20 18:17 and 18:21 ET):
1. Employer ATS posting (Lever, Greenhouse, Ashby public APIs): posted pay -> `SALARY_BASIS=EMPLOYER_POSTED`.
2. Aggregator posting (LinkedIn guest page, Indeed, ZipRecruiter): posted pay -> `EMPLOYER_POSTED`; pay the site labels as
   its own estimate -> `THIRD_PARTY_ESTIMATE`.
3. Only when a posting was read (this run, or `FEASIBILITY_ATTEMPT_ASOF` set by a lane) and showed no pay:
   `FORGE-ESTIMATE` from employer-posted comparables in the master (same level and function; same region first;
   1 comparable = LOW, 2+ close = MED), with comparables, basis, uncertainty and ASOF recorded.

Reads: Cloudflare structured copy and the Writer's own worklist code (same selection and order as the Grok lane).
Writes: at most `maxBatches` x 25 rows per run, one Writer `batch` call at a time; a `remainder` waits for the next run.
`state/enrich-ats-pay.json` keeps submitted / tried rows for `resubmitHours`. `state/enrich-ats-pay-report.json` is the
per-run report. `config.json` `"submit": false` = dry run: report only, Writer untouched, ledger unchanged.

Tests: `ENRICH_FC_DIR=../foreman-cockpit node --test tools/enrich-ats-pay/lib.test.js tools/enrich-ats-pay/run.test.js`
