# Complete degree evidence

`tools/enrich-ats-pay/qualification.js` and the companion
`foreman-cockpit/apps-script/PipelineQualification.gs` are byte-identical copies
of the same pure parser. Keep their fixture files in sync too. Both the ATS
producer and programmed enrichment/coordinator paths use this contract.

- Retain the academic requirement and its immediately adjacent, explicit
  experience/substitution alternative, including sentence, list-item, semicolon
  and wrapped `or` boundaries. Ordinary experience requirements are not alternatives.
- Retain a governing preferred heading when it determines the requirement.
  Do not cross a section boundary to borrow equivalence from unrelated content.
- Preserve the complete normalized source wording. No first-sentence or prefix
  truncation is allowed. A block exceeding 1,200 characters remains unresolved,
  as does conflicting degree-level/alternative scope. This fits the existing
  Writer 1,500-character ATS evidence field limit.
- Equivalence to a technical field is not experience equivalence. Negated
  equivalence is not flexibility. A genuinely independent mandatory credential
  still governs. The Writer remains responsible for FLEX and scoring.
- The ATS producer does not invent `NOT_STATED` for an unreadable/ambiguous block.
  Existing `DEGREE_TEXT` is not overwritten by a routine ATS liveness check.
- Degree extraction has its own version. Retained, identity-bound full posting
  text is reparsed when that version changes, preserving its original observation
  time and existing pay. Derived-only old cache entries cannot certify a degree.

## Validation and release boundary

The shared regression corpus is `tools/enrich-ats-pay/fixtures/degree-extraction.json`
and `foreman-cockpit/tests/fixtures/degree-extraction.json`. The cockpit suite checks
parser output through ATS interpretation, Writer fields, and the actual FLEX
policy; it also evaluates both Apps Script files without CommonJS, in reversed
load order. Coordination tests cover both public extraction entry points and
independent degree cache invalidation. The regression for merged PR #312 uses its
successful-posting cache and verifies degree migration without changing rejected
pay, raw retained evidence, or observation time. Its invalid-date and pay-ambiguity
safeguards remain intact.

The companion cockpit change is necessary for its Apps Script producer. Merging
one repository does not deploy Apps Script or establish adoption of a native lane
packet. This change does not merge, deploy, change schedules, submit Writer
requests, or replay any previous request.

## Historical repair assessment

The reported failure was reproduced from synthetic evidence, not a named live
role. The initial read-only sample at coordination commit
`a768a2316308a4920fb07834072cc5accbab01ad` contained 349 posting-evidence entries,
45 with retained full text, of which 40 asserted verified source identity.
Comparing the old ATS extractor with the new parser on those retained texts found
no hard-degree-to-flexible correction. This is limited historical cache coverage,
not proof that the live master has no affected rows. No canonical record was changed.

Previously populated degree fields are intentionally not automatically rewritten.
A future targeted repair should identify source-backed rows whose stored excerpt
omits an adjacent alternative, read fresh canonical identity/state and the exact
full posting, respect Tim overrides/protected states, and submit only confirmed
corrections through the Writer under separate authorization. Preserve original
request evidence; never replay a historical batch. Do not infer `NOT_STATED` from
an unavailable source or perform a broad score refresh as a substitute for proof.
