# Preliminary ATS term variants

This is an observed competency-overlap filter, not a qualification score. Eleven
resume-grounded categories remain eleven categories. More words in one category
still yield one hit. No credential, new competency, or final-fit decision is added.

## Vocabulary and evidence

`control/RESUME_MATCH_PROFILE.json` retains the same selected October 13 resume
version, file identity, text hash and competency evidence hashes, unchanged on disk.
The separate `control/RESUME_MATCH_VARIANTS.json` contains only public vocabulary,
without resume identifiers or hashes. The default profile loader applies these
variants in memory; custom profile files are not silently extended. The terms
include explicit plural/spelling variants, common abbreviations and expansions,
and narrow equivalent descriptions of existing competencies. Examples:

- factories, plants, assemblies and mfg;
- PLCs / programmable logic controllers, robots / robotic;
- electric vehicles / batteries, manufacturing execution systems;
- root-cause / corrective actions, line-balancing / standard-work;
- supplier development as an expression of supplier readiness/recovery;
- operational excellence as a broader expression of Lean/continuous improvement.

These last two are preliminary topic overlap, not proof that a particular role
is suitable. They intentionally can match industries Tim excludes; Never Consider
is a separate decision, and a positive ATS hit must not override it.

Whitespace and common hyphen variants are accepted in phrases, bounded to 20
separator characters. Token boundaries prevent substring matches. Saved terms
are the actual observed text, in source order, preserving first observed casing.
Excerpts use validated match positions, not substring searches. New results carry
`matcherVersion: explicit-variants-v2`.

Bare `vision` has been removed. `machine vision`, `robot vision`, and
`vision-guided` remain. Insurance, visual acuity and corporate vision alone no
longer imply robotics experience. Existing broad terms such as `data` and `module`
are not expanded; they remain a limitation of preliminary overlap.

Generic General Manager, Director of Operations, CNC and MRO do not become
manufacturing or Lean matches by themselves. This avoids inventing experience or
confusing a title with demonstrated domain overlap. Missing description remains
unknown rather than evidence against a role. Relevant title-only leads can still
need a description check.

## Worksheet evidence labels

Counts and saved evidence are not recalculated by the worksheet. Labels now
separate Title only, Source snippet, Captured content (extent unverified), and
Role content screened. Only the last label uses a saved PASS/EXCLUDE ATS gate on
captured role content. Zero on incomplete or unverified text explicitly says it
is not a screened-out job. Missing/invalid evidence still displays unavailable,
never zero. The zero gate and Never Consider implementation are unchanged.

No historical evidence, backlog status, canonical rows, schedules or running
services are changed by this patch. Fresh matching requires the normal producer
to use the updated matcher/profile after authorized rollout. Saved old matches
retain their original provenance.

## Read-only impact comparison

Snapshot: `65520a77af8575783a1e8c18511083a7ea111dd1`, waiting index timestamp
2026-11-12T01:19:22.659Z, 601 candidate identities.

For each card, the existing read-only discovery-inputs index was asked for locally
recoverable source text. Old and new matcher were run on identical inputs: 119
had recovered descriptions; 482 used title only. This is **not** a replay of all
historical saved text and must not be presented as a recalculation of the live
worksheet's saved counts. Some older source descriptions are no longer recoverable
through that index, and saved matches may have used richer text.

On those identical available inputs:

- 116 old zeros became 109 new zeros: seven changed from zero to one category.
- No positive became zero.
- 26 cards increased their category count; 44 decreased; 531 were unchanged.
- Five of the seven zero-to-positive cards also had a saved zero in this snapshot.
- Eaton's Supplier Development Engineering title now observes supplier development.
- Operational Excellence titles now observe Lean/operations overlap.
- GNR's VP / General Manager for CNC Machining remains title-only, zero observed
  overlap, not screened out. It does not establish hands-on CNC experience.

These are changes in keyword evidence, not counts of qualified jobs. Examples
include Baxter and food-related employers, illustrating why Never Consider must
remain independent. The comparison made no writes to pipeline state and fetched
no new job descriptions.

## Checks and rollout

Regression tests cover aliases, actual term/quote preservation, duplicate category
counting, substring boundaries, whitespace-only content, insurance/corporate vision,
long formatting gaps, snippet versus screened zero, missing evidence, and the
unchanged current-resume/source-content prerequisites of the exclusion gate.
Existing zero-gate test fixtures now use Customer Support rather than Operational
Excellence, which is intentionally a positive alias.

Publish as a draft PR only. Merge/deployment and any deliberate historical
reprocessing require the normal separate authorization. Reverting the vocabulary,
matcher and display changes restores prior behavior; it does not rewrite saved
matching results already produced.
