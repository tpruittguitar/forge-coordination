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
