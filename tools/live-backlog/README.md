# Live backlog worksheet

A local worksheet over `tpruittguitar/forge-coordination` main, not a CSV or Google Sheets import. It reads the exact discovery ledger and the app's checked pages. Explicitly selected deletions commit the ledger, app pages, counts, and recovery receipt together to main. The working checkout and its branch stay untouched.

## Rollout and prerequisites

This code must first be reviewed and merged. The server refuses deletions until the fetched main contains the compatible tombstone observer. Publishing a draft PR does not enable the feature. No hosted deployment is needed.

On the user's computer, use an existing Forge checkout with Node.js 18+ and existing authenticated Git access. No npm dependencies, installation, new token, credential storage, security change, Writer key, Writer read, or Writer write is required. Existing branch protection remains authoritative. A rejected push is not bypassed.

Before using a new worksheet checkout, verify its existing Git author and committer identity with `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`. Clone/fetch and synthetic browser tests do not verify commit identity. If missing, configure `user.name` and `user.email` locally in that checkout using the user’s already-established Forge identity; do not invent an identity or change global settings. This correction needs no server restart, and must not replay a deletion. Local commit-preparation failures occur before push and are reported as no rows changed.

After updating the checkout to include this change, run:

```sh
node tools/live-backlog/server.cjs
```

Open the loopback URL printed in the terminal on that same computer. It binds only to `127.0.0.1` on a random available port. Stop with Ctrl+C. The random session value is local, ephemeral CSRF protection, not a persistent service credential.

## Appearance

The worksheet keeps black/grey backgrounds, rows and evidence. Restrained accents highlight links, keyboard focus and selection edges in muted blue, errors and enabled destructive controls in rose, confirmed success in mint, and repeat-review warnings in lavender. No orange is used. Selection remains visible on hover; errors, warnings and destructive actions retain text and border cues rather than depending on color. The theme changes presentation only, with no data, selection or mutation behavior changes.

## Use

- Search/filter and sort across every live row, not just the displayed 100-row page.
- **Salary range** displays source-bound posted salary with its original observation date and source. The source posting verifies the disclosure; no second salary review is required. Explicit third-party estimates remain labeled estimates. It uses existing posting facts or exact saved posting/card excerpts when usable, otherwise the latest matching row in the current source-trial/board-discovery reports at the same fetched revision. A fallback requires the exact source identity and complete company/title/location, normalizing only case and whitespace. Conflicting or unusable values stay unavailable. Missing scoring units do not invalidate a posted disclosure. It never joins by company/title alone, reads Writer, fetches postings or estimates pay. Explicit currencies/periods remain unchanged; no annualization or exchange conversion occurs. Legacy report strings are preserved verbatim, may be rounded, and lack currency code, period and base/total metadata. Those missing units are visible, not assumed to mean annual USD. An em dash means missing/unusable evidence, never zero. Click the salary header to sort by the numeric **top of range**, ascending or descending, across the full filtered snapshot. Sorting stays within currency/pay-period groups, with complete units first and incomplete units grouped separately. Group order stays fixed in both directions; the active sort displays each row’s numeric top and group. Unlabeled dollar amounts are never assumed to be USD or annual. Structured ranges use the validated saved upper bound; legacy K/M range text is parsed conservatively, retains its rounding, and never uses open-ended floors, ambiguous text or malformed ranges as a ceiling. Missing or unusable tops stay last both ways. A new sort returns to page 1 without changing selection. Search and selected TSV include the salary and provenance. Only current reports are joined; pay available only in older reports remains unavailable until retained in the card source.
- Sort the **ATS hits** column to compare counts of distinct saved resume-supported competencies. Each row shows **Matched words** inline: all distinct saved posting words/phrases, preserving the first saved spelling and deduplicating case/outer whitespace. The competency count is not a word count. No terms are inferred from competency labels or excerpts. Expand Evidence for saved terms/excerpts, the saved resume version and check date. Excerpts may have been shortened when recorded; the display retains all saved terms and does not infer missing text. Zero shows **No matched words observed**; missing or invalid evidence shows **Matched words unavailable**. `Title only`, `Source snippet`, and `Captured content (extent unverified)` distinguish incomplete or unverified text from `Role content screened` (a saved PASS/EXCLUDE gate on captured role content). A zero in the first three categories is not a screened-out job. These counts are preliminary overlap, not an ATS-provider percentage, qualification verdict or a new scoring model. Zero means no observed matches in the saved text; an em dash means evidence is missing, invalid or needs a resume update. Missing values sort last in both directions. Search includes matched evidence; copied TSV includes the count, a separate ATS matched words column, evidence basis and provenance. The display never runs the matcher, reads Writer, refreshes resume data or changes saved evidence.
- Use **ATS hits** to filter by **Exactly**, **At least**, **At most**, or **Between** (inclusive whole numbers, including zero). Choose **Unavailable evidence (—)** separately; numeric filters never treat unavailable evidence as zero. **All counts** clears the ATS filter. Invalid or reversed bounds show an error and no matching rows. ATS filtering combines with search, status and occurrence filters across the full snapshot. It resets the page, but never automatically selects, deselects or deletes rows. Existing selections stay selected, including hidden rows; clear selection before selecting a new filtered group if needed.
- **Hold / wait reason** is visible, searchable, sortable and included in copied TSV. The worksheet reads the saved intake-drain assignment and immutable review at the same fetched revision. Reviews must match the current ledger timestamp, exact source key/aliases, source version, task, outcome and content hash. Otherwise the recorded ledger classification remains visible with an explicit missing/stale-review label. **Work details** gives the assigned task, work status, next action, retry condition/date and evidence reference. Preliminary relevance-screen reasons are not passed off as hold causes. Reviews are research, not evidence that an original write completed or a held job was admitted. Reading reasons never runs workers or changes source data, schedules or Writer state.
- Select individual rows, Shift-select a range, or select all filtered rows.
- Delete selected rows only after the dialog confirms the exact count.
- Wait for a committed remote revision. A queued request is never presented as a deletion.
- Undo the last committed deletion in the same tab. Receipts retain recovery data under `receipts/live-backlog/` for older deletions.
- Refresh after another process changes the source. Changed revisions clear selection. Unrelated background commits are tolerated; a selected card whose identity changed is rejected rather than silently edited.
- When a normal Git push loses a race with a background commit, the server can rebuild the same confirmed edit against fresh main, with at most three push attempts total. It checks the original selected identities and repeat groups again on every attempt. It never overwrites the newer background data or sends a new browser request.
- For an uncertain connection result, use Check pending request. No automatic retry occurs after an uncertain result, authentication error, or protected-branch/hook rejection. The same request ID is blocked from another push in that server process while its outcome is unknown.

Deletion removes discovery cards from the active backlog immediately in the source commit. The main app sees the updated snapshot on refresh. Full history is retained, and existing canonical jobs or applications are never erased, changed, or cancelled. An outstanding canonical action is not cancelled by removing its discovery card. The original source-observation timestamps remain visible; a worksheet edit does not claim that background work ran.

A durable tombstone on each selected source identity prevents later discovery collection from restoring it. The observer retains the underlying current classification so undo does not turn a historically present card into a new job. Restoration can legitimately return fewer active rows when the source has since been accounted for elsewhere.

## Loading performance

Hold/wait review files are read in one Git batch at the fetched main revision rather than starting a Git process for each row. Review identity, source version, timestamp and content-hash checks are unchanged. Missing or invalid reviews retain the existing unavailable label. No worktree data or cross-revision cache is used, and refresh still fetches main. A batch failure leaves research unavailable without replaying hundreds of individual reads.

## Atomicity and safety

Each edit fetches main, verifies the displayed card identities and all page hashes, regenerates the cards from the authoritative ledger, and checks summary consistency. A process-specific fetch ref avoids interference with other Git operations. A temporary Git index creates one commit; the local branch/worktree are never checked out, reset, staged, or rewritten. Every push is a normal non-force push. A completed Git porcelain rejection for the exact target can establish that an attempt did not write. Only a non-fast-forward/fetch-first rejection may be rebuilt, and only after a fresh fetch proves the request has no committed receipt and main advanced from the attempted base. The server performs at most three pushes for one confirmation, regenerating the edit from the latest validated source rather than rebasing or cherry-picking the old tree. Original selection identity, repeat-group membership, page hashes, counts and history checks still apply; timestamp-only background changes do not invalidate a stable selection. Restores retain their existing tombstone/receipt checks and use the latest underlying status. Changed identities, changed repeat groups, incompatible history, branch protection and exhausted attempts stop without a force push.

Remote receipt readback is required before success is shown. Ambiguous writes keep the request ID available for reconciliation and block another push for that ID in the current server process. If the browser repeats a disconnected request, a matching committed receipt is returned without a second effect; absent proof of a committed receipt, an ambiguous attempt is not replayed. Receipt files are read in one batch at the exact fetched revision, reducing the race window without a cross-revision cache. No Writer call, queue or lock is involved in this Git-only conflict handling.

The HTTP server checks loopback Host, a per-run session header, exact Origin on writes, JSON content type, payload size, and a single edit lock. It serves no remote assets and does not enable cross-origin access. Only this fixed Forge repository and main branch can be written by the CLI. A different remote is injectable only by unit tests.

## Tests

```sh
node --test tools/live-backlog/git-store.test.cjs tools/live-backlog/source-race.test.cjs tools/live-backlog/model.test.cjs tools/live-backlog/server.test.cjs tools/live-backlog/occurrences.test.cjs tools/live-backlog/match-evidence.test.cjs tools/live-backlog/ats-hits.test.cjs tools/live-backlog/ats-filter.test.cjs tools/live-backlog/salary.test.cjs tools/live-backlog/salary-sort.test.cjs tools/live-backlog/hold-reason.test.cjs
node --test tools/manual-backlog/*.test.cjs tools/pipeline-observability/upstream-flow.test.js tools/pipeline-observability/waiting-queues.test.js tools/intake-drain/queue.test.cjs tools/intake-drain/exclusions.test.cjs
```

The Git tests use disposable local bare repositories only. HTTP handler tests require no listening sockets. Browser tests use a mock source and never contact production:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium node tools/live-backlog/worksheet-ui.test.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium node tools/live-backlog/theme-ui.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium node tools/live-backlog/hold-reason-ui.cjs
```

Do not install a browser implicitly just to run this optional check. Record an unavailable browser as unverified, not passed.

## Occurrence review

`Occurrence` is a per-row number (1, 2, 3...), while `Matches` is the total in its possible-repeat group. Choose **Occurrence > 1** to inspect extras while leaving occurrence 1 outside that filter. Nothing is automatically selected or deleted. Selection still spans filters and pages; clear any earlier selection before selecting filtered extras. The confirmation includes all selected rows, including hidden ones.

Groups require complete company, title and location. Only case, surrounding/repeated whitespace and Unicode canonical form are normalized; punctuation, company suffixes, title seniority, locations and requisition suffixes are not collapsed. Missing/unknown match fields are explicitly **Not counted**, not assumed equal. Matching names can still describe different vacancies. The oldest known first-seen date, then the exact source key, determines occurrence 1. Missing dates come last. The number is assigned across the full snapshot before filtering, sorting or paging; a refreshed snapshot recalculates the numbers.

**Match evidence** distinguishes an identical source URL (vacancy unverified), a shared supported provider listing/requisition, a name/location-only match, and conflicting posting IDs. Supported parsers use exact host/path shapes and tenant-scoped identifiers for Recruitics, Glassdoor, Workday, Lever, BambooHR, BuildSubmarines, LinkedIn and Indeed. Only known Recruitics/BuildSubmarines wrappers are examined, one level deep, without fetching a destination. Unsupported or opaque links remain unproven. Different source links, identity/history holds and differing statuses remain visible warnings even when a requisition agrees. Source routes are preserved; destination liveness and vacancy equivalence are not checked. This is review evidence, not an automatic deduplication decision.

Counts, evidence and warnings are computed in memory for the worksheet response only, never written into source pages or the ledger. TSV copying includes the ordinal, group total, evidence, warnings and original source key. If a repeated group changes between display and deletion, the edit is rejected with `REPEAT_GROUP_CHANGED_REFRESH_AND_RESELECT`, including when another process removes the row that would have been retained. Unrelated background changes are still tolerated. Existing confirmation, history, tombstone and undo behavior remains intact.
