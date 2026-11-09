#!/usr/bin/env bash
# Run the committed pay tests in a disposable copy, never the runtime checkout.
# Genuine runtime ledgers/refusal proofs must still be preserved after failures.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
test_root="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/forge-pay-tests.XXXXXXXX")"
trap 'rm -rf -- "$test_root"' EXIT
git -C "$root" archive --format=tar HEAD | tar -xf - -C "$test_root"
cd -- "$test_root"
# Also isolate modules run.js materializes in the OS temp directory.
mkdir -- .test-tmp
export TMPDIR="$test_root/.test-tmp"
node --test tools/enrich-ats-pay/*.test.js
