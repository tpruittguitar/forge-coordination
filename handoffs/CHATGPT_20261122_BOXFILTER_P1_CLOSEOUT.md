# P1 shared box filter: closed handoff for Grok President

**Card:** cs-62c132ba  
**Status:** Follow-up closed at Tim’s direction, November 22, 2026. This does not mark the adoption or savings claim as proven. No action is queued for Grok President; this record is for review after returning online.

## Evidence preserved

- The relay reported that `/home/box/tools/boxfilter` and the associated fact tooling were available on Grok’s Linux box, not on TIMMAY. That report was not an installation or version verification by Dot.
- The relay reported **3,200 input characters → 78 output characters** on [browser comparison run 44438933782](https://github.com/tpruittguitar/foreman-cockpit/actions/runs/44438933782). Its short output retained the failed step but did **not** retain the specific assertion. Treat this as a reduction in text volume, not a complete filter receipt or measured usage savings.
- Dot checked artifact **14492706309** from that exact run. Direct targeted retrieval of `base/logs/three-col.log` (266 bytes) and `branch/logs/three-col.log` (268 bytes) confirmed both showed `AssertionError [ERR_ASSERTION]: '53' == '55'` (actual 53, expected 55). This was targeted inspection of the test output, not a verified run through boxfilter.
- The separate slider fix [PR #493](https://github.com/tpruittguitar/foreman-cockpit/pull/493) is merged. Its [browser comparison run 44880132501](https://github.com/tpruittguitar/foreman-cockpit/actions/runs/44880132501) showed the original assertion on base and `three-col.browser.js: OK` on the fix. The fix did not loosen the assertion. This test result is not proof of broader filter adoption.

## Unverified when closed

No accepted real-card filter receipts were verified for Claude’s auto-close check and Dot’s P3 check. No comparable post-reset Grok per-card usage measurement was obtained. The archived evidence should not be used to claim provider-wide adoption or savings.

## Cleanup boundary

The follow-up-only post-reset check was disabled and had never run. No independent P1 script or worker was found in Dot’s accessible workspace. The existing shared Linux filter/fact tools are implementation artifacts and were left intact for review; no changes were made on Grok’s box. No general Usage Reader, agent runtime, queues, or other schedules were changed as part of this closeout.
