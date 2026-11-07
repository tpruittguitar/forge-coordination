# Private Writer client migration (prepared, not activated)

Public cockpit configuration is no longer a credential source for coordination.
`tools/source-intake/writer-connection.js` accepts `FORGE_WRITER_KEY` and, for
clients that construct their own requests, `FORGE_WRITER_URL`. Alternatively,
existing local runners may explicitly name their private data file with
`FORGE_CONNECTION_FILE`. Supported formats are a JSON object with string `key` and
`url` fields, or exactly `var PipelineConnection = <JSON object>;` with optional
whitespace and complete leading line/block comments (such as the generated header).
Comments inside JSON or after the object/wrapper are not supported. Duplicate/unknown keys and non-string values are rejected. Property names and strings must use JSON double quotes. Inline/suffix comments,
unquoted keys, getters, expressions and other executable JavaScript are rejected.
The file is parsed as data, never evaluated. Convert older executable configs
privately before activation; no private configuration was inspected or converted.
Environment values take precedence. Keep that file outside all published checkouts.
Existing enrichment/coordinator client fingerprints include the shared loader, so
connection changes participate in existing unchanged-client refusal checks.
No public file is searched, downloaded, or evaluated to discover credentials.
Errors omit values and private file contents, including rejected getter, asynchronous, and malformed input. Custom request endpoints must be
HTTPS execution URLs on script.google.com, without credentials, query or fragment,
and exactly match the existing canonical reader deployment. Its identity is parsed
from the reader’s local literal assignment without evaluating the module or copying
the deployment ID. Missing or ambiguous assignments fail closed.

Key-only clients: source-trial, process-flow, relevance prepare. Explicit key and
URL clients: enrich-ats-pay, applied-duplicates, relevance step/verify, programmed
coordinator. Existing writer-reader and its FORGE_WRITER_KEY interface are unchanged.
Its established endpoint remains unchanged; configure a write URL for that same
Writer deployment. This change does not introduce deployment selection for reads.

The relevance identity adapter copies only normEmployer, normTitle, normLocation,
sanitizeRecord and their pure constants/cleaner from foreman-cockpit Code.gs. It
uses the existing credential-free PipelinePolicy module from ACTIVITY_FC_DIR.
Its parity test checks exact definitions and behavior against a supplied cockpit
checkout, without evaluating Code.gs initialization or injecting runtime config.
Run it with ACTIVITY_FC_DIR pointing to the reviewed Writer checkout. A skipped
parity test is not a cross-repository compatibility pass. The existing enrich-ats-pay
CI test command now includes this guard using its existing cockpit checkout and
ENRICH_FC_DIR; no new credentials, schedules, or permissions are involved.

Writer companion: [foreman-cockpit #278](https://github.com/tpruittguitar/foreman-cockpit/pull/278),
sanitized source commit `ed9235670867c41da4c71718ff8abf09d9116def`.

## Remaining activation blockers

- The Writer companion's private Script Properties must be migrated/validated
  separately before its deployment. No configuration was created or changed here.
- Existing source-trial/board-discovery, enrich-ats-pay, and applied-duplicates
  workflows currently depended on public connection defaults. An authorized owner
  must supply the runtime key and, where applicable, URL through private runner
  configuration. Production workflows, secrets, schedules and access are untouched.
  Until configured, these clients fail closed before fetching source modules or
  making Writer calls. Do not merge expecting those scheduled runs to keep working.
- Local process-flow needs the key or explicitly selected private file. Existing
  programmed-coordinator/relevance private file input remains supported, provided
  its endpoint passes validation. No private file was inspected or migrated here.
- Historical Code.gs source retrieval for acceptance/recovery proofs is unchanged;
  these callers inspect revision source rather than executing the global runtime.
- No live requests, credential validation, deployment, or merge was
  performed as part of this local preparation. Fixture credentials are test-only,
  used with mocked transports, and never a missing-production-config fallback.
