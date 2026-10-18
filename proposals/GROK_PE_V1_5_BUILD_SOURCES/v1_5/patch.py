L=open('/workspace/pe/build/gen.py').read().split('\n')
head='\n'.join(L[:269]); tail='\n'.join(L[359:])
new=open('/workspace/pe/build13/new_sections.py').read()
s=head+'\n'+new+'\n'+tail
def R(a,b,cnt=1):
    global s
    n=s.count(a); assert n==cnt,(n,a[:80]); s=s.replace(a,b)
# CSS: landscape pages
R(".page:last-child{",".page.land{page:land;width:11in;height:8.5in;padding:0.55in 0.5in 0.7in 0.5in}\n.page.land .hdr,.page.land .ftr{left:0.5in;right:0.5in}\n.page:last-child{")
R("@page { size: 8.5in 11in; margin: 0; }","@page { size: 8.5in 11in; margin: 0; }\n@page land { size: 11in 8.5in; margin: 0; }")
R("def page(body,hdr): pages.append((body,hdr))","def page(body,hdr,land=False): pages.append((body,hdr,land))")
# cover
R('<div class="num" style="font-size:20pt">14</div><div class="muted small">HF-01 – HF-14</div>','<div class="num" style="font-size:20pt">18</div><div class="muted small">HF-01 – HF-18</div>')
R('<div class="num" style="font-size:20pt">5</div><div class="muted small">Baseline → Adaptive</div>','<div class="num" style="font-size:20pt">5 + M</div><div class="muted small">Baseline → Adaptive + Mobile track</div>')
R('<div>1.2 <span class="muted">(supersedes 1.1 consolidated)</span></div>','<div>1.3 <span class="muted">(supersedes 1.2)</span></div>')
R('<div class="label">New in 1.2</div><div class="muted" style="font-size:10pt">Color system · detailed implementation plan · design tokens · cockpit concept mockup</div>','<div class="label">New in 1.3</div><div class="muted" style="font-size:10pt">Motion system · map as primary panel (targeting style retained) · 2560 × 1440 cockpit · iPhone 18 Pro redesign · HF-15 – HF-18</div>')
R("Turning a job-listing dashboard into a decision-support cockpit: high information density, low cognitive friction, explicit evidence, and absolute clarity about system state.","Turning a job-listing dashboard into a living decision-support cockpit: high information density, rich purposeful motion, a prominent tactical map, explicit evidence, and absolute clarity about system state.")
# changes page after TOC
R('page("__TOC__","Contents")\n','''page("__TOC__","Contents")
CH=[("1","Animation — rich motion","“Short purposeful animation only” withdrawn everywhere. New standard: animate anywhere it makes a little sense. Full Motion System: named duration / easing tokens, 17-item catalog, guardrails (never blocks input, never hides state, 60 fps GPU-only, Reduce motion toggle off by default). Principles and research updated: high motion is an operator design-authority decision.","11 · P7 · 04 · 09 · HF-15","{{11}}"),
("2","Map is back and prominent","Permanent primary panel, not a tab: score-band pins, clusters, radar sweep, Chattanooga range rings, two-way selection sync, hover cards, filter reflection. Old exit / zoom issues fixed with expand-to-focus + clear Collapse.","12 · HF-06 · HF-16","{{12}}"),
("2a","Map look retained","Addition from Tim: the current military targeting look is retained as design authority and only enhanced — reticles and crosshairs, lock-on, grid overlay, coordinate readouts, range rings, HUD corner brackets, radar. Applied to desktop and mobile maps.","12 · 13.4 · 14.2","{{12}}"),
("3","Desktop target 2560 × 1440","Three-zone cockpit: full 11-column table (31 rows, no horizontal scroll), large live map centre, selected-job workspace right, KPI tiles + change strip top, event ticker bottom. Grid, column widths and type scale specified; mockup redone at 2560 × 1440 proportions on a landscape page.","13 · HF-17","{{13}}"),
("4","Mobile redesign — iPhone 18 Pro","Separate design (assumed 402 × 874 pt): KPI strip, swipeable cards (→ Pursue, ← Hold, long-press Decline + confirm + Undo), tab bar, full-bleed map + bottom sheet, haptics; landscape split view; desktop-mode switch with persistent state. Four+ mockups.","14 · HF-18","{{14}}"),
("5","Plan, tokens, requirements","Motion + map tasks added to Phases 2 / 3 (Phase 1 integrity still first); 2560 layout tasks; new Mobile track M; tokens add motion, breakpoints and layout; HF-15 – HF-18 added; HF-01 – HF-14 and acceptance targets kept.","07 · 15 · 16","{{15}}")]
sec("R","Changes in v1.3")
chh=''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td><td class="label" style="font-size:7.5pt">{d}</td><td class="num" style="text-align:right">{e}</td></tr>' for a,b,c,d,e in CH)
page(f"""<div class="sec">Revision</div><h1>Changes in v1.3</h1>
<p class="small muted" style="margin-top:-4px">Critiques from Tim Pruitt (owner), applied as binding design authority. Tim likes v1.2 generally; everything not listed here is unchanged.</p>
<table class="tight"><tr><th style="width:30px">#</th><th style="width:130px">Critique</th><th>What changed</th><th style="width:104px">Where</th><th style="width:34px;text-align:right">Pg</th></tr>{chh}</table>
<div class="grid2" style="margin-top:10px">
<div class="card bar-r small" style="margin:0"><b>Withdrawn / superseded.</b> “Short purposeful animation only” (v1.2 §09); the 120 ms single motion token; “nothing else glows”; map as a tab; the 1280-class cockpit mockup (v1.2 §10.6), replaced by the 2560 mockup (§13).</div>
<div class="card bar-g small" style="margin:0"><b>Unchanged.</b> HF-01 – HF-14, acceptance targets (new rows only added), colour palette, signal meanings, Phase 1 integrity first. Status stays <b style="color:var(--amber)">PROPOSED</b>: no code, backlog or deployment authorized.</div></div>""","Changes in v1.3")
''')
# principles
R('("P6","Operator control","Adaptive features recommend and organize; never silently override or rearrange.")]','("P6","Operator control","Adaptive features recommend and organize; never silently override or rearrange."),\n("P7","Living, truthful HUD","<b>Operator design-authority decision (v1.3):</b> rich motion wherever it helps — sliding, sweeping, materializing — running alongside instant actions and never hiding true state.")]')
# research
R('("NN/G data tables","Dense professional tables are correct for find / compare / act on multivariate records.")]','("NN/G data tables","Dense professional tables are correct for find / compare / act on multivariate records."),\n("Motion (operator decision)","Tim explicitly chose a <b>high-motion HUD</b> as a design-authority decision (v1.3). Motion aids attention, continuity and change detection (NN/G animation guidance); guardrails keep it from blocking input, hiding state or flashing (WCAG 2.3.1).")]')
R('"Map tab full-screen with no clear exit; opens at 600% zoom."','"Map tab full-screen with no clear exit; opens at 600% zoom. <span class=\'muted\'>(v1.3: fixed by HF-16 — permanent panel.)</span>"')
# hierarchy & requirements
R('sec("06","Information Hierarchy"); sec("07","Requirements HF-01 – HF-14")','sec("06","Information Hierarchy")')
R('"06–07 · Hierarchy, Requirements")','"07 · Requirements")')
R('("HF-14","Usability baseline before any change","P0")]','("HF-14","Usability baseline before any change","P0"),\n("HF-15","Motion system: tokens, catalog, guardrails","P2"),\n("HF-16","Map as permanent primary panel (targeting style kept)","P1"),\n("HF-17","2560 × 1440 primary desktop layout","P2"),\n("HF-18","Mobile redesign: portrait / landscape / desktop-mode","P2")]')
R('"HF-12":"4"}','"HF-12":"4","HF-15":"2–3","HF-16":"2–3","HF-17":"3","HF-18":"M"}')
R('<div class="sec" style="margin-top:14px">Section 07</div><h1 style="font-size:17pt">Requirements</h1>','<div class="hull bar-l small" style="margin-top:4px"><b>Layers mapped to the v1.3 cockpit</b></div><table class="tight"><tr><th style="width:80px">Layer</th><th style="width:190px">Desktop 2560 zone</th><th>Phone (portrait)</th></tr><tr><td class="id">1</td><td>KPI tiles + change strip (top)</td><td class="small">KPI strip + change strip</td></tr><tr><td class="id">2</td><td>11-column table (left) + live map (centre)</td><td class="small">Swipe cards · Map tab</td></tr><tr><td class="id">3</td><td>Selected-job workspace (right)</td><td class="small">Job detail · map bottom sheet</td></tr><tr><td class="id">4</td><td>Breakdown drawers, receipts, ticker</td><td class="small">Desktop mode</td></tr></table>""","06 · Information Hierarchy")\nsec("07","Requirements HF-01 – HF-18")\npage(f"""<div class="sec">Section 07</div><h1>Requirements</h1>')
R('<p class="small muted">Layout keeps the current foundation: <b style="color:var(--t1)">queue + map left, selected job + decision controls right.</b></p>','<p class="small muted">Layout (v1.3, Tim-approved): <b style="color:var(--t1)">review table left · live map centre · selected job + decisions right</b>; KPI tiles + change strip on top, event ticker below.</p>')
R("The Phase column (new in v1.2) maps each requirement to the implementation plan in Section 11.","Phase column maps to Section 15; “M” = Mobile track. HF-15 – HF-18 are new in v1.3.")
# detail
R('("HF-06","Navigation","P1",["Map: visible exit, sensible default zoom, synced selection with queue.","Rail never covers content (push, don\'t overlay)."],None)','("HF-06","Navigation","P1",["Map: permanent panel (HF-16); expand mode always shows Collapse + Esc; default zoom fits results; selection synced with queue.","Rail never covers content (push, don\'t overlay)."],None)')
R('"Targets ≥ 44px for decision buttons (WCAG 2.2 minimum 24px). Editing rules / settings is desktop only."],None)','"Targets ≥ 44px for decision buttons (WCAG 2.2 minimum 24px). Editing rules / settings is desktop only. <b>Expanded by HF-18 (v1.3).</b>"],None)')
R('''page('<div class="sec">Section 08 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-06 – HF-14</span></h1>'+''.join(detcard(d) for d in det[5:]),"08 · Requirement Detail (2/2)")''','''page('<div class="sec">Section 08 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-06 – HF-13</span></h1>'+''.join(detcard(d) for d in det[5:13]),"08 · Requirement Detail (2/3)")
det2=[("HF-15","Motion system","P2",["Rich motion is the standard (operator decision): named duration and easing tokens; catalog M-01 – M-17 (Section 11).","Guardrails: never blocks input, never hides true state, 60 fps GPU-only, flash-safe.","<b>Reduce motion</b> toggle in Local preferences, off by default."],"0 input blocked by animation; p95 frame ≤ 16.7 ms; every animation maps to a token; write-state motion never precedes the state event."),
("HF-16","Map as primary panel","P1",["Permanent panel at the centre of the cockpit; expand-to-focus with visible Collapse, Esc.","Score-band pins, clusters, radar, Chattanooga range rings, hover cards, filter reflection, two-way selection sync.","<b>Current military targeting style retained as design authority</b>; reticles, lock-on, grid, coordinates, brackets added."],"Map ↔ queue ↔ detail selection sync 100%; default zoom fits results; exit / collapse found unaided."),
("HF-17","2560 × 1440 desktop layout","P2",["Three zones: table 1160 · map 820 · workspace 508; KPI tiles, change strip, ticker.","All 11 columns visible without horizontal scroll; ≥ 30 rows; type scale per Section 13."],"11 / 11 columns and ≥ 30 rows at 2560 × 1440; 0 clipped priority cells."),
("HF-18","Mobile redesign","P2",["iPhone 18 Pro (assumed 402 × 874 pt): portrait cards with swipe decisions + haptics, tab bar, full-bleed map + sheet.","Landscape split view; desktop-mode switch with state persisting both ways.","Targets ≥ 44 pt; decision buttons 52–56 pt."],"Swipe decisions reversible via Undo 100%; state kept across desktop-mode switch 100%.")]
page('<div class="sec">Section 08 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-14 – HF-18</span></h1>'+''.join(detcard(d) for d in det[13:]+det2),"08 · Requirement Detail (3/3)")''')
# visual standards
R('"Clear type hierarchy; minimize tiny text. Short purposeful animation only."','"Clear type hierarchy; minimize tiny text.","<b>Rich motion by operator decision (v1.3):</b> animate anywhere it makes a little sense — sliding, scrolling, sweeping, materializing — under the Motion System guardrails (Section 11).","<b>Map style retained:</b> the current military targeting look is design authority and is only enhanced (Section 12)."')
R('"Emotional target: <b>confidence and control</b>, not excitement."','"Emotional target: <b>confidence and control</b> in a living HUD — motion says the system is alive and working, never that it is unsure."')
R("<td>Only on cyan focus and processing states: <code>0 0 6px</code> at 40% opacity. Nothing else glows.</td>","<td>Cyan glow on focus, processing, hover traces, lock-on and radar (<code>0 0 6px</code>, 40%); one-shot green confirm flash. At rest nothing else glows.</td>")
R("<td>Radar Cyan means live / interactive / focused. Never used for status or decoration.</td>","<td>Radar Cyan means live / interactive / focused — incl. radar sweep, lock-on and traces. Never used for status or decoration.</td>")
# plan renumber 11->15
R('sec("11","Implementation Plan")','sec("15","Implementation Plan")')
R('<div class="sec">Section 11</div><h1>Implementation Plan — Overview</h1>','<div class="sec">Section 15</div><h1>Implementation Plan — Overview</h1>')
R('"11 · Implementation Plan — Overview")','"15 · Implementation Plan — Constraints")')
R('''seq=[("00","Baseline","HF-14","Measured baseline of 5 real review tasks.","Baseline report + discrepancy register signed off."),
("01","Integrity","HF-01 · 02 · 03 · 04 (errors)","One score, reconciled counts, truthful writes.","No unexplained cross-view discrepancy; zero false successes."),
("02","Workflow","HF-04 · 05 · 06","Context survives refresh; mistakes recoverable.","Refresh keeps context; mistakes recoverable without data loss."),
("03","Cognitive + visual","HF-07 – 11 · 13 + color tokens","Faster review via density, labels, rationale, palette.","Measured faster review, no accuracy loss."),''','''seq=[("00","Baseline","HF-14","Measured baseline of 5 real review tasks.","Baseline report + discrepancy register signed off."),
("01","Integrity","HF-01 · 02 · 03 · 04 (errors)","One score, reconciled counts, truthful writes. <b>Still first.</b>","No unexplained cross-view discrepancy; zero false successes."),
("02","Workflow + motion core","HF-04 · 05 · 06 · 15 (core) · 16 (panel)","Context survives refresh; map becomes a permanent panel; motion tokens + core transitions.","Refresh keeps context; motion never blocks input."),
("03","Cognitive + visual + 2560","HF-07 – 11 · 15 · 16 · 17 + tokens","2560 cockpit, full motion catalog, map enhancements, palette.","Measured faster review, no accuracy loss; 60 fps."),''')
R('''("04","Adaptive","HF-12","Opt-in, explainable personalization.","Explainable, reversible, subordinate to canonical rules and Tim's decisions.")]''','''("04","Adaptive","HF-12","Opt-in, explainable personalization.","Explainable, reversible, subordinate to canonical rules and Tim's decisions."),
("M","Mobile track","HF-13 · 18","iPhone portrait / landscape / desktop-mode; starts after Phase 2 gate, parallel to Phase 3.","Swipe decisions reversible; state kept across switch.")]''')
R('<div class="card bar-t" style="padding:8px 12px;margin-bottom:0"><b>Design authority.</b> <span class="small">All changes preserve the established layout (queue + map left, selected job right) unless Tim explicitly approves otherwise. Shared-model / rule changes stay out of scope in every phase.</span></div>','<div class="card bar-t" style="padding:8px 12px;margin-bottom:0"><b>Design authority.</b> <span class="small">Layout follows Tim\'s v1.3 decisions: 2560 three-zone cockpit, map as a permanent primary panel in its current targeting style, high-motion standard. Further layout changes need Tim\'s explicit approval. Shared-model / rule changes stay out of scope in every phase.</span></div></div>')
R('<h2 style="margin-top:10px">Cross-cutting dependencies and constraints</h2>','<h2 style="margin-top:10px">Cross-cutting dependencies and constraints</h2><div class="grid2" style="gap:7px">')
R('<p class="small muted" style="margin-top:6px">HF-14 timing is re-run at the end of every phase so each gate is judged against the same baseline. No phase begins until the previous gate is reviewed with Tim.</p>','<p class="small muted" style="margin-top:6px">HF-14 timing is re-run at the end of every phase. No phase begins until the previous gate is reviewed with Tim. No motion or layout work starts before the Phase 1 gate.</p>')
# phase numbering 11.x -> 15.x
for a,b in [("11.1","15.1"),("11.2","15.2"),("11.3","15.3"),("11.4","15.4"),("11.5","15.5")]:
    R(f'("{a}","Phase',f'("{b}","Phase')
R('sec(s,t,1); ppage(s,"11 · "+t,phase(*args))','sec(s,t,1); ppage(s,"15 · "+t,phase(*args))')
# phase 1 addition
R('"Fix console TypeErrors at pipeline lines 1320 / 1326."],','"Fix console TypeErrors at pipeline lines 1320 / 1326.",\n"Expose state-machine events as the only source for write-state motion later (G2)."],')
# phase 2
R('["HF-04","HF-05","HF-06"],"Remove behavioral surprises and make context survive every refresh, so mistakes are recoverable without data loss."','["HF-04","HF-05","HF-06","HF-15","HF-16"],"Remove behavioral surprises, make context survive every refresh, make the map a permanent panel, and ship the motion core."')
R('"Highlight new / changed rows briefly (≈ 2s, with a “changed” marker) instead of silent reorder; batch bulk bot updates into the change strip.",','"New / changed rows get the cyan wipe (M-08) and a “changed” marker instead of silent reorder; bulk bot updates batch into the change strip.",')
R('"Map: visible exit button + Esc, default zoom fit-to-results, selection synced with queue.",\n"Sidebar rail pushes content rather than overlaying it."],','"<b>Map as permanent primary panel</b> (HF-16) in its current style: fit-to-results zoom, ⤢ Expand + visible Collapse + Esc, two-way selection sync.",\n"<b>Motion tokens file + core transitions</b> (HF-15): panel slide, tab slide, toast slide-up, write-state pulses bound to Phase 1 events; Reduce motion toggle (off by default).",\n"Sidebar rail pushes content rather than overlaying it."],')
R('["Settings separation spec","Context preservation + conflict guard","Map / navigation fixes"],','["Settings separation spec","Context preservation + conflict guard","Map panel + motion core"],')
R('"Map exit found unaided in re-test; rail covers no content","HF-14 re-test shows no regressions"],','"Map collapse found unaided; selection sync 100%","Motion never blocks input (dispatch ≤ 50 ms)","HF-14 re-test shows no regressions"],')
R('["Highlight noise during bulk bot activity → batch and summarize.","Reflexive conflict confirmations → show a concrete diff, not a generic warning."]','["Highlight noise during bulk bot activity → batch and summarize.","Motion masking state → G2: state wins, animation cancels."]')
# phase 3
R('["HF-07","HF-08","HF-09","HF-10","HF-11","HF-13"],"Make review measurably faster through density, readable labels, rationale, change awareness, and the HUD color system."','["HF-07","HF-08","HF-09","HF-10","HF-11","HF-15","HF-16","HF-17"],"Make review measurably faster with the 2560 cockpit, readable labels, rationale, the full motion catalog and the HUD system."')
R('"11-column default table with adjustable widths and column priority; priority columns never overflow; truncate on whole words with full-text tooltip; 15–20 visible rows.",','"<b>2560 × 1440 three-zone layout</b> (HF-17): grid 1160 / 820 / 508, KPI tiles, change strip, ticker, type scale; all 11 columns and ≥ 30 rows; 15–20 rows at 1440–1920.",')
R('"Phone layout: Layer 1, change strip, queue, selected job, decide / undo; decision targets ≥ 44px.",','"<b>Full motion catalog</b> M-01 – M-17 and <b>map enhancements</b> (clusters, hover cards, rings, radar, lock-on, filter reflection); phone moves to Track M.",')
R('"<b>Apply the color system as CSS design tokens</b> (Section 12): replace hard-coded colors, add a lint rule against raw hex, add a keyboard-shortcut help overlay, run a contrast audit."]','"<b>Apply colour, motion and breakpoint tokens</b> (Section 16); lint against raw hex / raw durations; shortcut help overlay; contrast audit."]')
R('["Table + label dictionary","Rationale line + change strip","Token stylesheet + visual-regression snapshots","Phone layout"],','["2560 layout + label dictionary","Rationale line + change strip","Motion catalog + map enhancements","Token stylesheet + visual snapshots"],')
R('"0 priority-column overflow at 1280 / 1440 / 1920 px",','"0 overflow at 1280 / 1440 / 1920 / 2560; 11 / 11 cols at 2560","p95 frame ≤ 16.7 ms with radar running",')
R('["Density vs readability → keep table text ≥ 11px; test with real data.","Token migration regressions → screenshot diffs per view before/after."]','["Density vs readability → table text ≥ 14 px at 2560.","Motion cost → G3 caps; perf trace in gate."]')
# phase M after phase 4
R('''["Overfitting to recent behavior → minimum-evidence threshold and decay.","Trust erosion → visible, labeled, never a silent reorder (P6)."]))]''','''["Overfitting to recent behavior → minimum-evidence threshold and decay.","Trust erosion → visible, labeled, never a silent reorder (P6)."])),
("15.6","Track M — Mobile",("M","Mobile track",["HF-13","HF-18"],"Deliver the iPhone 18 Pro redesign (portrait, landscape, desktop-mode switch). Starts after the Phase 2 gate; runs in parallel with Phase 3.",
["Confirm iPhone 18 Pro dimensions and safe areas in the simulator (402 × 874 pt assumed).",
"Portrait: KPI strip, change strip, swipe cards (→ Pursue, ← Hold, long-press Decline + confirm + Undo), tab bar Queue · Map · Changes · Search.",
"Map tab: full-bleed targeting map in the retained style + bottom sheet (peek / half / full).",
"Landscape split view: list left, Detail | Map right.",
"Desktop-mode switch: 2560 layout scaled + pannable; shared view-state persists selection, filters, sort, scroll, viewport.",
"Haptics map (threshold, commit, warning, success / error); motion tokens with phone cap of 6 concurrent animations."],
["Portrait + landscape builds","Desktop-mode switch + shared view-state","Gesture + haptic spec"],
["All decision targets ≥ 44 pt","Swipe decisions reversible via Undo 100%","State kept across switch 100% (50 cycles)","HF-14 tasks timed on phone"],
["Accidental swipes → 35 % threshold, Undo, Decline needs long-press + confirm.","Assumed dimensions wrong → layout from safe-area insets, not constants."]))]''')
s=s.replace('"Phase 0 — Baseline",("00"','"Phase 0 — Baseline",("00"')
# tokens
R('sec("12","Design Tokens (CSS)")','sec("16","Design Tokens (CSS)")')
R('("--pe-font-ui",\'"Inter", system-ui, sans-serif\',"numbers / titles"),("--pe-motion","120ms ease-out","short, purposeful"),("--pe-target-min","44px","phone decision buttons")]','("--pe-font-ui",\'"Inter", system-ui, sans-serif\',"numbers / titles"),("--pe-target-min","44pt","phone targets"),("--pe-target-decision","52pt","phone Pursue / Hold")]')
R('("/* Shape, glow, type, motion */",None,None)','("/* Shape, glow, type, targets */",None,None)')
R('<div class="sec">Section 12</div><h1>Design Tokens (CSS)</h1>','<div class="sec">Section 16</div><h1>Design Tokens (CSS)</h1>')
R('<p class="small">Phase 3 applies the color system through a single token file.','<p class="small">Phase 2 ships motion tokens; Phase 3 applies colour, motion and breakpoint tokens through a single token file. Motion and breakpoints continue on the next page.')
R('<div class="card bar-l small" style="margin:0"><b>Focus &amp; processing only:</b> <code>box-shadow: var(--pe-glow)</code>. No other element glows.</div>','<div class="card bar-l small" style="margin:0"><b>Glow:</b> <code>box-shadow: var(--pe-glow)</code> on focus, processing, traces and lock-on; nothing glows at rest.</div>')
R('"12 · Design Tokens")','"16 · Design Tokens — Colour & Shape")')
# tokens page 2 inserted before targets
R('sec("13","Acceptance Targets"); sec("14","References"); sec("15","Design Standard")','''TOK2=[("/* Motion — durations */",None),("--pe-motion-instant","0ms"),("--pe-motion-fast","120ms"),("--pe-motion-base","240ms"),("--pe-motion-lock","320ms"),("--pe-motion-materialize","400ms"),("--pe-motion-sweep","600ms"),("--pe-motion-roll","800ms"),("--pe-motion-boot","1200ms"),("--pe-motion-breathe","1600ms"),("--pe-motion-radar","4000ms"),("--pe-motion-stagger","18ms"),
("/* Motion — easing */",None),("--pe-ease-out","cubic-bezier(.16,1,.3,1)"),("--pe-ease-in","cubic-bezier(.7,0,.84,0)"),("--pe-ease-inout","cubic-bezier(.65,0,.35,1)"),("--pe-ease-snap","cubic-bezier(.34,1.56,.64,1)"),("--pe-ease-linear","linear"),
("/* Breakpoints */",None),("--pe-bp-desktop-2560","2560px"),("--pe-bp-desktop-1920","1920px"),("--pe-bp-desktop-1440","1440px"),("--pe-bp-phone-portrait","402pt"),("--pe-bp-phone-landscape","874pt"),
("/* Layout @ 2560 */",None),("--pe-margin","20px"),("--pe-gutter","16px"),("--pe-col-table","1160px"),("--pe-col-map","820px"),("--pe-col-work","508px"),("--pe-row-h","32px")]
l2=['<span class="c">/* PE tokens · v1.3 */</span>',':root {']
for k,v in TOK2:
    if v is None: l2.append(f'  <span class="c">{k}</span>'); continue
    l2.append(f'  <span class="k">{k}:</span>{" "*(28-len(k))}{H.escape(v)};')
l2.append('}')
mq=\'\'\'<span class="c">/* layout selection */</span>
@media (min-width: 2560px) { <span class="k">.cockpit</span> { grid-template-columns: var(--pe-col-table) var(--pe-col-map) var(--pe-col-work); } }
@media (max-width: 440px) and (orientation: portrait)  { <span class="k">.app</span> { --layout: mobile-portrait; } }
@media (max-height: 440px) and (orientation: landscape) { <span class="k">.app</span> { --layout: mobile-landscape; } }
<span class="k">.app[data-desktop-mode]</span> { --layout: desktop-2560; <span class="c">/* scaled, pannable */</span> }
<span class="k">[data-reduce-motion]</span> { --pe-motion-radar: 0ms; --pe-motion-breathe: 0ms; <span class="c">/* off by default */</span> }\'\'\'
page(f"""<div class="sec">Section 16 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Design Tokens — Motion, Breakpoints, Layout</h1>
<pre style="font-size:8pt;line-height:1.42;margin:0">{chr(10).join(l2)}</pre><p class="small muted" style="margin-top:5px">Phone breakpoints are assumed iPhone 18 Pro dimensions (Section 14); 2560 is the primary desktop target.</p>
<pre style="font-size:7.9pt;margin-top:9px">{mq}</pre>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l small" style="margin:0"><b>Lint:</b> no raw durations or easing curves in components — only <code>--pe-motion-*</code> and <code>--pe-ease-*</code>, mirroring the raw-hex rule.</div>
<div class="card bar-a small" style="margin:0"><b>Reduce motion</b> (Settings, off by default) swaps loops to 0 and slides to <code>--pe-motion-fast</code> fades.</div></div>""","16 · Design Tokens — Motion & Breakpoints")
sec("17","Acceptance Targets"); sec("18","References"); sec("19","Design Standard")''')
R('("WCAG 2.2 AA agreed criteria","Pass")]','("WCAG 2.2 AA agreed criteria","Pass"),("<b>v1.3</b> · Input blocked by animation","0"),("<b>v1.3</b> · Animation frame time (p95)","≤ 16.7 ms"),("<b>v1.3</b> · Map ↔ queue selection sync","100%"),("<b>v1.3</b> · Columns visible at 2560 × 1440","11 / 11, ≥ 30 rows"),("<b>v1.3</b> · State kept across desktop-mode switch","100%")]')
R('"W3C, WCAG 2.2 SC 2.5.8 <i>Target Size (Minimum)</i>"]','"W3C, WCAG 2.2 SC 2.5.8 <i>Target Size (Minimum)</i>; SC 2.3.1 <i>Three Flashes</i>","Harley, <i>The Role of Animation and Motion in UX</i> (NN/G, 2014)","Apple, <i>Human Interface Guidelines</i> — layout, safe areas, haptics"]')
R('<div class="sec">Section 13</div><h1>Acceptance Targets','<div class="sec">Section 17</div><h1>Acceptance Targets')
R('<div class="sec" style="margin-top:12px">Section 14</div><h1 style="font-size:17pt">References</h1>','<div class="sec" style="margin-top:10px">Section 18</div><h1 style="font-size:17pt">References</h1>')
R('<div class="sec" style="margin-top:10px">Section 15</div><h1 style="font-size:17pt">Design Standard','<div class="sec" style="margin-top:8px">Section 19</div><h1 style="font-size:17pt">Design Standard')
R('Adaptive functionality stays transparent, explainable, reversible and under user control.','Adaptive functionality stays transparent, explainable, reversible and under user control. By operator decision, motion is a first-class element — rich and continuous, yet never blocking input or concealing true state — and the tactical map is a primary panel whose military targeting style is retained.')
R('<div class="notice"><b>Status</b>Proposed · v1.2 · October 14, 2026. No code, backlog or deployment changes authorized.</div>','<div class="notice"><b>Status</b>Proposed · v1.3 · October 14, 2026. No code, backlog or deployment changes authorized.</div>')
R('"13–15 · Targets, References, Standard")','"17–19 · Targets, References, Standard")')
R('.toc .row{display:flex;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--seam)}','.toc .row{display:flex;align-items:baseline;padding:2.5px 0;border-bottom:1px solid var(--seam)}.toc .t{font-size:10.5pt!important}.toc .sub .t{font-size:10pt!important}')
R('.toc .sub{padding:4px 0;border-bottom:1px dashed #1a1a1a}','.toc .sub{padding:2px 0;border-bottom:1px dashed #1a1a1a}')
R('Canonical writes are asynchronous and routinely take 20–45 minutes. “Queued” and “processing” are normal states, not errors. Decision UI, tests and timing studies treat confirmation as arriving late; usability timings measure time-to-decision, not time-to-confirmation.','Writes routinely take 20–45 min; “queued” and “processing” are normal, not errors. Timings measure time-to-decision, not time-to-confirmation; queued motion (breathe) must never read as a fault.')
R('Scheduled windows when the Writer accepts no commits. Decisions made during a blackout queue with their payload and show the window end time. No rollout or migration steps are scheduled inside a blackout; fault-injection tests include a simulated blackout.','No commits accepted; decisions queue with payload and show the window end. No rollout steps inside a blackout; fault tests simulate one.')
R('Several bots update the same job records. Every decision carries the record version seen at open; a mismatch at commit triggers the conflict guard (HF-05) and a <i>superseded</i> state, never a silent overwrite. Bulk bot updates are summarized in the change strip rather than individually flashed.','Each decision carries the record version seen at open; a mismatch triggers the conflict guard (HF-05) and a <i>superseded</i> state. Bulk bot updates summarize in the change strip and ticker rather than individually animating.')
R('<pre style="font-size:7.9pt;margin-top:9px">{mq}</pre>','<pre style="font-size:7.9pt;margin-top:9px;white-space:pre-wrap">{mq}</pre>')
R('sec("17","Acceptance Targets"); sec("18","References"); sec("19","Design Standard")','sec("17","Acceptance Targets")')
R('<div class="sec" style="margin-top:10px">Section 18</div><h1 style="font-size:17pt">References</h1>','""","17 · Acceptance Targets")\nsec("18","References"); sec("19","Design Standard")\npage(f"""<div class="sec">Section 18</div><h1>References</h1>')
R('"17–19 · Targets, References, Standard")','"18–19 · References, Design Standard")')
R('<table class="tight"><tr><th style="width:36px">#</th><th style="width:100px">Phase</th><th style="width:128px">Requirements</th><th>Objective</th><th style="width:170px">Exit gate</th></tr>{sh}</table>','<table class="tight"><tr><th style="width:30px">#</th><th style="width:118px">Phase</th><th style="width:150px">Requirements</th><th>Objective</th><th style="width:150px">Exit gate</th></tr>{sh}</table>')
R('<h2 style="margin-top:10px">Cross-cutting dependencies and constraints</h2><div class="grid2" style="gap:7px">','""","15 · Implementation Plan — Overview")\npage(f"""<div class="sec">Section 15 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Sequencing &amp; Cross-cutting Constraints</h1><pre style="font-size:8.4pt;line-height:1.55"><span class="c">PHASE            ────────────────────────────── time ──────────────────────────────▶</span>\n00 Baseline      ████\n01 Integrity         ██████████  <span class="c">◀ first; no motion / layout work before this gate</span>\n02 Workflow                ████████  <span class="k">+ map panel · motion tokens · core transitions</span>\n03 Cog + 2560                      ████████████  <span class="k">+ full motion catalog · map enhancements</span>\n04 Adaptive                                    ██████\n<span class="k">M  Mobile</span>                          <span class="k">░░░░░░░░░░░░░░░░</span>  <span class="c">starts after Phase 2 gate · parallel</span></pre><div class="grid2 cc" style="gap:7px;margin-top:10px">')
R('.page:last-child{','.cc .card{margin:0!important}\n.page:last-child{')
# TOC + output
R('<p class="small muted" style="margin-top:14px">{N} pages · US Letter · dark edition. Section 10.6 contains an illustrative concept screen built from mock data.</p>','<p class="small muted" style="margin-top:4px">{N} pages · US Letter (landscape for the 2560 mockup) · dark edition. Sections 12–14 contain concept screens built from mock data.</p>')
R('pages[1]=(f','pages[1]=(f',1)
R(',"Contents")\nout=[]',',"Contents",False)\npg={n:p for n,t,p,l in toc}\npages=[(re.sub(r"\\{\\{([0-9.]+)\\}\\}",lambda m:f"{pg[m.group(1)]:02d}",b),h,l) for b,h,l in pages]\nout=[]')
R("for i,(body,hdr) in enumerate(pages,1):","for i,(body,hdr,land) in enumerate(pages,1):")
R("else: out.append(f'<section class=\"page\">","else: out.append(f'<section class=\"page{\" land\" if land else \"\"}\">")
R("<span>v1.2 · Oct 14 2026 · Prepared for Tim Pruitt</span>","<span>v1.3 · Oct 14 2026 · Prepared for Tim Pruitt</span>")
R("r.push('p'+(i+2)+':'+(c.scrollHeight-c.clientHeight))","r.push('p'+(i+2)+':'+(c.scrollHeight-c.clientHeight)+'h');if(c.scrollWidth>c.clientWidth+1)r.push('p'+(i+2)+':w'+(c.scrollWidth-c.clientWidth))")
R("Implementation Plan v1.2</title>","Implementation Plan v1.3</title>")
R('open("/workspace/pe/build/proposal.html","w")','open("/workspace/pe/build13/proposal.html","w")')
R('print("pages",N,"mock",MOCK_PAGE)','print("pages",N); print(toc)')
open('/workspace/pe/build13/gen13.py','w').write(s)
print("patched")
