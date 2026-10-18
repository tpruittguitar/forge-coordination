# asks/ — questions and actions waiting on Tim

One file per item. The **Needs you** page in the Pipeline Explorer reads these through `attention/NEEDS_TIM.json`,
which `tools/needs-tim/build.js` rebuilds on every push and every 30 minutes (`.github/workflows/build-needs-tim.yml`).

## Raise an item (any lane, same run that needs it)
Create `asks/open/<ID>.json`. ID = `ASK-<YYYYMMDD>-<PROVIDER>-<HHMM>` (Claude's seed set uses `ASK-<YYYYMMDD>-NN`).

```json
{
  "id": "ASK-20261018-CHATGPT-1430",
  "raisedBy": "CHATGPT",
  "raisedAt": "2026-10-18T14:30:00-04:00",
  "section": "DECIDE",
  "level": "ACTION",
  "title": "One-line question Tim can answer",
  "detail": "What is going on, with the facts he needs. No jargon.",
  "blocks": "What is held up until he answers.",
  "options": ["Option A", "Option B"],
  "recommended": "Option A, and why in a few words.",
  "action": "Answer in chat; the AI records it in asks/resolved/.",
  "links": [{"label": "Evidence", "url": "https://..."}]
}
```
- `section`: `DECIDE` (policy, plans, settings) or `JOBS` (a job or application record waiting on him).
- `level`: `BLOCKING` (work is stopped), `ACTION` (needs him soon), `WATCH` (no rush).
- `covers` (optional): item-ID prefixes this ask replaces while it is open, e.g. `["gofer-archive:"]`, so a vague
  receipt line and the specific question do not both show.
- Keep writing `NEXT_OWNER=` in the receipt as before; the builder reads both.

## Close an item
Create `asks/resolved/<ID>.json` with the same `id` (never edit or delete the open file):

```json
{"id": "ASK-20261018-01", "resolvedAt": "...", "resolvedBy": "CLAUDE", "ruling": "Tim 2026-10-18 16:05 ET: WATCH"}
```

## Dismiss an item the builder found in a receipt or handoff
When a receipt-derived item is already done, add `dismiss` to a resolved file. The item stays hidden only while the
same source file raises it; a newer receipt that raises it again brings it back.

```json
{"id": "DISMISS-20261018-01", "resolvedAt": "...", "resolvedBy": "CLAUDE", "reason": "Verified done: ...",
 "dismiss": [{"itemId": "run-next-owner:INDEX|CHATGPT", "source": "receipts/<file>"}]}
```
Item IDs are shown on the Needs you page under each item.
