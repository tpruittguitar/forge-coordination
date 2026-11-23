# Native five-job local evidence entry point (unreleased)

`native-five.cjs` adds a callable entry point alongside the existing dry worker. It does not modify that worker's release fence or call its simulation adapter. It uses `responses.cjs`, `windows-credential.cjs`, `checkpoint.cjs`, the existing public-evidence/proposal validators and research-admission validator. It creates no assignments, helper returns, Writer requests or schedules.

The trusted TIMMAY coordinator host calls:

```js
const pilot = require('./tools/grant-backlog/native-five.cjs');
const result = await pilot.main(
  ['--grant', approvedGrantReference, '--output', approvedAbsoluteCheckpointDirectory],
  {authority: verifiedCoordinatorPilotCapability}
);
```

This is an embedding interface, not an installed host command. The coordinator binding is implemented in `../programmed-coordinator/direct-pilot.cjs`; its published release remains absent and disabled. Running the file directly fails with `COORDINATOR_PILOT_CAPABILITY_REQUIRED` before credential/native/API access. No JSON file, CLI switch, environment variable or user-supplied module path enables release. Do not replace the capability with an object that simply returns asserted approval.

## Required existing-authority binding

The existing coordinator's authorized in-process reader must implement two methods. The coordinator adapter now implements these methods against the existing shared-work claims and grant accounting; see DIRECT_PILOT.md. The reader must verify the published release and persisted grant rather than manufacture approval from these shapes. No new shared ledger is introduced.

`verifyGrant(reference, signal)` verifies the real release and exclusive exact-five scope and returns:

- `receiptId`, `revision`, `readAt`, `expiresAt`, the five distinct canonical `ids`, and the coordinator-approved absolute `checkpointDir` (stable across resumes; never use another directory to reset accounting).
- `provider: 'OpenAI'`, `purpose: 'FIVE_JOB_LOCAL_EVIDENCE_ONLY'`, `release: 'AUTHORIZED'`, and the actual scoped `workIdentity`. Legacy ChatGPT/Claude/Grok task impersonation is rejected.
- `expectedSid` for the approved TIMMAY Windows account; `project: {name:'Default', id:<actual project ID>, responsesOnly:true, grantOnly:true, noPaidFallback:true}` verified by the authorized host, not an assumption from key format.
- `credit: {verifiedAt, balanceMicrousd, expiresAt}` from genuine current grant-only verification. No billing changes are made here. The host must verify the existing fixed model pricing still applies.

`readCurrent(reference, primaryId, signal)` revalidates the same authoritative grant, current reservations, returned/prepared evidence and unresolved original requests. It returns `receiptId`, `revision`, `exclusive:true`, `returned:false`, `originalRequestsReconciled:true`, `priorEvidenceReviewed:true`, plus the full current `snapshot`, its exact `row`, approved `missingGroups`, the existing `admission` proof, and reviewed public `evidence`. Admission source URL/hash must match the model excerpt. Use the supported existing classifier/screen and canonical reader, not manually constructed proof. Optional `reusableResult` supplies sufficient already-verified evidence and avoids both credential and model calls. The host must fence IDs across competing invocations; this entry point never claims jobs.

Full canonical source, protection and Never Consider checks remain mandatory. Snapshot/authority/credit observations expire after 15 minutes. The batch rechecks the authority before every ID. Blocked rows are held, never replaced with extra rows. All values needed to authenticate stay inside the existing native secure runtime; no key is an input to these methods.

## Bounds and accounting

One five-ID grant, at most five model attempts, no automatic retry. Existing 8192-token input bound, 1024 output cap, GPT-6 Luna standard tier, no tools and fixed Responses URL apply. Reserve 2048 microdollars per attempt durably before native credential startup/HTTP, capped at 10240 microdollars ($0.01024), with the existing $10 credit floor and Nov 29 cutoff. Job timeout is 45 seconds; batch timeout is ten minutes. Auth/credit failure or unknown model outcome stops the batch. In-flight requests recovered from disk are never replayed.

Local `native-five-checkpoint.json` contains only source-bound evidence, degree dimensions, IDs, usage, reservations and status. Confirmed usage is reported separately from reserved worst-case spend; unknown outcomes never become zero-cost claims. Preserve the same durable directory and its lock/checkpoint. Never delete an abandoned lock or checkpoint to rerun. Windows checkpoint writes use the existing native durable replace; secure runtime closes after the batch. This patch was tested with mocks on Linux, not against TIMMAY or live services.

Offline verification (no key/API/Writer):

```sh
node --test tools/grant-backlog/native-five.test.cjs
```

Pending operational input: the authorized coordinator host's verified direct-pilot grant and read capability for the selected five real rows. A fresh master alone does not supply that authority. No production grant, identity, release or host installation is created here.

QA release barrier: the coordinator adapter now hard-blocks production because TIMMAY does not share a proven last-POST serialization protocol with Ubuntu ATS. Local fences are not proof of cross-host exclusivity. Private billing/host facts are stored only in the private grant file, never the public shared pool. Continuation requires five validated PREPARED checkpoint records, not five visited IDs. The native call refreshes grant/credit at dispatch and uses the earlier validity deadline.
