# Keep pay test fixtures out of runtime publication

The November 9 pay [run 42574914287](https://github.com/tpruittguitar/forge-coordination/actions/runs/42574914287)
passed its tests and then failed enrichment on the employer-cache checksum. Its
always-run publication step nevertheless published a synthetic dry-run report:
`V2I-MIGRATION`, with the source `https://careers.example.org/parser-refresh`.
Those report figures are test data, not production results.

## Cause and prevention

`sourceRun` in `run.test.js` saved the current report before every invocation and
registered a cleanup hook for each saved copy. A test can invoke it repeatedly.
Because those hooks run in registration order, later hooks restored an earlier
fixture after the first hook restored the original report. The final production
run failed before replacing that report.

- Capture one output baseline per test and restore it once. Repeated synthetic
  runs no longer leave an intermediate report behind.
- The production workflow runs all pay tests in a disposable archive of the
  checked-out commit, outside the runtime checkout. Its temporary generated
  modules are isolated too. The test exit status is preserved and the disposable
  directory is removed on success or failure.
- Runtime artifacts and report/ledger publication still run after a live failure.
  Original pending-write fences and refusal proofs must not be dropped merely
  because enrichment failed. Tests cannot modify their publication inputs.

The regression suite checks repeated fixture restoration, both passing and failing
tests that overwrite every kind of publication input, synthetic refusal creation,
temporary-directory cleanup, and retention of real pending-request evidence. The
repeated-run regression fails with the old cleanup implementation.

## Verification and limits

Run the full `enrich-ats-pay-test` command with a `foreman-cockpit` checkout. After
committing changes, also run `ENRICH_FC_DIR=<absolute cockpit path> bash
tools/enrich-ats-pay/test-isolated.sh`; the isolated runner deliberately tests the
committed tree, not uncommitted edits.

This change neither restores corrupted cache parts nor rewrites the already
published synthetic report. Cache recovery is a separate repair. After both
reviewed changes merge, inspect the next ordinary run's live enrichment outcome
and report provenance. Do not treat an unchanged historical report or a passing
test step as current Writer results. No schedules, Writer requests, runtime state
files, merges or deployments are changed by this PR.
