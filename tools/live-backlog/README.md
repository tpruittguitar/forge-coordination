# Live backlog worksheet

A local worksheet over `tpruittguitar/forge-coordination` main, not a CSV or Google Sheets import. It reads the exact discovery ledger and the app's checked pages. Explicitly selected deletions commit the ledger, app pages, counts, and recovery receipt together to main. The working checkout and its branch stay untouched.

## Rollout and prerequisites

This code must first be reviewed and merged. The server refuses deletions until the fetched main contains the compatible tombstone observer. Publishing a draft PR does not enable the feature. No hosted deployment is needed.

On the user's computer, use an existing Forge checkout with Node.js 18+ and existing authenticated Git access. No npm dependencies, installation, new token, credential storage, security change, Writer key, Writer read, or Writer write is required. Existing branch protection remains authoritative. A rejected push is not bypassed.

After updating the checkout to include this change, run:

```sh
node tools/live-backlog/server.cjs
```

Open the loopback URL printed in the terminal on that same computer. It binds only to `127.0.0.1` on a random available port. Stop with Ctrl+C. The random session value is local, ephemeral CSRF protection, not a persistent service credential.

## Use

- Search/filter and sort across every live row, not just the displayed 100-row page.
- Select individual rows, Shift-select a range, or select all filtered rows.
- Delete selected rows only after the dialog confirms the exact count.
- Wait for a committed remote revision. A queued request is never presented as a deletion.
- Undo the last committed deletion in the same tab. Receipts retain recovery data under `receipts/live-backlog/` for older deletions.
- Refresh after another process changes the source. Changed revisions clear selection. Stale edits are rejected rather than silently applied.
- For an uncertain connection result, use Check pending request. The same mutation is never automatically replayed.

Deletion removes discovery cards from the active backlog immediately in the source commit. The main app sees the updated snapshot on refresh. Full history is retained, and existing canonical jobs or applications are never erased, changed, or cancelled. An outstanding canonical action is not cancelled by removing its discovery card. The original source-observation timestamps remain visible; a worksheet edit does not claim that background work ran.

A durable tombstone on each selected source identity prevents later discovery collection from restoring it. The observer retains the underlying current classification so undo does not turn a historically present card into a new job. Restoration can legitimately return fewer active rows when the source has since been accounted for elsewhere.

## Atomicity and safety

Each edit fetches main, verifies the displayed revision and all page hashes, regenerates the cards from the authoritative ledger, and checks summary consistency. A temporary Git index creates one commit; the local branch/worktree are never checked out, reset, staged, or rewritten. A normal non-force push rejects concurrent updates. Remote receipt readback is required before success is shown. Ambiguous writes keep the request ID available for reconciliation.

The HTTP server checks loopback Host, a per-run session header, exact Origin on writes, JSON content type, payload size, and a single edit lock. It serves no remote assets and does not enable cross-origin access. Only this fixed Forge repository and main branch can be written by the CLI. A different remote is injectable only by unit tests.

## Tests

```sh
node --test tools/live-backlog/model.test.cjs tools/live-backlog/server.test.cjs
node --test tools/manual-backlog/*.test.cjs tools/pipeline-observability/upstream-flow.test.js tools/pipeline-observability/waiting-queues.test.js tools/intake-drain/queue.test.cjs tools/intake-drain/exclusions.test.cjs
```

The Git tests use disposable local bare repositories only. HTTP handler tests require no listening sockets. Browser tests use a mock source and never contact production:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium node tools/live-backlog/worksheet-ui.test.cjs
```

Do not install a browser implicitly just to run this optional check. Record an unavailable browser as unverified, not passed.
