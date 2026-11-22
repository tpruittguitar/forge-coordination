# TIMMAY API adapter — offline draft

`timmay-adapter.cjs` connects the existing dry worker loop to the proposed
`FORGE_API_GRANT_ENRICHMENT` membership and shared evidence-return contracts.
It does not create another allocation ledger. It reads shared work, verifies
route/identity receipts and all overlapping claims, and checks each current
canonical row, source version, Never Consider proof and unresolved Writer
requests. It constructs only the existing shared helper evidence envelope.

Hermes ACK now contains `assignments`, sorted by primaryId, with exact
`primaryId`, `assignmentVersion` and `sourceVersion` for every active partner
membership. Matching an assignment name alone is insufficient. This is a draft
contract change; no real ACK, owner, provider or assignment was modified.

The host dependency boundary accepts trusted `readView` and
`readPublicEvidence` readers and explicit offline `simulate`/`reuse` functions.
No reader is configured against production. `publishedWorkSha256` and
`publishedInstructionCommit` are assertions from that trusted boundary, not
cryptographic proof supplied by a model or accepted from arbitrary input files.
The host must establish them from the published supported route before release.
The adapter rechecks local membership and source data per job. Public excerpts
must meet both worker privacy bounds and the existing shared collector's minimum
capture length. It neither publishes those envelopes nor submits to Writer.

`create(...).launch()` always throws `LIVE_RELEASE_DISABLED`, before loading a
native credential addon or reading any secret. Existing credential decoding,
TIMMAY/SID checks, Responses transport and cap constants remain unchanged.
The current implementation is **not ready to start live processing**. There is
no production CLI or service registration. Offline tests are not credential,
API availability, current-credit or Writer transport verification.

## No-secret native validation

From the staged repository root in PowerShell, with the previously verified
native addon built for the current Node ABI:

```powershell
node --test tools/grant-backlog/timmay-adapter.test.cjs
node --test tools/grant-backlog/worker.test.cjs tools/grant-backlog/windows-credential.test.cjs tools/grant-backlog/allocation-preflight.test.cjs
```

Use `node --test tools/grant-backlog/*.test.cjs` if the installed Node version
supports the glob expansion (Node 24 does). No credential is required. The new
adapter tests create and remove synthetic routes in temporary directories.
The existing synthetic runner and resume commands in GRANT_BACKLOG_WINDOWS.md
remain valid; they exercise the original worker fixture, not a real API route.

## Remaining implementation and authorization gates

1. Wire trusted read-only host readers to the supported published revision,
   full canonical snapshot, policy screen, live receipt index and coordinator
   state. An arbitrary JSON bundle is not sufficient authority. No second master.
2. Establish an actually supported Hermes execution identity and its exact ACK;
   resolve every overlapping existing claim through the supported coordinator.
   Do not rename another helper or flip the legacy owner to bypass this gate.
3. Review the production release integration: use Windows Credential Manager
   startup once on TIMMAY under the approved SID; fixed Responses transport;
   fresh Default-project grant-only/Responses-only proof and credit verification;
   unchanged timeout/token/dollar caps; no paid fallback; and supported evidence
   transport with exact pending/submitted/independently verified accounting.
   Only then can the unconditional live-release gate be considered for removal.
4. Tim alone installs the approved short-lived restricted key through Windows
   Credential Manager, Generic target `Forge/OpenAI/Default/Responses`, username
   `Default`, once under the intended Windows account. Follow the existing
   Windows runbook's blob format. Do not paste it in chat, shell, environment or
   source files. This step alone cannot release the worker.

The smallest next engineering step is the trusted published-revision/snapshot
reader binding; the user-only prerequisite is that one secure credential paste
when the approved key is issued. Neither was attempted here.

Use an ACL-restricted, persistent local TIMMAY directory for eventual checkpoints,
not a cloud container or synced folder. Keep one instance, preserve both the
checkpoint and uncertain temporary replacement files, and retain reservations
for unknown outcomes. API and legacy dry routes cannot share a nonempty checkpoint.
The durable checkpoint holds prepared shared envelopes; transport remains pending
and Writer counts remain zero. A future live loop must reuse the same durable
reservation/lock semantics and stop at the existing caps/cutoff; do not increase
caps or erase checkpoints to continue. No assumption of unattended cloud lifetime.
