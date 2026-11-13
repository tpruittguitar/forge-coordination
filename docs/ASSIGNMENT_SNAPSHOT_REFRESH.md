# Canonical snapshot freshness after mail

Assignment planning requires a canonical snapshot no older than 15 minutes. A long mail pass can exceed that window even when it verifies no master writes. Previously only verified mail writes triggered a new snapshot before assignment replenishment, allowing the next step to fail with `FRESH_CANONICAL_ASSIGNMENT_SNAPSHOT_REQUIRED`.

The coordinator now refreshes after mail if the snapshot is at least 14 minutes old, missing/malformed, future-dated, or mail verified writes. A recent unchanged snapshot is reused. The one-minute margin avoids handing planning a snapshot on the edge of its existing freshness gate. Failed or stale refreshes stop safely; no gate is disabled and no original Writer request is replayed.

Read-only reproduction used the persisted 2026-11-13 run timestamps: canonical read at 03:06:52.525 UTC, mail processing through 03:31:10.143 UTC, age 1,457.618 seconds. These reproduce the guard failure. The original process stderr was not retained, so this is a verified reproducible failure path, not a recovered original error log.

Tests cover the aged read-only pass, fresh reuse, write-triggered refresh, missing/invalid/future clocks, boundary timing, refresh failures and the original assignment guard.
