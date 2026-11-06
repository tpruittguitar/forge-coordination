# Evidence, recovery and measurable progress

These changes address five related failure patterns without creating another native schedule or granting research workers canonical write authority.

## One current automation binding

`control/NATIVE_AUTOMATION_BINDINGS.json` maps stable task keys to current native IDs and destinations. The native reader discovers installed local tasks before comparing configuration; it reports missing, duplicate, unexpected and mismatched registrations. Compatibility copies in the registry/owner/operating model are checked against this binding. Local and cloud observations stay separate.

The cockpit catalogue is generated from the registry, bindings and cutover policy:

```sh
node scripts/generate-automation-catalogue.cjs <forge-coordination-checkout>
node scripts/generate-automation-catalogue.cjs <forge-coordination-checkout> --check
```

Service work, task work and a native scheduler invocation are separate signals. A generic five-minute coordinator receipt cannot certify an hourly native launch or its destination. Until a genuine bound invocation-record producer exists, that specific claim remains unverified; working services are not described as failed merely because launch evidence is unavailable.

## Facts retain meaning and identity

All supported posting paths use common qualification and compensation interpretation. A rejected source identity cannot fall through to a weaker salary regex. Pay retains currency, annual period and base-pay context; total compensation, conflicting metadata and other sites are not employer-posted USD base facts. Qualifications retain headings, credential levels, major preferences and experience alternatives. Supplier protections take precedence over customer-industry terms.

Saved raw evidence is reinterpreted rather than fetched again when its exact binding is proven. Old derived-only or unbound values do not bypass the new checks. This does not authorize overwriting historical canonical facts without current source evidence.

## Writer refusals are not uncertain deliveries

`reference/WRITER_OUTCOME_CONTRACT.json` is shared with the cockpit protocol tests. A request-bound `NOT_ACCEPTED` outcome must prove the relevant phase and zero mutations. Accepted, uncertain and nonaccepted results have distinct recovery behavior. An unreadable result is never evidence that a request was absent. A refusal authorizes only its next permitted attempt; a later uncertain delivery cannot reuse that old authorization.

The existing coordinator/mail/pay workers retain refusal proof, honor backoff, and use a new request identity where their existing transport requires it. They continue unrelated jobs. COMPLETE receipts plus exact row effects remain necessary before canonical completion is claimed. Bad-input refusals require a corrected input; unchanged invalid requests must not be churned indefinitely.

Historical lock refusals require the actual deployed source that produced the saved response. Before replacing the Writer, preserve that witness with the read-only command:

```sh
node tools/writer-outcome-witness.cjs <existing-private-config.json> <exact-original-request-id>
```

It only reads current status/deployed source and saves a private witness; it does not POST, reconcile a transaction or clear a fence. Recovery subsequently still checks fresh receipt/result absence. A witness for the original Gates request was captured before this rollout; no canonical effects were claimed by that capture.

## Exceptions have an executing consumer

The existing hourly outcome tracker reviews cases; the five-minute coordinator validates proposals and performs permitted effects. Source capture and queue enumeration alone never complete review duties.

```sh
node tools/routine-handoffs/exceptions.cjs start <accounting-checkout> <unique-run-id> 20
node tools/routine-handoffs/exceptions.cjs review <accounting-checkout> <private-source-bound-review.json>
node tools/routine-handoffs/exceptions.cjs checkpoint <accounting-checkout> <private-progress.json>
```

Use the START selection's exact run ID in its reviews. Continue successive evidence-sized selections while runtime permits; 20 is not a processing cap. Source-bound attempts and accepted reviews rotate MAIL, WRITER, INTERVIEW, SOURCE, IDENTITY and HISTORICAL service. Waiting cases retain their retry condition rather than consuming every new selection.

Immutable START/CHECKPOINT receipts and `state/AI_EXCEPTION_PROGRESS.json` distinguish attempted, reviewed, independently resolved, waiting and awaiting-code work. Capture-only runs count zero review progress. Repeated active zero-progress runs report `AI_REVIEW_STALLED` with the next exact case. Superseded selections are identified separately and are not invented canonical resolutions.

Interview failures enter this same queue. The private inspect/correct protocol is documented in `lanes/CHATGPT_APPLICATION_OUTCOME_TRACKER.txt`. Corrected reviews are resolved only after normal source/identity validation and event consumption. Older review files cannot silently overwrite newer interpretations; missing Gmail IDs cannot merge different events.

## Saved alerts become consumable work

The normal mail pipeline automatically extracts observed Indeed, Glassdoor, BuildSubmarines and Ladders layouts. It preserves provider/job identity and reusable card evidence. Opaque links retain known facts and a missing URL instead of inventing a posting ID; the existing intake-source worker receives that durable obligation. Partial/conflicting cards do not discard valid neighbors. See `docs/ALERT_SOURCE_CAPTURE.md`.

Collection advances from proven enumeration independently of semantic coverage, while unresolved IDs and historical gaps remain retained. The same MIME completeness check governs full-read counts, pending capture and cache reuse.

## Failure isolation and rollout checks

Immutable artifact provenance is validated separately from current processing eligibility. Completed/protected work is skipped at consumption, not used to invalidate unrelated historical evidence. Valid PR artifacts are harvested even when another artifact fails. Malformed correction or reporting-health input produces a precise local obligation and cannot stop unrelated collection/attention work.

Review and merge the backend and cockpit changes together. Preserve historical refusal witnesses before Writer replacement, then verify actual scheduled cycles using their source-bound receipts. Passing tests or prepared evidence do not prove that production has deployed, that all backlog jobs completed, or that historical application-status gaps are closed. No production deployment or backlog mutation is performed by the PR validation suite.
