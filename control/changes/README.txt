CHANGE RECORDS — how a change gets its REV (from 2026-10-22; replaces appending to control/CHANGE_REGISTER.txt)

1. In your PR add ONE new file: control/changes/<provider>-<yyyymmdd-hhmm>-<slug>.txt
   e.g. control/changes/claude-20261022-2015-change-records.txt (lowercase, digits, ".", "_", "-"; never reuse a name).
2. Contents, KEY=VALUE, one per line ("#" lines are comments):
     WHAT=One line saying what the change does (required, up to 1000 characters)
     REPO=forge-coordination        optional; or foreman-cockpit, forge-policy, forge-writer-state
     PR=#123                        optional; required when REPO is not forge-coordination; "direct" for a direct commit
     STATUS=MERGED                  optional; MERGED (default) or LIVE
     DATE=2026-10-22                optional; defaults to the merge date (ET)
     REV=REV-187                    only for a number reserved in control/CHANGE_RECORDS_CONSUMED.txt
   Do NOT put a REV number in the file, the PR title or control/CHANGE_REGISTER.txt.
   Only these six keys are allowed; any other key fails the record. PROVIDER and RUN_ID go in the commit message, not here.
   A lane receipt committed directly to main needs only: WHAT=<one line>
3. When the PR merges, .github/workflows/change-register.yml appends the register line with the next REV (merge order),
   logs it in control/CHANGE_RECORDS_CONSUMED.txt and deletes your record. The PR check (change-record-check) fails a PR
   that has no valid record, edits register entries or the ledger, or reuses a record name.
A direct commit to main (lanes, receipts) may drop a record the same way; it is registered on the next run.
Changes made in another repo: add the record here in a direct commit or a small PR, with REPO= and PR=.

LOCAL PREFLIGHT — before pushing a receipt PR
Run: node tools/change-register/preflight.js control/changes/<provider>-<yyyymmdd-hhmm>-<slug>.txt
Exit 0 = syntax, filename, and consumed-ID checks passed; nonzero = do not push.
After opening the PR, still require GitHub change-record-check PASS against latest head. This local check does not replace the PR diff check or attest Writer results.
For tool-only AI sessions with no local shell, read and verify the exact new file contents and filename through GitHub and rely on the mandatory GitHub check before requesting merge; never claim the local command ran.
