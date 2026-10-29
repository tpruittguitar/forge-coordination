# Employer board recovery

Tim approved repairs to the six failed employer-board checks on October 28, 2026. Discovery remains read-only. Intake policy, scoring, protected rows, source priorities and schedules are unchanged.

Verified public employer sources support four repairs:

* Radiant's former `greenhouse:radiant` is replaced by `ashby:radiant-industries`, linked by the employer's own career posting. The unrelated Ashby board named `radiant` is deliberately not used.
* Atotech's official careers page points to MKS `MKSCareersAmericas`, replacing the retired Atotech host/site.
* Challenge Manufacturing's official Job Openings link points to `challengemfg.wd503.myworkdayjobs.com/challenge-mfg_careers`.
* Otsuka's Workday page declares API tenant `vhr_otsuka`, although the public hostname uses `vhr-otsuka`. Workday 422 responses can now recover a validated tenant/site from public page configuration, without evaluating page JavaScript or guessing identifiers.

The evidence URLs are in `tools/source-trial/board-addresses.json`. Live read-only checks returned usable job arrays for all four. Charter's verified current endpoint still returns HTTP 500. Opella's endpoint returns HTTP 403 and its public root redirects to Workday maintenance. These are still unresolved employer-side conditions, not successful empty searches.

`board-health.js` retries only connection failures, HTTP 408/429 and temporary 5xx responses, with three total attempts and bounded waits. Access denials and broken addresses are not blindly retried. One broken endpoint does not get retried for every Workday search term. Partial or malformed answers cannot be recorded as fully successful.

The scanner saves each completed board check atomically to `state/board-health.json`, including last attempt, last successful check, error category, failure count and retry eligibility. A failed check retains the previous last-success timestamp. Due failures get bounded priority alongside the regular rotation; unread rotation entries retain their cursor. Failed boards remain queued across later reports even when they are no longer in that report's selected slice. Paused employers stay paused. Retry eligibility is a cooldown, not a promise of a new independently scheduled run.

The board workflow uploads and commits saved health even after a later step fails. Only the board workflow owns this history; the source-trial workflow that skips boards does not overwrite it. Malformed history stops the scanner rather than silently discarding pending sources. A board with no successful recorded check shows `Not yet recorded` in the GUI.

The Operations health panel consumes this durable history, lists unresolved employers, and exposes a table of each recorded board's current result, last attempt, last success and retry eligibility. Fresh durable history supersedes the older report's failure count; missing or stale history remains unknown. No software change can guarantee that an employer's restricted or unavailable service returns successfully.
