# Bounded research workspaces

Hourly evidence-only research must not create a fresh permanent clone on every wake.
The intake and enrichment utilities use `scripts/research_workspace.py` to keep a
bounded, explicitly owned checkout pool. This changes workspace preparation only:
it does not change schedules, research ownership, Writer permissions or publication
rules.

## Before cloning

1. Resolve current `main` and read the registered procedure at that exact SHA.
2. Materialize `scripts/research_workspace.py` from that same SHA through the
   existing authorized GitHub transport. Keep the bootstrap helper outside both
   the checkout and pool. Verify its source SHA/blob before executing it.
3. Use one stable absolute pool path per scheduled task in that task's authorized
   workspace. Do not choose a new timestamped path on every wake. Never adopt an
   arbitrary old directory as a managed pool.
4. Run `inspect` before acquiring a checkout. Low space or an outstanding lease is
   a storage blocker, not a reason to start a second clone elsewhere. If the
   runtime exposes a stricter workspace quota than filesystem free space, respect
   that quota too. Filesystem free space alone cannot prove quota headroom.

Example setup, once per task (replace absolute paths for the current executor):

```sh
python /workspace/bootstrap/research_workspace.py init \
  --root /workspace/forge-intake-source-pool \
  --origin https://github.com/tpruittguitar/forge-coordination.git \
  --slots 1 --min-free-bytes 536870912 --max-pool-bytes 3221225472
python /workspace/bootstrap/research_workspace.py inspect \
  --root /workspace/forge-intake-source-pool
```

The measured coordination tree at the time of this change was about 896 MB in
14,695 tracked files, before Git metadata and filesystem overhead. Reserve a
conservative amount for acquisition rather than assuming a tiny code-only clone:

```sh
python /workspace/bootstrap/research_workspace.py acquire \
  --root /workspace/forge-intake-source-pool \
  --task FORGE_INTAKE_SOURCE_RECOVERY \
  --expected-main-sha <resolved-full-main-SHA> \
  --projected-bytes 1610612736
```

Use the returned checkout and lease token. Do not run research in the bootstrap
location or another worker's checkout. Fetch is shallow and pins the exact resolved
SHA. A newer main during bootstrap does not change that snapshot or mix revisions;
the next run resolves main again. The byte reserve is storage headroom, not a
candidate, research or time quota.

Git for Windows needs `core.longpaths=true` when a deep pool path plus a tracked
filename exceeds 260 characters. The helper enables this per Git invocation and
in the managed repository so normal lane publication uses the same behavior.
It does not change global Git configuration, Windows settings or path protections.
The Windows regression fixture covers long-path acquisition, parking and reuse.
A previously failed slot remains failed: this fix does not retry it, remove its
lease or declare the existing checkout recovered.

## End every completed run

Keep private sources, draft inputs, command logs and other retained evidence in an
authorized evidence directory outside the managed checkout. Continue per-item
durable checkpoints. Stage only the lane's exact permitted outputs and verify
remote publication using the normal lane procedure.

After all work has stopped and any output is durably accounted for, release the
exact lease:

```sh
python /workspace/bootstrap/research_workspace.py release \
  --root /workspace/forge-intake-source-pool \
  --slot <returned-slot> --token <returned-token> --complete
```

Release is explicit, not an unconditional exit trap. A failed or interrupted run
may still have evidence that needs publication. A no-work run can release after
its read-only work has ended. The helper refuses changed tracked files, untracked
or ignored files, stashes, unpublished work or ambiguous Git layouts. It never
uses `git clean`, `reset --hard`, age-based deletion or automatic lease stealing.

On successful release, sparse checkout removes the clean tracked materialization
while preserving the Git object database and history. The next run reuses that
slot. An unchanged acquired snapshot needs no fetch to park, including when free
space has fallen below the acquisition floor. A changed HEAD must be proven
published: either it is the current remote main tip or it is an ancestor within a
bounded 128-commit fetch. Unproven history remains leased and intact. Git objects
are not pruned. The finite pool byte budget stops further growth
before another acquisition; it does not silently erase history to meet a target.
If retained Git objects fill the budget, report the measured size for reviewed
maintenance rather than creating a new pool. The helper is deliberately not a
general disk cleaner.

## Failures and existing accumulated checkouts

- Preserve the returned lease/token and exact failure. A failed fetch or checkout
  is not permission to discard its directory or reclaim an active slot. This
  version has no automatic failed-lease recovery or garbage collector. An
  interrupted operation needs explicit inspection before further maintenance;
  do not edit the manifest or increase slot limits just to evade that hold.
- Never infer completion from a directory name, age, absent process or a clean
  worktree alone. Confirm the owning run is terminal and there are no consumers.
- Existing unmanaged checkouts are not automatically adopted or deleted. Inventory
  their actual size, Git state, ignored/untracked evidence, local branches/stashes,
  publication proof and linked worktrees on the affected executor first.
- Preserve unknown files and unpublished work. Any approved cleanup must remain
  reconstructible or use a verified recoverable backup. Do not reset a workspace,
  delete a Git database, or remove evidence just to recover disk space.
- Report actual free bytes and successful next-checkout execution before declaring
  an exhausted workspace recovered. A passing fixture test or merged instruction
  change alone does not prove adoption by an existing scheduled executor.

## Operator recovery of a failed materialization

`recover-failed` is a narrow, explicit maintenance operation, never a scheduled
fallback. It supports only the recorded sparse-checkout exit-128 acquisition
failure when the checkout, index and origin/main still equal the original
acquisition commit. It parks reconstructible tracked files without fetching,
retrying research, changing HEAD, deleting objects, or creating another slot.
Other failures remain held for review. Do not manually change the manifest.

Before using a merged helper bootstrapped from fresh main:

1. Verify the owning run is terminal from its terminal evidence, and independently
   confirm no run or other process is using this checkout. A clean worktree or an
   old timestamp is not enough. The two CLI attestations record this operator
   verification; the helper cannot prove external process ownership itself.
2. Inspect the failed lease privately. Record the exact acquisition SHA, task,
   slot, current token and SHA-256 of the raw manifest bytes. The acquisition SHA
   is deliberately the failed run's snapshot, not today's main revision.
3. Choose a new audit directory under an existing authorized private evidence
   directory outside the pool. Its parent must have appropriate Windows ACLs.
   Audit files preserve the original manifest byte-for-byte, including its lease
   capability and possibly a credential-bearing origin URL. Never publish them.
4. Invoke the operator command from outside the pool:

```sh
python /workspace/bootstrap/research_workspace.py recover-failed \
  --root <existing-pool> --slot <failed-slot> --token <current-private-token> \
  --task <owning-task> --expected-main-sha <original-acquisition-SHA> \
  --expected-manifest-sha256 <inspected-manifest-SHA256> \
  --audit-dir <new-private-directory-outside-pool> \
  --owner-terminal --no-consumers
```

The helper holds the normal pool lock; verifies exact lease identity, detached
HEAD, origin ref, complete index, intact reconstructible Git objects and all
existing clean-worktree protections; rejects partial/promisor object stores;
and saves private inspection evidence before parking. Only after this proof does
it refresh index stat data and park the partially materialized tracked files.
It rechecks the snapshot, absent tracked files and unchanged manifest before
transitioning the lease to idle. The failed manifest remains in the private audit
directory; the idle lease retains redacted provenance. Audit file contents are
flushed before parking/release, and directory metadata is synced where the
platform exposes it. No global Git or OS settings change.

On any error or interruption, inspect the actual manifest, lock and audit files
before deciding what happened. Do not assume an uncertain final save or lock
cleanup left the old state, remove a lock, or automatically retry. A fresh attempt
requires renewed inspection and a new audit directory. Unsupported data or work
always stays held. Recovery does not itself establish that research is healthy.

After an idle result, independently inspect state and free bytes, then validate
one normal exact-main acquisition and release on the same slot using the merged
helper. Preserve the private audit files and original Git objects. Finally check
the next ordinary scheduled run before claiming scheduled adoption. No schedule
change or additional pool is needed.

## Validation

Run `python -m unittest discover -s tests -p 'test_research_workspace.py' -v`.
The fixtures use local repositories and no production credentials or writes.
Run the repository's full Python test suite and instruction build check before
publication. CI exercises the workspace helper on Linux and Windows.
