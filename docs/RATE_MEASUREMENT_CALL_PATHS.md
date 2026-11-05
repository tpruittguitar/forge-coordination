# Rate measurement call paths

Audited 2026-11-05. WIP stock is never divided by the rate window.

| Producer/caller | Numerator and clock | Unit |
| --- | --- | --- |
| upstream-flow discovery | Captured candidate identities whose original first-seen timestamp falls in the selected 6/12/24/36 elapsed hours; known aliases merged, repeat sightings excluded, intake not required | candidates/hour |
| upstream-flow intake | Distinct master/archive job IDs with MASTER_LOADED_AT in that same window; missing timestamps are partial coverage | jobs/hour |
| process-flow enrichment | Distinct job IDs with observed enrichment-completion transitions in the selected window; baseline stock and partial updates excluded; short history/gaps partial | jobs/hour |
| activity discovery compatibility path | The same reconciled UPSTREAM_FLOW discovery rate, freshness checked independently; no automatic-source-only report reconstruction | candidates/hour |
| Writer receipt rates | Distinct job IDs from independently COMPLETE receipts in 36 hours; alias writes deduplicated and incomplete history marked partial. Receipt enrichment writes do not establish process-stage completion | receipt-observed jobs/hour |
| desktop badges / mobile summary | Shared window selector; current upstream rates preferred. Missing/expired discovery is unknown, not zero. Receipt-only intake cannot replace canonical admission history and stays unknown. No 36-hour fallback for 6/12/24-hour windows | stage-specific units |
| Writer queue hourly charts / peak | Arrived/finished Writer request counts per hourly bucket; a request may contain multiple jobs. Peak and its sparkline both use finished requests | requests/hour |
| Writer activity chart | COMPLETE master writes by verification hour; insert/update operations explicitly separate from unique jobs | writes/hour |

The discovery compatibility reader requires a reconciled capture snapshot, a timestamp no older than 30 minutes, candidate units, and count/window arithmetic consistency. Reappearing rolling source reports and absent email history cannot silently stand in for all-source discovery. Intake/enrichment rate denominators remain selected elapsed wall time; partial coverage is labeled rather than extrapolated into unobserved output.
