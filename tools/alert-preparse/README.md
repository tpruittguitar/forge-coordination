# alert-preparse

Deterministic pre-parser for two alert senders. It runs before a model screens the body.

Senders it parses:
- jobalerts-noreply@linkedin.com
- donotreply@jobalert.indeed.com

Rules:
1. Dedupe on job id (LinkedIn /jobs/view/<id>, Indeed jk=<16 hex>).
2. Keep the canonical job URL. Tracking parameters are removed.
3. Drop Indeed /pagead/ sponsored listings.

Every other sender, including jobs-noreply@linkedin.com, returns passthrough. The full body still has to be read.

Seen keys live in state/alert-seen-jobs.json and carry across runs.

```
python tools/alert-preparse/alert_preparse.py --seen state/alert-seen-jobs.json --input emails.json
```

emails.json is one object, a list, or JSONL. Each object has sender, body, and optional gmail_id.
Stdout is {"emails":[...],"stats":{...}}. For a parsed sender, screen kept[]. A dropped reason duplicate is OUT_OF_SCOPE DUPLICATE_ACROSS_ALERTS. A dropped reason sponsored is OUT_OF_SCOPE OTHER:SPONSORED_PAGEAD. JOBS_LISTED for that email is kept + dropped.
The command rewrites the seen file. Commit that file with the run when the runner can write the repo.
