# Direct processing of discovered job details

Tim's November 9 direction is to put usable discovered details straight into the supported Writer path. Research is not finished merely because a batch was prepared or a review was published. This contract applies to the non-retired job-detail routes marked `WRITE_THROUGH_SUPPORTED_WRITER`; it does not activate dormant routes or alter ownership, schedules, credentials or source permissions.

## Grok direct submission, November 10

Grok uses the existing Drive `AI_Coordination/WRITER_QUEUE` route described in
[Grok direct Writer](GROK_DIRECT_WRITER.md) before the helper-return adapter.
That queue reaches the same Writer without the local helper coordinator, its
production lock, a credential, or a new endpoint. The Writer's script lock and
verification fences remain. Existing captured/uncertain returns must not be sent
again; new direct work must not also be delivered as an evidence-only batch.
Actual Grok queue access and verified effects require observed execution, not
this instruction change. Independent coordinator duties remain intact.

## Existing supported execution paths

- Shared Claude/Grok, ChatGPT enrichment, and independently active legacy Claude intake/enrichment/relevance tasks preserve their existing immutable helper envelopes. Validate and durably publish or deliver the exact source-bound batch first. Confirm that the adapter can read its supported receipt path, then use the existing production wrapper when this executor already has its authorized private configuration:

  `pwsh -NoProfile -File tools/programmed-coordinator/launch.ps1 -ConfigFile <existing-private-config> -ReturnsOnly -Batch <exact-supported-receipt-path>`

  Omit `-Batch` to process all eligible supported job-detail returns. The wrapper first publishes retained accounting and updates merged main, using the same private Writer connection and production lock. Failed publication preserves the retained trusted checkout; the apply command still requires fresh, clean merged main before any new write. The wrapper does not install or change a schedule. The internal command is `node tools/programmed-coordinator/run.cjs apply --returns-only [--batch <exact-supported-receipt-path>]`; do not bypass configuration/lock checks or copy secrets to another executor. Exact paths are repository-relative supported helper receipt paths, not arbitrary input files.

- The three intake-drain tasks retain their distinct `forge.intake-drain-review.v1` adapter. Validate and durably publish each SOURCE_READY review using the existing append-only route, inspect current `source-intake-auto.yml` runs on main, and dispatch that existing workflow once if none is queued/in progress. Do not send a drain review to the helper-batch adapter. Existing active processing or the next normal pass consumes pending reviews without a duplicate dispatch.

The helper returns-only path excludes private outcome batches and skips unrelated mail capture, generic intake preparation, source pagination and assignment replenishment. It does not bypass source verification, canonical deduplication, current policy, ownership, protected decisions or original-request reconciliation. The normal coordinator remains responsible for its independent duties.

## When the provider cannot execute Writer

Use the existing authorized automatic delivery route for the complete validated artifact, such as immutable `forge-helper-<runId>.json` text/plain in the private AI_Coordination folder, or the existing supported append-only repository receipt route. The existing collector feeds supported job-detail returns into the locked adapter; the provider must not invent a remote endpoint, assume access to another chat or claim that upload itself wrote a job. No manual relay, approval, evidence PR or merge is a routine prerequisite for processing. For shared helpers, the existing collector also reads dedicated `claude-shared-helper-batch-<unique>` and `grok-shared-helper-batch-<unique>` branches without a PR, merge or manual relay. Only added receipt files for that exact provider/task plus optional change records are accepted. Mixed code changes, wrong paths/providers, incomplete comparisons, stale heads and invalid artifacts remain blocked. Branch publication is delivery preparation; confirm collector capture and Writer results separately. An already-existing supported evidence PR transport can still be captured without merging it, but must not become the only required next step when an authorized direct route is available.

Confirm delivery from collector evidence, not a claimed transport field. Existing Drive collection requires its authorized connector host; these instructions do not create a new cloud Writer endpoint or universal provider access. If neither authorized execution nor automatic delivery works, preserve full evidence and the resume cursor as TRANSPORT_PENDING and report the exact blocker once. Continue independent work. Do not request credentials, repeat completed research, manufacture acknowledgment, or ask Tim to copy routine batches.

## Transaction and completion rules

Existing `next`/`validate` output may still label the evidence shape `EVIDENCE_ONLY` or `productionAuthorized=false`; that is a preparation/validation result, not a prohibition on invoking the supported locked Writer adapter.

Evidence envelopes retain `writerSubmitted=false`: they describe source collection before the adapter transaction, not permanent zero-write ownership. Record actual request IDs, submitted/accepted counts, pending states and independently verified effects in the adapter's existing durable receipts. Historical accepted evidence stays reusable with current source/assignment/policy rechecks.

Writer alone changes canonical data. Acquire/recheck the existing production lock, preserve freezes and leases, durably checkpoint before POST, and keep unresolved original request IDs fenced. A lock conflict defers that exact write; it does not discard its prepared evidence or justify an overlapping Writer. Never replay an unknown outcome, change a protected decision, force an identity match or infer a req/location/source. Exact original source and role/site distinctions survive.

VERIFIED requires the original RESULT SUCCESS, an independently later COMPLETE receipt, and exact matching row effects read after COMPLETE. Publication, upload, accepted requests, green workflow status and canonical presence do not supply that three-proof chain. Supported zero-write outcomes retain their separate source-bound accounting rules. Report prepared, submitted, verified and blocked separately. A new application-outcome job still needs Tim's approval; applications, outreach, private-data exposure and new access remain outside this change.

## Dormant and retired routes

The dormant Claude intake A/B, enrichment and relevance procedures share this contract for any later authorized use, but remain disabled/unavailable as recorded. The retired Grok intake, enrichment and outcome routes stay retired and reject new work. Do not change work assignments, provider availability, schedule intent, native enabled state or current owner merely because this document or registry changed. Implementation tests are not live adoption or production verification.

## Providers without hashing or execution tools

Return real evidence, not placeholder metadata. For shared helpers a ready item may include `sourceEvidence.capture={kind:"TEXT_EXTRACT",text:"<verbatim source text>"}` instead of a source hash. The validator computes a SHA-256 over those exact UTF-8 bytes and records it separately as `SUBMITTED_TEXT_ONLY`, never as independently verified. The original provider artifact stays unchanged. A supplied hash must match that capture; placeholder or contradictory supplied hashes are rejected. The exact quote must occur in the captured text. Each capture is bounded to 200,000 UTF-8 bytes, and the whole batch to 2 MB. Split artifacts rather than truncate source evidence.

Independent live source, identity and quotation verification still precedes Writer. Text captures cannot establish a live posting, pay, degree equivalency or fit on their own. For fit, exact requirement quotes may omit resume hashes/competency IDs; code derives those omitted values from the authoritative current resume profile. Present values must be genuine and valid; an explicit empty mapping means no observed resume overlap. Source-blocked or incomplete items require a concrete reason, research owner and retry condition, not fabricated hashes or inferred NOT_STATED facts.

Resolve the live main SHA at the start of each invocation and read files at that SHA. An old commit's unavailable slot is not current status. A first real run is the setup verification; separate or repeated readiness probes are not prerequisites.
