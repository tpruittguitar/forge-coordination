# Disabled API-only reservation and evidence-return extension

This is a draft engineering extension for `FORGE_API_GRANT_ENRICHMENT` /
`forge-grant-luna` on TIMMAY. No live registry entry, binding, acknowledgment,
assignment, schedule or helper return is created. Existing provider task maps,
owners and production work files are unchanged. The old enrichment schedules
remain disabled; their Claude/ChatGPT ownership conflict is not repaired by
substituting the new task or changing an old owner.

## Implemented

- `tools/helper-routing/api-grant.cjs` consumes a reviewed API binding attached
  to the existing `control/SHARED_HELPER_WORK.json`. Missing/disabled/unregistered
  bindings fail closed. The new task is deliberately absent from the generic
  `shared.TASKS` auto-allocation and page loops. Generic helper priority excludes
  API jobs. Existing reservation exclusions still see API IDs through the same
  shared work file.
- `plan()` requires explicit API IDs and the exact, smaller set of already
  assigned Hermes IDs. It returns proposed shared-work additions without writes.
  It rejects aliases/overlaps, existing legacy/helper/intake claims (including
  legacy enrichment memberships whose native schedule is disabled), stale or
  incomplete canonical rows, missing current Never Consider proof, protected
  decisions, unhealthy/frozen Writer state and unresolved original requests.
  A live receipt index must be supplied; pending entries without exact job
  identities block. The screen result is trusted host input bound to the exact
  canonical row hash, read time and policy hash, not a model-generated decision.
- `reserve()` is a programmatic hook for the existing coordinator, with its
  existing mutation-lock callback. It replans under the lock, checks the work
  hash has not changed, saves only the existing work file and regenerates the
  existing shared pages. It preserves other providers and claims, never transfers
  an ID and never publishes. No CLI or automatic invocation is added. Membership
  still requires the normal existing publication and pinned-revision proof.
  If page generation fails after the work save, retain that work and repair
  publication; do not resubmit or remove membership. Replanning the same IDs
  intentionally fails on their existing claims.
- `envelope()` builds the existing `forge.shared-helper-batch.v1`, at most
  15 enrichment items, with `writerSubmitted=false`, exact assignment/source
  versions, worker identity and only assigned missing field groups. The normal
  shared and helper-fields validators still validate evidence, source quotation
  binding and protected fields. The constructor does not write or deliver it.
- Existing collection accepts only the exact
  `receipts/CHATGPT_HELPERS/FORGE_API_GRANT_ENRICHMENT/<runId>.json` path for this
  route. It rechecks the current API/Hermes binding and external claims, plus
  historical routing, membership and exact authorization/acknowledgment hashes
  at the instruction revision. Evidence bytes and transaction deferral remain
  the collector's existing immutable paths; there is no parallel receipt ledger.
- The existing coordinator's pre-POST ownership check recognizes this new route
  and invokes the same shared current-assignment check. Existing providers take
  the same branch as before. No Writer endpoint, payload, submission, replay,
  result verification or protected-row logic is changed. The new route cannot
  bypass revocation by relying on a previously collected envelope.

## Binding contract (not instantiated in production)

The new registry entry would need owner `ChatGPT`, enabled `true`,
executionIdentity `forge-grant-luna`, utility route, the new procedure
`lanes/FORGE_API_GRANT_ENRICHMENT.txt`, existing shared work path and
`WRITE_THROUGH_SUPPORTED_WRITER`. No such entry is added by this draft.

The existing shared work would need an `apiGrantBinding` with schema
`forge.api-grant-binding.v1`, enabled `true`, exact worker, host `TIMMAY`, project
`Default`, and an authorization receipt path/hash. The authorization receipt
uses schema `forge.api-grant-authorization.v1` and binds task, worker, host,
project, assignment ID, Hermes task key and grantOnly=true.

The `hermes` binding must name an **already supported shared task/provider**,
whose reviewed registry explicitly binds executionIdentity `Hermes`, is enabled,
is not retired, uses the shared work path and is available in that same work.
It also needs a source-hashed receipt with schema
`forge.shared-execution-identity-ack.v1`, status ACKNOWLEDGED, a run ID and exact
Hermes identity/task/provider/assignment ID. Both identity receipt paths are
confined to `receipts/SHARED_HELPER_IDENTITY/<name>.json` and must exist at the
instruction revision. These contracts specify required evidence; arbitrary
worker-written assertions are not authorization to add them to main.

The synthetic fixture deliberately uses a supported slot with an explicit
synthetic Hermes execution binding. It does **not** establish that actual
Hermes is Claude, Grok or Sniffer, and does not authorize repurposing those bots.
An actual standalone Hermes provider/task is currently unsupported and will be
rejected. If the real identity cannot be truthfully represented by an existing
supported slot, a separately reviewed shared-provider extension is required;
do not fabricate the acknowledgment or alias an existing provider to bypass it.

## Validation and remaining blockers

Run offline, without credentials or native Windows actions:

```sh
node --test tools/helper-routing/api-grant.test.cjs
node --test tools/helper-routing/*.test.cjs tools/programmed-coordinator/*.test.cjs tools/grant-backlog/*.test.cjs
python scripts/build_runtime.py --check
```

Tests use temporary synthetic work files and mocked transports. They cover
read-only planning, coordinator-lock persistence, concurrent work changes,
explicit disjoint allocations, unsupported/unacknowledged identity, disabled
legacy claims, current protection/screening, live receipt fences, historical
proof drift, real collector admission/quarantine, unchanged evidence, unknown
transaction deferral, field scope and zero-POST revocation. Test writes are only
to synthetic temporary workspaces. A synthetic successful return is not a real
first batch.

The smaller remaining allocation blocker is **the actual supported Hermes
execution identity plus its acknowledged exact reservations**. No authority to
change existing slots, legacy claims or registry bindings is assumed here. Once
that identity is established, the existing coordinator still needs an explicitly
authorized allocation input and publication step. Existing legacy claims need
their own terminal/release proof before any ID can be selected.

The production host adapter remains separate unfinished integration: it must
read fresh canonical/policy/receipt state, derive the screening proof through
the existing screen, consume these shared API reservations (the original worker
still expects its legacy synthetic allocation shape), obtain the approved
credential only on TIMMAY, pass grant-only caps, deliver through the supported
collector and reconcile independent Writer effects. `LIVE_RELEASE_DISABLED`
and the existing $1/expiry limits remain. This draft does not wire or start it.

Notify Tim only after a real separately authorized first batch, with exact
prepared/submitted/verified counts and original request IDs. No such run or
notification is claimed, scheduled or sent by this engineering work.
