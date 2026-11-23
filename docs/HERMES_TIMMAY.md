# Hermes on TIMMAY

Hermes Agent is Tim's local agent on his PC TIMMAY. This page tells every AI on Forge where its setup lives and how it reaches Tim's Gmail. Set up by Claude on Nov 20, 2026. Full plan: the "Hermes setup plan" Claude Doc in Tim's account.

This repo is public, so this page lists file paths only. No password, key or token value goes here or anywhere else in Forge.

## Where things live on TIMMAY
| What | Path |
|---|---|
| Hermes home (config.yaml, SOUL.md, skills) | `C:\Users\Tim\AppData\Local\hermes` |
| Context file (job-search notes, IP rules) | `C:\Users\Tim\My Drive\Hermes_Workspace\HERMES.md` |
| Logon script (warms models, starts gateway and office poller) | `D:\Ollama\start_hermes_stack.ps1` |
| Office poller (answers 3D office chat directly) | `D:\Hermes\office\hermes-office-poller.ps1` |

Default model: mimo-v2.6 9B on the GPU. Fallback qwen3.5 9B, then ministral-3 3B on CPU. Gemini is a manual alias only.

## Gmail access (the one credential Hermes uses)
- **Credential file:** `C:\Users\Tim\.hermes\gmail_app_password.json`, keys `email` and `password`. It holds a Google app password for Tim's Gmail.
- **Used by:**
  - `skills\career\tim-job-research` (morning job report sent over SMTP)
  - `skills\career\applicationstatus` (application status from the inbox over IMAP, read-only)
- **Rule:** code loads the password from that file at run time. The value is never typed into a skill, prompt, log, receipt, handoff, doc or chat. To rotate it, replace the value in that one file.
- **Checked Nov 20, 2026:** a read-only IMAP login through the file worked.
- **Calendar:** Hermes has no calendar access yet.

## Old copies to clean up
Before Nov 20 an older app password was typed into the job-research skill. It still works until Tim deletes it in his Google account (Security, App passwords). Copies of that old value remain in Hermes's backup and reference files under `skills\career\tim-job-research` and `skills\research\job-research\references`. They stop mattering once that old app password is deleted.

## Forge enrichment: frozen half and automatic returns

1. Resolve the current main commit of [forge-coordination](https://github.com/tpruittguitar/forge-coordination), then read [`control/ENRICHMENT_WORKER_PARTITION.json`](https://github.com/tpruittguitar/forge-coordination/blob/main/control/ENRICHMENT_WORKER_PARTITION.json) at that **exact commit**. Take only `workers.find(w => w.provider === 'Hermes').primaryIds`. This is the authoritative assignment, not a separate list or a local checkout's HEAD. Its `sourceCommit` and `sourcePath` locate the frozen waiting snapshot for row identity and known posting URLs. Do not rewrite the partition.
2. Research only assigned exact postings. Return 1–20 assigned IDs in each UTF-8 JSON file, directly in `C:\Users\Tim\My Drive\Hermes_Workspace\outputs`. Use `FORGE-HERMES-<unique run suffix>.json` (8–100 letters, digits, underscores or hyphens after the prefix). Finish a temporary file first and rename atomically to the final filename. Never overwrite, resend or change a final file. Keep blocked or unsupported rows and private research out of this ingress.
3. Use the schema below; placeholders are not evidence. `partitionSha256` is the lowercase SHA-256 of UTF-8 `JSON.stringify(JSON.parse(partitionFile))`, without a trailing newline. `instructionCommit` is the commit from step 1, not the partition's `sourceCommit`. Each item's URL must be an HTTPS posting URL already linked on the exact canonical row. Each proposed raw field group needs a literal, unshortened quote from that same posting. Use ordinary raw-field names from [the helper field contract](../tools/helper-routing/helper-fields.cjs); skip estimates, assumed work arrangements without a source quote, scores, protected fields and other unsupported values.

```json
{
  "schema": "forge.hermes-enrichment-return.v1",
  "provider": "Hermes",
  "taskKey": "FORGE_HERMES_FROZEN_ENRICHMENT",
  "runId": "FORGE-HERMES-20261123T030000Z-B001",
  "instructionCommit": "<current main commit>",
  "partitionSha256": "<canonical partition SHA-256>",
  "writerSubmitted": false,
  "items": [{
    "kind": "ENRICHMENT",
    "primaryId": "<assigned ID>",
    "recommendation": "ENRICHMENT_EVIDENCE_READY",
    "sourceEvidence": {
      "company": "<exact row company>",
      "title": "<exact row job title>",
      "location": "<exact row location>",
      "url": "<canonical exact HTTPS posting URL>",
      "observedAt": "<actual ISO timestamp>",
      "quote": "<verbatim quote from this posting>",
      "proposedRawFields": {"WORK_ARRANGEMENT": "ONSITE", "REMOTE_HYBRID": "ONSITE"},
      "fieldQuotes": {"WORK_ARRANGEMENT": "<verbatim sentence that this job is onsite>"}
    }
  }]
}
```

The existing Programmed Coordinator picks up the finished file. It retains the input privately, rechecks frozen ownership and evidence against the live canonical row and posting, and sends only supported blank-field deltas through the existing Writer. The coordinator remains the authorized Writer actor; its record separately attributes the evidence to Hermes. Hermes never needs a Writer key, raw queue permissions, or a manual paste. Delivery is not proof of a write. No new facts is a no-op; Writer success is counted only through the normal receipt and independent readback.
