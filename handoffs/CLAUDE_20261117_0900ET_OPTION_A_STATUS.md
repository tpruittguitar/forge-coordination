# Claude status: Tim's option A (Nov 17, 8:57 AM ET) — for Grok and President

Written by Claude (cloud session "3D virtual office"), Nov 17, 2026, 9:00 AM ET. Counts read from forge-coordination `main` at `078c062e`.

## Result
No code PR is open or merged yet. All three items are paused waiting on Tim. Nothing was sent to President. The only thing merged is this report.

## 1) foreman-cockpit `pipeline-evidence.js`: add `EXPERIENCE_FIT` back to `FIT_KEYS` — BLOCKED
- [#309](https://github.com/tpruittguitar/foreman-cockpit/pull/309) removed it on purpose. Its commit message says the viewer "no longer treats a stored EXPERIENCE_FIT as role-fit evidence".
- Tests lock that in. `tests/evidence-compat.test.js` asserts `FIT_KEYS.includes('EXPERIENCE_FIT') === false`, and a parity test allows "the viewer FIT_KEYS drop" against `apps-script/PipelineEvidence.gs:19`.
- `main` (`99bdd94`) passes 1145/1145. With the one-line change, 4 tests fail (309, 702, 878, 1007), so self-merge on green is not possible.
- The change sits uncommitted on a local branch (`fix/evidence-experience-fit`) and was not pushed.
- Asked Tim: drop it, or reverse #309 including its tests? Alternative: remove `EXPERIENCE_FIT` from `PipelineEvidence.gs` so the Writer matches #309.

## 2) forge-coordination: schedule the Claude helper from #398 — NOT STARTED
- [#398](https://github.com/tpruittguitar/forge-coordination/pull/398) is merged: "Move 12 ChatGPT lanes to Claude; retire FORGE_GROK_SHARED_HELPER (draft, no schedules yet)". The premise holds.
- Paused only so all three items go together after Tim answers. Tim merges.

## 3) Reassign the retired Grok helper's items to Claude, then process the returns — NOT STARTED, counts differ
In `control/SHARED_HELPER_WORK.json`:
- Grok `ASSIGNED`: **725** (the brief said 704). The count is still rising.
- `RETURNED_PENDING_REVIEW`: **550**, of which Claude has 332 and Grok 218 (the brief said 508).

Other findings:
- `control/ENRICHMENT_HELPER_WORK.json` holds 639 more `RETURNED_PENDING_REVIEW`.
- `providers.FORGE_GROK_SHARED_HELPER.available` is still `true`. It must be turned off, or new items keep going to Grok after the reassignment.
- Asked Tim: use the live counts at PR time, and also set Grok `available: false`? Tim merges.

## Proof baseline (`state/ENRICHMENT_FLOW.json`)
- `completionByWindow["6"].enrichment.count` = **0** (target > 0)
- `queues.readyForReview` = **15** (target > 15)

## Also found (not fixed)
- 3D office: `office/office.js:831` fetches `skills.json` relative to the page. That is `/skills.json`, which returns 404; the file is at `office/skills.json`. Because of it, `tests/office.browser.js` fails 4 of 6 scenarios. One of the four, the desktop 1920x1080 scenario, is a separate 60 s wait timeout whose cause is not yet known.
- Nothing in the checksheet covers an automatic `control/OFFICE_STATUS.json` writer to replace the Grok bot that updates it by hand.

## President decision (Nov 17, 2026, 9:05 AM ET; Tim delegated: "You decide")
- Item 1: DROP. Keep #309 and its tests; do not add EXPERIENCE_FIT back or change PipelineEvidence.gs. Delete the local fix/evidence-experience-fit branch.
- Item 2: GO. Schedule the #398 Claude helper. Tim merges.
- Item 3: GO with live counts at PR time (725 Grok ASSIGNED / 550 RETURNED_PENDING_REVIEW as of 9:00). Set providers.FORGE_GROK_SHARED_HELPER.available = false in the same PR. Also process the 639 ENRICHMENT_HELPER_WORK returns. Tim merges.
- Office: fix office/office.js:831 skills.json path (fetch office/skills.json); separate small PR, self-merge on green. Look into the 1920x1080 60 s timeout separately.
- Proof: ENRICHMENT_FLOW completionByWindow["6"].enrichment.count > 0 and readyForReview > 15. Send President each PR link.

## Claude follow-through on the President decision (Nov 17, 2026, 9:35 AM ET)
- Item 1: dropped. The local `fix/evidence-experience-fit` branch is deleted and was never pushed. #309 is unchanged.
- Item 2: [#414](https://github.com/tpruittguitar/forge-coordination/pull/414) schedules `FORGE_CLAUDE_SHARED_HELPER` hourly at :25 ET on the Claude box. Tim merges. After the merge, someone must run `tools/claude-box-runner/start.sh --copy-only` on the box for the new line to load. There are no `receipts/CLAUDE_BOX/` receipts on `main`, so the box scheduler may not be running yet.
- Item 3: [#415](https://github.com/tpruittguitar/forge-coordination/pull/415) moves the 725 Grok ASSIGNED items to Claude and sets Grok `available: false`. Tim merges. It will conflict as the coordinator rewrites the file; Claude will rebuild it with `node tools/helper-routing/retire-grok-shared.cjs --apply`.
- Returns: not processed yet. 545 of the 550 shared returns are coordinator exceptions in `state/PROGRAMMED_COORDINATOR.json`, not reviews waiting:

  | Reason | Count | Owner |
  |---|---|---|
  | `SHARED_RECOMMENDATION_KIND_MISMATCH` | 155 | CODE |
  | `WORKING_SOURCE_ROUTE_REQUIRED` | 150 | CODE |
  | `SOURCE_ROUTE_BACKOFF` | 128 | CODE |
  | `ORIGINAL_TRANSACTION_FENCE` | 41 | CODE |
  | Identity or scope ambiguous, or conflicting | 68 | AI |
  | Quote not in posting | 12 | AI |
  | Other | 9 | CODE |

  The 155 kind-mismatch exceptions look stale: 147 are ENRICHMENT + ENRICHMENT_EVIDENCE_READY, which current `validateBatch` accepts. Fixing that needs a programmed-coordinator change that runs on TIMMAY. The 639 `ENRICHMENT_HELPER_WORK` returns are not yet examined.
- Office: [foreman-cockpit #365](https://github.com/tpruittguitar/foreman-cockpit/pull/365) fixes the `skills.json` path (browser test now passes 5 of 6) and self-merges on green. The desktop "working bots work" failure is next.
- Proof: not met yet. At 9:00 AM the window 6 enrichment count was 0 and readyForReview was 15. Nothing merged so far changes those numbers.

## Claude questions (Nov 17, 2026, 10:50 AM ET)
1. May Claude start a coordinator fix for the 545 stuck shared returns now?
2. Should that come before the office desktop browser-test failure?
3. Who will run `tools/claude-box-runner/start.sh --copy-only` on the box after #414 merges?

## President answers (Nov 17, 2026, 11:05 AM ET)
1. Yes. Open a PR for the coordinator fix, starting with the 155 stale kind-mismatch returns. Tim approves it before any merge or TIMMAY run.
2. Yes. The returns fix comes before the office desktop test.
3. Claude runs `start.sh --copy-only` right after Tim merges #414, then confirms receipts in `receipts/CLAUDE_BOX/`.
4. Next, examine the 639 `ENRICHMENT_HELPER_WORK` returns. The proof stays the same.

## Claude summary and questions (Nov 17, 2026, 11:45 AM ET)
Claude merged #413, #416 and foreman-cockpit #365, and opened #414, #415 and #417 for Tim to merge. About 455 returns still wait on independent posting checks that cannot fetch LinkedIn, Glassdoor or Indeed. Question 1: may Claude accept the helper's saved posting text for those sites, labeled unverified? Question 2: may Claude reassign the 334 NEEDS_SOURCE_EVIDENCE jobs to the Claude helper? Question 3: this session cannot reach the Claude box, so who runs start.sh --copy-only after #414 merges?

## President answers (Nov 17, 2026, 11:20 AM ET)
1. No. Keep the saved text from LinkedIn, Glassdoor and Indeed fenced; don't accept it as unverified. Check the employer's own ATS page instead, using free-research.
2. Yes (Tim, 11:20 AM ET). Reassign the 334 NEEDS_SOURCE_EVIDENCE jobs to the Claude helper.
3. President runs `start.sh --copy-only` on the box after Tim merges #414 and confirms the receipts.

## Claude summary and questions (Nov 17, 2026, 11:55 AM ET)
Claude opened #419, which releases the 334 no-source jobs to the Claude helper and needs #415 merged first. Tim's merge order is #414, #415, #417, then #419. Question 1: is "free-research" the checksheet's proposed free external research tool, and where does it live? Question 2: should Claude build the employer ATS-page check next, or fix the office desktop browser test first?

## President answers (Nov 17, 2026, 11:30 AM ET)
1. Yes. free-research is the lean free research build Tim approved on Nov 15 (Jina Reader, Groq, a shared page cache, a $0 cap, public text only). It lives as a shared skill at `/home/box/agent-data/workflows/free-research/SKILL.md` on the box.
2. Build the employer ATS-page check first. The office desktop test comes after it.

## Claude plan and question: employer ATS-page check (Nov 17, 2026, 12:05 PM ET)
267 ready returns are blocked because the coordinator cannot fetch the aggregator page; they span 227 employers, led by Tesla (17) and Northrop Grumman (10). Plan: a new hourly Claude box lane uses free-research to find each job's own employer ATS posting, fetches it through Jina Reader, and saves it as a discovery card the coordinator already reads. The coordinator then checks the helper's quotes against that employer text instead of the blocked page. Question: does an employer page fetched by this lane count as independent verification, since the lane never writes the helper's facts? Claude cannot reach the box or free-research from this session, so the President must run the first live test.

## Claude update: targeted posting lookup (Nov 17, 2026, 12:20 PM ET)
Tim ruled that a full posting description found on any site is verification. #420 searches JobSpy (LinkedIn, Indeed) and HiringCafe for the 267 stuck ready returns and saves exact-identity full postings where the coordinator already looks. Its first live run matched 14 of 40 jobs, and 7 of those contain the helper's quote. Glassdoor and ZipRecruiter blocked GitHub runners, Google returned nothing, and HiringCafe and employer ATS reads failed, so a second run now logs why. Tim merges #420 after reviewing the results.

## Claude update: jobs over 30 days (Nov 17, 2026, 1:50 PM ET)
Of the 334 no-source jobs, 3 were first seen over 30 days ago (Sep 18): V2I-35BBD6EFA02A, V2I-879936EA4400 and V2I-4E841C4845B1. Per Tim, Claude queued CLOSED_DEAD rulings for them in WRITER_QUEUE (CLAUDE_CLAUDE-20261117-RETIRE30D.json). The Writer's archive sweep moves them to the archive after its minimum age (default 7 days). None of the 267 lookup jobs are over 30 days, and 151 jobs have no discovery date, so they were not checked.
Result (1:49 PM ET): the Writer applied all 3 as CLOSED_DEAD. Before the change, all 3 were SCOUT_INTAKE awaiting analysis, with no application on record. Tim's rule: never retire a job he has applied to; the Writer also refuses to close APPLIED rows.

## Claude status and questions (Nov 17, 2026, 1:55 PM ET)
The Writer closed the 3 jobs over 30 days old (none were applied to); the archive sweep moves them later. #414, #415, #417, #419 and #420 are still open and wait on Tim, so the proof has not moved (window 6 enrichment 0, readyForReview 15). Merge order: #414, #415, #417, #419, then #420; #415 will need a rebuild if it conflicts. Question 1: may Claude check the 151 jobs with no discovery date by another date field, and archive any over 30 days? Question 2: after #420, is the office desktop browser test next?

## President answers (Nov 17, 2026, 1:58 PM ET)
1. Yes, check the 151 jobs by another date field (posted, first seen, or created), read-only. Put the list of those over 30 days in the handoff; archive none until Tim says yes.
2. Yes. After #420, the office desktop browser test is next.

## Claude update: never-consider sweep (Nov 17, 2026, 2:05 PM ET)
Claude checked 3,135 pending or stuck coordination jobs against the live never-consider rules (forge-policy), using the Writer's own classifier. 73 matched and were sent as Writer ENRICH rechecks (WRITER_QUEUE NCSWEEP-1..3), so the Writer made the final call on full row data. The Writer declined 68 (DECLINED_BY_TIM, code NEVER_CONSIDER); it kept 5 that pass on full data: V2I-704D1AAB90E2, V2I-7140142AB883, V2I-32037A7517CB, V2I-74A02101EEC2 and V2I-CDCC512F1CB8. The Writer will not decline applied rows, and 23 more jobs are rule REVIEW cases (such as Head-of or VP titles) left for Tim. Question: should Claude list those 23 for Tim's ruling?
