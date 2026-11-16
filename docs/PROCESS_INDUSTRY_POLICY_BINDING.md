# Process-industry policy binding rollout

This change binds the existing evaluator categories to Tim's chemical/material-processing scope: bulk chemical production, refining and raw-material production as the employer's primary business. Discrete stamping/molding/machining and industrial suppliers are preserved; unknowns remain visible and are not held solely for company research.

## Merge order

1. Review and merge the [companion forge-policy PR #13](https://github.com/tpruittguitar/forge-policy/pull/13) canonical rule change (RULING_ID=TIM-20261112-PROCESS-INDUSTRY).
2. Confirm the live `rules/TIM_PIPELINE_RULES_CANONICAL.txt` blob SHA is `8ff69e120eb423268e8bd3b7603d277707d7d8ac`. If concurrent policy edits change it, regenerate/review the bundle binding against the complete new canonical text rather than replacing the live file or guessing a revision.
3. Merge this fact-bundle binding only after step 2. It updates the bundle and all four existing facts to the new canonical revision; the employer evidence itself is unchanged.
4. Do not switch on company exclusions as a side effect of either merge. Verify the deployed authenticated source can load this canonical text and bundle, then obtain activation approval.

A canonical-file edit changes its blob SHA. Until the matching bundle is merged, the evaluator returns REVIEW_NEEDED rather than using old bindings. With the evaluator still off this introduces no filtering change. Do not activate between the two merges.

## Coverage and limits

The bundle still contains only AbbVie, Amgen, Stryker and Medtronic. Adding the three process-category rule bindings does not classify any real employer and cannot exclude a chemical/material-processing job without an exact reviewed primary-business fact. Reuse evidence already captured in discovery/enrichment; add source-bound facts only where the employer's primary business is supported. Never infer classification from title, customer industry, company-name fragments or a site's output alone.

No master updates, deletions, activation, schedules or writes are part of this change. Existing-row impact must be dry-run against fresh master/archive reads, preserving protected history and Tim decisions before separately authorized dispositions.
