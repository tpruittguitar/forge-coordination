# enrich-ats-pay (REV-116)

Company/site scale and role responsibility use the shared [compensation context contract](../../docs/COMPENSATION_CONTEXT.md)
and `reference/COMPANY_SITE_CONTEXT.json`. The programmed worker owns matching, weighting, deduplication, diagnostics and
bounded migration; Writer owns canonical updates/scoring. AI research is for ambiguous evidence, not every calculation.
See [salary data sources](../../docs/SALARY_DATA_SOURCES.md) for posted-pay priority, public DOL/BLS data and calibration requirements.

Serialized GitHub Action (`.github/workflows/enrich-ats-pay.yml`, every 15 minutes) that fills SALARY and DEGREE on FORGE_ENRICH_FEASIBILITY
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

Research has a nine-minute budget and Writer work an eighteen-minute overall deadline,
including transport bodies, receipt polls and retry waits. Two Writer batches are the
maximum, with no cooldown after the final batch. Deferred work stays for a later run;
uncertain submissions stay fenced until RESULT, GitHub index and readback agree.
See [runtime repair](../../docs/PAY_RUNTIME_REPAIR_20261103.md).

Missing-field reads track the resolved API, guest-page or public endpoint per row.
Fallback skips endpoints already attempted, including aliases, without consuming
the four-distinct-route fallback allowance. Other saved endpoints remain eligible.
Transport failures get at most one explicit retry for HTTP 408/500/502/503/504 or
recognized transient connection/time-out errors. Permanent failures, access walls,
invalid posting content and 429s do not retry through fallback. Retry-After waits,
provider circuit breakers, disabled providers, request caps and the shared runtime
deadline still apply; retries count against the physical request caps.
`source_reads`, `source_retries` and `source_duplicate_skips` report this missing-field
path only. They do not count comparable-search, board-discovery or active-review reads.

Tests: `ENRICH_FC_DIR=../foreman-cockpit node --test tools/enrich-ats-pay/lib.test.js tools/enrich-ats-pay/run.test.js`

Salary anchor repair (2026-10-31): associate/assistant manager, manager and senior manager are distinct comparison levels.
Every anchor path recomputes level from the source title, including remembered postings. Site-labelled estimates cannot
be employer-posted anchors. Each run audits existing named-anchor estimates, including rows outside the missing-salary
worklist, and plans up to 10 recalculations before new missing-field work. Unrepaired IDs and invalid anchor IDs remain
in `salary_invalid` in the report. The pre-submit readback requires the original salary fields to be unchanged.
Protected application/decline states, closed jobs and pending Writer requests are excluded. Missing historical anchor
records alone do not prove a bad estimate. Replacements retain estimate provenance; they do not claim employer-posted
pay or include equity/bonus. This corrects comparison errors in either direction, without an invented salary floor.

Complete, identity-matched public posting reads share a seven-day evidence cache in
`state/enrich-ats-pay-employer.json`. Primary ATS reads, structured aggregator
postings, public fallback, active salary review, employer-board details, comparable
source refresh and benchmark research all save through the same cache. Existing
request limits and research routes are unchanged. Legacy aggregator text without
independent exact identity does not qualify, nor do search snippets, access walls,
failed reads or salary-only anchors.

Each observation retains its source URL, employer/title/location binding, full
posting text, observation time, parser version and available posting facts. Cache
reuse preserves the original salary and degree evidence dates. ATS URL aliases are
matched conservatively; distinct Ashby requisitions remain separate despite their
shared board API. Changed identities, unrelated URLs, expired postings, invalid or
future timestamps and observations seven days old cannot be reused. Old evidence
is pruned when the existing public employer cache is saved, including dry runs;
canonical Writer state and the submission ledger keep their existing dry-run rules.

`PAY_FOUND`, `NO_PAY_STATED` and `PAY_UNRESOLVED` distinguish a retained disclosure,
a successful full read without pay and a read whose compensation was not usable.
An unreadable source creates no successful posting cache entry. An unchanged/no-pay
read does not erase an earlier disclosure; contradictory or unresolved newer pay
cannot turn into a confirmed salary. The report's `posting_cache` counters describe
successful saves and reuse, separately from physical source reads.

Degree extraction uses the [complete degree-evidence contract](../../docs/DEGREE_EXTRACTION.md).
The same parser and regression corpus are mirrored in the cockpit ATS producer;
adjacent experience alternatives must survive extraction and field serialization.

Preparation requires a complete, exact-identity posting with its original source
URL, observation time and full text. Version 2 prepared artifacts embed that
validated evidence, rather than only hashing a transient ledger entry. Legacy
aggregator text, historical lane timestamps and failed-read history alone cannot
produce a prepared salary. Missing proof is reported as
`COMPLETE_EXACT_POSTING_EVIDENCE_REQUIRED`; unresolved compensation cannot become
no-pay proof. Existing live-run eligibility and Writer fences are unchanged.

The existing serialized live owner can consume durable v2 **no-pay posting
observations** from `state/enrich-ats-pay-prepared-<sha256>.json` (or the existing
`ENRICH_PREPARED_DIR` override). After review, place only the immutable prepared
JSON there; do not transfer a private canonical snapshot, ledger, request payload,
or preparation workspace. No workflow input, new worker, or replay is needed.
The original full salary-preparation artifact is not included. One separately
reviewed, explicitly minimized public-source artifact is staged below.

The filename/content hash, embedded-source hash, exact canonical row fingerprint,
source identity, observation age, posting expiry and current pay-parser version
must validate. Protected rows, pending/refused Writer requests, helper reservations
and transaction fences remain excluded. A changed preparation policy/input hash
can provide source evidence only: all salary fields are recomputed with current
policy and comparison inputs, and degree is reparsed from full text. Sources with
pay, unresolved compensation, structured salary or monetary text are not imported
by this narrow handoff; existing source recovery still handles them. Original
observation times are preserved, and the final Writer guard rechecks the full
canonical row binding for imported-source candidates. Backoff remains in force.
The existing Writer receipt/readback path remains the only completion proof.

A separate minimized handoff uses `forge.pay-posting-source.v1` files named
`enrich-ats-pay-source-<sha256>.json` in that same directory. The prepare-only
producer emits these alongside eligible no-pay salary preparations. Its explicit
allowlist contains only the role ID, nonreversible exact-row hash, parser version,
public posting URL/full text/employer-title-location identity, original observation
time and optional public expiry. It contains no calculated salary or degree,
canonical source identifiers, private row text, notes or comparison-input hashes.
Unknown keys are rejected. This is an evidence-only schema, never a salary payload.
The live owner applies identical role/fence checks and current recalculation; it
never renews source age. `prepared-source.cjs.save` is also the supported local
producer for an already validated retained full no-pay posting. Publication of an
actual data file is a separate approved handoff. The staged source-only artifact
contains one reviewed public posting and its row binding; no original private
preparation envelope is published.
