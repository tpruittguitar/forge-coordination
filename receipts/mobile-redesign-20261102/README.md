# Mobile redesign screenshots: Stage 5 review (2026-11-02)

For Grok Bot GUI and Tim. Branch `feat/mobile-pipeline-explorer` at `167543b`, PR tpruittguitar/foreman-cockpit#253 (draft).
Taken in a Claude Code cloud session on scrubbed test data (company names are placeholders), with a local test server and a
local stand-in for the Writer. All traffic to the production Writer was blocked, and the block was checked before any run.

Direct image links: `https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main-ed62bb/receipts/mobile-redesign-20261102/<file>`

## Why some banners show (test data, not live state)
- **"✕ SYS FAULT"** in the phone header: the test serves no health or incident feed, so the system readout shows a fault.
- **"? Decision queue loading: showing only jobs marked Needs decision."**: Stage 5's new queue state. The test serves no
  `/api/pipeline-health`, so the decision-ready index never loads. Decide falls back to rows marked `TIM_DECISION_REQUIRED`
  and says so. After 60 s, or on an error, it changes to "unavailable" with a Retry button. See the bug below.

## Phone, 390×844 unless named
| File | Stage | Shows |
|---|---|---|
| `stage2-decide-390x844.png`, `stage2-decide-375x667.png`, `stage2-decide-844x390.png` | 2 | Phone frame at three sizes |
| `stage2-more-390x844.png`, `stage2-more-over-decide-390x844.png` | 2 | More sheet |
| `stage3-decide-390x844.png` | 3 | Decide: **All · 8 / Act now · 7** (one test job, a Director role in Memphis, TN, is not Act Now) |
| `stage3-decide-act-now-390x844.png` | 3 | Act now chip pressed after earlier decisions in the test: **All · 3 / Act now · 2**, Memphis card left out. A "Hold queued" toast from the previous step is still on screen |
| `stage3-undo-toast-390x844.png` | 3 | "Pursue queued" with Undo |
| `stage3-detail-390x844.png` | 3 | Full-screen job detail |
| `stage3-no-writer-phone-390x844.png` | 3 | "⚠ NO WRITER" header and Decide banner |
| `stage4-jobs-390x844.png`, `stage4-fields-390x844.png`, `stage4-jobs-landscape-844x390.png` | 4 | Jobs list, Fields sheet, landscape table |
| `stage4-status-390x844.png` | 4 | Status (its "4 need decision" uses a different test data set than Decide; the test checks the two counts match on the same data) |
| `stage5-retry-stuck-390x844.png` | 5 | **Bug:** after a failed Retry, the button stays disabled on "Retrying…" |

## Desktop, 1440 wide
| File | Shows |
|---|---|
| `stage3-no-writer-desktop-1440x900.png` | Header crop with no Writer connected: a single orange "WRITER ⚠ OFF" |
| `branch-desktop-first-visit-header-1440x120.png` | The same state, from the comparison run |
| `main-desktop-connected-1440x900.png` vs `branch-desktop-connected-1440x900.png` | Full page, connected: **0 differing pixels** |
| `main-desktop-connected-header-1440x120.png` vs `branch-desktop-connected-header-1440x120.png` | Header crop, connected: **0 differing pixels** |

The left menu panel covering "PIPELINE" and the start of the banner looks identical on `main`, so it's an existing issue,
logged as tpruittguitar/foreman-cockpit#254. It doesn't block this branch.

## Open items before merge
1. **Rerun on Tim's desktop.** In the cloud container, 14 browser tests also fail on `main` (`derived-refresh`, `incidents`,
   `map-popup`, `map`, `mobile`, `pay-worth`, `phone-columns`, `phone-drawer`, `phone-sheet`, `pr70`, `progress`,
   `scoring-publish`, `three-col`, `ui`). That they fail only because of the container (Playwright 1.63 instead of the pinned
   1.61.1, fonts, no map tiles) is **not confirmed**. They must pass on the desktop before merge.
2. **Stage 5 Retry bug:** the fix isn't applied yet, pending Tim and Grok's Stage 5 review.
