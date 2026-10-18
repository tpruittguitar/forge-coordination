# ---------- v1.3 new sections (inserted after Color System) ----------
import sys; sys.path.insert(0,'/workspace/pe/build151')
from mapsvg import map_svg
from desk import desktop
from mobile import portrait_queue, portrait_detail, portrait_map, landscape_map, landscape_desktop
def note(t,c="l"): return f'<div class="card bar-{c} small" style="padding:7px 11px;margin-bottom:7px">{t}</div>'
sec("11","Motion System")
MT=[("--pe-motion-instant","0ms","—","State commit, value write (never animated)"),
("--pe-motion-fast","120ms","ease-out","Hover glow, press, focus ring"),
("--pe-motion-base","240ms","ease-inout","Panel slide, tab slide, toast slide-up"),
("--pe-motion-lock","320ms","snap","Map lock-on brackets / reticle"),
("--pe-motion-materialize","400ms","ease-out","Job detail scanline + dissolve"),
("--pe-motion-sweep","600ms","linear","Row cyan wipe, edge trace, ring draw-on"),
("--pe-motion-roll","800ms","ease-out","KPI counter roll-up"),
("--pe-motion-boot","1200ms","ease-out","Total HUD boot-up sequence"),
("--pe-motion-breathe","1600ms loop","ease-inout","Queued amber breathe"),
("--pe-motion-radar","4000ms loop","linear","Radar revolution (map + loading)"),
("--pe-motion-stagger","18ms / row","—","Row stagger step, capped at 30 rows")]
EZ=[("--pe-ease-out","cubic-bezier(0.16, 1, 0.3, 1)","Entrances, materialize, roll-up"),
("--pe-ease-in","cubic-bezier(0.7, 0, 0.84, 0)","Exits, collapse"),
("--pe-ease-inout","cubic-bezier(0.65, 0, 0.35, 1)","Slides, tabs, breathe"),
("--pe-ease-snap","cubic-bezier(0.34, 1.56, 0.64, 1)","Pin drop, lock-on overshoot"),
("--pe-ease-linear","linear","Radar, sweeps, ticker")]
mth=''.join(f'<tr><td class="code" style="color:var(--cyan)">{a}</td><td class="num">{b}</td><td class="small">{c}</td><td class="small">{d}</td></tr>' for a,b,c,d in MT)
ezh=''.join(f'<tr><td class="code" style="color:var(--cyan)">{a}</td><td class="code">{b}</td><td class="small">{c}</td></tr>' for a,b,c in EZ)
GR=[("G1","Never blocks input","Actions dispatch at t = 0; animation runs alongside, is interruptible, and never gates a click, key or gesture. No “wait for animation” states."),
("G2","Never hides true state","Final values are in the DOM immediately; motion is a presentation layer. Write-state motion is driven only by state-machine events (Phase 1). If motion and state disagree, state wins and the animation is cancelled."),
("G3","60 fps, GPU only","Animate <code>transform</code>, <code>opacity</code>, <code>filter</code> (and SVG <code>stroke-dashoffset</code> on small elements). No layout properties. p95 frame ≤ 16.7 ms; concurrent animations capped (12 desktop / 6 phone); overflow degrades to fade."),
("G4","Reduce motion toggle","Settings › Local preferences › <b>Reduce motion</b>, <b>off by default</b> (operator decision). On: loops stop, slides become 120 ms fades, shake becomes a static outline. OS-level Reduce Motion triggers a one-time prompt; it never silently overrides Tim's choice."),
("G5","Meaning conserved","Motion colour follows signal meaning: amber breathe = queued only, red shake = failed only, cyan = live / selected / processing."),
("G6","Flash safety","Nothing flashes more than 3× per second (WCAG 2.3.1); confirmed flash is a single pulse.")]
grh=''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td></tr>' for a,b,c in GR)
page(f"""<div class="sec">Section 11</div><h1>Motion System <span class="muted" style="font-size:12pt;font-weight:400">· rich motion by operator decision</span></h1>
<div class="notice" style="margin-top:0"><b>Design authority</b>Tim Pruitt explicitly chose a <b>high-motion HUD</b> (v1.3). The v1.2 rule “short purposeful animation only” is withdrawn everywhere. New standard: <b>animate anywhere it makes a little sense</b> — sliding, scrolling, sweeping, materializing — within guardrails G1–G6.</div>
<div class="label" style="color:var(--t1);margin:8px 0 5px">11.1 Duration tokens</div>
<table class="tight"><tr><th style="width:178px">Token</th><th style="width:92px">Value</th><th style="width:78px">Easing</th><th>Used for</th></tr>{mth}</table>
<div class="label" style="color:var(--t1);margin:9px 0 5px">11.2 Easing curves</div>
<table class="tight"><tr><th style="width:150px">Token</th><th style="width:240px">Curve</th><th>Used for</th></tr>{ezh}</table>
<div class="label" style="color:var(--t1);margin:9px 0 5px">Boot-up timeline (M-01) · input live from t = 0</div>
<pre style="font-size:8.4pt">t=0      <span class="k">controls live</span> · grid fades in            <span class="c">fast</span>
t=120    panels slide in from edges (stagger 40 ms)  <span class="c">base · ease-out</span>
t=360    corner brackets draw · map materializes     <span class="c">materialize</span>
t=400    KPI counters roll up · rows stagger in      <span class="c">roll · stagger</span>
t=1200   radar sweep begins steady loop             <span class="c">radar · linear</span></pre>""","11 · Motion System — Tokens")
CAT=[("M-01","HUD boot-up","App load","Grid fades in → panels slide from edges → corner brackets draw → KPIs roll up → radar starts. 1200 ms total; any input skips it; controls live at t = 0."),
("M-02","Panel slide-in","Load, open, expand","Panels enter from their nearest edge: translate 24 px + fade · base · ease-out."),
("M-03","Job detail materializes","Selection","Scanline mask sweeps top → bottom with pixel-dissolve fade-in; cyan edge trace runs the panel border · materialize 400 ms. Real values from frame 1."),
("M-04","Radar sweep","Continuous; loading","Map sweep from home base, 4 s / rev · linear. Also the loading state for any panel (“ACQUIRING…”)."),
("M-05","Map lock-on","Job selected","Brackets collapse 2× → 1×, reticle rotates 90°, crosshairs extend, coordinates type on · lock 320 ms · snap."),
("M-06","Pin drop / ping","New job on map","Pin drops 12 px with snap overshoot; one ping ring expands 0 → 28 px and fades · sweep 600 ms."),
("M-07","KPI roll-up","Counter change","Digits roll to the new value · roll 800 ms. Final value written at once; screen readers get the final value only."),
("M-08","New-row cyan wipe","Row new / changed","Cyan gradient wipes left → right, settles into a “changed” marker · sweep 600 ms. Replaces silent reorder (HF-05)."),
("M-09","Row stagger","Load, sort, filter","Rows rise 6 px + fade, 18 ms step, capped at 30 rows."),
("M-10","Score ring draws on","Detail opens / score changes","Ring stroke draws from 0 to value · sweep 600 ms · ease-out; number shown immediately."),
("M-11","Tab slide","Tab change","Content slides horizontally in tab order · base 240 ms · ease-inout."),
("M-12","Writer write states","State-machine event","<span style='color:var(--amber)'>◷ queued: amber breathe</span> (1600 ms loop) · <span style='color:var(--cyan)'>◉ processing: cyan sweep</span> across the receipt · <span style='color:var(--green)'>✓ confirmed: single green flash</span> · <span style='color:var(--red)'>✕ failed: red shake</span> (3 × 4 px, 300 ms) then steady red with Retry."),
("M-13","Toast receipts","Decision made","Receipt slides up from the action bar · base · ease-out; stacks; failures never auto-dismiss."),
("M-14","Hover glow trace","Pointer hover / focus","1 px cyan trace runs once around the control border · fast 120 ms + sweep."),
("M-15","Event ticker","Pipeline events","Bottom feed scrolls ← at 40 px/s; pauses on hover / focus."),
("M-16","Map expand-to-focus","⤢ Expand / Collapse","Map scales to fill the workspace · base; Collapse, Esc or ⤢ reverses; selection and viewport kept."),
("M-17","Mobile swipe physics","Card drag","Card tracks finger, action colour reveals underneath, springs back below threshold; haptic at threshold.")]
ct=lambda L:''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small muted">{c}</td><td class="small">{d}</td></tr>' for a,b,c,d in L)
CH_='<tr><th style="width:42px">ID</th><th style="width:118px">Animation</th><th style="width:100px">Trigger</th><th>Specification</th></tr>'
page(f"""<div class="sec">Section 11 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Guardrails &amp; Motion Catalog (1/2)</h1>
<div class="label" style="color:var(--t1);margin:2px 0 5px">11.3 Guardrails — kept because they do not fight the standard</div>
<table class="tight"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th><th>Rule</th></tr>{grh}</table>
<div class="label" style="color:var(--t1);margin:10px 0 5px">11.4 Catalog · every animation names its token</div>
<table class="tight">{CH_}{ct(CAT[:5])}</table>""","11 · Motion System — Guardrails & Catalog")
page(f"""<div class="sec">Section 11 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Motion Catalog (2/2)</h1>
<table class="tight">{CH_}{ct(CAT[5:])}</table>
<div class="card bar-l small" style="margin-top:9px">All catalog items obey G1–G6: the action has already happened when the animation starts, and the screen shows the true state at every frame.</div>""","11 · Motion System — Catalog")

sec("12","Map System")
MK=[("Retained (design authority)","Black field, grey state outlines with large monospace state labels, zoom-% readout, + / − / layers controls, RECENTER and RESET, legend. <b>The current map style stays; v1.3 only enhances it.</b>","t"),
("Targeting layer","Reticle + crosshairs on the selected pin; lock-on animation (M-05); HUD corner brackets on the panel; centre-of-view crosshair.","l"),
("Grid & readouts","Graticule overlay (1° minor, 5° major) with edge coordinate labels; selected-pin lat/long, range and bearing from home; cursor coordinates.","l"),
("Home base & range","Home base <b>Chattanooga, TN</b> (35.0456°N 085.3097°W) with 100 / 250 / 500 mi range rings and 30° ticks; radar sweep (M-04) centred on home.","l"),
("Pins & clusters","Pins coloured by score band (✓ Strong green · ◷ Watch amber · ✕ Weak red), icon + word in hover card; clusters show a count; new pins drop and ping (M-06).","g"),
("Sync & filters","Selection synced both ways: map ↔ queue ↔ detail. Filters reflect on the map: filtered-out pins dim to 25 % and a filter chip shows on the map.","g"),
("Old issues fixed","No tab trap: the map is a <b>permanent primary panel</b>. Default zoom fits results (never 600 %). <b>⤢ Expand</b> to focus mode with an always-visible <b>Collapse</b>, Esc, and the same button to return.","a")]
mkh=''.join(f'<div class="card bar-{c}" style="padding:7px 11px;margin-bottom:6px;display:grid;grid-template-columns:150px 1fr;gap:10px"><div class="label" style="padding-top:2px;color:var(--t1)">{a}</div><div class="small">{b}</div></div>' for a,b,c in MK)
page(f"""<div class="sec">Section 12</div><h1>Map System <span class="muted" style="font-size:12pt;font-weight:400">· primary panel · military targeting style</span></h1>
<div class="notice" style="margin-top:0"><b>Design authority</b>Tim loves the map. It returns as a <b>prominent primary panel</b>, not a hidden tab. Its current military targeting look and feel is <b>retained as design authority and only enhanced</b> — on desktop and on mobile.</div>
{mkh}
<div class="label" style="color:var(--t1);margin:8px 0 4px">Behaviour</div>
<table class="tight"><tr><th style="width:150px">Interaction</th><th>Result</th></tr>
<tr><td><b>Click pin</b></td><td class="small">Selects the job everywhere; table row scrolls into view and gets the selection bar; workspace materializes (M-03); lock-on runs (M-05).</td></tr>
<tr><td><b>Select row</b></td><td class="small">Map pans to the pin (base 240 ms) and locks on; a cluster expands if the pin sits in one.</td></tr>
<tr><td><b>Hover pin</b></td><td class="small">Hover card: title, company, city, score + band word, posted pay. Glow trace on the pin (M-14).</td></tr>
<tr><td><b>Filter change</b></td><td class="small">Pins outside the filter dim to 25 %; counts in the map header update with roll-up (M-07).</td></tr>
<tr><td><b>Remote jobs</b></td><td class="small">Counted in the map header (“12 remote”) and listed in a tray; never dropped.</td></tr>
<tr><td><b>Expand / collapse</b></td><td class="small">⤢ Expand fills the workspace (M-16); Collapse button stays top-right; Esc works; selection, filters and viewport are kept.</td></tr></table>""","12 · Map System")
sec("12.1","Map Panel — Reference Rendering",1)
mref=map_svg(684,640,-84.9,33.9,58,s=0.85,uid='ref',sweep_deg=70)
an=[("1","Lock-on reticle","Crosshairs + corner brackets on the selected pin; coordinate, range and bearing readout."),
("2","Range rings","100 / 250 / 500 mi from home base Chattanooga with ticks."),
("3","Radar sweep","Cyan wedge from home, 4 s per revolution; doubles as loading state."),
("4","Pins & clusters","Band colours; clusters show counts; new pins ping; dimmed pins are filtered out."),
("5","Grid & HUD frame","Graticule with edge coordinates, corner brackets, view crosshair."),
("6","Retained controls","Layers, + / −, zoom %, RECENTER, RESET (as today) plus ⤢ EXPAND.")]
anh=''.join(f'<div class="card" style="padding:6px 9px;margin:0"><div style="display:flex;gap:6px;align-items:baseline"><span class="id">{n}</span><b style="font-size:9.5pt">{t}</b></div><div style="font-size:9pt;color:var(--t2);line-height:1.35">{d}</div></div>' for n,t,d in an)
page(f"""<div class="sec">Section 12.1</div><h1 style="font-size:18pt;margin-bottom:6px">Map Panel — Reference Rendering</h1>
<p class="small muted" style="margin-bottom:7px">Current style retained (grey outlines, mono state labels, controls) with the targeting layer added. Pins and jobs are fictional.</p>
<div style="position:relative;border:1px solid var(--grid)">{mref}<div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:var(--amber);color:#000;font-family:var(--mono);font-size:7.5pt;letter-spacing:.12em;padding:3px 8px;font-weight:600">CONCEPT — MOCK DATA</div></div>
<div class="grid3" style="margin-top:9px;gap:7px">{anh}</div>""","12 · Map — Reference Rendering · Mock Data")

sec("13","Desktop Layout 2560 × 1440")
LC=[("Score + band","64"),("Δ since review","38"),("Role","186"),("Company","112"),("Location","116"),("Posted pay","94"),("Base pay (est.)","80"),("Degree flex","98"),("Source","74"),("Age","36"),("Write state","≈ 140 (fill)")]
lch=''.join(f'<tr><td class="id">{i+1:02d}</td><td>{a}</td><td class="num" style="text-align:right">{b}</td></tr>' for i,(a,b) in enumerate(LC))
TS=[("KPI value","40 / 650"),("Job title (workspace)","26 / 650"),("Section / pay value","20 / 620"),("Body, why line","15–16 / 400"),("Table cell (row 32 px)","14 / 540"),("Score in table","16 / 650"),("Mono label (uppercase)","11.5–13"),("Minimum anywhere","11")]
tsh=''.join(f'<tr><td>{a}</td><td class="num" style="text-align:right">{b}</td></tr>' for a,b in TS)
page(f"""<div class="sec">Section 13</div><h1>Desktop Layout — 2560 × 1440</h1>
<p class="small" style="margin-top:-4px">Primary target: 2560 × 1440 CSS px at 1× (5120 × 2880 at 2×). Three working zones plus top and bottom strips, map in the centre.</p>
<pre style="font-size:8.4pt;line-height:1.45"><span class="c">┌ 20 margin ─────────────────────────────────────────────────────────── 2560 ┐</span>
 TOP BAR       56   brand · Writer status · motion state · search · CONCEPT
 KPI TILES    104   6 tiles: Review · New · Failed · Queued · Applied · Declined
 CHANGE STRIP  44   since last review · filter summary (reflected on map)
 MAIN        1108   <span class="k">TABLE 1160</span> │16│ <span class="k">MAP 820</span> │16│ <span class="k">WORKSPACE 508</span>
 TICKER        40   pipeline events feed, scrolls ←
<span class="c">└ row gap 12 · gutter 16 · margin 20 ─ 20+56+12+104+12+44+12+1108+12+40+20 = 1440 ┘</span></pre>
<div class="grid2" style="margin-top:6px">
<div><div class="label" style="color:var(--t1);margin-bottom:4px">13.1 Review table — 11 columns, px</div>
<table class="tight"><tr><th style="width:30px">#</th><th>Column</th><th style="width:96px;text-align:right">Width</th></tr>{lch}</table>
<p class="small muted" style="margin-top:4px">Column gap 8 · 6 px selection bar · all 11 visible, no horizontal scroll · row 32 px → 31 rows visible.</p></div>
<div><div class="label" style="color:var(--t1);margin-bottom:4px">13.2 Type scale at 2560 (px / weight)</div>
<table class="tight"><tr><th>Role</th><th style="width:92px;text-align:right">Size</th></tr>{tsh}</table>
<div class="label" style="color:var(--t1);margin:9px 0 4px">13.3 Zone contents</div>
<ul class="small" style="margin:0"><li><b>Map</b> 820 × 1064 · live, permanent (Section 12).</li><li><b>Workspace</b>: score ring, why, evidence, breakdown, recommended action, Pursue / Hold │ Decline, receipts with write states.</li><li><b>Below 2560</b>: 1920 keeps 3 zones (map 640, workspace 460); 1440 stacks map above workspace.</li></ul></div></div>""","13 · Desktop Layout 2560 × 1440")
sec("13.4","Desktop Concept Mockup (landscape)",1)
sc=960/2560
page(f"""<div class="sec">Section 13.4</div><h1 style="font-size:17pt;margin-bottom:5px">Desktop Concept Mockup — 2560 × 1440 <span class="muted" style="font-size:10.5pt;font-weight:400">· rendered at 37.5 % · map prominent · fictional data</span></h1>
<div style="width:960px;height:540px;overflow:hidden;border:1px solid var(--grid);position:relative"><div style="transform:scale({sc});transform-origin:0 0;width:2560px;height:1440px">{desktop()}</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:7px">
<div class="card" style="padding:5px 8px;margin:0;font-size:9pt"><span class="id">1</span> <b>Table · 1160</b><div class="muted">11 columns, 31 rows; rows stagger in (M-09); new rows cyan-wipe (M-08).</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:9pt"><span class="id">2</span> <b>Map · 820</b><div class="muted">Lock-on, radar, rings, clusters, hover card, pings; ⤢ Expand.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:9pt"><span class="id">3</span> <b>Workspace · 508</b><div class="muted">Materializes (M-03); ring draws on (M-10); write-state pulses (M-12).</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:9pt"><span class="id">4</span> <b>Strips</b><div class="muted">KPI roll-up (M-07), change strip, event ticker (M-15). Full-res PNG supplied.</div></div></div>""","13 · Desktop Mockup 2560 × 1440 — Mock Data",land=True)

sec("14","Mobile Redesign — iPhone 18 Pro")
page(f"""<div class="sec">Section 14</div><h1>Mobile Redesign — iPhone 18 Pro</h1>
<div class="notice" style="margin-top:0"><b>Assumed dimensions</b>~402 × 874 pt portrait, ~874 × 402 pt landscape, Dynamic Island, safe areas ≈ 62 pt top / 34 pt bottom (portrait) and ≈ 62 pt sides / 21 pt bottom (landscape). Not yet confirmed for this model; verify in the simulator before build.</div>
<p class="small">A separate design, not a squeezed desktop. Same principles, palette, signal meanings and motion tokens. Decision targets ≥ 44 pt (Pursue / Hold 52–56 pt).</p>
<div class="grid2">
<div class="card bar-l" style="margin:0"><div class="label" style="color:var(--cyan);margin-bottom:3px">Portrait</div><ul class="small" style="margin:0">
<li>KPI strip (4 tiles, tap = filter) + change strip.</li>
<li>Swipeable job cards: <b style="color:var(--green)">→ swipe right Pursue</b>, <b style="color:var(--amber)">← swipe left Hold</b>, <b style="color:var(--red)">long-press Decline</b> → confirm sheet → Undo toast.</li>
<li>Swipe threshold 35 % of width; below it the card springs back (M-17).</li>
<li>Bottom tab bar: Queue · Map · Changes · Search.</li>
<li>Map tab: full-bleed tactical map (same targeting style) with a bottom sheet (peek / half / full) for the locked job and actions.</li></ul></div>
<div class="card bar-l" style="margin:0"><div class="label" style="color:var(--cyan);margin-bottom:3px">Landscape</div><ul class="small" style="margin:0">
<li>Split view: queue list left (300 pt); right pane switches <b>Detail | Map</b>.</li>
<li>Map keeps lock-on, rings, radar; a compact action card docks at the bottom.</li>
<li>Island side and opposite side keep 62 pt safe insets.</li></ul>
<div class="label" style="color:var(--cyan);margin:8px 0 3px">Desktop-mode switch</div><ul class="small" style="margin:0">
<li>⧉ Desktop toggle loads the 2560 layout scaled to width; pinch-zoom and pan, with a viewport minimap.</li>
<li>Full functionality incl. settings and rules (still confirm-gated).</li>
<li>Selection, filters, sort, scroll and map viewport live in one shared view-state and <b>persist across the switch</b> both ways; no data reload.</li></ul></div></div>
<h2 style="margin-top:10px">Haptics and motion on phone</h2>
<table class="tight"><tr><th style="width:160px">Moment</th><th style="width:170px">Haptic</th><th>Motion</th></tr>
<tr><td>Swipe crosses threshold</td><td class="small">light impact</td><td class="small">Underlay colour saturates; card tilts ≤ 4°</td></tr>
<tr><td>Pursue / Hold committed</td><td class="small">medium impact</td><td class="small">Card slides off, toast slides up (M-13)</td></tr>
<tr><td>Decline confirm sheet</td><td class="small">warning notification</td><td class="small">Sheet rises · base 240 ms; Undo toast after confirm</td></tr>
<tr><td>Write confirmed / failed</td><td class="small">success / error</td><td class="small">Green flash / red shake (M-12)</td></tr>
<tr><td>Map lock-on</td><td class="small">selection tick</td><td class="small">Lock-on (M-05); bottom sheet to peek</td></tr></table>
<p class="small muted" style="margin-top:5px">Reduce motion (Settings, off by default) also disables haptic-linked tilt. Phone running cap: 6 concurrent animations (G3).</p>""","14 · Mobile Redesign — Spec")
sec("14.1","Mobile Mockups — Portrait Queue & Detail",1)
ps=0.74
def ph(h,cap,sc=None):
    sc=sc or ps
    return f'<div><div style="width:{422*sc:.0f}px;height:{894*sc:.0f}px;overflow:hidden"><div style="transform:scale({sc});transform-origin:0 0">{h}</div></div><div class="label" style="margin-top:5px;color:var(--t1);font-size:7.8pt">{cap}</div></div>'
mob=[("A","Queue","KPI strip, change strip, top card mid-swipe right with Pursue underlay (haptic at threshold), queued receipt with Undo, tab bar. ← Hold · long-press Decline."),
("B","Job detail","Materialized detail (M-03), score ring draws on (M-10), why, evidence, toast receipts slid up (M-13), 56 pt action bar with Decline separated.")]
mbh=''.join(f'<div class="card" style="padding:6px 9px;margin:0"><div style="display:flex;gap:6px;align-items:baseline"><span class="id">{n}</span><b style="font-size:9.5pt">{t}</b></div><div style="font-size:9pt;color:var(--t2);line-height:1.35">{d}</div></div>' for n,t,d in mob)
page(f"""<div class="sec">Section 14.1</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockups — Portrait Queue &amp; Detail <span class="muted" style="font-size:10.5pt;font-weight:400">· 402 × 874 pt · fictional data</span></h1>
<div style="display:flex;justify-content:space-around">{ph(portrait_queue(),"A · Portrait queue")}{ph(portrait_detail(),"B · Portrait job detail")}</div>
<div class="grid2" style="margin-top:9px;gap:7px">{mbh}</div>""","14 · Mobile — Portrait Queue & Detail · Mock Data")
sec("14.2","Mobile Mockup — Portrait Map + Sheet",1)
mm=[("Retained style","Grey state outlines, mono state labels, grid, coordinates — same as desktop and today."),
("Lock-on","Reticle, crosshairs, corner brackets on the selected pin; lat/long, range and bearing readout; selection-tick haptic."),
("Range & radar","100 / 250 / 500 mi rings from Chattanooga; radar sweep from home base."),
("HUD frame","Corner brackets inside the safe area; view crosshair."),
("Filters","Chips at top reflect queue filters; dimmed pins are filtered out; on-map / remote counts."),
("Controls","44 pt + / − / recenter / expand buttons on the right edge."),
("Bottom sheet","Peek / half / full detents; locked job with score, why line and Pursue / Hold │ Decline; ◂ ▸ steps through pins.")]
mmh=''.join(f'<div class="card bar-l" style="padding:6px 9px;margin-bottom:6px"><b style="font-size:9.8pt">{a}</b><div style="font-size:9pt;color:var(--t2);line-height:1.35">{b}</div></div>' for a,b in mm)
page(f"""<div class="sec">Section 14.2</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockup — Portrait Map + Sheet <span class="muted" style="font-size:10.5pt;font-weight:400">· targeting style retained</span></h1>
<div style="display:grid;grid-template-columns:{422*0.84:.0f}px 1fr;gap:16px">{ph(portrait_map(),"C · Portrait map + bottom sheet",0.84)}<div>{mmh}</div></div>""","14 · Mobile — Portrait Map · Mock Data")
sec("14.3","Mobile Mockups — Landscape & Desktop Mode",1)
ls=0.76
def lph(h,cap):
    return f'<div style="margin-bottom:8px"><div style="width:{894*ls:.0f}px;height:{422*ls:.0f}px;overflow:hidden"><div style="transform:scale({ls});transform-origin:0 0">{h}</div></div><div class="label" style="margin-top:4px;color:var(--t1);font-size:7.8pt">{cap}</div></div>'
page(f"""<div class="sec">Section 14.3</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockups — Landscape &amp; Desktop Mode <span class="muted" style="font-size:10.5pt;font-weight:400">· 874 × 402 pt</span></h1>
{lph(landscape_map(),"D · Landscape split view — queue left, Map right (Detail | Map switch), docked action card")}
{lph(landscape_desktop(),"E · Desktop mode — 2560 layout scaled and pannable; state bar shows kept selection and filters; ◧ Exit returns")}
<div class="grid2" style="gap:7px">{note("<b>Split view.</b> Selecting in the list locks the map (retained targeting style: lock-on, rings, radar, grid); tapping a pin selects the row. Detail mode shows the portrait detail content.")}{note("<b>State persistence.</b> One view-state object (selection, filters, sort, scroll, map viewport) is shared by phone and desktop layouts, so switching is lossless both ways.")}</div>""","14 · Mobile — Landscape & Desktop Mode · Mock Data")
