# Company-business exclusion: reviewed contract and rollout design

Status: draft, not integrated or deployed. This change does not activate a policy, alter a canonical row, suppress a live queue, or perform research. The executable contract is intentionally disconnected until the adapters and end-to-end checks below exist.

## Scope and authority

Existing canonical GLOBAL_PHARMA_MEDICAL_EXCLUSION covers primary pharmaceutical, medical-device, healthcare-delivery and diagnostic/therapeutic businesses. Tim's November 12 clarification adds process-industry operations: bulk chemicals, refining and raw-material production. Discrete stamping, molding and machining remain in scope. Industrial suppliers and diversified manufacturers are not excluded merely because customers operate in excluded industries. Agency classification concerns the identified client, never the recruiting firm or an inferred client.

The process classes in the prototype are vocabulary, not activated rules. The canonical policy owner must bind the clarified scope to a current rule definition/revision. Do not manufacture a new NC number or reuse an unrelated rule ID. The contract requires a caller-supplied reviewed current rule and matching fact binding before proposing any exclusion.

## Verified failure

The November 12 01:28:48 UTC master had 6,744 rows. An exact-name sample of AbbVie, Stryker, Amgen and Medtronic had 11 active SCOUT_INTAKE rows and 15 declined historical rows. The 01:19:22 UTC queue placed ten sampled active rows in enrichment and one in decision. This is a sample, not an industry-wide rate.

AbbVie V2I-DB914E782B87 already carries pharmaceutical primary-business classification, NC-001 and PHARMA_MEDICAL exclusion reason but remains in enrichment. Product fields alone do not trigger disposition. Writer classifyNeverConsider runs at intake; its parser reads the NEVER_CONSIDER section but stops before the separate global healthcare ruling. PipelineWorklists does not inspect business exclusions.

Sources: forge-policy rules/TIM_PIPELINE_RULES_CANONICAL.txt; foreman-cockpit apps-script/Code.gs, apps-script/PipelineWorklists.gs and pipeline-products.js; canonical master and forge-coordination state/PIPELINE_WAITING_QUEUES.json. Official employer evidence: https://investors.abbvie.com/ ; https://www.stryker.com/us/en/about.html ; https://www.amgen.com/about ; https://www.medtronic.com/no-nn/about.html .

## Evidence flow

1. Reuse source text already read during discovery/enrichment and existing shared employer facts. No new mandatory company lookup or separate discovery schedule.
2. Keep PRODUCT_SCOPE=JOB_POSTING or COMPANY_LOCATION evidence distinct from EMPLOYER_PRIMARY_BUSINESS. Products at one site cannot establish the whole employer's primary business. Company names, job titles, healthcare customers and generic materials terminology are not classification evidence.
3. Review primary-business evidence once per exact employer, retaining URL, exact quote, content digest, verification date, reviewer/provenance, confidence, conflicts and current policy definition/revision. The prototype accepts reviewed facts; it does not independently authenticate supplied claims or fetch URLs. A production adapter must verify these fields against the controlled shared reference and source evidence, not trust candidate-supplied JSON.
4. Feed the same result to intake, post-enrichment, active worklists, scoring/ranking and resurfacing. Unknown business remains nonblocking review under existing lane semantics. Cache invalidation on employer, policy or evidence changes must reopen review.
5. Newly confirmed active master matches generate exact-identity Writer disposition proposals. Use current row readback, freeze/lock and idempotent transaction rules, explicit authorized disposition, RESULT/COMPLETE receipts and independent readback. Never mutate a row through this pure helper. Preserve applications, terminal history, anti-resurrection and Tim decisions. Conflicting explicit Tim instructions require adjudication, not automatic suppression.
6. Suppress confirmed excluded employers from active recommendation surfaces using the same authoritative decision, not a second employer-name blacklist. Preserve historical visibility and evidence. Queues need an explicit exclusion-pending accounting state until disposition is verified, so work is neither silently dropped nor repeatedly researched.

## Required adapters and acceptance tests before rollout

- Canonical parser: incorporate the global healthcare ruling and owner-approved process rule without stale duplicated definitions; changed/retired policy invalidates the binding.
- Controlled shared fact reader: exact employer/client identity, evidence provenance, dates, source digest and ambiguity checks. No fuzzy subsidiary inheritance.
- Writer: intake and post-ENRICH hooks using the same evaluator. Read existing saved facts as well as newly enriched facts; do not require another lookup for the confirmed AbbVie example.
- Every active queue/rank/recommendation/resurface consumer must consume this decision. Verify unknowns progress, protected suppliers remain, known exclusions cannot re-enter through alternate URLs/providers, and history/status remain unchanged.
- UI accounting: confirmed exclusion pending disposition versus business review needed; neither is a completed canonical write.
- Controlled dry run against the complete current master/archive, reconciling all IDs and per-stage counts. Inspect false positives and Tim exceptions before approving row-specific mutations.
- End-to-end fixtures for manual/automated intake, enrichment, scoring, ranking, resurfacing, agency clients, diversified employers, stale evidence, source conflicts, protected history, explicit Tim overrides, failed Writer receipts, concurrent changes and retries.

## Prototype verification

Run `node --test tools/company-business/review.test.cjs`.

18 focused tests pass. They cover all seven proposed exclusion classes, all five supplier/discrete carveouts, missing facts, product-only evidence, stale/conflicting/changed bindings, unknown/identified agency clients, protected records, intake and input immutability. They do not establish production integration or full repository/CI success. No production adapter is installed by this draft.
