# Intake catch-up

The existing five-minute Windows coordinator reopens saved full-message captures, persists candidate cards, screens them, drains READY work and reconciles pending original requests. Each completed pass now publishes `state/COORDINATOR_CATCH_UP.json`: ready cards, pending requests, research cards, alert handoffs and cumulative distinct verified jobs. Acceptances do not count as verified completion. Empty READY work with unresolved research is WAITING_RECONCILIATION, not a claim that the backlog is complete.

The existing `source-intake-auto` GitHub workflow also runs hourly at minute 17 and on discovery completion. Its `--catch-up` mode keeps the union of source-trial, employer-board and untouched carried candidates in `receipts/auto-intake/catch-up/state.json`. Report rollover cannot remove saved candidates. Every candidate still passes the current relevance screen, helper reservations, live source evidence, canonical rules and original-request/identity fences. Successive batches drain in the same pass.

Unavailable source evidence records a one-hour retry time. Another batch or unchanged report does not retry that lookup; due time or changed source evidence reopens it. A source failure never stops later candidates. Inventory progress distinguishes unattempted discovery candidates, attempted requests, unresolved requests and waiting source retries; it never labels attempted requests as canonical completions.

The workflow's existing concurrency group serializes catch-up with normal AUTO intake, and its artifact/commit steps preserve both the inventory and original response checkpoints. No new Writer client, AI automation, credential or production lock is introduced. Gofer's existing hourly schedule owns uncertain writes and abnormal cards.

To begin immediately after merge, dispatch `source-intake-auto` and start the existing `FORGE_PROGRAMMED_COORDINATOR` Windows task if idle. Both resume from durable state. Later scheduled passes continue new evidence and due retries; no busy loop waits for an unchanged exception. Historical unseen search results remain unproven and are never invented.
