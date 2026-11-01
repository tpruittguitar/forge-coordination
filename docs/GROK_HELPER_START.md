# Grok helpers — Tim 2026-11-01

Two evidence-only utilities are registered in the common automation registry. ChatGPT retains local coordination, all canonical Writer updates/verification and calendar/outcome persistence. No native schedule or automatic handback was created. The existing usage-reader schedule is unchanged.

## Start in Grok

Start two independent Grok chats/workers, with one launcher each:

PROVIDER=Grok TASK_KEY=FORGE_GROK_ENRICHMENT. Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<current-epoch> and follow the current shared registry/common contract and assigned utility procedure from one resolved main commit. Return the required access ACK first.

PROVIDER=Grok TASK_KEY=FORGE_GROK_APPLICATION_OUTCOME_HELPER. Read fresh https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt?cb=<current-epoch> and follow the current shared registry/common contract and assigned utility procedure from one resolved main commit. Return the required Gmail access ACK first.

## Activation / avoiding duplicate work

The enrichment assignment lists exact current research exceptions and excludes Claude-prepared evidence, cached complete postings, protected/closed jobs and pending requests. Its routingActive flag begins false. Grok first proves existing source access and returns its assignment/instruction revision. The coordinator validates the ACK against actual source evidence and enables research routing; Grok then takes its assigned IDs in successive evidence batches. Programmed calculations/cache lookups and Writer reconciliation remain local. No WIP/daily quota applies; a 20-item return is artifact size, not a processing ceiling.

The outcome assignment also begins inactive. ChatGPT covers the full mailbox until the coordinator validates an actual read-only Gmail ACK, records a cutover time, and binds hashes of already-owned ongoing threads. After activation, thread SHA-256 first byte modulo 2 = 1 is Grok research; even threads and retained ongoing threads stay with ChatGPT. The tracker still enumerates all messages, keeps delegated source pages/messages pending, and alone publishes event/cursor changes and Writer requests. No coverage is claimed from configuration or a helper seeing a message. A helper access failure explicitly returns ownership rather than silently expiring a lease.

Validate returned enrichment batches with tools/helper-routing/enrichment.cjs validate <file>; outcomes with tools/helper-routing/outcome.cjs validate <private-file>. Neither validator authorizes production. Recheck canonical job identity, saved decisions, original requests and raw evidence. Only the coordinator consumes accepted evidence and independently verifies writes. No missing-job insertion without Tim approval.

Do not transfer PC/Writer/Gmail credentials. If Grok lacks an existing connection, report MISSING_GMAIL_ACCESS or SOURCE_ACCESS_BLOCKED; do not sign in. Private correspondence, contact addresses, meeting details and raw quotes stay in authorized private evidence or the private Grok handoff. Public GitHub stores minimal non-sensitive facts/hashes only.
