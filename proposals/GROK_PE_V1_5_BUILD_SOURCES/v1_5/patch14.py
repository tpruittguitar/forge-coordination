# v1.4 patch: gen13.py -> gen14.py  (renumber sections, replace blocks, apply Tim's corrections)
import re
B='/workspace/pe/build15/'
s=open(B+'gen13.py').read()
def cut(a,b,ph,keep_b=True):
    global s
    i=s.index(a); j=s.index(b,i)
    if not keep_b: j+=len(b)
    s=s[:i]+ph+s[j:]
def R(a,b,cnt=1):
    global s
    n=s.count(a); assert n==cnt,(n,a[:90]); s=s.replace(a,b)
# ---- 1. placeholders for replaced blocks (old numbering) ----
cut('CH=[("1","Animation','</div></div>""","Changes in v1.3")\n','#<<CHANGES>>\n',keep_b=False)
cut('sec("05","Baseline Observations")\npage(','"05 · Baseline Observations")\n','#<<BASELINE>>\n#<<COVERAGE>>\n',keep_b=False)
cut('sec("12","Map System")','sec("13","Desktop Layout','#<<MAP>>\n#<<SCORING>>\n')
cut('sec("14","Mobile Redesign','sec("15","Implementation Plan")','#<<MOBILE>>\n')
R('for s,t,args in PH:\n    sec(s,t,1); ppage(s,"15 · "+t,phase(*args))\n','for s,t,args in PH:\n    sec(s,t,1); ppage(s,"15 · "+t,phase(*args))\n#<<REGISTER>>\n')
# ---- 2. renumber: 06-12 -> +1, 13+ -> +2 ----
def f(n):
    n=int(n); return n if n<=5 else (n+1 if n<=12 else n+2)
s=re.sub(r'sec\("(\d\d)((?:\.\d)?)"',lambda m:f'sec("{f(m.group(1)):02d}{m.group(2)}"',s)
s=re.sub(r'Section (\d\d)((?:\.\d)?)',lambda m:f'Section {f(m.group(1)):02d}{m.group(2)}',s)
s=re.sub(r'"(\d\d)((?:\.\d)?) · ',lambda m:f'"{f(m.group(1)):02d}{m.group(2)} · ',s)
s=re.sub(r'"(\d\d)–(\d\d) · ',lambda m:f'"{f(m.group(1)):02d}–{f(m.group(2)):02d} · ',s)
s=re.sub(r'>(\d\d)\.(\d) ',lambda m:f'>{f(m.group(1)):02d}.{m.group(2)} ',s)
s=re.sub(r'\("(\d\d)\.(\d)","(Phase|Track)',lambda m:f'("{f(m.group(1)):02d}.{m.group(2)}","{m.group(3)}',s)
# ---- 3. insert blocks ----
for k in ["CHANGES","BASELINE","COVERAGE","MAP","SCORING","MOBILE","REGISTER"]:
    R(f'#<<{k}>>\n',open(B+'blk/'+k.lower()+'.py').read()+'\n')
# ---- 4. CSS: >=10pt body ----
R('.small{font-size:9.5pt}','.small{font-size:10pt}')
R('table{width:100%;border-collapse:collapse;font-size:9.8pt}','table{width:100%;border-collapse:collapse;font-size:10pt}')
R('.sw .rl{font-size:9.2pt','.sw .rl{font-size:10pt')
R('.page:last-child{','.cov table td{padding:1.5px 6px;border:0;font-size:10pt;line-height:1.33;background:none!important}.cov table td.cl{width:58px;font-family:var(--mono);font-size:7.8pt;letter-spacing:.1em;text-transform:uppercase;padding-top:3px;white-space:nowrap}\n.page:last-child{')
# ---- 5. cover ----
R('<div class="num" style="font-size:20pt">18</div><div class="muted small">HF-01 – HF-18</div>','<div class="num" style="font-size:20pt">19</div><div class="muted small">HF-01 – HF-19</div>')
R('<div>1.3 <span class="muted">(supersedes 1.2)</span></div>','<div>1.4 <span class="muted">(supersedes 1.3)</span></div>')
R('<div class="label">Date</div><div>October 14, 2026</div>','<div class="label">Date</div><div>October 15, 2026</div>')
R('<div class="label">New in 1.3</div><div class="muted" style="font-size:10pt">Motion system · map as primary panel (targeting style retained) · 2560 × 1440 cockpit · iPhone 18 Pro redesign · HF-15 – HF-18</div>','<div class="label">New in 1.4</div><div class="muted" style="font-size:10pt">Full app coverage from the live inventory · scoring page section + HF-19 · map: selected job or filtered set, radar removed · mobile perimeter insets + camera keep-out · inventory task register</div>')
# ---- 6. hierarchy / requirements ----
R('<b>Layers mapped to the v1.3 cockpit</b>','<b>Layers mapped to the v1.4 cockpit</b>')
R('<td>11-column table (left) + live map (centre)</td>','<td>11-column table (left) + job map (centre)</td>')
R('("HF-16","Map as permanent primary panel (targeting style kept)","P1"),','("HF-16","Map panel: selected job or filtered set (targeting style kept)","P1"),')
R('("HF-18","Mobile redesign: portrait / landscape / desktop-mode","P2")]','("HF-18","Mobile redesign + perimeter insets, camera keep-out","P2"),\n("HF-19","Scoring page &amp; geo map: honest totals, scope, preview, recalc","P1")]')
R('"HF-18":"M"}','"HF-18":"M","HF-19":"1–3"}')
R('HF-15 – HF-18 are new in v1.3.','HF-15 – HF-18 new in v1.3; HF-19 new in v1.4.')
R('sec("08","Requirements HF-01 – HF-18")','sec("08","Requirements HF-01 – HF-19")')
R('"Every Layer-1 tile is clickable and filters the queue to exactly its population."],','"Every Layer-1 tile is clickable and filters the queue to exactly its population.","Inventory cases: Declined by Tim 0 / 56 / 57 and Employer rejected 0 / 2 / 7 (Trends · Scout results · Buckets) carry explicit scope (live / cohort / archive)."],')
R('"Remove duplicate Refresh / Status entry points."],None)','"Remove duplicate entry points: Settings tabs + cards, ⚙ vs Writer connection, three System-drawer triggers, Schedules / Health top tabs.","Writer banner / pill debounced (no “unreachable” flash on load); opening a job never causes a write."],None)')
R('"Map: permanent panel (HF-16); expand mode always shows Collapse + Esc; default zoom fits results; selection synced with queue.","Rail never covers content (push, don\'t overlay)."]','"Map: permanent panel (HF-16); fullscreen sits below the tab bar with always-visible ✕ Close + Esc; auto-fit; selection synced with queue.","Rail never covers content (push, don\'t overlay); Menu pin toggles with a visible Unpin."]')
R('catalog M-01 – M-17 (Section 12)','catalog M-01 – M-19 (Section 12); no radar sweep')
R('''("HF-16","Map as primary panel","P1",["Permanent panel at the centre of the cockpit; expand-to-focus with visible Collapse, Esc.","Score-band pins, clusters, radar, Chattanooga range rings, hover cards, filter reflection, two-way selection sync.","<b>Current military targeting style retained as design authority</b>; reticles, lock-on, grid, coordinates, brackets added."],"Map ↔ queue ↔ detail selection sync 100%; default zoom fits results; exit / collapse found unaided."),''','''("HF-16","Map panel — Tim's rule","P1",["Permanent centre panel showing <b>only the selected job</b>, or by default <b>the jobs in the current filtered selection</b> (current behaviour = design authority).","Score-band pins, two-way selection sync, hover cards, smooth animated auto-fit; fullscreen with visible ✕ Close + Esc.","Targeting look kept: reticle / lock-on, grid, coordinates, corner brackets. <b>No radar, range rings or clusters.</b>"],"Pin set == filtered rows 100 %; selection sync 100 %; close found unaided; 0 radar / ring / cluster elements."),''')
R('["Three zones: table 1160 · map 820 · workspace 508; KPI tiles, change strip, ticker.",','["Rail 56 (push) + three zones: table 1112 · map 800 · workspace 508 (job drawer); sub-tabs, KPI tiles, change strip, ticker.",')
R('"Targets ≥ 44 pt; decision buttons 52–56 pt."],"Swipe decisions reversible via Undo 100%; state kept across desktop-mode switch 100%.")]','"Perimeter: 24 pt side padding beyond safe area, 36 pt in corner zones, controls ≥ 16 pt above the home indicator; camera keep-out top (portrait) and left or right (landscape). Targets ≥ 44 pt."],"Undo 100 %; state kept across switch 100 %; 0 tap targets in keep-out zones, portrait and both landscape rotations."),\n("HF-19","Scoring page &amp; geo map","P1",["Settings › Flex policy &amp; scoring retained and enhanced (Section 14): honest total 100 % = 70 local + 30 shared FLEX.","LOCAL / SHARED badge per card; shared saves confirm + receipt + undo; live impact preview; recalc progress + ◌ provisional.","Geo map: targeting look, click-to-add, drag-to-move; canonical COMPENSATION_GEOGRAPHY is the authority."],"Per Section 14.1: total = visible sum; preview = actual change; ◌ on 100 % of stale scores.")]')
R('"08 · Requirement Detail (1/2)")','"09 · Requirement Detail (1/4)")') if False else None
s=s.replace('"09 · Requirement Detail (1/2)")','"09 · Requirement Detail (1/4)")').replace('"09 · Requirement Detail (2/3)")','"09 · Requirement Detail (2/4)")')
R('''<h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-14 – HF-18</span></h1>'+''.join(detcard(d) for d in det[13:]+det2),"09 · Requirement Detail (3/3)")''','''<h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-14 – HF-17</span></h1>'+''.join(detcard(d) for d in det[13:]+det2[:3]),"09 · Requirement Detail (3/4)")
page('<div class="sec">Section 09 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-18 – HF-19</span></h1>'+''.join(detcard(d) for d in det2[3:]),"09 · Requirement Detail (4/4)")''')
# ---- 7. visual / colour ----
R('Cyan glow on focus, processing, hover traces, lock-on and radar','Cyan glow on focus, processing, hover traces, lock-on and auto-fit trace')
R('incl. radar sweep, lock-on and traces','incl. lock-on reticle and hover traces')
# ---- 8. motion ----
R('("--pe-motion-radar","4000ms loop","linear","Radar revolution (map + loading)"),','("--pe-motion-fit","600ms","ease-inout","Map auto-fit pan / zoom to job or filtered set"),')
R('"Radar, sweeps, ticker")','"Sweeps, ticker, progress fill")')
R('t=1200   radar sweep begins steady loop             <span class="c">radar · linear</span>','t=1200   map auto-fits to the current view          <span class="c">fit · ease-inout</span>')
R('Tim Pruitt explicitly chose a <b>high-motion HUD</b> (v1.3).','Tim Pruitt explicitly chose a <b>high-motion HUD</b> (v1.3; kept in v1.4 — <b>minus the radar sweep</b>, removed everywhere).')
R('→ KPIs roll up → radar starts.','→ KPIs roll up → map auto-fits.')
R('("M-04","Radar sweep","Continuous; loading","Map sweep from home base, 4 s / rev · linear. Also the loading state for any panel (“ACQUIRING…”)."),','("M-04","Map auto-fit","Selection / filter change","Smooth animated pan + zoom to the selected job, or to the padded bounds of the filtered selection · fit 600 ms · ease-inout; any manual pan / zoom cancels it. <i>Replaces the v1.3 radar sweep.</i>"),')
R('("M-06","Pin drop / ping","New job on map","Pin drops 12 px with snap overshoot; one ping ring expands 0 → 28 px and fades · sweep 600 ms."),','("M-06","Pin drop","Job enters the filtered set","Pin drops 12 px with snap overshoot · base 240 ms. No ping rings."),')
R('("M-16","Map expand-to-focus","⤢ Expand / Collapse","Map scales to fill the workspace · base; Collapse, Esc or ⤢ reverses; selection and viewport kept."),','("M-16","Map fullscreen","⤢ Fullscreen / ✕ Close","Fills the workspace below the tab bar · base; always-visible ✕ Close or Esc reverses; selection and viewport kept."),')
R('springs back below threshold; haptic at threshold.")]','springs back below threshold; haptic at threshold."),\n("M-18","Recalc progress","Recalc running","Progress bar fills (roll 800 ms per update); ◌ provisional cross-fades to the final score when that job\'s recalc lands. No breathing — amber stays “queued” only."),\n("M-19","Panel loading","Data loading","Corner brackets draw + one scanline pass, label “ACQUIRING…”. Replaces the radar loading state.")]')
# ---- 9. desktop layout ----
R('''<pre style="font-size:8.4pt;line-height:1.45"><span class="c">┌ 20 margin ─────────────────────────────────────────────────────────── 2560 ┐</span>
 TOP BAR       56   brand · Writer status · motion state · search · CONCEPT
 KPI TILES    104   6 tiles: Review · New · Failed · Queued · Applied · Declined
 CHANGE STRIP  44   since last review · filter summary (reflected on map)
 MAIN        1108   <span class="k">TABLE 1160</span> │16│ <span class="k">MAP 820</span> │16│ <span class="k">WORKSPACE 508</span>
 TICKER        40   pipeline events feed, scrolls ←
<span class="c">└ row gap 12 · gutter 16 · margin 20 ─ 20+56+12+104+12+44+12+1108+12+40+20 = 1440 ┘</span></pre>''','''<pre style="font-size:8.4pt;line-height:1.45"><span class="c">┌ 20 ─ RAIL 56 (push) ─ 12 ──────────────────────────────────────────── 2560 ┐</span>
 TOP BAR       56   Menu · title · breadcrumb · search · Writer pill · Queue · Sync · Compare
 SUB-TABS      44   Jobs · Review queue · Decline candidates · My rulings · Map · Trends · Compare
 KPI TILES     96   Needs decision · Applied · Research · Interviews 14d · Writer · ◌ Provisional
 CHANGE STRIP  40   since last review · recalc · map mode
 MAIN        1068   <span class="k">TABLE 1112</span> │16│ <span class="k">MAP 800</span> │16│ <span class="k">JOB DRAWER 508</span>
 TICKER        36   pipeline events feed, scrolls ←
<span class="c">└ gaps 12 ─ 20+56+12+44+12+96+12+40+12+1068+12+36+20 = 1440 · 20+56+12+1112+16+800+16+508+20 = 2560 ┘</span></pre>''')
R('LC=[("Score + band","64"),("Δ since review","38"),("Role","186"),("Company","112"),("Location","116"),("Posted pay","94"),("Base pay (est.)","80"),("Degree flex","98"),("Source","74"),("Age","36"),("Write state","≈ 140 (fill)")]','LC=[("Score + band (SCORE) · ◌","64"),("Δ / New (NEW)","36"),("Title (TITLE)","184"),("Company (COMPANY)","112"),("Location (LOCATION)","112"),("Bucket (BUCKET)","104"),("Base pay est. (SALARY_BASE_EST)","72"),("Degree flex (FLEX_CLASS)","84"),("Exp. fit (EXPERIENCE_FIT)","56"),("Age (AGE)","36"),("Write state (new)","≈ 150 (fill)")]')
R('row 32 px → 31 rows visible.','row 32 px → 30 rows visible. LINK moves to the drawer Posting tab.')
R('<li><b>Map</b> 820 × 1064 · live, permanent (Section 13).</li><li><b>Workspace</b>: score ring, why, evidence, breakdown, recommended action, Pursue / Hold │ Decline, receipts with write states.</li>','<li><b>Map</b> 800 × 1024 · selected job, else filtered set (Section 13).</li><li><b>Job drawer</b>: real tabs Overview · Posting · Fit &amp; Score · Application · Documents · History; ring + rev; weights incl. FLEX; Pursue / Hold / Research │ Decline; receipts.</li>')
R('Three working zones plus top and bottom strips, map in the centre.','Real app chrome (left rail, top bar, Pipeline sub-tabs) plus three working zones, map in the centre.')
R('<span class="id">1</span> <b>Table · 1160</b><div class="muted">11 columns, 31 rows; rows stagger in (M-09); new rows cyan-wipe (M-08).</div>','<span class="id">1</span> <b>Table · 1112</b><div class="muted">11 app columns, readable labels, 30 rows, ◌ provisional; M-08 / M-09.</div>')
R('<span class="id">2</span> <b>Map · 820</b><div class="muted">Lock-on, radar, rings, clusters, hover card, pings; ⤢ Expand.</div>','<span class="id">2</span> <b>Map · 800</b><div class="muted">Selected job only, lock-on, coordinates, nearest geo point; Selected | Filtered.</div>')
R('<span class="id">3</span> <b>Workspace · 508</b><div class="muted">Materializes (M-03); ring draws on (M-10); write-state pulses (M-12).</div>','<span class="id">3</span> <b>Drawer · 508</b><div class="muted">Real tabs; rev 24; weights Σ 100 incl. FLEX; receipts (M-12).</div>')
R('<span class="id">4</span> <b>Strips</b><div class="muted">KPI roll-up (M-07), change strip, event ticker (M-15). Full-res PNG supplied.</div>','<span class="id">4</span> <b>Chrome</b><div class="muted">Rail, sub-tabs, KPIs incl. ◌ 185, change strip, ticker. Full-res PNG supplied.</div>')
s=s.replace('font-size:9pt"><span class="id">','font-size:10pt"><span class="id">')
# ---- 10. plan ----
R('("01","Integrity","HF-01 · 02 · 03 · 04 (errors)","One score, reconciled counts, truthful writes. <b>Still first.</b>",','("01","Integrity","HF-01 · 02 · 03 · 04 · 19 (data)","One score, reconciled counts, truthful writes, recalc + ◌ provisional, honest weights, no write on view. <b>Still first.</b>",')
R('"Context survives refresh; map becomes a permanent panel; motion tokens + core transitions."','"Context survives refresh; map per Tim\'s rule + fullscreen close; scope badges + shared-change guard; de-duplicated entry points; motion core."')
R('("03","Cognitive + visual + 2560","HF-07 – 11 · 15 · 16 · 17 + tokens","2560 cockpit, full motion catalog, map enhancements, palette."','("03","Cognitive + visual + 2560","HF-07 – 11 · 15 – 17 · 19 + tokens","2560 cockpit, full motion catalog, scoring page + geo map, palette."')
R('"iPhone portrait / landscape / desktop-mode; starts after Phase 2 gate, parallel to Phase 3."','"iPhone portrait / landscape / desktop-mode with perimeter insets + camera keep-out; after Phase 2 gate, parallel to Phase 3."')
R("Layout follows Tim\\'s v1.3 decisions: 2560 three-zone cockpit, map as a permanent primary panel in its current targeting style, high-motion standard.","Layout follows Tim\\'s v1.4 decisions: 2560 three-zone cockpit; map shows the selected job or the filtered set in its targeting style (no radar); high-motion standard; scoring page retained as authority.") if "Tim\\'s v1.3" in s else R("Layout follows Tim's v1.3 decisions: 2560 three-zone cockpit, map as a permanent primary panel in its current targeting style, high-motion standard.","Layout follows Tim's v1.4 decisions: 2560 three-zone cockpit; map shows the selected job or the filtered set in its targeting style (no radar); high-motion standard; scoring page retained as authority.")
R('<span class="k">+ map panel · motion tokens · core transitions</span>','<span class="k">+ map rule · scope guard · motion core</span>')
R('<span class="k">+ full motion catalog · map enhancements</span>','<span class="k">+ motion catalog · scoring page</span>')
R('"Expose state-machine events as the only source for write-state motion later (G2)."],','"Expose state-machine events as the only source for write-state motion later (G2).",\n"<b>Recalc + provisional</b> (HF-19): record carries model rev + computed-at; stale scores show ◌ everywhere; recalc progress 418 / 603 surfaced; root-cause drift (Anduril 77 → 72 → 59).",\n"<b>Honest weights</b>: 100 % = 70 local + 30 shared FLEX on Settings and in Fit &amp; Score; reconcile Declined 0 / 56 / 57 and Employer rejected 0 / 2 / 7.",\n"Opening a job never writes; debounce the Writer banner / pill (2 failed checks or 20 s grace)."],')
R('"Console clean across the 5 task scripts"],','"Console clean across the 5 task scripts","◌ on 100 % of stale scores; weights total = visible sum"],')
R('["HF-01","HF-02","HF-03","HF-04"],"Make every number','["HF-01","HF-02","HF-03","HF-04","HF-19"],"Make every number')
R('["Make the Compact toggle work or remove it; remove duplicate Refresh / Status entry points.",','["Make the Compact toggle work or remove it.",')
R('"<b>Map as permanent primary panel</b> (HF-16) in its current style: fit-to-results zoom, ⤢ Expand + visible Collapse + Esc, two-way selection sync.",','"<b>Map per Tim\'s rule</b> (HF-16): selected job only, else the filtered set; animated auto-fit; fullscreen below tabs with visible ✕ Close + Esc; remove radar, rings, clusters.",\n"<b>Scope + shared-change guard</b> (HF-19): LOCAL / SHARED badges; confirm + receipt + undo for FLEX, publish, registry, rules.",\n"<b>App-wide fixes</b> (T-08 – T-13, T-20 – T-22): rail Unpin, de-duplicated tabs / cards / drawer entries, ⚙ → Settings, path aliases, bulk-action confirm.",')
R('"Split Settings into <b>Local preferences</b> and <b>Shared model</b>; shared changes show impact and require confirmation.",\n','')
R('"Sidebar rail pushes content rather than overlaying it."],','"Sidebar rail pushes content rather than overlaying it."],',1)
R('["Settings separation spec","Context preservation + conflict guard","Map panel + motion core"],','["Scope + guard spec","Context preservation + conflict guard","Map rule + motion core"],')
R('["HF-04","HF-05","HF-06","HF-15","HF-16"],"Remove behavioral surprises','["HF-04","HF-05","HF-06","HF-15","HF-16","HF-19"],"Remove behavioral surprises')
R('"<b>Full motion catalog</b> M-01 – M-17 and <b>map enhancements</b> (clusters, hover cards, rings, radar, lock-on, filter reflection); phone moves to Track M.",','"<b>Full motion catalog</b> M-01 – M-19 (no radar) + map polish (hover cards, lock-on, readouts); phone in Track M.",\n"<b>Scoring page redesign</b> (HF-19, Section 14): weights bar, salary curve, impact preview, geo map targeting look, click-to-add / drag.",')
R('["HF-07","HF-08","HF-09","HF-10","HF-11","HF-15","HF-16","HF-17"],"Make review','["HF-07","HF-08","HF-09","HF-10","HF-11","HF-15","HF-16","HF-17","HF-19"],"Make review')
R('"p95 frame ≤ 16.7 ms with radar running",','"p95 frame ≤ 16.7 ms during map auto-fit; preview count = actual change",')
R('"Map tab: full-bleed targeting map in the retained style + bottom sheet (peek / half / full).",','"Map tab: selected job or filtered set, targeting style, floating sheet inside the insets.",\n"<b>Perimeter insets</b>: --pe-pad-side 24, --pe-pad-corner 36, --pe-lift-bottom 16, --pe-pad-land 20; camera keep-out top / left / right; test both landscape rotations.",')
R('["All decision targets ≥ 44 pt","Swipe decisions','["All decision targets ≥ 44 pt; 0 targets in keep-out zones","Swipe decisions')
# ---- 11. tokens ----
R('("--pe-target-min","44pt","phone targets"),("--pe-target-decision","52pt","phone Pursue / Hold")]','("--pe-target-min","44pt","phone targets"),("--pe-target-decision","52pt","phone Pursue / Hold"),\n("/* Scope &amp; state (v1.4) */",None,None),("--pe-scope-shared","var(--pe-amber)","SHARED badge"),("--pe-scope-local","var(--pe-text-secondary)","LOCAL badge"),("--pe-provisional","var(--pe-olive)","◌ recalc pending")]')
R('("--pe-motion-radar","4000ms"),','("--pe-motion-fit","600ms"),')
R('("/* Layout @ 2560 */",None),("--pe-margin","20px"),("--pe-gutter","16px"),("--pe-col-table","1160px"),("--pe-col-map","820px"),("--pe-col-work","508px"),("--pe-row-h","32px")]','("/* Layout @ 2560 */",None),("--pe-margin","20px"),("--pe-gutter","16px"),("--pe-col-rail","56px"),("--pe-col-table","1112px"),("--pe-col-map","800px"),("--pe-col-work","508px"),("--pe-row-h","32px"),\n("/* Mobile perimeter (v1.4) */",None),("--pe-pad-side","24pt"),("--pe-pad-corner","36pt"),("--pe-pad-top","12pt"),("--pe-lift-bottom","16pt"),("--pe-island-clear","16pt"),("--pe-pad-land","20pt")]')
R('/* PE tokens · v1.3 */','/* PE tokens · v1.4 */')
R('{ --pe-motion-radar: 0ms; --pe-motion-breathe: 0ms; <span class="c">/* off by default */</span> }','{ --pe-motion-breathe: 0ms; --pe-motion-fit: 120ms; <span class="c">/* off by default */</span> }\n<span class="k">.app</span> { padding: calc(env(safe-area-inset-top) + var(--pe-pad-top)) calc(env(safe-area-inset-right) + var(--pe-pad-side)) calc(env(safe-area-inset-bottom) + var(--pe-lift-bottom)) calc(env(safe-area-inset-left) + var(--pe-pad-side)); }')
R('<span class="k">.cockpit</span> { grid-template-columns: var(--pe-col-table) var(--pe-col-map) var(--pe-col-work); }','<span class="k">.cockpit</span> { grid-template-columns: var(--pe-col-rail) var(--pe-col-table) var(--pe-col-map) var(--pe-col-work); }')
R('<pre style="font-size:8pt;line-height:1.42;margin:0">{chr(10).join(l2)}</pre>','<pre style="font-size:7.6pt;line-height:1.3;margin:0;column-count:2;column-gap:14px">{chr(10).join(l2)}</pre>')
R('Lint:</b> no raw durations or easing curves in components','Lint:</b> no raw durations, easing curves or radar tokens in components')
R('.toc .row{display:flex;','.toc{column-count:2;column-gap:22px}.toc .row{break-inside:avoid;display:flex;')
R("page('<div class=\"sec\">Section 09</div><h1>Requirement Detail <span class=\"muted\" style=\"font-size:12pt;font-weight:400\">HF-01 – HF-05</span></h1>'+''.join(detcard(d) for d in det[:5])","page('<div class=\"sec\">Section 09</div><h1>Requirement Detail <span class=\"muted\" style=\"font-size:12pt;font-weight:400\">HF-01 – HF-04</span></h1>'+''.join(detcard(d) for d in det[:4])")
R("HF-06 – HF-13</span></h1>'+''.join(detcard(d) for d in det[5:13])","HF-05 – HF-11</span></h1>'+''.join(detcard(d) for d in det[4:11])")
R("HF-14 – HF-17</span></h1>'+''.join(detcard(d) for d in det[13:]+det2[:3])","HF-12 – HF-15</span></h1>'+''.join(detcard(d) for d in det[11:]+det2[:1])")
R("HF-18 – HF-19</span></h1>'+''.join(detcard(d) for d in det2[3:])","HF-16 – HF-19</span></h1>'+''.join(detcard(d) for d in det2[1:])")
R('(v1.3; kept in v1.4 — <b>minus the radar sweep</b>, removed everywhere).','(v1.3; kept in v1.4 minus the radar sweep).')
R(' The v1.2 rule “short purposeful animation only” is withdrawn everywhere. New standard: <b>animate anywhere it makes a little sense</b> — sliding, scrolling, sweeping, materializing — within guardrails G1–G6.',' Standard: <b>animate anywhere it makes a little sense</b>, within guardrails G1–G6.')
R('<div class="label" style="color:var(--t1);margin:9px 0 5px">Boot-up timeline','<div class="label" style="color:var(--t1);margin:5px 0 4px">Boot-up timeline')
R('<span class="c">└ gaps 12 ─ 20+56+12+44+12+96+12+40+12+1068+12+36+20 = 1440 · 20+56+12+1112+16+800+16+508+20 = 2560 ┘</span>','<span class="c">└ H: 20+56+12+44+12+96+12+40+12+1068+12+36+20 = 1440 · W: 20+56+12+1112+16+800+16+508+20 ┘</span>')
R('"Radar Cyan"','"Target Cyan"')
R('<td>Radar Cyan means','<td>Target Cyan means')
# ---- 12. acceptance / standard / meta ----
R('("<b>v1.3</b> · State kept across desktop-mode switch","100%")]','("<b>v1.3</b> · State kept across desktop-mode switch","100%"),("<b>v1.4</b> · Weights total = sum of visible rows (incl. FLEX)","100%"),("<b>v1.4</b> · Stale scores marked ◌ provisional","100%"),("<b>v1.4</b> · Shared saves with confirm + receipt + undo","100%"),("<b>v1.4</b> · Map pin set == filtered rows / selected job","100%"),("<b>v1.4</b> · Tap targets inside keep-out zones (all orientations)","0"),("<b>v1.4</b> · Writer false-alarm banners on load","0")]')
R('— and the tactical map is a primary panel whose military targeting style is retained.','— the tactical map is a primary panel in its retained military targeting style that shows only the selected job or the current filtered selection, and the scoring page stays the authority for how scores are set, with every local or shared change scoped, previewed and reversible.')
R('Proposed · v1.3 · October 14, 2026.','Proposed · v1.4 · October 15, 2026.')
R('<span>v1.3 · Oct 14 2026 · Prepared for Tim Pruitt</span>','<span>v1.4 · Oct 15 2026 · Prepared for Tim Pruitt</span>')
R('Implementation Plan v1.3</title>','Implementation Plan v1.4</title>')
R('Sections 12–14 contain concept screens built from mock data.','Sections 13–16 contain concept screens built from mock data (labelled CONCEPT — MOCK DATA).')
R('from mapsvg import map_svg\n','from mapsvg import map_svg, geo_heat_svg\n')
R('from mobile import portrait_queue, portrait_detail, portrait_map, landscape_map, landscape_desktop','from mobile import portrait_queue, portrait_detail, portrait_map, landscape_map, landscape_detail, landscape_desktop, keepout_diagrams')
open(B+'gen14.py','w').write(s)
print("patched")
