# Early research admission and exact-five release — draft, off by default

This supersedes the earlier notes that a new authoritative CLEAR endpoint was
needed. The worker now uses a narrower proof: `RESEARCH_ADMITTED` for
`MISSING_PUBLIC_FACTS_ONLY`. It explicitly retains `canonicalEligibility:false`
and `writerAuthorized:false`. The unchanged existing Writer owns all updates.

## Supported positive output and additional evidence requirements

`source-trial/preliminary-screen.screen` supplies `NO_CONFIRMED_EXCLUSION`.
That output alone does not pass. `research-eligibility.evaluate` requires:

- Current authenticated canonical rules with bytes matching verified forge-policy
  main; every active definition must match the existing business patterns or
  title-exclusion definition hashes. Missing, changed or new rules hold.
- An identity-bound, reviewed public full posting (300–6,000 bytes, at most one
  day old), exact source hash and explicit employer-primary-business quote.
  `businessScopeReviewed:true` is a trusted coordinator source-review assertion
  that the capture actually establishes primary business, not a vague statement,
  title, unnamed client or absent facts. Never derive it from model output,
  `ALLOW`, or lack of an exclusion. Missing review holds. No new review ledger.
- The existing preliminary screen must return `NO_CONFIRMED_EXCLUSION` for both
  the complete posting and that exact quote, with no unresolved employer-business
  or canonical-rule check. REVIEW/EXCLUDE remain held, including protected-supplier
  review; no decline is produced. The existing title-exclusion proposal must be
  absent. No changes were made to either screen or to Never Consider rules.
- The existing checked-in Writer `classifyNeverConsider`, supplied by the trusted
  coordinator host, must independently return ALLOW for that primary business.
  ALLOW is necessary but cannot replace any of the above evidence checks.

The proof binds exact primary ID, canonical row hash, current observation,
policy hash/commit, source hash/URL, quote and evidence hash. It authorizes early
public-fact research only. It makes no ATS/resume, relevance, canonical admission
or Writer decision. Explicit `profile:null` prevents loading private resumes.
The model never creates or reviews this proof.

`host-readers.create` accepts `readAdmissionEvidence(id)` for **already saved,
reviewed public captures** and `classifyNeverConsider` from the host's reviewed
foreman-cockpit Code.gs module. Do not implement the capture reader by browsing
new sources before the first gate. No capture or insufficient review means hold.
Production must pin that module to its verified Writer build through the existing
host configuration, not inject a replacement classifier. Tests inject synthetic
read capabilities; they do not attest production access or review.

## Five jobs, separate authorities

`five-job-preflight.preview/compare` still uses existing shared memberships,
canonical rows, receipt fences, current policy and exact Hermes ACK. It admits
exactly five distinct unclaimed IDs and refuses any additional active API-worker
ID. The existing coordinator retains the mutation lock and reservation operation.
Its final check replans to catch newly arriving legacy claims.

Use `timmay-adapter.bindFiveReaders({...hostOptions, ids:fiveReviewedIds})` for the
initial worker run. It checks the exact five-ID partition before the first job,
every job and prepared return. A sixth API ID, substitution or Hermes ID blocks
instead of expanding the run. Hermes keeps its own supported task/provider and
exact acknowledged ID/version/source list; this code neither launches Hermes
nor relabels another provider. Evidence returns keep the existing shared collector
contract and all protected-row/current-field/Writer safeguards.

All live entry points still throw `LIVE_RELEASE_DISABLED` before credential or
transport access. Simulated offline processing is the only executable mode.
No schedule, production registry, owner, assignment, model/budget limit, payment
setting or credential changes are included.

## One next approval/configuration

Approve the **scoped five-job release configuration** for the existing coordinator:
this research-only admission mapping; its trusted reviewed-capture reader and
verified Writer classifier; exactly five IDs; and separate API/Hermes authority
with Hermes's actual exact ACK. Then the coordinator can prepare and compare the
five-ID reservation under the existing authority. The real IDs, review evidence,
Hermes identity/ACK and production publication are not supplied by synthetic tests
or fabricated in this PR. No merge, reservation or activation is automatic.

Credential setup is separate: Tim installs the approved restricted Default-project
key once in Windows Credential Manager at `Forge/OpenAI/Default/Responses` under
his intended TIMMAY account. That action grants neither allocation nor launch
permission. Reviewed removal of the live-release code gate, fresh credit/project
verification and native runtime checks are still required before an API call.

Offline verification from the staged repository root:

```powershell
node --test tools/grant-backlog/*.test.cjs tools/helper-routing/*.test.cjs tools/programmed-coordinator/*.test.cjs
```

The synthetic five-job run prepares five shared evidence envelopes, leaves
Hermes membership byte-for-byte unchanged and records zero Writer submissions.
These results must never be described as a real first batch.

## Supplied lookup shortlist — not an allocation

The parent supplied these IDs from queue blob prefix `62499e7` (06:16), shared
pool prefix `4fa960c` (06:01), and ATS cache prefix `4741cab`:

- V2I-39600AE8523C
- V2I-717A830D14D1
- V2I-C76E1C79842A
- V2I-2F0BC30F539C
- V2I-93E1F0EE150A

These are lookup hints only. The cache dates November 2–15 fail the new one-day
admission-capture freshness check on November 22. The reported pool counts
(3,160 waiting; 1,662 assigned; 491 returned/pending/partially consumed; 1,007
outside those statuses) are not eligibility or reservation evidence. All five
still need fresh canonical identity/protection/receipt checks, reviewed public
source and policy proofs, and compare-before-claim. No live source or assignment
checks for these IDs were performed here.

`V2I-9299940A9C7E` remains outside this shortlist and fenced to Claude Shared
Helper v3 per the supplied Hermes context. Do not release it, substitute it,
replay its uncertain work or infer ownership transfer from an idle schedule.
