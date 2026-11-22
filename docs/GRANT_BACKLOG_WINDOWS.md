# TIMMAY credential adapter and no-spend validation

This extension targets **TIMMAY / Windows / Tim's existing Windows account**.
Tim approved the **Default** OpenAI project only, with a restricted
Responses-only key and existing promotional credit only, no charges. The
reported verified balance remains $37.47, expiring November 30, 2026, with the
no-payment-method prompt state verified. A short-lived key is prepared but has
not been issued pending secure storage. This build does not issue or read it.

The worker remains `LIVE_RELEASE_DISABLED`. No service, scheduled task, API
request, Writer submission, Hermes action or real credential test is performed.
The Windows binary has **not been compiled or executed on TIMMAY** in this Linux
engineering session; native host validation remains an explicit next step.

## Storage and startup contract

Use Windows Credential Manager, Windows Credentials, **Add a generic credential**,
in the Windows account that will run the worker:

| UI field | Exact value |
| --- | --- |
| Internet/network address (target) | `Forge/OpenAI/Default/Responses` |
| User name | `Default` |
| Password | One paste by Tim of the issued restricted key |

This is the only credential paste. Do not send it to chat, place it in the
repository, a config file, environment variable, command argument or PowerShell
history. No `cmdkey /pass`, CLI credential creation, credential enumeration,
unrelated store access or fallback is implemented. Use the existing approved
secure account workflow to issue the key only when ready; the adapter cannot
create keys or modify the API project.

`tools/grant-backlog/windows-credential.cjs` exports `startup({expectedSid})`.
The future approved host calls it once at process startup, after non-secret
host configuration and live gates are validated, before any model attempt. The
same approved account SID must be pinned in that configuration, not inferred
afresh from whichever account happens to run it. `Default` in the credential's
username is only a storage marker, not proof of API project permissions.

The native Node-API addon uses documented
[CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw)
with the one fixed target, Generic type and zero flags, and releases its buffer
with [CredFree](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credfree).
Windows selects the current token's credential set. The addon independently
checks `GetComputerNameW == TIMMAY`, rejects thread impersonation and obtains
the process user SID. The JS adapter compares it to the pinned SID before reading
the credential and again before scoped use. No machine-name environment variable
is trusted. No raw key is returned by startup or printed.

Generic blobs are application-defined. This adapter requires the UI-pasted key
as ASCII UTF-16LE, without BOM, NUL, whitespace, lossy decoding or alternate
encoding guesses. It bounds the blob, verifies target/type/flags/username and
rejects custom attributes and session-only persistence. Machine/enterprise
persistence remains in the same user's credential set. The native allocation
is zeroed before `CredFree`; the copied JS Buffer is zeroed immediately after
decoding. The key remains only in a closure for the fixed Responses transport.
`close()` drops that reference on shutdown. JavaScript strings cannot be
guaranteed zeroed by the garbage collector; no claim of physical memory erasure
is made. Do not enable header/debug/heap-dump capture in a live credential process.

The credential callback accepts only trusted internal transport code, never
plugin/user callbacks. It returns a Response object, never credential text;
exceptions are replaced with fixed codes. Absent/denied/invalid credentials,
wrong account/host or unavailable native addon stop startup without a weaker
fallback. Mock injection exists solely for offline tests.

## Exact no-secret commands on TIMMAY

Use PowerShell under Tim's normal account, in the **existing** coordination
checkout containing this implementation branch. The path is not known to this
cloud session; the first command asks only for that non-secret local path.
These commands do not initialize the credential adapter or call CredReadW.

```powershell
$Repo = Read-Host 'Absolute path of the existing forge-coordination checkout on TIMMAY'
Set-Location -LiteralPath $Repo
if ([Environment]::MachineName -cne 'TIMMAY') { throw 'Wrong host' }
node --version
git status --short --branch
node --test tools/grant-backlog/worker.test.cjs tools/grant-backlog/windows-credential.test.cjs tools/grant-backlog/allocation-preflight.test.cjs
```

Node 22+, the existing approved node-gyp, Python and Visual Studio C++ build
tools are required to build the in-process Windows addon. No PowerShell child
process transports the key. This command compiles code only; it does not read
Credential Manager. node-gyp may obtain public Node headers if not cached.

```powershell
node-gyp rebuild --directory tools/grant-backlog/native
if ($LASTEXITCODE -ne 0) { throw 'Native build failed; no fallback' }
```

Create one private **dry-run** checkpoint directory under the current user's
persistent LocalApplicationData. The SID command below is non-secret; record
this approved SID for the future host configuration without printing a key.
These ACL commands concern only this new worker directory, not existing Forge
folders. Do not use a shared network drive, repository, OneDrive sync folder or
ephemeral container for the production checkpoint directory.

```powershell
$Sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$DryState = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Forge\grant-luna\dry'
New-Item -ItemType Directory -Force -Path $DryState | Out-Null
icacls $DryState /inheritance:r /grant:r ("*" + $Sid + ':(OI)(CI)F')
if ($LASTEXITCODE -ne 0) { throw 'Private directory ACL failed' }
$UnexpectedAcl = (Get-Acl -LiteralPath $DryState).Access | Where-Object {
    $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $Sid
}
if ($UnexpectedAcl) { throw 'Directory has other explicit access; review before continuing' }
node tools/grant-backlog/run.cjs --dry-run "$DryState"
if ($LASTEXITCODE -ne 0) { throw 'Dry-run failed' }
node tools/grant-backlog/run.cjs --dry-run "$DryState"
if ($LASTEXITCODE -ne 0) { throw 'Resume failed' }
```

Expected on each invocation: 31 synthetic jobs, three batches, 62 prepared
fields, 30 simulated attempts, $0.061440 **simulated** reservation, $0 actual
spend, zero Writer pending/submitted/verified jobs and fields. The second run
performs no additional attempts. Checkpoint replacement on Windows uses a
flushed staging file and `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` in the
addon, with no delete/copy/rename fallback. Loading this replacement function
does not read credentials. Failed replacement leaves the old checkpoint and
staging evidence; never discard either to continue. Native Windows/NTFS
restart and recovery behavior still needs validation on TIMMAY.

## Allocation preflight: read-only, not a new allocator

```powershell
git fetch --depth=1 origin main
if ($LASTEXITCODE -ne 0) { throw 'Fresh main unavailable' }
node tools/grant-backlog/allocation-preflight.cjs --ref origin/main
# Exit 2 means reported blockers; exit 1 means preflight could not read/validate.
```

The preflight pins one commit before reading registry and assignment files;
it does not mutate routes or publish memberships. It reports the required
mechanisms and exact existing-reservation overlap IDs/count. Git fetching only
updates local refs/objects. The report is a Git snapshot, not live Writer state.
The extension's report logic uses the implementation checkout's existing
validators; route changes beyond its supported utility procedure fail closed.

Observed current main `98a91711a871646fc4dc62ce102f3ae07a0c39d9`:

- Shared registry owner **Claude**; enrichment owner **ChatGPT**: conflict.
- Required task: `FORGE_CHATGPT_ENRICHMENT_RESEARCH` through shared entry,
  `control/ENRICHMENT_RESEARCH_OWNER.json` and
  `control/ENRICHMENT_HELPER_WORK.json` (`GROK-ENRICH-20261101-V1`).
- Supported validator: `tools/helper-routing/enrichment.cjs`.
- Supported planner: `tools/helper-routing/enrichment-plan.cjs`, using fresh
  canonical input and published membership before returns. It excludes
  `shared.reservedKeys(control/SHARED_HELPER_WORK.json)` and enabled Claude
  enrichment reservations in `control/CLAUDE_HELPER_WORK.json`.
- **670 active enrichment IDs; 0 overlaps** with those checked reservations.
  This is not a count of jobs currently missing fields or cleared for this worker.
- No registered Hermes task key and no verified worker-level split. Zero overlap
  with known reservations does not prove disjointness from Hermes.

The existing programmed coordinator owns assignment changes. No worker-side
claim file or replacement allocator is introduced. The preflight keeps
`AUTHORITATIVE_WORKER_PARTITION_UNAVAILABLE` until a reviewed integration can
consume the supported authoritative split. Do not fill a JSON assertion to
pretend that allocation exists.

## Continuing until caps and keeping checkpoints durable

The core already drains successive 15-job batches until its checkpoint-lifetime
cap, cutoff, exhaustion or fatal gate. It does not stop after the first 15 jobs.
Approved current caps remain: $1.00 total conservative reservation, $0.002048 per
model attempt (at most 488 attempts), $10 additional balance cushion, 8,192 input
tokens / 1,024 output tokens, 45 seconds/job, 10 minutes/batch and November 29
00:00 UTC cutoff. No limit is increased by this Windows extension. Auth/credit
stops persist across restart; uncertain requests are not replayed. Existing
evidence can resolve jobs for zero model cost.

After a reviewed live host adapter is complete and all gates pass, use one fixed
private `LocalApplicationData\Forge\grant-luna\live` directory under the same
account, separate from synthetic dry state, with the same user-only ACL and
tested atomic replacement. Start one process on TIMMAY, hold the named worker
lock and keep the PC/session available. Use the existing approved host lifecycle;
this change registers no service or schedule. Resume the same live directory,
never a fresh directory to reset the budget. Back up the stopped checkpoint,
lock and staging files together. Reconcile an abandoned lock before releasing
it; retain unresolved request IDs and original coordinator receipts.

There is deliberately **no runnable live command yet**. Default-project approval
does not clear owner/allocation, durable-host, Writer or independent-verification
gates. Fresh credit/headroom and the actual restricted project's no-charge
configuration must be rechecked before starting. Credential metadata and key
syntax cannot prove grant eligibility or endpoint permissions. The secure
startup adapter and transport are implemented; automatic public-source/current
row ingestion, authoritative worker split, supported return delivery and live
Writer accounting still need the approved host integration.
