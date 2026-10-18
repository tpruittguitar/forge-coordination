S117=r'''sec("11.7","Percentile Population & Band Snapshot",1)
POP=[("Population","Eligible <b>OPEN</b> jobs in the master (OPEN preset definition). Fixed — <b>never the current filter</b>, view or search."),
("Exclusions","STRICT FLEX / hard-blocked rows (shown ⊘ HOLD); applied, closed, declined, rejected, duplicates; rows with no score."),
("Denominator N","Count of the population at snapshot time. Shown wherever bands are explained: “rank among <b>N</b> eligible open jobs · as of HH:MM”."),
("Ranks","Percentile rank = share of the population scoring strictly below + ½ ties; band from rank: ≥ P90 top · ≥ P65 upper · ≥ P20 mid · else low."),
("Ties","Equal scores always take the <b>higher</b> band."),
("Minimum N","If N &lt; 40, bands are hidden: rows show the numeric score only, plus “bands need ≥ 40 eligible open jobs (now N)”."),
("Out of population","Applied / closed rows show the numeric score with “— not ranked (applied)” / “(closed)”; HOLD rows show ⊘ HOLD; never a band colour."),
("Snapshot","Atomic: <code>{modelRev, populationRev, N, cutP90, cutP65, cutP20, asOf}</code> published together; every view (table, ring, pins, compare, phone) renders from the same snapshot id. A new snapshot swaps in one frame — no split views, no arrival-order flashes."),
("Refresh","On model publish, evidence change or population change; at most once per 60 s otherwise."),
("Meaning","Bands are <b>relative rank</b>. The numeric score (absolute), fit and ⊘ HOLD stay visibly separate. The top band is never labelled “good fit”.")]
poph=''.join(f'<tr><td><b>{a}</b></td><td class="small">{b}</td></tr>' for a,b in POP)
page(f"""<div class="sec">Section 11.7 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Percentile Population &amp; Band Snapshot</h1>
<table class="tight" style="font-size:8.8pt"><tr><th style="width:110px">Rule</th><th>Definition</th></tr>{poph}</table>
<div class="grid2" style="margin-top:8px">
<div class="card bar-a small" style="margin:0"><b>Tokens hold ranks, not scores.</b> <code>--pe-band-rank-top: 0.90</code> · <code>-upper: 0.65</code> · <code>-low: 0.20</code>. Score cut-points are computed at runtime from the snapshot. Mock example only: N = 412, cut scores 61 / 54 / 38, top 76, median 48.</div>
<div class="card bar-l small" style="margin:0"><b>Live counts.</b> Stale-evidence and other counts (e.g. “◌ 185 of 603”) are computed live and always carry “as of HH:MM”; mock figures in this document are labelled. Nothing is hard-coded in KPI, settings or acceptance.</div></div>""","11.7 · Percentile Population & Snapshot")

sec("11.8","Accessibility Contract",1)
AC=[("Colour semantics","Meaning = <b>colour + unique glyph + word + position</b>. No state (success, failure, band, scope) conveyed by hue alone (WCAG 1.4.1). Replaces “one colour = one meaning”.","C#09"),
("Colour vision","Colours kept. Table cells and map hover cards show glyph + word: ▲ TOP · ◆ UPPER · ● MID · ▽ LOW · ⊘ HOLD. Protan / deutan / tritan simulations, greyscale and low-light screenshots are a <b>Phase 3 gate</b>.","C#10"),
("Non-text contrast","Meaningful indicators (bars, dots, borders that are a control\'s only boundary, focus) ≥ 3:1 against the adjacent surface (1.4.11), tested on real alpha composites, hover and selected states. Terminal Grey #5A5A5A is 2.67:1 on Plate → decoration only beside a word. Muted #6B6B66 never below large text — 11 px headers and the 9.5 px ◌ use Secondary.","C#11"),
("Flash","≤ 3 flashes / s measured on <b>whole-screen capture</b> during concurrent pulses, scanlines and failure shakes; a flash scheduler staggers them (≥ 400 ms apart) and drops extras.","C#12"),
("Focus","Persistent 2 px #E6E6E2 focus ring + 2 px Void offset on every interactive element (glyph actions, chart controls, map controls, swipe alternatives). Glow is never the focus indicator. Focus is never hidden under sticky overlays; restored to the invoking control when drawers or the map close. M-14 trace has keyboard-focus and touch-pressed equivalents.","C#13 · C#29"),
("Target size","Audit every icon, checkbox and table action: ≥ 24 × 24 CSS px or a valid spacing exception (2.5.8) on desktop; 44 pt on phone. No hidden overlap of hit areas.","C#14"),
("Focus order","Rail › queue › map › workspace. Selecting a row keeps focus on the row; Enter moves to the workspace heading. Fullscreen map: focus to ✕ Close, not a trap; Esc closes and returns focus to ⤢. Drawer close returns focus to the row.","C#15"),
("Glyph legibility","No glyph alone on a decision control: visible verb + accessible name (“⊖ Decline”, “✓ Pursue”). Legend in the help overlay. Misclicks and confusion recorded in the HF-14 baseline.","C#16")]
ach=''.join(f'<tr><td><b>{a}</b></td><td class="small">{b}</td><td class="label" style="font-size:7pt">{c}</td></tr>' for a,b,c in AC)
page(f"""<div class="sec">Section 11.8 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Accessibility Contract <span class="muted" style="font-size:11pt;font-weight:400">· WCAG 2.2 AA</span></h1>
<table class="tight" style="font-size:8.6pt"><tr><th style="width:96px">Area</th><th>Rule</th><th style="width:52px">Review</th></tr>{ach}</table>""","11.8 · Accessibility Contract")

'''
R('sec("12","Motion System")',S117+'sec("12","Motion System")')
S125=r'''sec("12.5","Selection Timeline, Loops & Ticker",1)
page(f"""<div class="sec">Section 12.5 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Selection Timeline, Loops &amp; Ticker</h1>
<pre style="font-size:8.2pt;line-height:1.45"><span class="c">JOB SELECTION · concurrency · total ≤ 700 ms p95 end to end (600+ rows)</span>
t=0      click / key / tap
frame 1  <span class="k">data rendered</span>: drawer values, ring number, row highlight, map pin — final + hit-testable
0–400    M-03 materialize (scanline + dissolve)       ┐
0–600    M-10 ring draw-on                            │ parallel, interruptible
0–300    M-04 auto-fit  <span class="k">300 ms on selection</span>              │
60–300   M-05 lock-on   <span class="k">240 ms</span>                         ┘
≤ 250    M-09 stagger total on selection; <span class="k">off</span> for bursts or sets &gt; 30 rows
≤ 700    <span class="k">settled</span> — measured from input to last frame, p95, in CI (T-28)</pre>
<div class="grid2" style="margin-top:6px">
<div class="card bar-a small" style="margin:0"><b>Loops stop within 5 s (WCAG 2.2.2).</b> “◷ Waiting for Writer lock” breathes for at most 5 s, then becomes <b>steady amber + seconds counter + next-retry time</b> (“◷ 12 s · next retry 15 s”). No loop anywhere runs past 5 s. Ticker is governed by B-16.</div>
<div class="card bar-l small" style="margin:0"><b>Event ticker (B-16 · C#04 / C#18).</b> Runs by default. Visible <b>❚❚ Pause / ▶ Resume</b> and <b>Hide</b> buttons (keyboard + touch, ≥ 24 px); choice persists locally; reading position kept on pause. Bot bursts deduplicated (same type within 60 s → one line “× n”) and throttled (≤ 1 new line / 4 s). Routine bot events muted. Secondary to the change strip.</div></div>
<div class="grid2" style="margin-top:8px">
<div class="card bar-g small" style="margin:0"><b>Attention budget (C#18).</b> The change strip is primary: grouped, clickable counts with causes. Ticker, row wipes and KPI rolls never compete for attention while a decision is open: during a decision the ticker freezes its scroll and new rows batch into the strip. Time-to-decision is measured with and without the ticker in HF-14.</div>
<div class="card bar-r small" style="margin:0"><b>Flash scheduler (C#12).</b> Confirm pulses, scanlines and failure shakes are queued globally: ≥ 400 ms apart, max 3 / s whole-screen; extras degrade to static state. Verified by whole-screen capture.</div></div>""","12.5 · Selection Timeline, Loops & Ticker")

sec("12.6","Reduced-Motion Equivalents (B-15)",1)
RM=[("M-01","Boot-up","No sequence: final layout at t = 0."),("M-02","Panel slide","120 ms opacity fade, no translate."),("M-03","Materialize","No scanline / dissolve: values appear at once; 120 ms fade on panel only."),("M-04","Auto-fit","Instant jump to final viewport (no pan / zoom tween)."),("M-05","Lock-on","Reticle + brackets drawn at final size; no rotation or collapse."),("M-06","Pin drop","Pins appear in place."),("M-07","KPI roll","Final value only; no rolling digits."),("M-08","Changed wipe","Static white Δ marker; no wipe."),("M-09","Row stagger","Off: all rows at once."),("M-10","Ring draw","Ring drawn at final value."),("M-11","Tab slide","Instant swap."),("M-12","Write states","Static glyph + word + seconds counter; no breathe, sweep or shake."),("M-13","Toast","Appears in place; same persistence."),("M-14","Hover trace","Static 2 px outline."),("M-15","Ticker","Static list of the last 5 events; manual advance."),("M-16","Fullscreen","Instant expand / collapse."),("M-17","Swipe","Card tracks finger; no spring-back animation; threshold haptic kept; buttons always offered."),("M-18","Publish progress","Step text “write ✓ · readback ✓”; bar snaps."),("M-19","Loading","Static “ACQUIRING…” label with brackets.")]
rmh=''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td></tr>' for a,b,c in RM)
page(f"""<div class="sec">Section 12.6 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Reduced-Motion Equivalents</h1>
<p class="small muted" style="margin-top:-2px">B-15: toggle in Local preferences, OFF by default; OS <code>prefers-reduced-motion</code> triggers a one-time prompt (“Your device asks for reduced motion — turn it on here?”), never a silent override. Reduced mode never delays information: every value is final at frame 1.</p>
<table class="tight" style="font-size:8.6pt"><tr><th style="width:40px">ID</th><th style="width:110px">Animation</th><th>Reduced equivalent</th></tr>{rmh}</table>""","12.6 · Reduced-Motion Equivalents")

'''
R('sec("13","Map System")',S125+'sec("13","Map System")')
S155=r'''sec("15.5","Grid Equation, Zoom & Mobile Insets",1)
page(f"""<div class="sec">Section 15.5 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Grid Equation, Zoom &amp; Mobile Insets</h1>
<pre style="font-size:8.4pt;line-height:1.5"><span class="c">ONE GRID EQUATION @ 2560 CSS px, 100 % zoom (C#19)</span>
W = margin 20 + rail 56 + railGap 12 + table T + gap 16 + map M + gap 16 + work K + margin 20
  + borders (6 × 1) + scrollbar S (0 overlay | 15 classic)
  → T + M + K = 2414 − S
tracks: grid-template-columns: 56px 12px minmax(980px, 1112fr) 16px minmax(640px, 800fr) 16px minmax(440px, 508fr)
        (flex tracks absorb borders + scrollbar; no clipping; fixed values are targets, not constants)</pre>
<table class="tight" style="font-size:8.8pt"><tr><th>Zoom</th><th>Effective width</th><th>Layout</th><th>Gate</th></tr>
<tr><td>100 %</td><td class="num">2560</td><td class="small">3 zones · 11 cols · ≥ 30 rows</td><td class="small">0 clipped cells</td></tr>
<tr><td>125 %</td><td class="num">2048</td><td class="small">3 zones · 11 cols (priority widths) · ≥ 22 rows</td><td class="small">0 horizontal scroll on priority cols</td></tr>
<tr><td>150 %</td><td class="num">1707</td><td class="small">map above workspace (1440 rule)</td><td class="small">nothing clipped mid-word</td></tr></table>
<div class="card bar-a small" style="margin-top:8px"><b>Mobile (C#20).</b> Layout reads <b>live</b> <code>env(safe-area-inset-*)</code> and orientation only — no model-specific hard-coded cut-outs; iPhone 18 Pro values are assumptions for mockups. Test both landscape rotations and desktop mode on <b>simulator and a real device</b>. Keep-out hatch colours in mockups are documentation only, never a runtime signal.</div>""","15.5 · Grid, Zoom & Mobile Insets")

'''
R('sec("16","Mobile Redesign — iPhone 18 Pro")',S155+'sec("16","Mobile Redesign — iPhone 18 Pro")')
