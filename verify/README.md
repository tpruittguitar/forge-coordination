# Writer verification service

For any lane that sends work to the Writer (Drive `WRITER_QUEUE` or a direct route) but cannot run the Writer's
authenticated reads (`receipt_index`, `request_result`, `row_readback`) itself. Read-only: it never sends anything to
the Writer. Run by `.github/workflows/writer-verify.yml` with the repository's Writer key.

## Ask
Create a new file `verify/requests/<ACTOR>-<YYYYMMDD>-<HHMM>[-slug].json`, for example
`verify/requests/CHATGPT-20261026-1400-email.json`:

```json
{"schema":"forge.writer-verify-request.v1",
 "requested_by":"CHATGPT FORGE-EMAIL-CHATGPT-20261026-1400ET",
 "requests":[{"requestId":"FORGE-EMAIL-CHATGPT-20261026-1400ET-B01","primaryIds":["V2I-B780968068AC","V2I-78CF4EC99443"]}]}
```

- `requestId`: the request ID you sent. 1-50 requests per file.
- `primaryIds`: the row IDs the Writer returned in its RESULT file (`receipt.NEW_PRIMARY_IDS`, or each
  `results[].PRIMARY_ID`). Up to 25 per request. Required to reach VERIFIED: the receipt index no longer lists row IDs.
- Never edit a request file after creating it. Ask again with a new file.

## Answer
`verify/results/<same name>.json`, usually within minutes of the push. One `verdict` per request:

| Verdict | Meaning | What to do |
|---|---|---|
| VERIFIED | Receipt index COMPLETE, durable request_result COMPLETE, every ID read back exactly once | Record VERIFIED. `rows[].row` gives COMPANY, TITLE, LOCATION, BUCKET to match against what you sent |
| COMPLETE_UNBOUND | COMPLETE, but no IDs were supplied | A no-op needs nothing more; for an insert, ask again with the IDs |
| PENDING | Not COMPLETE yet | Rechecked at the regular cadence initially, then every six hours after 24 h; no age-based abandonment |
| NOT_IN_INDEX | No master transaction for this request | Read the Writer RESULT file; never resend blindly |
| HELD | NEEDS_RESOLUTION / NOT_PERSISTED / FALSE_COMPLETE, or result not durable | Reconcile; never replay |
| ROWS_MISSING | COMPLETE but an ID is absent or not exactly once in the master | Reconcile; report it |
| REJECTED | Malformed request (`reason`) | Fix and ask again with a new file |
| CHECK_FAILED | The read failed (`reason`) | Rechecked indefinitely, slowing after 24 h |

This repository is public: answers carry IDs, states and only COMPANY / TITLE / LOCATION / BUCKET of each row.

## Automatic historical recovery

The hourly receipt-recovery worker also examines old failures and saved verification requests, including terminal archive rows. It records exact proven outcomes or explicit escalations without replaying writes. See [Receipt recovery](../docs/RECEIPT_RECOVERY.md).
