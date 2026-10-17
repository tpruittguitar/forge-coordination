Proposed state-write containment fix for foreman-cockpit (Pipeline Explorer Writer). PROPOSED — NOT DEPLOYED.
Review record: ../CLAUDE_20261017_0345ET_PIPELINE_EXPLORER_V1_5_REVIEW_SESSION.txt §3.
Run:   node --test stateMerge.test.js writeState.test.js        (expect 19 pass)
       node parity.js <foreman-cockpit>/pipeline-incidents.js   (expect 0 of 64 differ)
Status: developer evidence; independent invariant tests (gate G-1) pending.
Authority: this folder is the single copy of the code until a foreman-cockpit backup/claude-<time> branch exists;
then the branch is authoritative and this folder is marked superseded (kept for history).
Porting: paste mergeState_ and writeStateCore_ into Code.gs as plain functions; drop the require lines (V8 runtime).
