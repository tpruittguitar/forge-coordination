# Recover the exact pay-cache bytes

## Failure

The repository's `state/** text eol=lf` rule treated compressed gzip parts as text.
`git add` removed carriage returns from incidental CRLF bytes in the gzip stream.
The original file and runtime artifact were valid; the published Git blob was not.
Subsequent pay runs correctly stopped with `Employer cache part checksum mismatch`.
The separate fixture-publication fix in [#326](https://github.com/tpruittguitar/forge-coordination/pull/326)
is retained unchanged.

## Exact recovery source

Restore only the 12 parts referenced by the unchanged current manifest from:

- [Run 42543555749](https://github.com/tpruittguitar/forge-coordination/actions/runs/42543555749),
  artifact `pay-runtime-42543555749`, artifact ID `13642672935`.
- ZIP SHA-256: `0ab6b02746d8990e29d3b9ae5f7a47ab935595b19dd09525d64e8cce808ac8f4`.
- Packed payload SHA-256: `51643fea81573c15a1b69a45e502861d12f5ad54edcae8416dffc02ce7cbb799`.
- Packed length: 49,778,237 bytes. 12,850 observations and 5,122 distinct bodies.

Every compressed part matches its filename's SHA-256 and declared decompressed
length. The concatenated payload matches the original length and SHA-256. The
artifact manifest exactly matches current main, so no cache observations, source
timestamps, facts, identities or manifest fields are changed. This is byte recovery,
not fresh research or evidence renewal. No report, ledger, refusal proof or other
artifact file is copied back.

## Prevention

The exact cache-parts path now uses Git's `binary` attribute, overriding the broad
text rule. `verify-cache-index.cjs` reconstructs the currently staged manifest and
its referenced staged parts and loads them through the production codec. It
checks regular-file index entries, size bounds, part names, checksums, lengths and
the complete packed payload before commit on every publication retry. A correct
working file cannot hide a corrupt staged blob. Original pending transaction
evidence and failure artifacts remain preserved.

Regression tests demonstrate the old text-rule corruption, exact binary staging
and checkout with `core.autocrlf=true`, detection of an un-staged repair, missing
parts, unsafe references and pre-commit verification inside the retry loop.

## Rollout and boundaries

Draft PR only. No merge, deployment, workflow dispatch, schedule change, Writer
request or transaction replay. After merge, verify the next ordinary pay run loads
the full cache and publishes a real current report. The old synthetic report is
not repaired by copying a historical report over it. A restored research cache
does not independently prove any past Writer outcome.

Retain the binary rule and staged verifier in any rollback. Reintroducing forced
text handling would corrupt future parts again. Keep all existing pending-write
and refusal evidence; do not replay requests to compensate for reporting failures.
