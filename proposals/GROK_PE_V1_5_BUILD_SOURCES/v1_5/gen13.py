CSS = r"""
@page { size: 8.5in 11in; margin: 0; }
@page land { size: 11in 8.5in; margin: 0; }
:root{
 --void:#000000; --hull:#0B0B0B; --plate:#141414; --raised:#1E1E1E; --seam:#2A2A2A; --grid:#3A3A3A;
 --t1:#E6E6E2; --t2:#A3A39E; --t3:#6B6B66;
 --green:#4ADE80; --amber:#F2B33D; --red:#FF4D3D; --cyan:#38E1D6; --olive:#8A8F7A; --tgrey:#5A5A5A;
 --mono:'IBM Plex Mono','Geist Mono','DejaVu Sans Mono',monospace;
 --sans:'Inter','IBM Plex Sans','DejaVu Sans',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#000;}
body{font-family:var(--sans);color:var(--t1);font-size:10.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;background:var(--void);page-break-after:always;break-after:page;padding:0.62in 0.68in 0.8in 0.68in}
.page.land{page:land;width:11in;height:8.5in;padding:0.55in 0.5in 0.7in 0.5in}
.page.land .hdr,.page.land .ftr{left:0.5in;right:0.5in}
.cc .card{margin:0!important}
.page:last-child{page-break-after:auto;break-after:auto}
.content{height:100%;overflow:hidden}
.hdr{position:absolute;top:0.28in;left:0.68in;right:0.68in;display:flex;justify-content:space-between;font-family:var(--mono);font-size:7.5pt;letter-spacing:.12em;color:var(--t3);text-transform:uppercase;border-bottom:1px solid var(--seam);padding-bottom:4px}
.ftr{position:absolute;bottom:0.32in;left:0.68in;right:0.68in;display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:7.5pt;letter-spacing:.12em;color:var(--t3);text-transform:uppercase;border-top:1px solid var(--seam);padding-top:5px}
.ftr .pn{color:var(--t1);font-family:var(--sans);font-weight:600;font-size:9pt;letter-spacing:.02em}
.ftr .st{color:var(--amber)}
.label{font-family:var(--mono);text-transform:uppercase;letter-spacing:.14em;font-size:8pt;color:var(--t2)}
.sec{font-family:var(--mono);font-size:8.5pt;letter-spacing:.18em;color:var(--cyan);text-transform:uppercase;margin-bottom:2px}
h1{font-size:21pt;font-weight:650;letter-spacing:-.01em;line-height:1.15;margin-bottom:12px;color:var(--t1)}
h2{font-size:13.5pt;font-weight:620;margin:16px 0 7px;color:var(--t1)}
h3{font-size:11pt;font-weight:620;margin:10px 0 4px}
p{margin-bottom:8px;color:var(--t1)}
.lead{font-size:12pt;color:var(--t1);line-height:1.5}
.muted{color:var(--t2)}
ul{margin:0 0 8px 0;padding-left:0;list-style:none}
ul li{position:relative;padding-left:14px;margin-bottom:3px}
ul li:before{content:"";position:absolute;left:0;top:.62em;width:6px;height:1px;background:var(--t2)}
.card{background:var(--plate);border:1px solid var(--seam);border-radius:2px;padding:10px 12px;margin-bottom:9px}
.hull{background:var(--hull);border:1px solid var(--seam);border-radius:2px;padding:10px 12px;margin-bottom:9px}
.bar-l{border-left:2px solid var(--cyan)}
.bar-g{border-left:2px solid var(--green)} .bar-a{border-left:2px solid var(--amber)} .bar-r{border-left:2px solid var(--red)} .bar-o{border-left:2px solid var(--olive)} .bar-t{border-left:2px solid var(--tgrey)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
.tag{display:inline-block;font-family:var(--mono);font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--seam);padding:1px 6px;border-radius:2px;color:var(--t2);white-space:nowrap}
.tag.p0{color:var(--red);border-color:#4a1d18}.tag.p1{color:var(--amber);border-color:#4a3a17}.tag.p2{color:var(--cyan);border-color:#17403d}.tag.p3{color:var(--t2)}
table{width:100%;border-collapse:collapse;font-size:9.8pt}
th{font-family:var(--mono);font-size:7.8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--t2);font-weight:500;text-align:left;padding:6px 8px;border-bottom:1px solid var(--grid);background:var(--hull)}
td{padding:5.5px 8px;border-bottom:1px solid var(--seam);vertical-align:top}
tr:nth-child(even) td{background:#070707}
.id{font-family:var(--mono);color:var(--cyan);font-size:9pt;white-space:nowrap}
.num{font-family:var(--sans);font-weight:600;font-variant-numeric:tabular-nums}
.stamp{display:inline-block;border:1px solid var(--amber);color:var(--amber);font-family:var(--mono);font-size:8pt;letter-spacing:.16em;padding:3px 9px;text-transform:uppercase}
.notice{border:1px solid #4a3a17;border-left:2px solid var(--amber);background:var(--hull);padding:9px 12px;margin:10px 0;font-size:10pt}
.notice b{color:var(--amber);font-family:var(--mono);font-size:8pt;letter-spacing:.14em;text-transform:uppercase;font-weight:500;margin-right:6px}
code,.code{font-family:var(--mono);font-size:8.8pt;color:var(--t1)}
pre{font-family:var(--mono);font-size:8.6pt;line-height:1.5;background:var(--hull);border:1px solid var(--seam);border-left:2px solid var(--cyan);padding:10px 12px;white-space:pre;color:var(--t1)}
pre .c{color:var(--t3)} pre .k{color:var(--cyan)}
.corner{position:absolute;width:22px;height:22px;border-color:var(--grid);border-style:solid}
.cover{padding:0.9in 0.85in}
.cover .grid-bg{position:absolute;inset:0;background-image:linear-gradient(var(--hull) 1px,transparent 1px),linear-gradient(90deg,var(--hull) 1px,transparent 1px);background-size:0.5in 0.5in}
.cover .inner{position:relative;height:100%;display:flex;flex-direction:column}
.cover h1{font-size:34pt;line-height:1.08;font-weight:680;margin:18px 0 14px;letter-spacing:-.015em}
.cover .sub{font-size:15pt;color:var(--t2);font-weight:400;line-height:1.35}
.meta{display:grid;grid-template-columns:auto 1fr;gap:6px 22px;margin-top:auto;border-top:1px solid var(--seam);padding-top:16px}
.meta .label{padding-top:2px}
.meta div:nth-child(even){font-size:11pt}
.toc .row{display:flex;align-items:baseline;padding:2.5px 0;border-bottom:1px solid var(--seam)}.toc .t{font-size:10.5pt!important}.toc .sub .t{font-size:10pt!important}
.toc .n{font-family:var(--mono);color:var(--cyan);width:44px;font-size:9pt}
.toc .t{flex:1;font-size:11.5pt}
.toc .sub .t{font-size:10pt;color:var(--t2);padding-left:14px}
.toc .sub{padding:2px 0;border-bottom:1px dashed #1a1a1a}
.toc .p{font-weight:600;font-variant-numeric:tabular-nums;width:40px;text-align:right}
.sw{display:grid;grid-template-columns:62px 1fr;gap:10px;align-items:center;background:var(--hull);border:1px solid var(--seam);border-radius:2px;padding:7px;margin-bottom:7px}
.chip{height:46px;border:1px solid var(--grid);border-radius:2px}
.sw .nm{font-weight:600;font-size:10.5pt}
.sw .hx{font-family:var(--mono);font-size:8.5pt;color:var(--t2);letter-spacing:.06em}
.sw .rl{font-size:9.2pt;color:var(--t2);line-height:1.35}
.sw .crx{font-family:var(--mono);font-size:7.5pt;color:var(--t3);letter-spacing:.06em}
.phase-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--grid);padding-bottom:6px;margin-bottom:8px}
.phase-h .pnum{font-family:var(--mono);font-size:24pt;color:var(--cyan);font-weight:500;line-height:1}
.phase-h .pt{font-size:16pt;font-weight:640}
.kv{display:grid;grid-template-columns:118px 1fr;gap:4px 12px;margin-bottom:6px}
.kv .label{padding-top:2px}
ol.tasks{list-style:none;counter-reset:t;margin-bottom:6px}
ol.tasks li{counter-increment:t;position:relative;padding-left:30px;margin-bottom:3.5px;font-size:10pt}
ol.tasks li:before{content:counter(t,decimal-leading-zero);position:absolute;left:0;top:1px;font-family:var(--mono);font-size:8pt;color:var(--t3)}
.small{font-size:9.5pt}
.bands{display:flex;gap:8px}
.band{flex:1;background:var(--hull);border:1px solid var(--seam);padding:9px 11px}
.band .bn{font-size:22pt;font-weight:650;line-height:1}
.sig .sw{padding:5px 7px;margin-bottom:6px}.sig .chip{height:36px}
.bands .band{padding:7px 10px}.band .bn{font-size:19pt}
table.tight td{padding:4px 8px}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}
"""
import html as H, re
def rl(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    A,B=rl(a),rl(b); A,B=max(A,B),min(A,B); return (A+0.05)/(B+0.05)
pages=[]; toc=[]
def page(body,hdr,land=False): pages.append((body,hdr,land))
def sec(num,title,level=0): toc.append((num,title,len(pages)+1,level))

cover = """
<div class="grid-bg"></div>
<span class="corner" style="top:.45in;left:.45in;border-width:1px 0 0 1px"></span>
<span class="corner" style="top:.45in;right:.45in;border-width:1px 1px 0 0"></span>
<span class="corner" style="bottom:.45in;left:.45in;border-width:0 0 1px 1px"></span>
<span class="corner" style="bottom:.45in;right:.45in;border-width:0 1px 1px 0"></span>
<div class="inner">
 <div class="label" style="color:var(--cyan)">PIPELINE EXPLORER // DECISION-SUPPORT PROGRAM</div>
 <div style="margin-top:1.3in"><span class="stamp">Proposed · no code or deployment authorized</span></div>
 <h1>Pipeline Explorer</h1>
 <div class="sub">Human Factors Proposal<br>&amp; Implementation Plan</div>
 <div style="margin-top:28px;max-width:5.6in;color:var(--t2);font-size:11pt;line-height:1.55">Turning a job-listing dashboard into a living decision-support cockpit: high information density, rich purposeful motion, a prominent tactical map, explicit evidence, and absolute clarity about system state.</div>
 <div style="display:flex;gap:18px;margin-top:34px">
  <div class="hull bar-g" style="flex:1;margin:0"><div class="label">Requirements</div><div class="num" style="font-size:20pt">18</div><div class="muted small">HF-01 – HF-18</div></div>
  <div class="hull bar-l" style="flex:1;margin:0"><div class="label">Phases</div><div class="num" style="font-size:20pt">5 + M</div><div class="muted small">Baseline → Adaptive + Mobile track</div></div>
  <div class="hull bar-a" style="flex:1;margin:0"><div class="label">Status</div><div class="num" style="font-size:20pt;color:var(--amber)">Proposed</div><div class="muted small">Awaiting approval</div></div>
 </div>
 <div class="meta">
  <div class="label">Version</div><div>1.3 <span class="muted">(supersedes 1.2)</span></div>
  <div class="label">Date</div><div>October 14, 2026</div>
  <div class="label">Prepared for</div><div>Tim Pruitt</div>
  <div class="label">Prepared by</div><div>Grok Bot</div>
  <div class="label">New in 1.3</div><div class="muted" style="font-size:10pt">Motion system · map as primary panel (targeting style retained) · 2560 × 1440 cockpit · iPhone 18 Pro redesign · HF-15 – HF-18</div>
 </div>
</div>"""
page(cover,None)
page("__TOC__","Contents")
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

sec("01","Purpose"); sec("02","The Four Questions"); sec("03","Governing Principles")
qs=["What needs my attention?","Which opportunities are worth pursuing?","Why does the system recommend that action?","What happened after I made a decision?"]
pr=[("P1","Trust before polish","Scores, counts, statuses and write confirmations are consistent and traceable."),
("P2","Recognition over recall","No internal codes or cross-screen memory required."),
("P3","Complexity on demand","Routine decisions simple; expert depth one step away, never removed."),
("P4","Fast, reversible actions","Fewest steps, protected against mistakes and failed writes."),
("P5","Situational awareness","Preserve selection; explain changes; distinguish normal / pending / failed / unknown."),
("P6","Operator control","Adaptive features recommend and organize; never silently override or rearrange."),
("P7","Living, truthful HUD","<b>Operator design-authority decision (v1.3):</b> rich motion wherever it helps — sliding, sweeping, materializing — running alongside instant actions and never hiding true state.")]
qhtml=''.join(f'<div class="card bar-l"><div class="label" style="color:var(--cyan)">Q{i+1}</div><div style="font-size:12pt;font-weight:560;margin-top:2px">{q}</div></div>' for i,q in enumerate(qs))
phtml=''.join(f'<tr><td class="id">{a}</td><td><b>{t}</b></td><td>{d}</td></tr>' for a,t,d in pr)
page(f"""<div class="sec">Section 01</div><h1>Purpose</h1>
<p class="lead">Turn Pipeline Explorer from a job-listing dashboard into a <b>decision-support cockpit</b>: high information density, low cognitive friction, explicit evidence, absolute clarity about system state.</p>
<div class="notice"><b>Status</b>Proposed. No code, backlog or deployment changes are authorized by this document.</div>
<div class="sec" style="margin-top:20px">Section 02</div><h1 style="font-size:17pt">The Four Questions</h1>
<p class="muted">Every screen should let Tim answer these within seconds.</p>
<div class="grid2">{qhtml}</div>
<div class="sec" style="margin-top:16px">Section 03</div><h1 style="font-size:17pt">Governing Principles</h1>
<table><tr><th style="width:44px">ID</th><th style="width:170px">Principle</th><th>Meaning</th></tr>{phtml}</table>""","01–03 · Purpose, Questions, Principles")

sec("04","Research Basis")
rb=[("Hick-Hyman","Organize meaningful choices; don't strip options."),
("Working memory","Miller 1956; Cowan 2001 (~3–5 chunks). Minimize what must be <b>remembered</b>, not what is <b>visible</b>. Not a cap on screen elements."),
("Fitts","Primary targets large and reachable; destructive actions separated."),
("Progressive disclosure","Frequent functions exposed; specialist tools deferred."),
("Gestalt","Group related data by spacing, alignment, consistent presentation."),
("Norman, emotional design","Visceral = orderly industrial look; behavioral = reliable controls; reflective = confidence the system is right."),
("Feedback / visibility","Nielsen heuristics: show true state and result of every action."),
("Adaptive UIs","The “81%” is the share of 211 studies (2012–2022) reporting <i>some</i> improvement — <b>not</b> an 81% gain. Treat as promising; test it."),
("NN/G data tables","Dense professional tables are correct for find / compare / act on multivariate records."),
("Motion (operator decision)","Tim explicitly chose a <b>high-motion HUD</b> as a design-authority decision (v1.3). Motion aids attention, continuity and change detection (NN/G animation guidance); guardrails keep it from blocking input, hiding state or flashing (WCAG 2.3.1).")]
bo=[("r","Score inconsistency","Same job showed 75 (table) vs 68 “Watch” → 70 → 75 “Strong” (detail); three names for one number."),
("r","Counters disagree","Header “0 need you” beside “Needs decision 50”. Applied 84 vs 26; Declined 57 vs 56; intake KPIs 0 while chart shows 138."),
("a","Table overflow","1549px table in ~800px pane: pay / flex / fit / age hidden; company / location clipped."),
("a","Decision friction","Two-step decide (button “prepares”, separate Save commits); Decline adjacent to Pursue."),
("a","Silent reorder","Rows / values reorder on refresh without highlight."),
("a","Map trap","Map tab full-screen with no clear exit; opens at 600% zoom. <span class='muted'>(v1.3: fixed by HF-16 — permanent panel.)</span>"),
("a","Misleading controls","Rail overlays content on hover; Settings says “presentation only” but has shared-model Update buttons."),
("a","Chart integrity","Trends source labels un-normalized (LinkedIn / LINKEDIN etc.); decline reasons show none despite 57 declines."),
("r","Runtime errors","Console TypeErrors at pipeline lines 1320 and 1326. Compact toggle has no effect."),
("g","Performance","Selection now ~0.55s (after “memoize scoring config” fix, 32s → 0.7s).")]
rbh=''.join(f'<tr><td><b>{a}</b></td><td>{d}</td></tr>' for a,d in rb)
boh=''.join(f'<div class="card bar-{c}" style="padding:9px 12px;margin-bottom:7px;display:grid;grid-template-columns:150px 1fr;gap:10px"><div class="label" style="padding-top:2px">{t}</div><div class="small">{d}</div></div>' for c,t,d in bo)
page(f"""<div class="sec">Section 04</div><h1>Research Basis <span class="muted" style="font-size:12pt;font-weight:400">(correctly applied)</span></h1>
<table><tr><th style="width:150px">Source</th><th>Application to Pipeline Explorer</th></tr>{rbh}</table>
<div class="hull bar-l small" style="margin-top:14px"><b>How to read this basis.</b> These findings justify <i>organizing</i> information, not removing it. Pipeline Explorer is an expert tool used daily; density is an asset when grouping, labeling and disclosure make it scannable. Every quantitative claim used in this proposal is stated with its correct scope.</div>""","04 · Research Basis")
sec("05","Baseline Observations")
page(f"""<div class="sec">Section 05</div><h1>Baseline Observations</h1>
<p class="muted small" style="margin-top:-6px">Grok Bot review · Oct 14, 2026 · live build · bar color = severity (red integrity, amber friction, green resolved)</p>{boh}""","05 · Baseline Observations")

sec("06","Information Hierarchy")
layers=[("Layer 1","Operational state","Needs review, New, Write failures, Applied (each scoped and labeled)."),
("Layer 2","Scan / compare","Title, employer, score, posted pay, location, degree flex, age."),
("Layer 3","Decide","Selected job evidence, plain-English score reason, degree wording, pay assumptions, actions."),
("Layer 4","Depth","Source records, score history, raw codes, Writer receipts, AI analysis, audit trail.")]
reqs=[("HF-01","One authoritative score, one name, identical across views","P0"),
("HF-02","Every counter has defined population, window, source","P0"),
("HF-03","Transactional decisions: queued / processing / confirmed / failed / undo","P0"),
("HF-04","Fix runtime errors and misleading controls","P1"),
("HF-05","Preserve selection, filters, scroll on refresh; conflict guard","P1"),
("HF-06","Predictable map, navigation, sidebar","P1"),
("HF-07","Customizable high-density table (11-col default)","P2"),
("HF-08","Readable labels over internal codes","P2"),
("HF-09","Score rationale and uncertainty","P2"),
("HF-10","“Since your last review” summary","P2"),
("HF-11","Normalized chart categories; preserved decline reasons","P2"),
("HF-12","Explainable, opt-in personalization","P3"),
("HF-13","Phone scope: read + decide","P2"),
("HF-14","Usability baseline before any change","P0"),
("HF-15","Motion system: tokens, catalog, guardrails","P2"),
("HF-16","Map as permanent primary panel (targeting style kept)","P1"),
("HF-17","2560 × 1440 primary desktop layout","P2"),
("HF-18","Mobile redesign: portrait / landscape / desktop-mode","P2")]
phase_of={"HF-14":"0","HF-01":"1","HF-02":"1","HF-03":"1","HF-04":"1–2","HF-05":"2","HF-06":"2","HF-07":"3","HF-08":"3","HF-09":"3","HF-10":"3","HF-11":"3","HF-13":"3","HF-12":"4","HF-15":"2–3","HF-16":"2–3","HF-17":"3","HF-18":"M"}
lc=["#38E1D6","#A3A39E","#6B6B66","#3A3A3A"]
lh=''.join(f'<div class="card" style="margin:0;padding:7px 12px;display:grid;grid-template-columns:70px 130px 1fr;gap:10px;margin-left:{i*14}px;border-left:2px solid {lc[i]}"><div class="label" style="padding-top:2px">{a}</div><b>{t}</b><div class="small">{d}</div></div>' for i,(a,t,d) in enumerate(layers))
rh=''.join(f'<tr><td class="id">{i}</td><td>{t}</td><td><span class="tag {p.lower()}">{p}</span></td><td class="label">{phase_of[i]}</td></tr>' for i,t,p in reqs)
page(f"""<div class="sec">Section 06</div><h1>Information Hierarchy</h1>
<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px">{lh}</div>
<p class="small muted">Layout (v1.3, Tim-approved): <b style="color:var(--t1)">review table left · live map centre · selected job + decisions right</b>; KPI tiles + change strip on top, event ticker below.</p>
<div class="hull bar-l small" style="margin-top:4px"><b>Layers mapped to the v1.3 cockpit</b></div><table class="tight"><tr><th style="width:80px">Layer</th><th style="width:190px">Desktop 2560 zone</th><th>Phone (portrait)</th></tr><tr><td class="id">1</td><td>KPI tiles + change strip (top)</td><td class="small">KPI strip + change strip</td></tr><tr><td class="id">2</td><td>11-column table (left) + live map (centre)</td><td class="small">Swipe cards · Map tab</td></tr><tr><td class="id">3</td><td>Selected-job workspace (right)</td><td class="small">Job detail · map bottom sheet</td></tr><tr><td class="id">4</td><td>Breakdown drawers, receipts, ticker</td><td class="small">Desktop mode</td></tr></table>""","06 · Information Hierarchy")
sec("07","Requirements HF-01 – HF-18")
page(f"""<div class="sec">Section 07</div><h1>Requirements</h1>
<table><tr><th style="width:62px">ID</th><th>Requirement</th><th style="width:48px">Pri</th><th style="width:58px">Phase</th></tr>{rh}</table>
<p class="small muted" style="margin-top:6px">Priority: P0 integrity / precedes all else · P1 workflow safety · P2 cognitive efficiency · P3 optional enhancement. Phase column maps to Section 15; “M” = Mobile track. HF-15 – HF-18 are new in v1.3.</p>""","07 · Requirements")

det=[("HF-01","One score, one meaning","P0",["Single scoring record: value, score type, rule/model version, computed-at, evidence status.","Queue, detail, map, compare render from that record. One display name everywhere.","Alternative / historical scores explicitly labeled, never silently substituted.","<b>First suspect:</b> the memoized scoring config (lag fix). Verify cache invalidation when rules/weights change."],"Identical value and band for the same job / type / version in every view."),
("HF-02","Counts that reconcile","P0",["Each counter documents population, filters, time window, source. “Applied – all time” vs “Applied – this view” labeled.","Every Layer-1 tile is clickable and filters the queue to exactly its population."],"Every counter matches its documented query; tile click count == rows shown."),
("HF-03","Decisions that show the truth","P0",["One click begins a write; no separate Save for routine decisions.","States: queued, processing, confirmed, failed, superseded. Receipt + Undo shown directly under the action buttons.","Queued state shows time waiting and any upcoming Writer blackout window (Writer latency of 20–45 min and blackouts are normal, not failures).","Failed actions stay visible, keep payload, retry without duplicate canonical writes.","Decline visually separated from Pursue."],"Simulated Writer failures never show success, never drop decisions, never duplicate rows."),
("HF-04","Behavioral surprises","P1",["Fix console errors (lines 1320 / 1326). Make Compact toggle work or remove it.","Settings clearly separates local preferences from shared-model changes; shared changes warn and confirm.","Remove duplicate Refresh / Status entry points."],None),
("HF-05","Context preservation and conflict guard","P1",["Refresh keeps selected job, filters, sort, scroll.","New / changed rows highlighted briefly instead of silent reorder.","If a bot changes the selected job after it was opened, warn before the decision commits; never overwrite silently."],None),
("HF-06","Navigation","P1",["Map: permanent panel (HF-16); expand mode always shows Collapse + Esc; default zoom fits results; selection synced with queue.","Rail never covers content (push, don't overlay)."],None),
("HF-07","Density preserved","P2",["Keep 11-column desktop default; adjustable widths; column priority settings.","No horizontal overflow for priority columns (title, company, location, score, posted pay, age); clip nothing mid-word.","Target 15–20 visible rows at standard desktop viewport. Queue rows show posted pay + age next to score."],None),
("HF-08","Readable labels","P2",["<code>SALARY_BASE_EST</code> → “Base pay (est.)”; <code>FLEX_CLASS</code> → “Degree flex”; <code>RESOLVED/APPLIED_CONFIRMED</code> → “Applied – confirmed”. Raw codes live in Layer 4."],None),
("HF-09","Score rationale","P2",["One plain-English line next to every score (e.g., “Startup ramp role, $200–250K posted, degree required – flex”).","Breakdown and uncertainty one click away."],None),
("HF-10","Change summary","P2",["Strip: “Since your last review: N new · N scores changed · N Writer retries needed”, each item clickable."],None),
("HF-11","Data integrity in charts","P2",["Normalize source names case-insensitively; persist decline reason codes."],None),
("HF-12","Personalization (last)","P3",["Learns from overrides (e.g., frequent declines of manager-level non-priority roles); advisory only, explains itself, reversible.","Never alters canonical rules, applies to jobs, or decides for the user."],None),
("HF-13","Phone","P2",["Phone scope: Layer 1 counts, change summary, queue, selected job, decide / undo.","Targets ≥ 44px for decision buttons (WCAG 2.2 minimum 24px). Editing rules / settings is desktop only. <b>Expanded by HF-18 (v1.3).</b>"],None),
("HF-14","Baseline first","P0",["Before any change, time 5 real review tasks on the current build; record time, errors, extra navigation, scrolling, perceived difficulty. Repeat after each phase."],None)]
def detcard(d):
    i,t,p,items,acc=d
    a=f'<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--seam)" class="small"><span class="label" style="color:var(--green)">✓ Accept</span>&nbsp; {acc}</div>' if acc else ''
    li=''.join(f'<li>{x}</li>' for x in items)
    return f'<div class="card" style="padding:7px 12px;margin-bottom:7px"><div style="display:flex;gap:10px;align-items:baseline;margin-bottom:3px"><span class="id">{i}</span><b style="font-size:11pt">{t}</b><span style="margin-left:auto" class="tag {p.lower()}">{p}</span></div><ul class="small" style="margin-bottom:0">{li}</ul>{a}</div>'
sec("08","Requirement Detail")
page('<div class="sec">Section 08</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-01 – HF-05</span></h1>'+''.join(detcard(d) for d in det[:5]),"08 · Requirement Detail (1/2)")
page('<div class="sec">Section 08 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-06 – HF-13</span></h1>'+''.join(detcard(d) for d in det[5:13]),"08 · Requirement Detail (2/3)")
det2=[("HF-15","Motion system","P2",["Rich motion is the standard (operator decision): named duration and easing tokens; catalog M-01 – M-17 (Section 11).","Guardrails: never blocks input, never hides true state, 60 fps GPU-only, flash-safe.","<b>Reduce motion</b> toggle in Local preferences, off by default."],"0 input blocked by animation; p95 frame ≤ 16.7 ms; every animation maps to a token; write-state motion never precedes the state event."),
("HF-16","Map as primary panel","P1",["Permanent panel at the centre of the cockpit; expand-to-focus with visible Collapse, Esc.","Score-band pins, clusters, radar, Chattanooga range rings, hover cards, filter reflection, two-way selection sync.","<b>Current military targeting style retained as design authority</b>; reticles, lock-on, grid, coordinates, brackets added."],"Map ↔ queue ↔ detail selection sync 100%; default zoom fits results; exit / collapse found unaided."),
("HF-17","2560 × 1440 desktop layout","P2",["Three zones: table 1160 · map 820 · workspace 508; KPI tiles, change strip, ticker.","All 11 columns visible without horizontal scroll; ≥ 30 rows; type scale per Section 13."],"11 / 11 columns and ≥ 30 rows at 2560 × 1440; 0 clipped priority cells."),
("HF-18","Mobile redesign","P2",["iPhone 18 Pro (assumed 402 × 874 pt): portrait cards with swipe decisions + haptics, tab bar, full-bleed map + sheet.","Landscape split view; desktop-mode switch with state persisting both ways.","Targets ≥ 44 pt; decision buttons 52–56 pt."],"Swipe decisions reversible via Undo 100%; state kept across desktop-mode switch 100%.")]
page('<div class="sec">Section 08 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-14 – HF-18</span></h1>'+''.join(detcard(d) for d in det[13:]+det2),"08 · Requirement Detail (3/3)")
sec("09","Visual Standards"); sec("10","Color System")
base=[("#000000","Void","Page background"),("#0B0B0B","Hull","Panels"),("#141414","Plate","Cards / rows"),("#1E1E1E","Raised","Hover / selected"),("#2A2A2A","Seam","Borders"),("#3A3A3A","Gridline","Map grid")]
text=[("#E6E6E2","Primary","Body text, values, titles"),("#A3A39E","Secondary","Supporting text, labels"),("#6B6B66","Muted","Metadata · non-essential only")]
sig=[("#4ADE80","HUD Green","Fits rules · confirmed · <b>Pursue</b>","✓"),("#F2B33D","Amber Caution","Flex question · queued · <b>Hold</b>","◷"),("#FF4D3D","Alert Red","Hard block · failed · <b>Decline</b>","✕"),("#38E1D6","Radar Cyan","Selection · focus · links — the only “live” color","◉"),("#8A8F7A","Olive Drab","Discovery leads · unverified","?"),("#5A5A5A","Terminal Grey","Closed · declined","■")]
def sw(h,n,r,ic="",tc=None,stack=False):
    nm=f'<span class="nm" style="color:{tc}">{ic}&nbsp;{n}</span>' if tc else f'<span class="nm">{n}</span>'
    return f'<div class="sw"><div class="chip" style="background:{h}"></div><div><div style="display:flex;justify-content:space-between;align-items:baseline">{nm}<span class="hx">{h}</span></div><div class="rl">{r}</div><div class="crx">CONTRAST ON VOID {cr(h,"#000000"):.1f}:1</div></div></div>'
vs=["Black and neutral grey; <b>no blue-tinted charcoal</b>. Emphasis by contrast, weight, spacing, restrained status color.","One color = one meaning everywhere: green fits rules; amber flex/question; red hard block/failed; grey terminal.","Clear type hierarchy; minimize tiny text.","<b>Rich motion by operator decision (v1.3):</b> animate anywhere it makes a little sense — sliding, scrolling, sweeping, materializing — under the Motion System guardrails (Section 11).","<b>Map style retained:</b> the current military targeting look is design authority and is only enhanced (Section 12).","Visible focus, WCAG 2.2 AA contrast, logical keyboard order, keyboard shortcuts documented in a help overlay (not tiny inline text).","Emotional target: <b>confidence and control</b> in a living HUD — motion says the system is alive and working, never that it is unsure."]
th=''.join(f'<div class="sw" style="grid-template-columns:1fr"><div style="font-size:15pt;font-weight:600;color:{h};line-height:1.1">Aa 84</div><div><div style="display:flex;justify-content:space-between"><span class="nm">{n}</span><span class="hx">{h}</span></div><div class="rl">{r}</div><div class="crx">VOID {cr(h,"#000000"):.1f}:1 · PLATE {cr(h,"#141414"):.1f}:1</div></div></div>' for h,n,r in text)
page(f"""<div class="sec">Section 09</div><h1>Visual Standards</h1>
<ul>{''.join(f'<li>{x}</li>' for x in vs)}</ul>
<div class="sec" style="margin-top:14px">Section 10</div><h1 style="font-size:17pt">Color System <span class="muted" style="font-size:11pt;font-weight:400">· futuristic military HUD · black / neutral grey · no blue tint</span></h1>
<div class="label" style="color:var(--t1);margin:4px 0 6px">10.1 Base surfaces</div>
<div class="grid2" style="gap:0 9px">{''.join(sw(*x) for x in base)}</div>
<div class="label" style="color:var(--t1);margin:6px 0 6px">10.2 Text</div>
<div class="grid3" style="gap:0 9px">{th}</div>
<p class="small muted" style="margin-top:4px">Contrast note: Muted <code>#6B6B66</code> is {cr("#6B6B66","#000000"):.1f}:1 on Void (below 4.5:1), so it is limited to non-essential metadata or large text. Terminal Grey <code>#5A5A5A</code> ({cr("#5A5A5A","#000000"):.1f}:1) is used for dots and bars only and always carries a word label in Secondary text.</p>""","09–10 · Visual Standards, Color System")

sgh=''.join(sw(h,n,r,ic,h) for h,n,r,ic in sig)
page(f"""<div class="sec">Section 10 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Color System — Signal, Bands, Rules</h1>
<div class="label" style="color:var(--t1);margin-bottom:6px">10.3 Signal colors</div>
<div class="grid2 sig" style="gap:0 9px">{sgh}</div>
<div class="label" style="color:var(--t1);margin:8px 0 6px">10.4 Score bands</div>
<div class="bands">
 <div class="band" style="border-left:2px solid var(--green)"><div class="label">80 – 100</div><div class="bn" style="color:var(--green)">✓ Strong</div><div class="small muted">HUD Green · icon + word</div></div>
 <div class="band" style="border-left:2px solid var(--amber)"><div class="label">65 – 79</div><div class="bn" style="color:var(--amber)">◷ Watch</div><div class="small muted">Amber Caution · icon + word</div></div>
 <div class="band" style="border-left:2px solid var(--red)"><div class="label">&lt; 65</div><div class="bn" style="color:var(--red)">✕ Weak</div><div class="small muted">Alert Red · icon + word</div></div>
</div>

<p class="small muted" style="margin-top:5px">Bands derive from the single authoritative score record (HF-01); band names are never re-derived per view.</p>
<div class="label" style="color:var(--t1);margin:8px 0 6px">10.5 Usage rules</div>
<table class="tight">
<tr><th style="width:118px">Rule</th><th>Standard</th><th style="width:140px">Example</th></tr>
<tr><td><b>Typography</b></td><td>Monospace <b>uppercase</b> for labels only; sans-serif for numbers and titles.</td><td><span class="label">POSTED PAY</span> <span class="num">$212K</span></td></tr>
<tr><td><b>Glow</b></td><td>Cyan glow on focus, processing, hover traces, lock-on and radar (<code>0 0 6px</code>, 40%); one-shot green confirm flash. At rest nothing else glows.</td><td><span style="display:inline-block;border:1px solid var(--cyan);box-shadow:0 0 6px rgba(56,225,214,.4);padding:1px 8px;font-size:9pt">Focused</span></td></tr>
<tr><td><b>Borders &amp; corners</b></td><td>1px Seam borders; sharp or 2px corners. No pills, no soft shadows.</td><td><span style="display:inline-block;border:1px solid var(--seam);border-radius:2px;padding:1px 8px;background:var(--plate);font-size:9pt">Panel</span></td></tr>
<tr><td><b>Signal use</b></td><td>Signal colors on text, thin left bars and dots — <b>never large fills</b>.</td><td><span style="border-left:2px solid var(--amber);padding-left:6px;font-size:9pt"><span class="dot" style="background:var(--amber)"></span>Queued 12m</span></td></tr>
<tr><td><b>Never color alone</b></td><td>Every signal pairs with an icon or a word (WCAG 1.4.1), so meaning survives color-vision differences.</td><td><span style="color:var(--red);font-size:9pt">✕ Write failed</span></td></tr>
<tr><td><b>Cyan scarcity</b></td><td>Radar Cyan means live / interactive / focused — incl. radar sweep, lock-on and traces. Never used for status or decoration.</td><td><span style="color:var(--cyan);font-size:9pt">◉ Selected</span></td></tr>
</table>
""","10 · Color System (continued)")

# ---------- v1.3 new sections (inserted after Color System) ----------
import sys; sys.path.insert(0,'/workspace/pe/build15')
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

sec("15","Implementation Plan")
seq=[("00","Baseline","HF-14","Measured baseline of 5 real review tasks.","Baseline report + discrepancy register signed off."),
("01","Integrity","HF-01 · 02 · 03 · 04 (errors)","One score, reconciled counts, truthful writes. <b>Still first.</b>","No unexplained cross-view discrepancy; zero false successes."),
("02","Workflow + motion core","HF-04 · 05 · 06 · 15 (core) · 16 (panel)","Context survives refresh; map becomes a permanent panel; motion tokens + core transitions.","Refresh keeps context; motion never blocks input."),
("03","Cognitive + visual + 2560","HF-07 – 11 · 15 · 16 · 17 + tokens","2560 cockpit, full motion catalog, map enhancements, palette.","Measured faster review, no accuracy loss; 60 fps."),
("04","Adaptive","HF-12","Opt-in, explainable personalization.","Explainable, reversible, subordinate to canonical rules and Tim's decisions."),
("M","Mobile track","HF-13 · 18","iPhone portrait / landscape / desktop-mode; starts after Phase 2 gate, parallel to Phase 3.","Swipe decisions reversible; state kept across switch.")]
sh=''.join(f'<tr><td class="id">{a}</td><td><b>{t}</b></td><td class="small">{r}</td><td class="small">{o}</td><td class="small">{g}</td></tr>' for a,t,r,o,g in seq)
pc=["#A3A39E","#FF4D3D","#F2B33D","#38E1D6","#8A8F7A"]; gt=["SIGN-OFF","0 FALSE OK","CONTEXT 100%","TIMED RE-TEST","OPT-IN"]
flow=''.join(f'<div style="flex:1;border:1px solid var(--seam);border-top:2px solid {c};padding:6px 8px;background:var(--hull)"><div style="color:var(--t1)">{s[0]} {s[1].upper()}</div><div style="color:var(--t3);margin-top:2px">GATE ▸ {g}</div></div>' for s,c,g in zip(seq,pc,gt))
page(f"""<div class="sec">Section 15</div><h1>Implementation Plan — Overview</h1>
<div class="notice"><b>Authorization</b>This plan is <b>proposed only</b>. No code, backlog, deployment or shared-model changes are authorized by this document. Each phase starts only on Tim's explicit approval.</div>
<h2 style="margin-top:8px">Sequence and gates</h2>
<table class="tight"><tr><th style="width:30px">#</th><th style="width:118px">Phase</th><th style="width:150px">Requirements</th><th>Objective</th><th style="width:150px">Exit gate</th></tr>{sh}</table>
<p class="small muted" style="margin-top:6px">HF-14 timing is re-run at the end of every phase. No phase begins until the previous gate is reviewed with Tim. No motion or layout work starts before the Phase 1 gate.</p>
""","15 · Implementation Plan — Overview")
page(f"""<div class="sec">Section 15 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Sequencing &amp; Cross-cutting Constraints</h1><pre style="font-size:8.4pt;line-height:1.55"><span class="c">PHASE            ────────────────────────────── time ──────────────────────────────▶</span>
00 Baseline      ████
01 Integrity         ██████████  <span class="c">◀ first; no motion / layout work before this gate</span>
02 Workflow                ████████  <span class="k">+ map panel · motion tokens · core transitions</span>
03 Cog + 2560                      ████████████  <span class="k">+ full motion catalog · map enhancements</span>
04 Adaptive                                    ██████
<span class="k">M  Mobile</span>                          <span class="k">░░░░░░░░░░░░░░░░</span>  <span class="c">starts after Phase 2 gate · parallel</span></pre><div class="grid2 cc" style="gap:7px;margin-top:10px">
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer queue latency (20–45 min).</b> <span class="small">Writes routinely take 20–45 min; “queued” and “processing” are normal, not errors. Timings measure time-to-decision, not time-to-confirmation; queued motion (breathe) must never read as a fault.</span></div>
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer blackout windows.</b> <span class="small">No commits accepted; decisions queue with payload and show the window end. No rollout steps inside a blackout; fault tests simulate one.</span></div>
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Multi-bot edits.</b> <span class="small">Each decision carries the record version seen at open; a mismatch triggers the conflict guard (HF-05) and a <i>superseded</i> state. Bulk bot updates summarize in the change strip and ticker rather than individually animating.</span></div>
<div class="card bar-t" style="padding:8px 12px;margin-bottom:0"><b>Design authority.</b> <span class="small">Layout follows Tim's v1.3 decisions: 2560 three-zone cockpit, map as a permanent primary panel in its current targeting style, high-motion standard. Further layout changes need Tim's explicit approval. Shared-model / rule changes stay out of scope in every phase.</span></div></div>""","15 · Implementation Plan — Constraints")

def phase(num,title,reqids,obj,tasks,deliv,gate,risks):
    tg=''.join(f'<span class="tag p2" style="margin-left:4px">{r}</span>' for r in reqids)
    tk=''.join(f'<li>{t}</li>' for t in tasks)
    dl=''.join(f'<li>{x}</li>' for x in deliv); gl=''.join(f'<li>{x}</li>' for x in gate); rk=''.join(f'<li>{x}</li>' for x in risks)
    return f"""<div class="phase-h"><span class="pnum">{num}</span><span class="pt">{title}</span><span style="margin-left:auto">{tg}</span></div>
<div class="kv"><div class="label">Objective</div><div>{obj}</div></div>
<div class="label" style="margin:6px 0 5px">Tasks</div><ol class="tasks">{tk}</ol>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l" style="margin:0"><div class="label" style="color:var(--cyan);margin-bottom:3px">Deliverables</div><ul class="small" style="margin:0">{dl}</ul></div>
<div class="card bar-g" style="margin:0"><div class="label" style="color:var(--green);margin-bottom:3px">Exit gate · acceptance tests</div><ul class="small" style="margin:0">{gl}</ul></div></div>
<div class="card bar-a" style="margin-top:9px"><div class="label" style="color:var(--amber);margin-bottom:3px">Risks &amp; mitigations</div><ul class="small" style="margin:0">{rk}</ul></div>"""
def ppage(secno,hdr,html,prefix=""): page(f'<div class="sec">Section {secno}</div>'+html,hdr)

PH=[("15.1","Phase 0 — Baseline",("00","Baseline",["HF-14"],"Measure the current build before anything changes, so every later gate is judged against real numbers rather than impressions.",
["Script 5 representative review tasks: (a) find the job that needs action, (b) state the main score drivers for a given job, (c) disposition a straightforward job, (d) reconcile the Applied count, (e) find the previously selected job after a refresh.",
"Run each task on the live build across at least 3 sessions; record completion time, errors, extra navigation, scrolling, and perceived difficulty (1–7 single-ease question).",
"Snapshot score value, band and label for 20 sample jobs in table, detail, map and compare views, with timestamps.",
"Snapshot every counter (header, KPI tiles, Trends) with the query it appears to represent; log mismatches (Applied 84 vs 26, Declined 57 vs 56, intake 0 vs 138, “0 need you” vs 50).",
"Capture console logs (TypeErrors at lines 1320 / 1326), selection latency (~0.55s), and an inventory of raw internal codes visible in Layers 1–3.",
"Record Writer queue depth and any blackout window active during each session."],
["Baseline report (timings, errors, difficulty)","Discrepancy register: scores and counters","Reusable task scripts for each re-test"],
["All 5 tasks timed in ≥ 3 sessions","Discrepancy register reviewed and signed off by Tim","No product changes made during the phase"],
["Bots change data mid-session → timestamp every snapshot and note Writer queue state.","Small sample → report medians and ranges; treat targets as directional, not statistical proof."])),
("15.2","Phase 1 — Integrity",("01","Integrity",["HF-01","HF-02","HF-03","HF-04"],"Make every number, count and decision state truthful and identical everywhere before improving anything else.",
["Define the single scoring record {value, score type, rule/model version, computed-at, evidence status}; route queue, detail, map and compare through one selector.",
"Audit the memoized scoring config: key the cache on a rules/weights version hash and invalidate on change, keeping the ≤ 0.7s selection budget.",
"Adopt one display name for the score; label any historical or alternative score explicitly.",
"Write a counter registry (population, filters, window, source) for every Layer-1 tile and header count; each tile applies that exact query to the queue.",
"Implement a one-click decision state machine: queued → processing → confirmed | failed | superseded, with an idempotency key per decision.",
"Show receipt + Undo under the buttons; queued shows time waiting and the next blackout window; failed keeps its payload and offers Retry.",
"Fix console TypeErrors at pipeline lines 1320 / 1326.",
"Expose state-machine events as the only source for write-state motion later (G2)."],
["Scoring record spec + single selector","Counter registry document","Decision state machine with receipts","Fault-injection test suite"],
["Cross-view score consistency 100% on all jobs","Counter reconciliation 100%; tile click count == rows shown","Fault injection (timeout, 5xx, duplicate ack, blackout): 0 false successes, 0 dropped, 0 duplicates","Console clean across the 5 task scripts"],
["Late confirmations look “stuck” → explicit queued timer and Writer estimate.","Cache fix reintroduces the 32s lag → selection performance test in the gate.","Multi-bot edits during a write → superseded state, never overwrite."])),
("15.3","Phase 2 — Workflow",("02","Workflow",["HF-04","HF-05","HF-06","HF-15","HF-16"],"Remove behavioral surprises, make context survive every refresh, make the map a permanent panel, and ship the motion core.",
["Make the Compact toggle work or remove it; remove duplicate Refresh / Status entry points.",
"Split Settings into <b>Local preferences</b> and <b>Shared model</b>; shared changes show impact and require confirmation.",
"Preserve selected job, filters, sort and scroll across refresh using stable job IDs.",
"New / changed rows get the cyan wipe (M-08) and a “changed” marker instead of silent reorder; bulk bot updates batch into the change strip.",
"Conflict guard: store record version on open; on mismatch at commit, show what changed and require confirmation.",
"<b>Map as permanent primary panel</b> (HF-16) in its current style: fit-to-results zoom, ⤢ Expand + visible Collapse + Esc, two-way selection sync.",
"<b>Motion tokens file + core transitions</b> (HF-15): panel slide, tab slide, toast slide-up, write-state pulses bound to Phase 1 events; Reduce motion toggle (off by default).",
"Sidebar rail pushes content rather than overlaying it."],
["Settings separation spec","Context preservation + conflict guard","Map panel + motion core"],
["Selection retained after refresh 100% over 50 refresh cycles","Simulated bot edit mid-decision always warns; never overwrites","Map collapse found unaided; selection sync 100%","Motion never blocks input (dispatch ≤ 50 ms)","HF-14 re-test shows no regressions"],
["Highlight noise during bulk bot activity → batch and summarize.","Motion masking state → G2: state wins, animation cancels."])),
("15.4","Phase 3 — Cognitive + Visual",("03","Cognitive + visual",["HF-07","HF-08","HF-09","HF-10","HF-11","HF-15","HF-16","HF-17"],"Make review measurably faster with the 2560 cockpit, readable labels, rationale, the full motion catalog and the HUD system.",
["<b>2560 × 1440 three-zone layout</b> (HF-17): grid 1160 / 820 / 508, KPI tiles, change strip, ticker, type scale; all 11 columns and ≥ 30 rows; 15–20 rows at 1440–1920.",
"Label dictionary mapping internal codes to readable labels; raw codes moved to Layer 4.",
"Plain-English rationale line beside every score; breakdown + uncertainty one click away.",
"“Since your last review” strip with per-user last-review timestamp; every item clickable.",
"Normalize source names case-insensitively; persist decline reason codes and backfill where recoverable.",
"<b>Full motion catalog</b> M-01 – M-17 and <b>map enhancements</b> (clusters, hover cards, rings, radar, lock-on, filter reflection); phone moves to Track M.",
"<b>Apply colour, motion and breakpoint tokens</b> (Section 16); lint against raw hex / raw durations; shortcut help overlay; contrast audit."],
["2560 layout + label dictionary","Rationale line + change strip","Motion catalog + map enhancements","Token stylesheet + visual snapshots"],
["HF-14 re-test: medians ≤ 5s / ≤ 10s / ≤ 15s, no accuracy loss","0 overflow at 1280 / 1440 / 1920 / 2560; 11 / 11 cols at 2560","p95 frame ≤ 16.7 ms with radar running","WCAG 2.2 AA agreed criteria pass (automated + keyboard)","No raw hex outside the token file"],
["Density vs readability → table text ≥ 14 px at 2560.","Motion cost → G3 caps; perf trace in gate."])),
("15.5","Phase 4 — Adaptive",("04","Adaptive",["HF-12"],"Add opt-in, explainable personalization that recommends and organizes without ever deciding or altering canonical rules.",
["Log overrides (decision vs recommendation) with the reason codes persisted in Phase 3.",
"Derive advisory suggestions, e.g. “You declined 9 of the last 10 manager-level non-priority roles — rank these lower?”",
"Off by default; opt-in toggle in Local preferences; every suggestion explains itself and is reversible in one click.",
"Hard boundary: no writes to canonical rules, no automatic applications, no auto-decisions; audit log of every adaptive effect."],
["Override log + advisory suggestion engine","Explanation + revert UI","Adaptive-effect audit log"],
["Every suggestion has an explanation and Undo","Audit shows zero canonical-rule mutations","Tim opts in explicitly; HF-14 re-test shows no accuracy loss"],
["Overfitting to recent behavior → minimum-evidence threshold and decay.","Trust erosion → visible, labeled, never a silent reorder (P6)."])),
("15.6","Track M — Mobile",("M","Mobile track",["HF-13","HF-18"],"Deliver the iPhone 18 Pro redesign (portrait, landscape, desktop-mode switch). Starts after the Phase 2 gate; runs in parallel with Phase 3.",
["Confirm iPhone 18 Pro dimensions and safe areas in the simulator (402 × 874 pt assumed).",
"Portrait: KPI strip, change strip, swipe cards (→ Pursue, ← Hold, long-press Decline + confirm + Undo), tab bar Queue · Map · Changes · Search.",
"Map tab: full-bleed targeting map in the retained style + bottom sheet (peek / half / full).",
"Landscape split view: list left, Detail | Map right.",
"Desktop-mode switch: 2560 layout scaled + pannable; shared view-state persists selection, filters, sort, scroll, viewport.",
"Haptics map (threshold, commit, warning, success / error); motion tokens with phone cap of 6 concurrent animations."],
["Portrait + landscape builds","Desktop-mode switch + shared view-state","Gesture + haptic spec"],
["All decision targets ≥ 44 pt","Swipe decisions reversible via Undo 100%","State kept across switch 100% (50 cycles)","HF-14 tasks timed on phone"],
["Accidental swipes → 35 % threshold, Undo, Decline needs long-press + confirm.","Assumed dimensions wrong → layout from safe-area insets, not constants."]))]
for s,t,args in PH:
    sec(s,t,1); ppage(s,"15 · "+t,phase(*args))
sec("16","Design Tokens (CSS)")
TOK=[("/* Base surfaces */",None,None),("--pe-void","#000000","page background"),("--pe-hull","#0B0B0B","panels"),("--pe-plate","#141414","cards / rows"),("--pe-raised","#1E1E1E","hover / selected"),("--pe-seam","#2A2A2A","borders"),("--pe-gridline","#3A3A3A","map grid"),
("/* Text */",None,None),("--pe-text-primary","#E6E6E2",""),("--pe-text-secondary","#A3A39E",""),("--pe-text-muted","#6B6B66","non-essential only"),
("/* Signal */",None,None),("--pe-green","#4ADE80","fits / confirmed / Pursue"),("--pe-amber","#F2B33D","flex / queued / Hold"),("--pe-red","#FF4D3D","hard block / failed / Decline"),("--pe-cyan","#38E1D6","selection / focus / links"),("--pe-olive","#8A8F7A","discovery / unverified"),("--pe-terminal","#5A5A5A","closed / declined"),
("/* Score bands */",None,None),("--pe-band-strong","var(--pe-green)","80–100"),("--pe-band-watch","var(--pe-amber)","65–79"),("--pe-band-weak","var(--pe-red)","< 65"),
("/* Shape, glow, type, targets */",None,None),("--pe-border","1px solid var(--pe-seam)",""),("--pe-radius","2px",""),("--pe-bar","2px","signal left bar"),("--pe-glow","0 0 6px rgba(56,225,214,0.40)","focus + processing only"),("--pe-font-label",'"IBM Plex Mono", ui-monospace, monospace',"uppercase labels"),("--pe-font-ui",'"Inter", system-ui, sans-serif',"numbers / titles"),("--pe-target-min","44pt","phone targets"),("--pe-target-decision","52pt","phone Pursue / Hold")]
lines=['<span class="c">/* Pipeline Explorer — design tokens (proposed) */</span>',':root {']
for k,v,c in TOK:
    if v is None: lines.append(f'  <span class="c">{H.escape(k)}</span>'); continue
    cm=f'  <span class="c">/* {H.escape(c)} */</span>' if c else ''
    sw_=f'<span style="display:inline-block;width:8px;height:8px;background:{v};border:1px solid #3A3A3A;margin-right:5px;vertical-align:0"></span>' if v.startswith('#') else ''
    lines.append(f'  <span class="k">{k}:</span>{" "*(21-len(k))}{sw_}{H.escape(v)};{cm}')
lines.append('}')
page(f"""<div class="sec">Section 16</div><h1>Design Tokens (CSS)</h1>
<p class="small">Phase 2 ships motion tokens; Phase 3 applies colour, motion and breakpoint tokens through a single token file. Motion and breakpoints continue on the next page. Components reference tokens only; a lint rule rejects raw hex values elsewhere. Semantic aliases (e.g. <code>--pe-state-failed: var(--pe-red)</code>) may be added, but each signal keeps exactly one meaning.</p>
<pre>{chr(10).join(lines)}</pre>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l small" style="margin:0"><b>Glow:</b> <code>box-shadow: var(--pe-glow)</code> on focus, processing, traces and lock-on; nothing glows at rest.</div>
<div class="card bar-a small" style="margin:0"><b>Signals as accents:</b> <code>border-left: var(--pe-bar) solid var(--pe-amber)</code>; never a background fill.</div></div>""","16 · Design Tokens — Colour & Shape")

TOK2=[("/* Motion — durations */",None),("--pe-motion-instant","0ms"),("--pe-motion-fast","120ms"),("--pe-motion-base","240ms"),("--pe-motion-lock","320ms"),("--pe-motion-materialize","400ms"),("--pe-motion-sweep","600ms"),("--pe-motion-roll","800ms"),("--pe-motion-boot","1200ms"),("--pe-motion-breathe","1600ms"),("--pe-motion-radar","4000ms"),("--pe-motion-stagger","18ms"),
("/* Motion — easing */",None),("--pe-ease-out","cubic-bezier(.16,1,.3,1)"),("--pe-ease-in","cubic-bezier(.7,0,.84,0)"),("--pe-ease-inout","cubic-bezier(.65,0,.35,1)"),("--pe-ease-snap","cubic-bezier(.34,1.56,.64,1)"),("--pe-ease-linear","linear"),
("/* Breakpoints */",None),("--pe-bp-desktop-2560","2560px"),("--pe-bp-desktop-1920","1920px"),("--pe-bp-desktop-1440","1440px"),("--pe-bp-phone-portrait","402pt"),("--pe-bp-phone-landscape","874pt"),
("/* Layout @ 2560 */",None),("--pe-margin","20px"),("--pe-gutter","16px"),("--pe-col-table","1160px"),("--pe-col-map","820px"),("--pe-col-work","508px"),("--pe-row-h","32px")]
l2=['<span class="c">/* PE tokens · v1.3 */</span>',':root {']
for k,v in TOK2:
    if v is None: l2.append(f'  <span class="c">{k}</span>'); continue
    l2.append(f'  <span class="k">{k}:</span>{" "*(28-len(k))}{H.escape(v)};')
l2.append('}')
mq='''<span class="c">/* layout selection */</span>
@media (min-width: 2560px) { <span class="k">.cockpit</span> { grid-template-columns: var(--pe-col-table) var(--pe-col-map) var(--pe-col-work); } }
@media (max-width: 440px) and (orientation: portrait)  { <span class="k">.app</span> { --layout: mobile-portrait; } }
@media (max-height: 440px) and (orientation: landscape) { <span class="k">.app</span> { --layout: mobile-landscape; } }
<span class="k">.app[data-desktop-mode]</span> { --layout: desktop-2560; <span class="c">/* scaled, pannable */</span> }
<span class="k">[data-reduce-motion]</span> { --pe-motion-radar: 0ms; --pe-motion-breathe: 0ms; <span class="c">/* off by default */</span> }'''
page(f"""<div class="sec">Section 16 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Design Tokens — Motion, Breakpoints, Layout</h1>
<pre style="font-size:8pt;line-height:1.42;margin:0">{chr(10).join(l2)}</pre><p class="small muted" style="margin-top:5px">Phone breakpoints are assumed iPhone 18 Pro dimensions (Section 14); 2560 is the primary desktop target.</p>
<pre style="font-size:7.9pt;margin-top:9px;white-space:pre-wrap">{mq}</pre>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l small" style="margin:0"><b>Lint:</b> no raw durations or easing curves in components — only <code>--pe-motion-*</code> and <code>--pe-ease-*</code>, mirroring the raw-hex rule.</div>
<div class="card bar-a small" style="margin:0"><b>Reduce motion</b> (Settings, off by default) swaps loops to 0 and slides to <code>--pe-motion-fast</code> fades.</div></div>""","16 · Design Tokens — Motion & Breakpoints")
sec("17","Acceptance Targets")
acc=[("Cross-view score consistency","100%"),("Counter reconciliation","100%"),("False successful-write indications","0"),("Unrecoverable failed decisions","0"),("Identify a job needing action","≤ 5s median"),("Understand main score drivers","≤ 10s median"),("Disposition a straightforward job","≤ 15s median"),("Selection retained after refresh","100%"),("Priority-column horizontal overflow","0"),("WCAG 2.2 AA agreed criteria","Pass"),("<b>v1.3</b> · Input blocked by animation","0"),("<b>v1.3</b> · Animation frame time (p95)","≤ 16.7 ms"),("<b>v1.3</b> · Map ↔ queue selection sync","100%"),("<b>v1.3</b> · Columns visible at 2560 × 1440","11 / 11, ≥ 30 rows"),("<b>v1.3</b> · State kept across desktop-mode switch","100%")]
refs=["Nielsen, <i>10 Usability Heuristics</i> (NN/G, rev. 2024)","Nielsen, <i>Progressive Disclosure</i> (NN/G, 2006)","Laubheimer, <i>Data Tables: Four Major User Tasks</i> (NN/G, 2022)","Cowan, <i>The Magical Number 4</i> (2001)","Norman, <i>Emotional Design</i> (2004 / 2008)","<i>Intelligent User Interfaces and Their Evaluation</i> (systematic mapping, 211 studies, PMC)","W3C, WCAG 2.2 SC 2.5.8 <i>Target Size (Minimum)</i>; SC 2.3.1 <i>Three Flashes</i>","Harley, <i>The Role of Animation and Motion in UX</i> (NN/G, 2014)","Apple, <i>Human Interface Guidelines</i> — layout, safe areas, haptics"]
ah=''.join(f'<tr><td>{a}</td><td class="num">{t}</td></tr>' for a,t in acc)
page(f"""<div class="sec">Section 17</div><h1>Acceptance Targets <span class="muted" style="font-size:11pt;font-weight:400">(proposed, not research findings)</span></h1>
<table class="tight"><tr><th>Measure</th><th style="width:130px">Target</th></tr>{ah}</table>
""","17 · Acceptance Targets")
sec("18","References"); sec("19","Design Standard")
page(f"""<div class="sec">Section 18</div><h1>References</h1>
<ul class="small">{''.join(f'<li>{r}</li>' for r in refs)}</ul>
<div class="sec" style="margin-top:8px">Section 19</div><h1 style="font-size:17pt">Design Standard <span class="muted" style="font-size:11pt;font-weight:400">(controlling statement)</span></h1>
<div class="hull bar-l" style="font-size:10.5pt;line-height:1.55;padding:12px 14px">Pipeline Explorer shall be an expert decision-support system that minimizes cognitive translation, preserves situational awareness, provides truthful system feedback, and supports rapid, recoverable actions. It shall keep authoritative data consistent across views, preserve user context during updates, and expose decision evidence without unnecessary navigation. Progressive disclosure organizes complexity; it does not remove necessary information. Adaptive functionality stays transparent, explainable, reversible and under user control. By operator decision, motion is a first-class element — rich and continuous, yet never blocking input or concealing true state — and the tactical map is a primary panel whose military targeting style is retained. All changes preserve established design authority unless explicitly approved, and are validated against usability, accessibility and data-integrity criteria.</div>
<div class="notice"><b>Status</b>Proposed · v1.3 · October 14, 2026. No code, backlog or deployment changes authorized.</div>""","18–19 · References, Design Standard")

N=len(pages)
rows=""
for num,t,pg,lvl in toc:
    cls="row sub" if lvl else "row"
    rows+=f'<div class="{cls}"><span class="n">{num}</span><span class="t">{t}</span><span class="p">{pg:02d}</span></div>'
pages[1]=(f'<div class="sec">Contents</div><h1>Table of Contents</h1><div class="toc">{rows}</div><p class="small muted" style="margin-top:4px">{N} pages · US Letter (landscape for the 2560 mockup) · dark edition. Sections 12–14 contain concept screens built from mock data.</p>',"Contents",False)
pg={n:p for n,t,p,l in toc}
pages=[(re.sub(r"\{\{([0-9.]+)\}\}",lambda m:f"{pg[m.group(1)]:02d}",b),h,l) for b,h,l in pages]
out=[]
for i,(body,hdr,land) in enumerate(pages,1):
    if hdr is None: out.append(f'<section class="page cover">{body}</section>')
    else: out.append(f'<section class="page{" land" if land else ""}"><div class="hdr"><span>Pipeline Explorer // Human Factors Proposal</span><span>{hdr}</span></div><div class="content">{body}</div><div class="ftr"><span>v1.3 · Oct 14 2026 · Prepared for Tim Pruitt</span><span class="st">Proposed — not authorized</span><span class="pn">{i:02d} / {N:02d}</span></div></section>')
js="<script>window.addEventListener('load',()=>{const r=[];document.querySelectorAll('.content').forEach((c,i)=>{if(c.scrollHeight>c.clientHeight+1)r.push('p'+(i+2)+':'+(c.scrollHeight-c.clientHeight)+'h');if(c.scrollWidth>c.clientWidth+1)r.push('p'+(i+2)+':w'+(c.scrollWidth-c.clientWidth));});document.body.setAttribute('data-overflow',r.join(',')||'none');});</script>"
doc=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pipeline Explorer — Human Factors Proposal &amp; Implementation Plan v1.3</title><style>{CSS}</style></head><body>{"".join(out)}{js}</body></html>'
open("/workspace/pe/build15/proposal.html","w").write(doc)
print("pages",N); print(toc)
