# Early discovery ATS gate

Tim requested the ATS > 0 gate early when the necessary data is already available.
This is a discovery filter, not an ATS-provider score or a canonical job decision.

`tools/source-trial/preliminary-screen.js` counts distinct resume-supported
competency matches using the existing deterministic resume matcher. It produces
`atsGate.status` (`PASS`, `EXCLUDE`, or `UNKNOWN`) with source identity, source
text hash, resume version/hash, and a reason. A supported zero produces
`EXCLUDE_ATS_ZERO`. Never Consider retains precedence.

Negative evidence requires:

- A structurally valid, grounded resume profile and an already-read, valid resume
  inventory with no newer or changed resume. The exact selected file/version must
  be confirmed either in that inventory or by fresh direct metadata in the same
  authenticated documents response, as described below.
- Captured role content with a source URL and employer/title identity. The existing
  posting parser's 300-character minimum also applies here.
- No title echo, selected saved quotes, alert/card excerpt, access-error text, or
  explicitly incomplete posting marker.

Missing or unreliable inputs produce `hits: null` and continue through existing
review/recovery. A positive count alone does not establish role fit. The matcher
itself still reports observational overlap; the separate gate owns filtering.

## Integration and preservation

- Board, JobSpy, and HiringCafe discovery annotate every captured card. Existing
  report arrays retain all captured identities for provenance and accounting.
- The upstream discovery ledger removes supported zero-hit jobs from active
  waiting work, retains source history and saved posting evidence, and recomputes
  decisions with current evidence. Selected quote fallbacks cannot justify zero.
- AUTO selection applies the same gate before source fetching or Writer intake.
  It also reuses already-saved complete local posting evidence.
- Routine assignments and source-bound relevance preparation use the shared
  screen before new CODE/AI intake work. The coordinator passes its existing
  context to child preparation using a private, same-run, 15-minute context file.
  No extra source fetch, model call, or schedule is added. Exact resume metadata
  uses the existing documents HTTP request, not a second request.
- Canonical master/archive representation, ambiguous canonical matches, prior
  submissions, in-flight work, durable Writer outcomes, and reconciliation fences
  take precedence. No canonical job is deleted or declined. Provisional exclusions
  reopen when fresh evidence no longer supports them.
- Email/alert snippets remain incomplete evidence. The gate does not turn missing
  description text or a snippet's zero matches into a rejection.

A PR does not activate this change. Merge and normal deployment/adoption remain
separate; no live discovery records or schedules were modified for implementation.

## Selected resume outside the inventory folder

The Writer resume inventory lists a configured folder, not every accessible
resume. A selected profile outside that folder must not be replaced by an older
folder entry or accepted merely from its descriptive authority label.

The existing authenticated `documents` GET accepts the optional
`profileResumeId` and can return a separate `profileResume` object with schema
`forge.profile-resume-metadata.v1`, source `DIRECT_FILE_METADATA`, status, exact
`id`, `modifiedTime`, and `checkedAt`. Only `VERIFIED` metadata matching the
selected ID and version is usable. It expires after 15 minutes, with two minutes
of server clock tolerance. A changed selected file or newer inventory resume
requires a profile refresh. Missing, malformed, failed, or stale metadata leaves
the gate UNKNOWN even if an older folder snapshot claims an exact match.

This requests one direct file-metadata lookup inside the existing documents read;
it does not read resume bytes, move files, change an approved-resume setting,
grant access, or create credentials. The ordinary folder inventory is preserved
and must still be valid. Selected file IDs are sent only to the same authenticated
Writer that already supports exact document reads, not to job sources.

**Deployment dependency:** the coordination change is backward compatible, but an
older Writer that omits `profileResume` cannot confirm an out-of-folder resume.
Its gate remains UNKNOWN. A separate authorized Writer implementation/deployment
and fresh runtime verification are required; a coordination merge alone does not
establish effective ATS filtering.
