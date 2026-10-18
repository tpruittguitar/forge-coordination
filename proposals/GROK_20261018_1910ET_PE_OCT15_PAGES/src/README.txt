Grok Bot · Oct 15 look pages for F02 r3 review · PROPOSED · 2026-10-18 19:10 ET
Built on foreman-cockpit backup/claude-20261018-1805ET @ c69a9f02b9a1ee01702d5ee3649e57a45e3ab5a2 (rev3). Nothing here is committed.

Put this folder at tests/visual/oct15/ in a checkout of that commit, then serve the repo root:
  node tests/visual/oct15/build-oct15.cjs            # rebuilds fx-*.json with pipeline-scoring.js scoreRow + model rev 24
  python3 -m http.server 8765 --bind 127.0.0.1
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=2560,1440 --font-render-hinting=none --disable-lcd-text --virtual-time-budget=6000 \
    --screenshot=OUT.png http://127.0.0.1:8765/tests/visual/oct15/<page>.html
  (phone: --window-size=402,874 --force-device-scale-factor=3 on M01-phone.html)
  Append ?measure to any frame page to dump column widths / truncation and header widths into <pre id=out> (--dump-dom).

Files
  oct15.js / oct15.css   fork of rev3 F02-job-selected.js + a layer over golden.css: the R3 corrections (C-01..C-16 in the verdict).
                         window.PAGE selects fixture, mode (selected | empty), variant (agency | closed | applied), header state.
  build-oct15.cjs        scenario fixtures: rev3's 50 rows + one extra row each (agency JOB-0588, closed JOB-0381, applied JOB-0431);
                         fixes the breakdown largest-remainder rounding (C-08); adds fx.oct15.* fields for the values rev3 typed (C-15).
  needs-you.json         M-01 items: NEEDS_TIM snapshot 2026-10-18 17:47 ET + live checks (same data as look-owner P01, 18:30 ET);
                         job counts are recomputed from fx-closed.json by ny.js / M01-phone.html.
  map-f01.json           filtered-view projection (auto-fit to all mapped rows + HOME), from build15/us-states.json.
  Uses repo files: tokens.css, tests/visual/golden-src/golden.css, pe-icons.js, fonts/, tests/visual/fixture/{model-rev24.json, fixture.json, build-fixture.cjs, map-f02.json}.
