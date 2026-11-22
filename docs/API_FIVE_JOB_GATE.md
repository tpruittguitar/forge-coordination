# Exact-five API research gate — blocked draft

Fresh coordination main was fetched read-only at
`3ce3476c9da32ac5e126eb719e20672fc5312513` on 2026-11-22. The implementation
checkout was not switched and no production claim or configuration was changed.
At that revision:

- `control/AI_AUTOMATION_TASKS.json` has no `FORGE_API_GRANT_ENRICHMENT` task and
  no Hermes execution identity.
- `control/SHARED_HELPER_WORK.json` has no `apiGrantBinding`. Its supported
  providers remain Claude, retired Grok and hibernating Sniffer. These identities
  cannot be relabeled Hermes by this worker.
- The legacy research registry owner is Claude while
  `control/ENRICHMENT_RESEARCH_OWNER.json` names ChatGPT. Neither was changed.
  Disabled native schedules do not release any existing per-ID reservation.

## What is actually holding up five jobs

This is not primarily a key-installation problem. No current authority binds
this API worker to five exclusive canonical IDs. Actual Hermes identity and its
exact ID/version/source ACK are unverified. Current canonical rows, original
request fences and active policy cannot be authenticated from this executor
without already-authorized read capabilities; none have been supplied.

The second gap is an **implementation contract**, not proof that a new Writer
endpoint is required. The draft worker demands a positive `CLEAR` receipt.
Current shared policy says to apply current forge-policy Never Consider first
through the existing screens, with REVIEW remaining review. It does not define
that new CLEAR receipt. `preliminary-screen.screen` explicitly returns
`canonicalEligibility:false`; its `NO_CONFIRMED_EXCLUSION` is not that receipt.
The existing Writer `classifyNeverConsider` can return `ALLOW` when employer
facts are absent. Neither alone is a positive, source-bound clearance.

No existing positive-clearance producer or accepted receipt contract was found
in the checked-in control/reference/helper paths. `intake-drain/exclusions`
provides independently verified exclusion proposals, not affirmative clearance.
Do not turn absence of an exclusion into approval, invent a reviewer identity,
or require a new service merely because the draft chose the word CLEAR.

The smallest remaining policy decision is approval of a **research-only mapping
from the existing supported screen's reviewed, current-policy result to the
worker's admission proof**, including which existing authority records that
review. It must bind exact row/source/policy versions, preserve REVIEW/EXCLUDE,
respect protected suppliers and protected titles, and grant no canonical-write
permission. Alternatively an existing accepted per-ID ruling may be used only
if its actual receipt is found and current. No such five real receipts were
available in this session. A made-up CLEAR file is not a solution.

## Local fixes now implemented

1. `policy-source.cjs.read({root})` reads an existing forge-policy checkout,
   verifies exact origin, clean HEAD equals current remote main, and validates
   exact raw bytes against the Git blob SHA. It rereads main to reject drift.
   This is source proof only, not an eligibility decision. No credential is read.
2. The host reader now requires `readPolicy`, normally a closure calling that
   module against the host's existing policy checkout. Authenticated Writer
   `rules` must name the expected GitHub policy file and return exactly the same
   bytes. Both ends of the read must retain the same policy revision. The Writer
   `rules` endpoint drops the Git blob SHA, so a current policy source proof is
   necessary; a cached/raw-CDN response alone cannot establish this chain.
3. `five-job-preflight.preview` takes exactly five distinct IDs and the existing
   `api-grant.plan` inputs. It reuses all current identity, Hermes ACK, allocation,
   protected-row, missing-field, source and Writer-fence checks. CLEAR policy
   hashes must match the fresh source proof. Its receipt has zero assignment
   writes, zero Writer submissions and `productionAuthorized:false`.
4. `five-job-preflight.compare(receipt,freshOptions)` rejects any changed
   reviewed input. The existing `api-grant.reserve` also replans after its final
   coordinator-lock check, catching a newly arriving legacy claim before save.
   No separate allocation ledger or worker-side claim route was added.

## Reproducible route to the gated batch

Run the no-secret fixtures first from the repository root:

```powershell
node --test tools/grant-backlog/policy-source.test.cjs tools/grant-backlog/five-job-preflight.test.cjs tools/grant-backlog/host-readers.test.cjs tools/helper-routing/api-grant.test.cjs
```

The five-job fixture is explicitly synthetic: five API IDs plus one disjoint
Hermes ID inside a temporary existing shared work file. It proves preview,
comparison, policy-version checks and rejection of late claims. It does not
choose or reserve real jobs.

After supported authority exists, the existing coordinator host supplies the
following, using its normal read access and lock (not this worker or this build):

1. Fresh published coordination SHA and current full canonical rows, worklist
   needs, live Writer health, complete receipt index and coordinator state.
2. Fresh forge-policy main proof with raw bytes identical to Writer `rules`.
3. Actual supported worker route authorization, exact acknowledged Hermes
   membership, and current competing claims. Choose exactly five unclaimed
   IDs; if fewer than five qualify, return a shortfall, never borrow Hermes IDs.
4. The approved positive research-screen proofs for those five IDs, bound to
   each row hash, current observation and identical policy hash. This is the
   unresolved policy-contract step above, not an instruction to fabricate them.
5. For the initial five-job run, the worker partition must contain only those five active API IDs; an additional active worker ID is a shortfall in scope proof, not permission to expand the batch. Keep live launch disabled until its release wiring enforces that exact reviewed partition.
6. Call `preview({...existingPlanInputs,ids:fiveIds})` and retain the review
   fingerprint. Under the existing coordinator mutation lock, reread all inputs
   and call `compare(receipt,freshInputs)` immediately before the existing
   `api-grant.reserve`. Any drift requires another preview; do not silently
   change the set. Publish membership through the existing supported accounting,
   then reverify instruction revision before any worker run. No claim was made
   during this build.

Production authority work: authorize/publish only the scoped API task/binding,
identify Hermes without commandeering another provider, obtain exact ACK and
approved policy-proof semantics, and use the existing coordinator to reserve the
five reviewed IDs. Do not flip the legacy owner or resume its schedules.

Separate user-only step: install the approved restricted Default-project key
once in Windows Credential Manager on TIMMAY, target
`Forge/OpenAI/Default/Responses`, under the intended account. This does not
resolve assignment, policy or publication authority. No secret was issued,
accessed or installed here. Live release remains disabled; even valid synthetic
preflight receipts cannot launch it. Existing grant/token/time caps are unchanged.

For five model attempts, the unchanged 2,048-microdollar per-attempt reservation totals 10,240 microdollars ($0.01024). This is a conservative reservation, not actual spend or permission to call the API. Existing per-job/per-batch timeouts, global credit/expiry checks and no-paid-fallback remain mandatory.
