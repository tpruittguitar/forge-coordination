# Enrichment outcome measures

These are read-only observations. They introduce no WIP limits, processing caps, admission gates or ranking changes.

## Wasted enrichment

A distinct job counts once if an observed enrichment completion is followed by a confirmed posting closure or an explicit failed freshness check before Tim's recorded decision. The summary separates confirmed closures from failed checks: a failed request is at risk, not proof the job is dead. Posting age, an overdue check, or a disappearing row alone is not failure.

The daily denominator is jobs with an observed completion on that Eastern calendar day. Later losses update that original completion-day cohort; the numerator never mixes today's closures with today's completions. The UI also shows losses detected today separately. Recent cohorts have had less time to incur losses. The overview and age samples cover 30 Eastern days. Daily history is expandable.

## Age at decision

Observe the first post-completion Tim decision timestamp. Report median and oldest hours among decisions in the window. Completion is observed between successive snapshots, so elapsed times appear as lower/upper bounds. Applied, declined, pursue, hold and research are decisions when their explicit Tim provenance and timestamp are available. Later employer rejection does not create a Tim decision.

## History and storage

Existing enrichment transition events seed known completion windows. Review-ready baseline stock without an observed completion is excluded from timed cohorts and disclosed as unknown history. Missing timestamps never become zero loss or zero-hour decisions. Final canonical decisions without a usable timestamp are excluded from age and undecided-loss claims.

The observer stores its per-job lifecycle in state/ENRICHMENT_OUTCOMES.json (IDs, timestamps and check fingerprints only). The compact quality summary is included in state/ENRICHMENT_FLOW.json; the lifecycle map is not fetched by the GUI. Existing observer cadence publishes the measures alongside the reconciled flow. No Writer or master mutation is performed.
