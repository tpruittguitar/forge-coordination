# Lane run lock

Lanes have no owner (Tim, 2026-11-22). Any authorized provider whose scheduler fires a lane runs it. The run lock stops two providers from running the same lane at the same time.

- **Where:** branch `run-locks` of `tpruittguitar/forge-coordination`, one file per lane: `<record key>.json`. The record key is `laneKeys[TASK_KEY]` when present, otherwise `TASK_KEY`. So `FORGE_INTAKE_A` and `FORGE_CLAUDE_INTAKE_A` share one lock.
- **Stale:** a lock older than `runLock.staleAfterMinutes` in `control/AI_AUTOMATION_TASKS.json` may be taken over. Record the stale holder in your receipt.
- **Contents:** `{"lane","taskKey","runId","provider","acquiredAt","staleAfterMinutes"}`.

## With a shell (git and node)

```
node tools/lane-run-lock.cjs acquire <TASK_KEY> <RUN_ID> <PROVIDER>
node tools/lane-run-lock.cjs release <TASK_KEY> <RUN_ID> <PROVIDER>
```

Exit 0 means ACQUIRED or RELEASED. Exit 2 means BUSY: write a one-line SKIP receipt naming the holder and stop.

## Without a shell (GitHub contents API or connector)

1. Read `<record key>.json` on branch `run-locks` (note its blob sha).
2. Missing: create it without a sha. A "file exists" or 422 answer means another run won: SKIP.
3. Present and not stale: SKIP. Present and stale: update it with the sha you read. A 409 or sha mismatch means another run won: SKIP.
4. At the end of the run delete the file with its current sha, only when its `runId` is yours.

If the branch does not exist, create `run-locks` from `main` first; a "reference already exists" answer is fine.
