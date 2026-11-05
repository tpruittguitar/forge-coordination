# Per-request reconciliation

An interrupted POST is not an automatic failure or permission to replay. The scheduled AUTO intake now checks each pending request against the independent GitHub receipt index. COMPLETE entries bind exact row IDs through their own items, a matching captured acceptance, or a historical COMPLETE index revision for the same write ID. Current row identity is then checked read-only. Thinned/compacted index entries therefore no longer strand a proven completed request indefinitely.

Each resolution is a separate immutable proof bound to the original candidate hash. Original responses and uncertain intents are preserved. Mixed batches clear only proven individual cases; unresolved siblings retain their own fences. Mutation throughput is never increased by reconciliation.

Eight historical contention responses were separately audited against the deployed Writer source at commit 82a1daf911208dc7fb8f68ceffa65168c4419604. Their exact captured stack points to the initial waitLock before the master is opened or any mutation is attempted. The restricted contract names each response hash. Together with an independent absent receipt, this proves those specific attempts wrote nothing. Absence alone never proves a non-write. These cases are distinct from transport loss or arbitrary errors elsewhere in a Writer function.

A proven non-write can become eligible for normal fresh source review/admission. Existing/protected identity families remain held for review. No declined job is reopened. This audit performs zero Writer submissions.

Modern native automations sometimes write JSON into TERMINAL.txt files. Execution evidence now reads that format, validates immutable source-bound Gofer reviews and corroborates tracker capture counts against the programmed coordinator. Executed research is distinct from canonical resolution. Fresh message processing never certifies complete historical source-window coverage.
