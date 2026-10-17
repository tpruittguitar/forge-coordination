Proposed state-write containment fix for foreman-cockpit (Pipeline Explorer Writer). PROPOSED — NOT DEPLOYED.
Review record: ../CLAUDE_20261017_0345ET_PIPELINE_EXPLORER_V1_5_REVIEW_SESSION.txt §3.
Run:   node --test stateMerge.test.js writeState.test.js        (expect 19 pass)
       node parity.js <foreman-cockpit>/pipeline-incidents.js   (expect 0 of 64 differ)
Status: developer evidence; independent invariant tests (gate G-1) pending.
Authority: this folder is the single copy of the code until a foreman-cockpit backup/claude-<time> branch exists;
then the branch is authoritative and this folder is marked superseded (kept for history).
Porting: paste mergeState_ and writeStateCore_ into Code.gs as plain functions; drop the require lines (V8 runtime).
Porting requirements (so the tests protect the live Writer, beyond this folder):
- Move stateMerge.test.js and writeState.test.js into foreman-cockpit/tests/ with the code.
- foreman-cockpit has `npm test` (node --test tests/*.test.js) but, as of main @ 16e7f18, its only workflow is
  unreviewed-push-alarm.yml; nothing runs the tests automatically. Add a workflow that runs `npm test` on PRs.
- Comment above writeState_ in Code.gs: "Lock, refuse-on-unreadable, .prev copy and readback prevent lost
  rulings/seen/incidents on multi-device writes. Function per FORGE_DIRECTIVE_Function_Over_Privacy_2026-10-17."
