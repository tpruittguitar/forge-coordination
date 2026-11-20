# AI_REASON: high school diploma or GED is not a degree (2026-11-20)

## What changed
- `tools/enrich-ats-pay/qualification.js` (byte-identical to `foreman-cockpit/apps-script/PipelineQualification.gs`):
  a clause that names only a high school level credential (high school, secondary school/education, GED)
  and no college credential no longer counts as a degree requirement. Clauses are also split before a
  high school credential after a comma. Parser version moves to `20261120-high-school-not-degree-v3`,
  so retained full posting text is reparsed by the existing version rules.
- Shared fixtures (`fixtures/degree-extraction.json`, mirrored in cockpit) gain six cases.
- Companion cockpit change: the FLEX policy's `required` test now looks clause by clause and ignores a
  clause that names only a high school credential, so "High school diploma required; bachelor's preferred"
  scores SOFT_FLEX instead of NO_FLEX.

## Why
Tim's standing rule: a high school diploma is not a degree. Tim said "Fix it" on 2026-11-20 after the
live master showed row 5530D036C151 stored "High School Diploma or GED required." as DEGREE_REQ=REQUIRED.
The helper-lane check already rejected this (HIGH_SCHOOL_IS_NOT_A_DEGREE); the code parser did not.

## What did not change
- No master rows were edited. The coordinator writes a code-read degree only when the parser returns a
  real requirement, so a stored REQUIRED value is not replaced by NOT_STATED automatically.
- A text that names only a high school credential already scored HIGH_FLEX (no "degree" word), so its
  fit score was already right; only DEGREE_REQ was wrong.
- A technical diploma in a named field still counts as a credential.

## Verification
Fixture cases pass through both parser entry points, the coordinator posting-format path and the cockpit
ATS/FLEX path. Full suites: see the PR.
