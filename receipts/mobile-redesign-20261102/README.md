# Mobile redesign screenshots: Stage 5 review (2026-11-02)

For Grok Bot GUI and Tim. Branch `feat/mobile-pipeline-explorer` at `80c75e7`, PR tpruittguitar/foreman-cockpit#253 (draft).
Taken in a Claude Code cloud session on scrubbed test data (company names are placeholders), with a local test server and a
local stand-in for the Writer. All traffic to the production Writer was blocked, and the block was checked before any run.

Direct image links: `https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main-ed62bb/receipts/mobile-redesign-20261102/<file>`

## Changes since the first review set (all from the Stage 5 review)
- **Retry fixed** (`7271ecd`). A retry in flight shows a disabled "Retrying…". When it settles the button is "Retry" again, and a
  failed retry says, before the button: "Retry failed at h:mm AM ET (reason). Last successful load: h:mm AM ET" (or "never").
  Test: `tests/mobile-queue-retry.browser.js`. It fails on the old code.
- **Act now order fixed** (`22953d4`). The new Act Now rules test found that the phone re-sorted Act now by score, so Shield AI
  came last. Act now now keeps the shared Act Now order (Shield AI first), and its header reads "Order: Act now".
  Test: `tests/mobile-act-now.browser.js` (Shield AI first, Memphis out, a decided role out at once and after a reload).
- **Fit glyph** (`7135638`). Fits of 70+ are green "✓ Fit 79" (table "✓ 79"), so every fit badge has a glyph.
- All phone screenshots below were retaken at `7135638`.

## Queue display fixes (`80c75e7`, Tim's Stage 5 review)
- Queue failed to load: "— need you", chips "All · —" / "Act now · —"; header "⚠ QUEUE DOWN" in orange. See `stage5-queue-down-1e216c4-390x844.png` (on `1e216c4`: the middle icon is now the same orange ⚠ as the header; `stage5-queue-down-80c75e7-390x844.png` is the previous version with a yellow "?").
- Older queue shown after a failed refresh: header "? QUEUE STALE" in yellow; banner "Showing queue from 9:49 AM ET. Refresh failed (server error). Retry".
  See `stage5-queue-stale-390x844.png`. After a failed retry the banner says "Retry failed at … ET (server error)" (`stage5-retry-stale-failed-390x844.png`).
- Strong fit close-up: `stage5-fit-strong-card-390.png` ("✓ Fit 79" in green beside "? — est. pending").
- Times in these screenshots are the test run's clock in ET.

## Why some banners show (test data, not live state)
- **"✕ SYS FAULT"** in the phone header: the test serves no health or incident feed.
- **"? Decision queue loading: showing only jobs marked Needs decision."**: the test serves no `/api/pipeline-health`, so the
  decision-ready index never loads, and Decide says it is showing only `TIM_DECISION_REQUIRED` rows.

## Phone, 390×844 unless named
| File | Shows |
|---|---|
| `stage5-retry-failed-390x844.png` | **Fixed:** "Decision queue unavailable", "Retry failed at … ET (Queue snapshot HTTP 503). Last successful load: never.", and an enabled Retry button |
| `stage5-retry-stale-failed-390x844.png` | **Fixed:** older queue still shown; banner gives the failed retry, its reason, the last successful load time (ET), then Retry |
| `stage5-retry-stuck-390x844.png` | *Before the fix* (`6225505`): the button stuck on "Retrying…" |
| `stage5-act-now-rules-390x844.png` | Act now: Shield AI first (though not top score), no Memphis role, "Order: Act now" |
| `stage3-decide-390x844.png` | Decide: All · 8 / Act now · 7; strong fit "✓ Fit 79" in green next to a yellow "~ Fit 67" |
| `stage3-decide-act-now-390x844.png` | Act now chip pressed after earlier decisions in the test: All · 3 / Act now · 2, Memphis job left out |
| `stage3-undo-toast-390x844.png` | "Pursue queued" with Undo |
| `stage3-detail-390x844.png` | Full-screen job detail |
| `stage3-no-writer-phone-390x844.png` | "⚠ NO WRITER" header and Decide banner |
| `stage4-jobs-390x844.png`, `stage4-fields-390x844.png` | Jobs list and Fields sheet |
| `stage4-jobs-landscape-844x390.png` | Landscape table: Fit cells "~ 67", "✓ 79", "✓ 71" |
| `stage4-status-390x844.png` | Status (different test data set than Decide; the test checks the counts match on the same data) |
| `stage2-*.png` | Phone frame at 390×844, 375×667, 844×390, and the More sheet |

## Desktop, 1440 wide
| File | Shows |
|---|---|
| `stage3-no-writer-desktop-1440x900.png`, `branch-desktop-first-visit-header-1440x120.png` | No Writer connected: a single orange "WRITER ⚠ OFF" |
| `main-desktop-connected-1440x900.png` vs `branch-desktop-connected-1440x900.png` | Full page, connected: **0 differing pixels** |
| `main-desktop-connected-header-1440x120.png` vs `branch-desktop-connected-header-1440x120.png` | Header crop: **0 differing pixels** |

Retaken at `d11b7de`: still 0 differing pixels when connected. On first visit (no Writer saved), 437 pixels differ, all in the header
strip at x 522–660, y 9–46. That is the approved Stage 3 "Writer ⚠ off" badge and the search field next to it, which is drawn
slightly narrower. The left menu panel covering "PIPELINE" and the start of the banner is identical on `main`, so it's an existing
issue, logged as tpruittguitar/foreman-cockpit#254. It doesn't block this branch.

## Browser suite: branch vs main
Run by the `browser-tests-compare` GitHub Actions workflow on PR #253. It runs every browser test on the branch and on `main` in
the same runner, with the Writer hosts blocked, and posts a side-by-side table in the run summary. Tests that fail on both
are existing failures; a test that passes on `main` and fails on the branch is a regression.
