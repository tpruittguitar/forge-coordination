# PR #40 five-job canary — candidates APPROVED by Tim (2026-10-22)

**APPROVED:** Tim approved all five cases as drafted (chat, 2026-10-22). Approval flags are set in the JSON (`evidenceVerified`, `evidenceSource: INDEPENDENT_VERIFIED`, `businessEvidenceApproved`, plus an `approval` record). The canary has **not** been run and the release switch was **not** changed.

Drafted 2026-10-22 by Claude Code. **Read-only. Nothing has been submitted to the Writer.**
Machine-readable draft: `receipts/PR40_CANARY_CANDIDATES_DRAFT_20261022.json` (canary-cli format; approved).

## Data used (pulled 2026-10-22 23:02 UTC, GET-only through `writer-reader.read()`)
- Live Writer master: 1,677 rows (modified 22:52:20 UTC). Terminal archive: 785 rows, mode LIVE, not degraded.
- Canonical rules: ACTIVE, `forge-policy/rules/TIM_PIPELINE_RULES_CANONICAL.txt`, NC-001..NC-004, sha256 `876a618c…f1148fa2`.
- Writer status: `ok`, no freeze, no errors; one notice (2 queue requests FAILED on a Drive service error on 10-22 02:32 UTC, nothing written).
- Latest source trial: `FORGE-SOURCE-TRIAL-20261022T0500Z`.
- Every case was dry-run in order through the **Writer's own `planIntake`** (foreman-cockpit `Code.gs` `bb3327d`) on that live master + archive + rules, carrying predicted inserts forward.

## The five cases (proposed run order: no-ops first, then inserts)

| # | Expected | Role | Writer dry-run PREDICTION (nothing written) | Why this case |
|---|---|---|---|---|
| 1 | EXISTING_MATCH | BETA Technologies · Director of Supplier Quality · South Burlington, VT · REQ 4418953009 | EXISTING_MATCH → `V2I-9E30CCE0E70B` (SCOUT_INTAKE) by REQ_ID | Plain live master row; posting re-found by the 05:00Z board read |
| 2 | PROTECTED_NOOP | Anduril Industries · Deputy Head of Production, Autonomous Airpower (Fury) · Ashville, OH · REQ `GH-4962385007 / internal Req 5577` | EXISTING_MATCH → `V2S-ANDURIL-FURY-5577` (archive, REJECTED_BY_EMPLOYER) by REQ_ID; **without the archive the Writer would re-insert it** | Real resurfacing: posting still live (Greenhouse, updated 10-21) and listed as NEW in the 05:00Z trial |
| 3 | EXISTING_MATCH | Outrider · Senior Manager, Autonomous Vehicle Assembly Operations · Henderson, CO · REQ 5392330008 | EXISTING_MATCH → `V2I-029CE63ACABD` (APPLIED) by REQ_ID | Protected applicant state in the live master; posting re-found by the board read |
| 4 | NEW | Anduril Industries · Director of Production, Optics · Waltham, MA · Greenhouse 5268363007 | Predicted insertion as SCOUT_INTAKE (dry run only; not written; the real PRIMARY_ID is assigned at write time) | Director+, defense hardware; live posting updated 10-21 |
| 5 | NEW | nVent · Director of Manufacturing Automation · St Louis Park, MN · Workday R19232 | Predicted insertion as SCOUT_INTAKE (dry run only; not written; the real PRIMARY_ID is assigned at write time) | Director+, industrial electrical manufacturer; live posting (30+ days) |

**Correction (2026-10-22, independent QA):** every result above is a dry-run prediction from the Writer's `planIntake`, not a Writer transaction. Cases 4 and 5 are predicted insertions; only the live canary's COMPLETE receipts and exact row readbacks can show they were inserted. **Running the canary with 4 and 5 will add two real SCOUT_INTAKE rows to your master.** No Never Consider rule or review flag fired in the dry run for any case.

## Evidence per case (for your review)
1. **BETA Technologies** — electric aircraft and charging infrastructure manufacturer. Evidence: https://www.beta.team/ · master row `V2I-9E30CCE0E70B`.
2. **Anduril Industries (Fury)** — defense technology; employer's own posting text: autonomous military systems. Evidence: https://boards.greenhouse.io/andurilindustries/jobs/4962385007 · archive row `V2S-ANDURIL-FURY-5577`.
3. **Outrider** — autonomous yard-truck systems for logistics hubs. Evidence: https://www.outrider.ai/ · master row `V2I-029CE63ACABD`.
4. **Anduril Industries (Optics)** — posting: owns production of "precision optical assemblies for advanced defense systems". Evidence: https://boards.greenhouse.io/andurilindustries/jobs/5268363007
5. **nVent** — posting: "inventive electrical solutions"; role leads automation across manufacturing, assembly, packaging and distribution. Evidence: https://nvent.wd5.myworkdayjobs.com/nVent/job/St-Louis-Park-MN-US/Director-of-Manufacturing-Automation_R19232

Unknown salary, degree and FLEX are passed as `INITIAL_UNKNOWN_FIELDS` (PAY, DEGREE, FLEX); nothing is guessed.

## Candidates rejected while drafting
- **Anduril · Deputy Head of Production, Altius** and **Allen Control Systems · Director of Quality** — both trial NEW, but the Writer matches them to archived `REJECTED_BY_EMPLOYER` rows (`V2S-ANDURIL-ALTIUS-13697`, `V2I-D77DA5E3ABDA`). They would have broken the canary as "NEW".
- West Coast and Memphis roles were excluded by preference; staffing agencies and medical/life-sciences employers were avoided.

## Finding for the source trial
Of 142 provisional NEW roles in the 05:00Z trial, the Writer would treat **12 as existing archived roles** (9 board, 3 JobSpy) and 5 as WRITE_FAILED (weak identity). The trial's novelty check reads only the structured master, never the terminal archive, so it overstates NEW. Also, Never Consider did not flag medical/life-sciences employers (e.g. Baxter, Ecolab, Greiner Bio-One) when no employer-business text was supplied — the business evidence attached to each record matters.

## To approve (what changes in the JSON)
For each case you approve: set `evidenceVerified: true`, `evidenceSource: "INDEPENDENT_VERIFIED"`, `businessEvidenceApproved: true`, and `reviewedNeverConsider: false` stays `false` only if you confirm the employer is not a Never Consider business. `rulesHash` is bound to the rules above; the executor re-reads live rules and refuses a mismatch.

## Operating procedure (binding for the live run)
- **Durable recorder:** `canary-cli.js run` passes an fsync'd file recorder to the executor. The executor refuses to start unless the recorder passes a write/read-back check, and records and re-reads every Writer response before acting on it. If recording fails after a POST, the run halts UNKNOWN with the response attached; save it and reconcile — never retry by hand.
- **Kill switch scope:** setting `enabled=false` on `main` stops the **next** case. It cannot cancel a POST already in flight; that request must be reconciled through the receipt index (then `run` again) before anything else.
- **No blind retries:** any UNKNOWN or HOLD stops the canary; resume only with `canary-cli.js run`, which re-verifies from the receipt index first.
- **Re-check first:** re-run the read-only pull and dry run immediately before arming the switch.

## Pre-arm re-check (2026-10-22 23:32 UTC, read-only)
All five predictions held on a fresh pull (master 1,677 rows, archive 785, rules hash unchanged): cases 1–3 predicted no-ops on the intended IDs; cases 4–5 predicted insertions. Executor gate with this file stopped at the disabled switch with zero Writer calls. These are predictions, not transactions.

## Before the run (not done; nothing executed)
1. The kill switch is read from `main`; `control/SOURCE_INTAKE_RELEASE.json` exists only on the PR #40 branch. PR #40 must be merged (or the file placed on `main`) and set to `enabled: true, mode: "CANARY"` by you.
2. Re-run the read-only pull and dry run immediately before the canary — the master changes daily.
3. `FORGE_WRITER_KEY` in the operator's environment; then `canary-cli.js snapshot before → run (repeat after each verified halt) → snapshot after → finalize`.
