# Bounded pay-cache publication

The November 8 pay run [42536326445](https://github.com/tpruittguitar/forge-coordination/actions/runs/42536326445)
passed tests, enrichment and artifact upload, then failed its report commit:
`state/enrich-ats-pay-employer.json` was 119.20 MB, above GitHub's 100 MB blob limit.
The published report consequently remained at 11:37 UTC. Workflow success and
successful Writer acceptance must still be verified separately.

Full-board reads save complete postings under observation-time keys. The inspected
published cache contained 10,311 observations but only 2,583 distinct posting
bodies after excluding observation time. Repeated bodies pushed the single JSON
file over the publication limit. A seven-day age filter does not bound bytes.

## Storage and evidence

`employer-cache-store.js` reads the legacy JSON without modifying it. On the next
ordinary save, it writes a small `forge.pay-employer-cache.v1` manifest at the same
path and compressed content-addressed parts in
`state/enrich-ats-pay-employer.parts/`.

- Identical bodies share storage. Every observation key and original time remains
  separate, including conflicting pay, no-pay, identity and parser versions.
  Unknown cache and observation fields also survive.
- The packed UTF-8 payload is split into 4 MiB chunks before compression. Every
  published part and manifest has an enforced 8 MiB maximum, comfortably below
  GitHub's limit. Unrelated report files are not transformed.
- Each compressed part and the complete packed snapshot have SHA-256 checksums.
  Missing, altered, mixed or oversized parts fail closed. Decompression is bounded.
- Parts are read back and atomically published before replacing the manifest.
  Interrupted temporary writes do not poison immutable names. The prior manifest
  and parts stay usable if publication fails.
- Superseded parts are not deleted. A previous manifest from Git history restores
  its complete saved snapshot. This bounds individual Git blobs and the current
  manifest, **not total archive growth**. Any later archive cleanup needs its own
  reviewed retention/backup plan. Existing seven-day active posting freshness and
  60-day comparable/search policies are unchanged; this fix adds no eviction.

The read-only migration trial preserved all 10,311 observations in the published
100,156,499-byte legacy cache: 3,359,190 compressed bytes across seven parts, with a
1,088-byte manifest. The largest part was 764,721 bytes. A complete logical JSON
comparison passed. These are local storage results, not a production recovery claim.

The workflow uploads the manifest **and all parts** with the existing 14-day
runtime artifact. It stages the complete bundle and restores it together after
every failed push/reset. Existing refusal proofs, pending-write ledgers, report
fields, retry count, concurrency, schedules and Writer safeguards are unchanged.

## Verification and rollout

Run the existing `enrich-ats-pay-test` workflow's full Node command, including
`employer-cache-store.test.js`. Coverage includes legacy migration, exact evidence
round trips, unsupported pay, multi-part incompressible/Unicode data, corruption,
partial disk writes, identical retries, prior snapshots and artifact/retry paths.

After review and merge, verify the next ordinary pay run publishes its report and
ledger successfully, and that the committed manifest can load all referenced
parts. Confirm the report's actual run/time and Writer outcomes; do not infer them
from the most recent repository report before publication succeeds. Failed-run
artifacts remain separate evidence and must not be mistaken for published state.
This patch does not recover or replay transactions from historical failed runs.

The AI starter remains paused. The existing 35-minute code watchdog remains
unchanged; it has demonstrated dispatch, not successful report publication.
Neither reactivation nor a manual production run is part of this change.

## Rollback

Do not revert only the reader after migration: the old reader would mistake a
manifest for an empty cache. Keep this reader while rolling back other behavior,
or restore a verified previous manifest plus its retained parts. For inspection,
`require('./tools/enrich-ats-pay/employer-cache-store').read(path)` returns the full
legacy-shaped object. A raw JSON export may exceed GitHub's limit again, so it is
not a safe repository rollback format. No credentials or canonical Writer state
are stored by the new codec.
