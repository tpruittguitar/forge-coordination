# AI_REASON: high school diploma or GED is not a degree (2026-11-20)

## What changed
- `tools/enrich-ats-pay/qualification.js` (byte-identical to `foreman-cockpit/apps-script/PipelineQualification.gs`):
  a clause that names only a high school level credential (high school, secondary school/education, GED)
  and no college credential no longer counts as a degree requirement. High school wording covers
  "high school", "secondary school/education", "general education degree/diploma/development" and GED.
  A comma-joined clause is split before a high school credential, and a leading high-school-only part is
  split off ("Bachelor's preferred, HS required" reads PREFERRED). The final "degree word but no
  requirement" ambiguity check ignores high-school-only lines, so "equivalent degree" next to a high
  school diploma reads NOT_STATED instead of ambiguous. "desirable" now counts as preferred wording. Parser version moves to `20261120-high-school-not-degree-v3`,
  so retained full posting text is reparsed by the existing version rules.
- Shared fixtures (`fixtures/degree-extraction.json`, mirrored in cockpit) gain eleven cases.
- Companion cockpit change: the FLEX policy's `required` test now looks clause by clause and ignores a
  clause that names only a high school credential, so "High school diploma required; bachelor's preferred"
  scores SOFT_FLEX instead of NO_FLEX. Its degree-word test also ignores high-school-only clauses, so
  "general education degree (GED) required" no longer scores NO_FLEX.

## Master impact (read only, 2026-11-20 22:27Z, 9467 rows, 5240 with degree text)
- 101 rows are stored DEGREE_REQ=REQUIRED but now read as not required: 88 NOT_STATED, 13 PREFERRED.
  By bucket: SCOUT_INTAKE 79, DECLINED_BY_TIM 22. 5530D036C151 is one of them.
- FLEX on stored degree text: 16 NO_FLEX->SOFT_FLEX, 8 NO_FLEX->HIGH_FLEX.
- 4 parse changes without high school wording, all from "highly desirable" now reading PREFERRED
  (348C8DFBF5C9, DEB409FFC7CB, D6E28C3AA0D3, 0F8F07F79445).

## Why
Tim's standing rule: a high school diploma is not a degree. Tim said "Fix it" on 2026-11-20 after the
live master showed row 5530D036C151 stored "High School Diploma or GED required." as DEGREE_REQ=REQUIRED.
The helper-lane check already rejected this (HIGH_SCHOOL_IS_NOT_A_DEGREE); the code parser did not.

## What did not change
- No master rows were edited. The coordinator writes a code-read degree only when the parser returns a
  real requirement, so a stored REQUIRED value is not replaced by NOT_STATED automatically.
- Most texts that name only a high school credential already scored HIGH_FLEX (no "degree" word); the
  ones with "degree" in the high school wording, or a preferred college degree, scored NO_FLEX.
- A technical diploma in a named field still counts as a credential.

## Verification
Fixture cases pass through both parser entry points, the coordinator posting-format path and the cockpit
ATS/FLEX path. Full suites: see the PR.
