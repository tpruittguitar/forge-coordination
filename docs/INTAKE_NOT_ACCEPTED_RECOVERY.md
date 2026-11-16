# Request-scoped intake refusal recovery

`tools/relevance-screen/not-accepted.cjs` recognizes two forms of proven refusal:

- The existing exact, deployed-source-bound initial lock-timeout stack.
- The shared Writer outcome contract: request-bound `NOT_ACCEPTED`, `BEFORE_MUTATION`, zero master mutations, and retryable `WRITER_BUSY` or `WRITE_FENCE`, without any acceptance or partial-write marker.

Missing results alone are never proof. Both paths still require the original private payload and response to match their immutable checkpoint/acceptance hashes, a healthy current Writer status, a fresh explicit absent original request result, and a fresh independent receipt index with no original request entry. Every target must still have the original fence or a matching completed local recovery. Newer submissions cannot be released.

## Read-only eligibility

Call `inspect({root, privateDir, requestId, runId, deps})` with the same read adapters as recovery. It performs all checks, returns `{readOnly:true, eligible:<count>}`, and writes nothing. The result is a point-in-time observation, not authorization or proof that a later recovery can skip checks.

## Authorized local recovery

`recover(...)` repeats checks, verifies the shared production lock, and writes the immutable `_NOT_ACCEPTED.json` proof before releasing any local target. Structured evidence is a privacy-safe projection of the exact response, bound to its original response hash. It returns targets to fresh screening, not to an automatic retry. Original request IDs must never be replayed; any later eligible submission uses a new request after normal screening and Writer checks.

Other requests, pending original writes, their receipts, and unrelated ready work stay unchanged. This module does not disable global Writer safety checks, post to Writer, infer COMPLETE, or claim a master insertion. If an independent active fence remains, investigate it rather than overriding it.
