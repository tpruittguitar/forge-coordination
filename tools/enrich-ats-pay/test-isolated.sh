#!/usr/bin/env bash
# Run the committed pay tests in a disposable copy, never the runtime checkout.
# Genuine runtime ledgers/refusal proofs must still be preserved after failures.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
test_root="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/forge-pay-tests.XXXXXXXX")"
test_tmp="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/forge-pay-tmp.XXXXXXXX")"
trap 'rm -rf -- "$test_root" "$test_tmp"' EXIT
git -C "$root" archive --format=tar HEAD | tar -xf - -C "$test_root"
cd -- "$test_root"
# Also isolate modules run.js materializes in the OS temp directory.
export TMPDIR="$test_tmp"
node --test tools/enrich-ats-pay/*.test.js
