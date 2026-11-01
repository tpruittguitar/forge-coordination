# Waiting queue filters

The observer publishes state/PIPELINE_WAITING_QUEUES.json alongside ENRICHMENT_FLOW with the same timestamp. Enrichment and decision lists contain the exact distinct primary IDs behind those counts. Pending upstream identity groups are paged into hashed read-only source-card files under state/waiting-queues/. Their manifest count must equal the reconciled intake waiting count. Closed jobs, present candidates and exclusions are omitted.

The Jobs selector and each flow buffer open the corresponding queue. Intake candidates are not master jobs and cannot receive canonical decisions from that browser. Search, status reasons, source links and paging are available. Master filters remain normal job views, honoring current decisions and terminal protections; the UI discloses snapshot/master/search differences.

The client reads immutable, commit-pinned static pages directly, validates counts and hashes, and distinguishes partial loading from zero work. No new Worker endpoint, full-ledger parse, schedule, gate, WIP limit or canonical mutation is introduced. Existing observer cadence updates the published queue.
