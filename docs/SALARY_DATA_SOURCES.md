# Salary evidence sources

Maintain source priority rather than applying a universal discount to software compensation.

Use [Pay-disclosure salary search guide](PAY_DISCLOSURE_SEARCH_GUIDE.md) for the dated official-source state table,
remote/reporting coverage cues, request-only laws, future effective dates and shared salary-search procedure.

Use [the master/archive employer-source audit](EMPLOYER_PAY_SOURCE_AUDIT.md) and
`reference/EMPLOYER_PAY_SOURCES.json` for repeatedly documented employer sources and the programmatic source selector.
Saved capture coverage is not an employer's actual disclosure rate; provenance-review records are not approved anchors.

1. Exact employer posting (including an identity-matched aggregator copy of that posting): use the stated base range.
   Salary-transparency jurisdictions are useful places to search for same-employer comparables when the target has no
   posted pay. The current worker already checks posting pay first and prioritizes transparency-state board results.
   Coverage depends on the employer, jurisdiction and role/location. The state list in code is a search hint, not a legal
   determination that every listing must contain pay. Never present a California comparable as the target's Texas pay.
   Official California guidance: https://www.dir.ca.gov/dlse/california_equal_pay_act.htm
2. Official DOL OFLC public disclosure files (LCA H-1B/H-1B1/E-3): a candidate source of employer/title/worksite wage
   evidence, beyond software alone. Preserve offered wages separately from prevailing wages; these are visa-program
   application records, not proof of an accepted offer, a target job's posted range or a representative salary sample.
   Validate the current record layout, currency, unit, dates, case status, employer, SOC, worksite and duplicate case IDs
   before importing. Download index: https://www.dol.gov/agencies/eta/foreign-labor/performance
3. BLS OEWS downloadable national, state, metro and industry tables: broad occupational wage cross-checks; state data
   already support the worker's fallback. Do not equate an occupation-wide wage distribution with a named senior-manager
   employer range. Metro/industry matching is preferable to a single nationwide software benchmark.
   https://www.bls.gov/oes/tables.htm
4. Levels.fyi and other voluntary compensation reports: third-party evidence only. Separate base, stock and bonus and
   confirm permitted access/reuse. Publicly viewable data is not automatically an openly licensed bulk database.
   https://www.levels.fyi/about
   https://www.levels.fyi/about/terms.html

A fixed technology-to-manufacturing percentage is not established by these sources. Any future adjustment must be
estimated on overlapping, genuinely comparable base-pay jobs, stratified by level/function, employer/site scale,
geography and date. Evaluate on held-out examples with coverage, absolute error and bias, and reject adjustments that
do not improve the held-out evidence. Do not tune the discount to force a preferred salary. No blanket haircut, DOL
import or Levels bulk integration is enabled by this documentation; imported third-party records must not silently
enter the employer-posted anchor pool.

Company/site starter facts live in `reference/COMPANY_SITE_CONTEXT.json`, with dates, disclosure scope, headcount
population and sources. Fiscal-year revenue is in USD only when the filing reports USD; no unrecorded FX conversion.
Preserve reported rounded counts, contingent-worker inclusion and lower bounds. An `employeesLowerBound` is deliberately
not supplied as the model's exact `employees` input. Parent headcount must not become a subsidiary's headcount, and
facility-specific figures do not bind city-only jobs without facility identity evidence.
