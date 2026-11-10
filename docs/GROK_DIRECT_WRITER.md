# Grok directly through the existing Writer queue

Tim's November 10 direction removes the helper coordinator from Grok's ordinary
ready-fact submission path. Use the existing `AI_Coordination/WRITER_QUEUE`
Drive drop folder. This is direct submission to the Authorized State Writer,
not an edit of the master file and not another helper-return inbox. No local
coordinator, its production lock, helper approval, receipt PR, merge, HTTP key,
new endpoint or new schedule is required for this existing queue route.

The existing `foreman-cockpit/apps-script/Automation.gs` handler claims the file
and calls the same `dispatchWrite_` implementation as HTTP. Its script lock,
live freezes, duplicate-request checks and independent verification fence still
apply. A single helper does not remove the other automated Writer clients.
Never disable those protections or request/copy a credential.

## Use the real route, not a capability assumption

Read `policy/current/COMMON_WRITER.txt`. In the current Grok session, resolve the
existing queue as a child of the already-authorized AI_Coordination folder and
verify the exact parent, folder and existing processed/failed destinations.
Existing access to the parent is not proof that this session can create a file
in the queue or read its results. Use existing authorized Drive tools only.
Do not change sharing, create a replacement queue, install a trigger, or infer
access from another app. Verify the first real eligible submission; do not add
an empty readiness probe or repeated setup test.

If this route is actually unavailable, preserve evidence as TRANSPORT_PENDING
and report the exact capability/error. The already-authorized helper-return
transport remains a fallback only before direct submission has been attempted.
Do not describe a fallback upload as a direct Writer submission. Existing
helper-return artifacts retain `writerSubmitted=false`; direct queue requests
and their transaction checkpoints are a different format and must never claim
that flag after a submission attempt.

## Select distinct work before researching

The assignment file can remain ASSIGNED after a direct write. It is not a fresh
missing-field list or permission to start again at its first row. At each run,
load your existing private direct checkpoints, phase records, original queue
results and previously delivered helper-return IDs once. Merge that history by
primary ID and original request ID before choosing work. Never count repeated
operations on one role as new jobs.

Persist an immutable `grok-direct-progress-<runId>-<page>.json` outside all
executable queues after EVERY visited item, including blocked, ready, no-change
and uncertain items. Each record retains unique recordId, observedAt (UTC), primaryId, assignmentVersion,
sourceVersion, phase, original requestId if any, source/effect fingerprints,
evidence/checkpoint references and retryAfter/retry condition. Resume saved work;
do not reread all instructions or restart the same first two assignments after
publishing a batch. Scan past excluded items into later assignment pages and
continue this invocation while independent eligible work and tools remain.

Apply these rules even without shell access:
- Any attempted/queued/uncertain write or prior helper delivery fences that role
  from NEW submission/research. Reconcile its original request separately. A
  missing field, readback mismatch, new run ID or unchanged ASSIGNED status does
  not release the fence. Never submit again to repair a mismatch.
- VERIFIED or NO_CHANGE for the same assignment/source with no remainingFields: skip. Record explicit remainingFields for partial success; current-row comparison excludes completed fields while remaining gaps can advance. A partial update
  is not completion of the whole job, but repeating its completed fields is not
  progress. Reopen only a materially new assigned gap/source after current-row
  checks and original-request reconciliation, not a changed timestamp alone.
- RESEARCH_READY/SUBMISSION_NOT_ATTEMPTED: resume the saved artifact, not research.
- RESEARCH_BLOCKED: skip until its explicit retry condition/date is met or its
  source changes; continue other jobs. Preserve the gap rather than calling it
  completed. A zero-change RESULT advances selection without claiming a write.

With shell access, `node tools/helper-routing/direct-progress.cjs next <input>`
reads `{work:<fresh SHARED_HELPER_WORK>,progress:[<records>]}` and scans beyond
handled items. It is a read-only selector, not a claim/lease, evidence verifier,
Writer caller or authorization to release another owner's work. VERIFIED records
must already carry the three proofs below; this selector does not create them.
If no shell, apply the same exclusion rules to the compact pages and retain the
same durable progress. If history is unreadable, preserve known uncertain IDs
and report that exact blocker; never assume empty history.

## Before creating a write request

1. Reuse the source research and current assignment. Read current canonical rows
   and pending-original accounting. Recheck exact employer, title, location,
   requisition, primary ID, source/assignment versions and protected decisions.
   Use the active plain-text master or a fresh `row_readback`, not a frozen
   rollback Google Doc or an old worklist. Check exact missing fields, never
   overwrite a conflicting current value, and skip already-satisfied facts.
2. Preserve existing reservations. This path removes coordinator mediation of
   submission; it does not silently transfer another provider's work, change
   schedules or invent a cross-provider claim service. Research and direct
   submission do not acquire the local coordinator lock. Pending original
   requests still fence their exact identities.
3. Verify the actual source posting for that role and retain the original URL,
   observation time, exact quotes and complete relevant source text. A helper's
   `READY` label, saved snippet, syntactically valid JSON or prior delivery does
   not establish current source truth. Apply current salary, degree, fit and
   link rules. Submit supported raw facts only; Writer derives final scores.
   Direct FIT_* submission must include exact requirement quotes checked against
   the current `control/RESUME_MATCH_PROFILE.json`, its real resume text hash and
   valid requirement-to-competency matches. The fallback adapter is not running
   here to derive omitted mappings. Use observed overlap only, never invented
   qualifications or numeric scores; if the profile/mapping cannot be checked,
   leave fit pending and submit independently supported other fields.
   FIT_EVIDENCE and FIT_BASIS are readable plain strings (maximum 1500
   characters each), not arrays/objects. FIT_REQUIREMENTS is NOT an allowed
   direct field. Never send JSON objects coerced to "[object Object]" or truncate
   a quote to fit. Retain complete evidence privately; submit a complete shorter
   exact quote only if it is independently meaningful. DEGREE_TEXT limit is
   12000; all other direct strings max 1500. Long FIT_EVIDENCE/FIT_BASIS may be
   externalized by Writer: resolve the actual authoritative evidence reference
   before comparing, not a frozen master download. Unsupported, inaccessible
   or contradictory evidence remains an exception.
4. Do not queue a second copy of evidence already delivered for processing.
   Previously captured helper returns, their original request IDs and uncertain
   outcomes remain in the existing reconciliation path. Redirecting one requires
   proving no request is in flight and durably excluding it from the previous
   consumer before submission. This document does not perform that migration.
   For fresh direct work, never also deliver a write-through helper batch.
5. Durably save the exact complete planned payload, source evidence, row/ownership
   observations, all parent/child request IDs, target queue and a state of
   `SUBMISSION_NOT_ATTEMPTED` outside WRITER_QUEUE. Use a uniquely named private
   `grok-direct-checkpoint-<requestId>.json` artifact, not `forge-helper-...` or a
   supported helper receipt path. This checkpoint is evidence, not another
   executable queue file. Reuse it across interruptions. Before the single
   queue-create attempt, retain `SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN` in durable
   accounting as a new immutable phase record bound to the original checkpoint;
   never overwrite the original payload/evidence. A crash or ambiguous tool result
   then remains fenced.

## Submit exactly once

Create one immutable plain-text file in the verified WRITER_QUEUE containing
only the existing Writer JSON body. Use 1–25 distinct canonical rows per
homogeneous ENRICH batch, with unique stable Grok parent and child request IDs.
Do not put a helper envelope, checkpoint, Markdown, credential or completion
claim in the queue. Artifact size is a transaction boundary, not a run cap.

Illustrative shape only; never upload this example or placeholder facts:

```json
{
  "action": "batch",
  "requestId": "FORGE-GROK-<unique-run>-B001",
  "requests": [{
    "action": "ruling",
    "ruling": {
      "requestId": "FORGE-GROK-<unique-run>-B001-R001",
      "primaryId": "<exact-current-primary-id>",
      "kind": "ENRICH",
      "actor": "GROK",
      "fields": {
        "DEGREE_TEXT": "<complete exact requirements evidence>",
        "DEGREE_EVIDENCE_URL": "<exact-source-url>"
      }
    }
  }]
}
```

With shell access, `node tools/helper-routing/direct-writer.cjs validate <file>`
checks the narrow ENRICH JSON syntax without network calls, changing files or
invoking Writer. It does not validate live evidence, ownership, pending originals
or completion. Without shell, use the same shape, allowlisted facts and exact
JSON parse/readback checks with the tools actually available. Lack of a shell
is not a requirement to send a helper envelope instead of a queue request.

Retain the actual returned Drive file ID and read back the complete queue file,
including its parent and bytes. A create timeout or ambiguous acknowledgment
is `SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN`, not permission to create another
file or use the helper fallback. Search/read the original file and result by its
stable IDs/name. Never rename, overwrite, move, delete, or resubmit the Writer's
PROCESSING__, HOLD__, processed or failed artifacts. Writer owns their lifecycle.

## Verify without the helper coordinator

1. Read the original `RESULT__<request-basename-without-extension>.json` in processed/failed. Bind
   `request_file_id` and the exact original parent/child request IDs. Require
   terminal `SUCCESS`, successful corresponding results and the actual write ID.
   Upload, `ok` alone, `ALREADY_APPLIED`, an accepted request or canonical presence
   does not establish a new verified write. Preserve a no-write result separately.
2. Read a later independent current receipt index at
   `tpruittguitar/forge-writer-state`, main, `PIPELINE_RECEIPT_INDEX.json`. Resolve
   the current revision; require every original child request's `s=COMPLETE`,
   matching `w` write ID and requested primary ID in its items. Record the
   revision, `at` and observation time. The old Drive receipt index is a frozen
   rollback copy and must not be used as completion authority.
3. After observing COMPLETE, request fresh exact rows through the same existing
   Drive queue, without a key:

   ```json
   {"action":"row_readback","requestId":"FORGE-GROK-<unique-readback-id>","primaryIds":["<exact-primary-id>"]}
   ```

   This read-only action does not mutate the master. Use at most 25 IDs and a
   unique readback filename/ID. Its RESULT must report `result.ok=true`,
   `readOnly=true`, `readAt` after the COMPLETE observation, an END marker,
   exactly one row per target, and exact matching identity and requested effects.
   Externalized evidence must be checked against its authoritative evidence
   record if the compact row does not contain it; an evidence pointer or missing
   long field is not proof. Keep unverifiable fields pending, not guessed.
4. Record original payload/file ID, RESULT, COMPLETE revision and post-COMPLETE
   row proofs in the private direct checkpoint. Report prepared, queued,
   independently verified and blocked separately. Count distinct roles and newly
   filled fields separately from row operations, retries, no-ops and receipts.
   Report eligible roles visited and the concrete stop reason, including counts
   skipped by prior direct progress; one or two submitted rows is not a run cap. These actual transaction facts
   do not need a helper coordinator to approve them. They may be reported through
   the existing observability route, but never as a new evidence-only batch that
   would ask another consumer to write them again.

`PARTIAL_HOLD`, `HOLD_UNCERTAIN`, `HOLD_ABANDONED`, failed or missing results
require original-request reconciliation, never automatic replay or a changed
request ID. Continue unrelated eligible work. Existing intake and discovery
admission retains its current identity/relevance contract; this initial direct
producer validator supports ENRICH only. A missing application-outcome job still
requires Tim's approval. This change does not claim live Grok access, disable
the coordinator's independent mail/intake duties, change provider availability,
merge, deploy or verify a production write.
