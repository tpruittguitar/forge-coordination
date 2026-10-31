# Email recommendation recovery

Tim authorized recovery and prevention of lost/stuck email recommendations on 2026-10-31.

Root causes verified locally:
- Anonymous fetch reported login_required for eleven LinkedIn result links and bot blocking for a Glassdoor link. All twelve opened through the existing signed-in Chrome session without login, settings changes, CAPTCHA handling or applications.
- LinkedIn view-all links are changing searches, not preserved email snapshots. The advertised 149 unseen occurrences overlap and cannot identify 149 distinct missing jobs. Glassdoor's old page currently says “No new matches for now”; that does not prove its historical job was handled.
- The parser's persistent seen set previously suppressed jobs before any saved disposition or successful intake existed. It now suppresses repeated cards only within one email. Previously observed jobs require fresh identity/disposition checks.

`state/EMAIL_RECOVERY_QUEUE.json` is a source/candidate work ledger, not a second master. `tools/email-recovery/ledger.cjs` merges visible provider job IDs across emails, preserves source provenance, records page checkpoints and requires evidence for terminal dispositions. Writer remains the sole master mutation route. Pending and ambiguous writes cannot be replayed. Old email receipts and backfill cursors remain intact.

The email runtime instructs every subsequent run to drain captured jobs before fetching further pages, use the browser fallback once on anonymous login failures, and rotate remaining sources. An empty historical live page remains an explicit coverage gap; it is never represented as zero missing jobs or complete historical coverage.

The compact summary distinguishes access failures, captured unique jobs, pending dispositions, remaining pagination and historical gaps. The GUI stops displaying the old access fault only when matching, fresh recovery evidence supersedes that exact email receipt. Remaining work stays visible.

CLI: `node tools/email-recovery/ledger.cjs state/EMAIL_RECOVERY_QUEUE.json inputs.json captures.json`. Inputs contain gmailId, provider, sanitized source URL and advertisedUnseen. Captures contain actual visible card data and pagination observations; never synthesize cards from counts. Empty results require positive visible evidence. Summary publication occurs with every ledger save. Commit both state files and supporting receipts after each completed batch.
