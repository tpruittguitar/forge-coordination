# Source-bound discovery exclusions

This path closes ineligible **discovery identities**, preserving their source history. It never removes a master/archive row, changes a user's decision, or writes through a replacement Writer. Existing canonical matches remain PRESENT, and original-request fences remain reconciliation work.

## Prepare grouped negative evidence

Reuse the current intake-drain owner's assigned keys. Group by exact employer and reviewed rule binding, not fuzzy names or titles. Only `reference/EXCLUSION_BUSINESS_EVIDENCE.json` bindings merged through review are supported. Each binding declares an exact employer name, official public source URL and contiguous quote, and the current canonical rule/category/MATCH hash. This is a reviewed business classification, not arbitrary helper prose. Suppliers, unnamed agency clients and diversified groups require separate scope evidence, never inheritance from customers or a parent company.

For each current key/sourceVersion, submit the normal immutable `forge.intake-drain-review.v1` envelope with outcome `EXCLUSION_CANDIDATE`, `originalCard` equal to the current card, and `exclusionEvidence` containing the binding's company, ruleId, URL and quote. Retain reason, nextAction, actual attempts, provider/task/run attribution, timestamp and `writerSubmitted:false`. Validate and save with the existing `queue.cjs review` command. Negative evidence does not require filling irrelevant pay/degree/worksite gaps. Known identity conflicts or any Writer fence still block it.

Publish through the existing authorized append-only review transport with a valid change record. Do not mutate generated queue state. Observe existing queued/in-progress source-intake-auto runs before any permitted manual dispatch; do not duplicate them or create a new schedule.

## Independent processing and closure

The existing source-intake-auto verification step reads current canonical rules using its already configured Writer read credential. It requires an ACTIVE matching rule definition, re-fetches the official source and verifies the exact quote/host. It shares source requests within the run, including failed requests, so a group does not trigger per-row page fetches. It produces READY_FOR_CONTROLLED_EXCLUSION, not a positive intake candidate. Changed matched-rule definitions, changed quotes, missing sources, redirects to another host, or missing authority remain pending with a specific error/retry condition.

The existing observability process independently reads the live master and archive. It can apply an exclusion only while the original review/version is current, the validation is less than 24 hours old, the reviewed employer binding and matched-rule hashes still match (unrelated rule additions do not reopen verified work), and there is no original-request fence or identity conflict. Any potential canonical employer/title match is protected even if the location differs. Exact canonical/URL matches continue to win as PRESENT. The observer records the review and validation proof in the retained upstream identity, marks it EXCLUDED, and the normal drain synchronization accounts it upstream.

An established disposition remains source/rule-bound rather than reopening daily. Changed identity, policy definition, employer binding, conflicts or fences invalidate its use. This preserves history and supports independent accounting of the reduced pending count. No canonical job mutation occurs.

## Rollout limits

The initial reviewed bindings cover Koch Foods, AbbVie and The Coca-Cola Company under existing NC-001/NC-003. They do not automatically activate proposed finance/accounting/property-management rules. HCA's broader healthcare exclusion needs an exact authoritative rule binding before this path can close it. New bindings are reviewed policy-consumer data, not a runtime AI allowlist edit.

After merging this implementation, prepare fresh source-version-bound reviews, allow the existing verifier and observer to run, and compare before/after pending identities with EXCLUDED proofs. Publication, READY_FOR_CONTROLLED_EXCLUSION and successful workflows are not themselves removal. Report reviewed, independently verified, actually excluded and blocked counts separately.

## Exact-role templates (NC-005 / NC-006)

`reference/EXCLUSION_ROLE_EVIDENCE.json` is a separately reviewed set of role templates. Each entry binds an **exact company and exact title**, responsibility quote, public source URL, canonical category and SHA-256 of the complete canonical NC-005/NC-006 definition line. A negative review carries `kind:"ROLE_TEMPLATE"` and `title` in its `exclusionEvidence`, alongside company/ruleId/url/quote. The original per-identity card and sourceVersion are still mandatory. There is no fuzzy company or title inheritance, and manufacturing/industrial title contexts remain reviewable.

The independent verifier requires the current ACTIVE canonical rules text to contain that exact definition, and re-fetches the reviewed page. The page must contain the exact employer, title and responsibility quote. Canonical policy permits credible job-board descriptions; an official employer page is not an additional admission gate. Shared role evidence classifies the role's function, not the liveness of every requisition. The retained quote and reviewed template scope must explain why the primary function matches the rule; an employer name or incidental budget responsibility is insufficient.

The initial template covers H&R Block's exact Multi-Office Leader title, whose sourced responsibilities lead Tax Professionals. It does not exclude H&R's differently titled roles. Current snapshot reach is 75 actionable exact matches, before fresh protections and live independent verification. No reviews are published by this implementation and no exclusions are asserted.

EY supply-chain templates are intentionally **not** enabled: the current canonical role categories and published discovery mismatch terms do not supply a corresponding active rule. A reviewed canonical authorization is needed before any such template can exclude. This implementation does not create a policy category or treat saved conversational preferences as runtime rule authority.

The grouped producer must enumerate role bindings with both company and title and retain `kind`/`title` in evidence; a company-only business producer cannot apply these templates. The existing queue publisher can already submit properly formed per-identity negative reviews. After merge, regenerate exact current reviews, publish only through authorized transport, and verify independent EXCLUDED proofs. Existing master matches, user decisions, original-request fences and immutable history retain priority.
