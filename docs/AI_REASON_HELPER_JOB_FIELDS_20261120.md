# AI_REASON: helper lanes can fill every job-text field (Claude, 2026-11-20)

Tim, Nov 20 2026, 9:29 AM ET: "Let's fix the writer then. The writer should be capable of filling all required fields except those that come from the app or code built in." Tim then said "You merge."

## What changed

- `tools/helper-routing/helper-fields.cjs` (new) is the one list of job-text fields a helper may propose, with the quote and value rules. `shared.cjs` validateBatch uses it instead of its old 8-field allowlist.
- Helpers send one exact, unshortened quote per field group in `sourceEvidence.fieldQuotes`. Groups: DEGREE, SALARY, WORK_ARRANGEMENT (WORK_ARRANGEMENT + REMOTE_HYBRID), REQ_ID, POSTING_DATE, CLIENT_EMPLOYER.
- The programmed coordinator (`source.cjs` helperEvidence) checks every quote again against the posting it read itself. A quote not in that posting stops the item as an AI exception (`HELPER_FIELD_QUOTE_NOT_IN_POSTING`).
- `source.cjs` enrichmentFields: code-read values still come first. Helper facts fill only what code could not read. REQ_ID, CLIENT_EMPLOYER, POSTING_DATE and work arrangement fill blanks only.
- Tim's standing rule (newer employer-site data replaces older stored values) is now code for the degree and salary groups, the two that carry an as-of date. Employer-owned means an ATS API read or the employer's own page; LinkedIn, other aggregators and captured discovery cards never replace. `transactions.cjs` allows the overwrite only when the job names the group, the group is complete and its as-of date is later than the stored one.
- `transactions.cjs` Writer submit allowlist adds WORK_ARRANGEMENT, REMOTE_HYBRID, REQ_ID, POSTING_DATE, CLIENT_EMPLOYER.
- `shared-assignments.cjs` needs(): DEGREE_REQ=NOT_STATED with REQUIREMENTS_REVIEWED=YES counts as settled, so a full-posting "no degree" read is not assigned again.

## Rules kept from before

Exact verbatim quotes; no "..." or "…"; salary above zero, low ≤ high, employer-posted annual base, no hourly/OTE/estimate text; NOT_STATED only after reading the whole, uncut posting (and the coordinator's own parser must also find no degree); a high school diploma or GED is not a degree; assignment, identity and fence checks unchanged; helpers never submit to the Writer.

## Column classification

(a) Job text, helper may propose: DEGREE_TEXT, DEGREE_REQ, SALARY_BASE_LOW, SALARY_BASE_HIGH, SALARY_BASIS, WORK_ARRANGEMENT, REMOTE_HYBRID, REQ_ID, POSTING_DATE, CLIENT_EMPLOYER; links (SOURCE_URL, COMPANY_SOURCE_URL, DEGREE_EVIDENCE_URL, SALARY_SOURCE) accepted but always rebuilt by code; fit requirement quotes (sourceEvidence.fit), which code turns into FIT_EVIDENCE.

(b) Computed by the Writer or code: OVERALL, OVERALL_RATING, GEO, GEO_SCORE, NET_COMP, NET_COMP_SCORE, EXPERIENCE_FIT, RATING_CONFIDENCE, FLEX_RATING_IMPACT, PAY_WORTH, PAY_WORTH_BASIS, FLEX_CLASS, FLEX_MODIFIER, ADJUSTED_FIT, PURSUIT_STATUS, SALARY_MIDPOINT, SALARY_SCORE_POINT, FLOOR_STATUS, FLOOR_BASIS, SCOPE_FIT_RAW, FIT_EVIDENCE, FIT_BASIS, FIT_CONF, latitude/longitude and geocode fields, salary estimates, SCORING_MODEL_REF, RULES_POLICY_VERSION (list in helper-fields.cjs COMPUTED).

(c) Bookkeeping and identity, Writer only: PRIMARY_ID, COMPANY, TITLE, LOCATION, REQ, BUCKET, DISPOSITION, STATE_*, ENRICH_SOURCE, ENRICH_UPDATED_AT, IDENTITY_*, INITIATING_URL, *_ASOF, *_CONF, REQUIREMENTS_REVIEWED, TIM_*, APP_*. Writer evidence keys (LOCATION_NOTE, *_QUOTE, *_NOTE) go to the evidence file, not the master row, so helpers do not send them.

## Not changed

- Grok direct-writer (`direct-writer.cjs`) keeps its 18 keys; Grok is retired and Sniffer replaced it.
- needs() does not yet assign rows for work arrangement, requisition ID or posting date alone. Adding that would put most of the master into helper queues at once; it is a separate decision.
- The code degree parser (`enrich-ats-pay/qualification.js`) still reads "High school diploma or GED required." as a REQUIRED degree. The helper path rejects that; the parser itself is unchanged here.

## Tests

`tools/helper-routing/helper-fields.test.cjs` (11 tests). Full helper-routing, programmed-coordinator and sniffer suites: 349 tests, 348 pass, 1 skipped (pre-existing), 0 fail.
