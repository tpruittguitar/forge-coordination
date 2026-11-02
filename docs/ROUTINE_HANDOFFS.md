# Programmed report transport, pagination and handoffs

The existing five-minute coordinator now runs these steps before ordinary return inspection and Writer work. It adds no automation, schedule reduction, WIP limit, page quota or job quota. All helpers retain their research capacity. AI receives unresolved identity, relevance and conflicting-evidence exceptions; code owns collection, validation, cursor accounting and assignment progress.

## What runs without a browser

`tools/routine-handoffs/reports.cjs` scans the private helper inbox and narrowly named helper exports in Downloads, including ZIP archives. Full reports are saved privately before parsing. Only complete known JSON envelopes with current registered provider/task/assignment and valid instruction routing enter public evidence receipts. Excerpts, incomplete objects and collisions remain explicit exceptions. Existing accepted envelopes are canonical-content duplicates, including older accepted Claude exports. ZIP members are read without extracting or executing them; unsafe paths, symlinks, oversized members and CRC failures reject the artifact. These are format boundaries, not processing quotas. Private outcome reports stay outside the public repository and remain pending for the mailbox tracker; collection does not persist an application event.

`assignments.cjs` derives the next page/key and returned-key accounting from validated evidence and existing explicit handoffs. It appends new pages to the existing assignment only when its prior research has been handed off. It retains assignment IDs, old pages, aliases, pending transactions and reservations. It requires a fresh complete canonical master/archive snapshot. Exact canonical posting matches, protected decisions and transaction fences are reused; similar identities remain AI exceptions. Complete unassigned captured cards go directly into `CODE_INTAKE_CONSUMPTION`, the current relevance screen and existing Writer path. Unclear scope goes to Claude, incomplete sources to Grok. Independently verified helper returns without legacy intake records also enter the same path, bound to their immutable batch/version. No Claude evidence is fabricated or rewritten.

Helper CLIs select the next unfinished page in code. Cloud helpers can read `state/HELPER_HANDOFFS.json` for the exact assignment, nextPage and nextKey, then continue successive evidence batches. Returned, prepared and handed-off counts never claim canonical completion. Reserved failed-source cases remain code/source-route obligations rather than repeated helper preparation.

## Browser transport configuration

Optional private configuration is `<privateDirectory>/handoffs.json`, or an absolute `FORGE_HANDOFF_CONFIG` path. It contains paths and tool identifiers, never credentials. Without it, local inbox processing, assignment replenishment, source verification and Writer work continue; browser work reports `SUPPORTED_BROWSER_ROUTE_UNAVAILABLE`.

```json
{
  "python": "python",
  "inboxes": [
    { "directory": "C:/private/forge/helper-inbox", "pattern": ".*\\.(json|jsonl|md|txt|zip)$" },
    { "directory": "C:/Users/Tim/Downloads" }
  ],
  "browser": {
    "endpoint": "http://127.0.0.1:9222",
    "playwrightModule": "C:/existing/node_modules/playwright"
  },
  "reportFeeds": []
}
```

The browser endpoint must be an **already available**, explicitly configured loopback CDP connection to the authorized external Chrome session. The runner does not enable debugging, launch a signed-in browser, restart Chrome, copy profiles/cookies, log in or use hidden authenticated APIs. [Playwright CDP attachment](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp) uses the existing context; the runner closes its own pages and disconnects its client.

For each native report feed configure `id`, `automationId`, `provider`, `taskKey`, the observed exact UI `url`, and `listTool`/`readTool` names from that page's supported WebMCP registry. The automation ID/provider/task must match `control/AUTOMATION_OPERATING_MODEL.json`. No native report endpoints or selectors are invented here. The list tool receives `{automationId,cursor}` and returns `{reports:[{id}],exhausted,nextCursor,resumeCursor}`. The read tool receives `{automationId,reportId}` and returns `{complete:true,text}` only for the complete persisted report. Cursors must enumerate oldest-first and retain a watermark for future reports. The collector drains every page and persists full bodies before cursor advancement. Changed immutable reports and cursor cycles fail visibly; other feeds continue.

The results adapter uses the existing Pluno WebMCP registry first, registering reusable source-free DOM tools when absent. Ordinary DOM inspection is the fallback when that registry is unavailable. The LinkedIn tools select observed result cards to obtain actual `currentJobId` URLs; they never guess IDs or offsets, click Apply/Dismiss, or use non-results carousels. They require complete card identities and the observed Page N/Next cluster. Unknown site layouts fail explicitly. Configured alternative tools must implement the same observation contract; Glassdoor has no built-in DOM parser in this change.

## Cursor and write recovery

`pagination.cjs` rotates pending saved sources, saves the complete observed page privately, captures every card into the existing recovery ledger, and flushes an IN_FLIGHT Next checkpoint before activating the actual observed results control. Only an actual increasing URL cursor with unchanged filters advances the ledger. The next page's cards are saved before the browser page closes. Repeated IDs, changed filters, loading placeholders and ambiguous controls stop only that source. An uncertain click reopens and reobserves the last captured page; it does not guess or skip the next page. Temporary source failure has a code retry timestamp. Live exhaustion never proves missing historical coverage; an empty live source preserves `HISTORICAL_RESULTS_UNAVAILABLE`.

Writer remains the only canonical mutation path. Existing request checkpoints, original acceptance, independent COMPLETE receipts and exact later row/evidence checks remain mandatory. The scheduler publishes only declared accounting and newly created immutable receipts/pages; modified immutable evidence stops publication. Private full reports, source bodies, outcome correspondence, payloads and connections are not published. `state/PROGRAMMED_COORDINATOR_REPORT.json` includes transport and assignment exceptions in the existing code/AI queues, with detailed progress in `ROUTINE_HANDOFFS_REPORT` and `HELPER_HANDOFFS`.

## Rollout and remaining access boundary

Merge the reviewed PR before the dedicated coordinator checkout fetches these changes. The existing scheduled task then picks up the new modules; it does not need another recurring AI automation. Installation uses PowerShell 7, matching the launcher's .NET API requirements. Keep every existing AI schedule active until source coverage and measured throughput support a separate retirement decision. Remove their routine collection/counting/Next/receipt-polling work through the updated shared procedures; retain actual research and unresolved exceptions.

During implementation, the desktop browser tools failed before execution with `failed to write kernel assets ... os error 3`, and the existing external Chrome process exposed no supported CDP endpoint. Therefore live UI-only report collection and signed-in pagination have **not** been validated or enabled. They remain explicit source-route exceptions. Tests use an isolated synthetic browser without the user's profile; fixture success does not claim production access. Existing code inbox/Writer processing and AI source coverage stay active while that connection is unavailable. Do not disable the coordinator's source-transport responsibility on the basis of unit tests.

The 30–50% usage reduction remains an engineering target. Measure AI tokens per independently verified disposition/update, along with source coverage, backlog age and throughput; growing backlog throughput can consume saved tokens while improving work completed. No total-usage or monetary savings are claimed here.

Validation: `npm ci --prefix tools/routine-handoffs --ignore-scripts`, `npx --prefix tools/routine-handoffs playwright install chromium`, then the combined Node command in `.github/workflows/programmed-coordinator-test.yml`. Local fixture runs may set `FORGE_PLAYWRIGHT_MODULE` and `FORGE_TEST_CHROME` to an existing dependency/browser executable, using a new isolated headless test session. Python's standard library supplies archive tests. Instruction sources require the usual runtime build and Python tests.
