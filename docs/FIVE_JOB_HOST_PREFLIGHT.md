# Five-job host preflight — live gate retained

This small follow-up to merged #484 adds no operational schedule, allocation
ledger, role, return contract, production configuration or model permission.
It does not make the worker live-capable. `coordinator-preflight.launch()` and
the existing worker entry points still fail `LIVE_RELEASE_DISABLED` before any
credential or network use.

## What is now connected

`host-readers.create({writerSourceRoot,...})` now loads the existing
`classifyNeverConsider` through `verified-classifier.load` after its fresh Writer
status read. It requires the exact 40-character deployed Writer build commit,
the expected foreman-cockpit origin, clean local source at that same commit and
the supported exported function. A changed build requires process restart rather
than reuse of Node's cached classifier. It reads no connection file or credential.
The existing source-bound admission screen and Writer authority remain unchanged.

The existing coordinator can call `coordinator-preflight.inspect` with its
already-authorized `readView` capability and exactly five assigned IDs. The
preflight validates published identity and exact membership before invoking
funding or native-context capabilities. Each job then undergoes the existing
current-row, missing-field, protection, research-proof and original-request
checks. A blocked job is SKIP, never replaced with another worker's job or replayed.
No assignment is made, released or published. A global allocation conflict still
blocks the batch; per-job eligibility failures can be recorded independently.

The report gives exact eligible/skipped IDs and blockers, maximum five attempts,
8,192 input / 1,024 output token caps, and 10,240 microdollars ($0.01024) maximum
reservation for five attempts. Existing $1 lifetime reservation, $10 credit
cushion, job/batch timeout and November 29 cutoff constants are unchanged.
The normal durable worker checkpoint still owns per-attempt reservation and
uncertain-outcome accounting; this preflight is not a replacement budget ledger.

## Required non-secret host observations

- `readFundingObservation()` is supplied by an **already-authorized account
  verifier**, never the model or an arbitrary JSON filename. Its contract is
  `forge.grant-funding-observation.v1`, source `AUTHORIZED_ACCOUNT_VERIFIER`,
  observation time, evidence SHA-256, exact Default project ID/Responses-only
  scope/credential target, promotional-only funds, verified disabled paid
  fallback and auto-recharge, balance/expiry, and a bounded reservation for
  other consumers of the same credit pool. Observation age is at most five
  minutes. Unknown external consumption, stale credit, or a budget-only claim
  blocks. This code validates the contract; it does not conjure the verifier or
  independently establish account billing restrictions from Boolean fields.
- `readNativeContext()` can use only the fixed existing native addon's `context`
  function, returning TIMMAY host, intended SID and no impersonation. It must not
  call `read`/CredRead or `startup`; preflight never needs the secret.
- `credentialObservation` is the owner's recent, non-secret installation check
  for exactly `Forge/OpenAI/Default/Responses` under that SID. It is not the key,
  proof of API authentication, or permission to read the key. This session did
  not perform any Windows action; all native-context tests are synthetic.

No production observation reader or billing change is installed by this patch.
OpenAI's current project documentation distinguishes alerts from enforced spend
limits and warns that enforcement is not instantaneous. Neither a budget value
nor an enforced-limit checkbox alone proves grant-only/no-paid operation:
https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform

## Known real blockers, independently reported by the parent

On November 22, the 07:06Z shared-pool snapshot prefix `97905628165` contains
2,901 items, zero Hermes task/provider records and zero trusted
`businessScopeReviewed` attestations. The current registry also lacks Hermes.
The TIMMAY owner checked the exact restricted Credential Manager target and
reported it absent. Only one prior lookup hint has a currently verifiable exact
employer posting. These facts are source notes, not fabricated admission proofs
or claims; this patch does not make any of the five hints eligible.

The minimal next operator step is to establish the missing **trusted host input
bundle** through the existing coordinator: a supported, genuinely separate
worker authority/ACK, five exact non-overlapping current IDs, and independently
reviewed public business/source captures. Do not relabel Hermes or another
provider, invent review attestations, borrow assigned work, or manufacture a
five-job count when only one source is verified. If those foundations cannot be
provided under existing authority, stop; this patch deliberately does not change
the role or return-contract model to force a start.

Credential installation is separate: only Tim installs the approved restricted
Default-project key in the exact target under his intended TIMMAY account. No
key was accessed, issued or installed here. It cannot fix missing worker identity
or source-review authority. Fresh account-level grant-only verification and
bounded other-consumer exposure are still needed. Do not use a broader key or
request billing/project changes to work around a failed check.

Once real inputs exist, run the read-only preflight inside the authorized host
and inspect its sanitized report. Passing every observation still leaves
`LIVE_RELEASE_DISABLED`; replacing that code gate requires separately reviewed
live transport/checkpoint wiring. No claim of a real five-job batch is made.

## Offline checks

From the staged repository root:

```powershell
node --test tools/grant-backlog/coordinator-preflight.test.cjs
node --test tools/grant-backlog/*.test.cjs tools/helper-routing/*.test.cjs tools/programmed-coordinator/*.test.cjs
```

Synthetic cases cover exact-five authority, independent skips, no replacement,
no key/model/Writer/claim side effects, failed grant-only evidence, stale balance,
unknown other consumers, host mismatch, missing credential observation, and
clean deployed classifier pinning. They do not validate real account authority,
Windows installation or public posting availability.
