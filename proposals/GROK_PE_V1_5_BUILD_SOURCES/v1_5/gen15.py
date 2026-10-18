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
.cov table td{padding:1.5px 6px;border:0;font-size:10pt;line-height:1.33;background:none!important}.cov table td.cl{width:58px;font-family:var(--mono);font-size:7.8pt;letter-spacing:.1em;text-transform:uppercase;padding-top:3px;white-space:nowrap}
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
table{width:100%;border-collapse:collapse;font-size:10pt}
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
.toc{column-count:2;column-gap:22px}.toc .row{break-inside:avoid;display:flex;align-items:baseline;padding:2.5px 0;border-bottom:1px solid var(--seam)}.toc .t{font-size:10.5pt!important}.toc .sub .t{font-size:10pt!important}
.toc .n{font-family:var(--mono);color:var(--cyan);width:44px;font-size:9pt}
.toc .t{flex:1;font-size:11.5pt}
.toc .sub .t{font-size:10pt;color:var(--t2);padding-left:14px}
.toc .sub{padding:2px 0;border-bottom:1px dashed #1a1a1a}
.toc .p{font-weight:600;font-variant-numeric:tabular-nums;width:40px;text-align:right}
.sw{display:grid;grid-template-columns:62px 1fr;gap:10px;align-items:center;background:var(--hull);border:1px solid var(--seam);border-radius:2px;padding:7px;margin-bottom:7px}
.chip{height:46px;border:1px solid var(--grid);border-radius:2px}
.sw .nm{font-weight:600;font-size:10.5pt}
.sw .hx{font-family:var(--mono);font-size:8.5pt;color:var(--t2);letter-spacing:.06em}
.sw .rl{font-size:10pt;color:var(--t2);line-height:1.35}
.sw .crx{font-family:var(--mono);font-size:7.5pt;color:var(--t3);letter-spacing:.06em}
.phase-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--grid);padding-bottom:6px;margin-bottom:8px}
.phase-h .pnum{font-family:var(--mono);font-size:24pt;color:var(--cyan);font-weight:500;line-height:1}
.phase-h .pt{font-size:16pt;font-weight:640}
.kv{display:grid;grid-template-columns:118px 1fr;gap:4px 12px;margin-bottom:6px}
.kv .label{padding-top:2px}
ol.tasks{list-style:none;counter-reset:t;margin-bottom:6px}
ol.tasks li{counter-increment:t;position:relative;padding-left:30px;margin-bottom:3.5px;font-size:10pt}
ol.tasks li:before{content:counter(t,decimal-leading-zero);position:absolute;left:0;top:1px;font-family:var(--mono);font-size:8pt;color:var(--t3)}
.small{font-size:10pt}
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
  <div class="hull bar-g" style="flex:1;margin:0"><div class="label">Requirements</div><div class="num" style="font-size:20pt">19</div><div class="muted small">HF-01 – HF-19</div></div>
  <div class="hull bar-l" style="flex:1;margin:0"><div class="label">Phases</div><div class="num" style="font-size:20pt">6 + M</div><div class="muted small">Baseline → Architecture → Adaptive + Mobile</div></div>
  <div class="hull bar-a" style="flex:1;margin:0"><div class="label">Status</div><div class="num" style="font-size:20pt;color:var(--amber)">Proposed</div><div class="muted small">Awaiting approval</div></div>
 </div>
 <div class="meta">
  <div class="label">Version</div><div>1.5 <span class="muted">(supersedes 1.4)</span></div>
  <div class="label">Date</div><div>October 15, 2026</div>
  <div class="label">Prepared for</div><div>Tim Pruitt</div>
  <div class="label">Prepared by</div><div>Grok Bot</div>
  <div class="label">New in 1.5</div><div class="muted" style="font-size:10pt">Re-baselined on main (PRs #111–#115) · one shared scoring model, honest all-SHARED weights · Writer timed in seconds · percentile score bands · distinct glyphs · ◌ keyed on stale evidence · architecture phase before motion</div>
 </div>
</div>"""
page(cover,None)
page("__TOC__","Contents")
CH=[("1","Re-baseline on main (PRs #111–#115)","Inventory was pre-#113. Verified in code: one-button updates with progress + readback (B-14), one-job score tester, OPEN preset default, culture = Target Companies tier, APPLIED / REJECTED_BY_EMPLOYER protected from decline, selection lag fixed. FLEX weight (model) vs FLEX policy modifiers (rules) separated; class scores fixed HIGH 80 · SOFT 62 · NO 30 · STRICT 0.","05.1 · 14 · HF-03","{{05.1}}","✓ all confirmed in code · see note A"),
("2","Scope model","Weights, salary curve, geo points and FLEX weight are ONE shared, revision-numbered model (save_scoring_model). LOCAL only for display / columns / layout / map mode / seen-state / drafts. “70 local + 30 FLEX” and LOCAL badges on D–G removed; honest total = one row per weight, all SHARED; Undo = republish previous revision. Rev 24 weights read from the published file.","14 · 14.1 · HF-19 · S2/S3","{{14.1}}","✓ confirmed · rev 24 = 35/30/15/10/5/5/0/0"),
("3","Writer timings","Removed every latency-window and outage-window claim (HF-03, Section 17 constraints, KPI tile, receipts, mockups). Writer is synchronous Apps Script: write completes in seconds, 30 s script lock, refuses if busy; client auto-retries 8 / 15 / 30 / 45 s. States in seconds; queued = “waiting for Writer lock”.","HF-03 · 12 · 17 · mockups","{{17}}","✓ waitLock(30000); retries [8000,15000,30000,45000]"),
("4","Dynamic score colors","Fixed 80 / 65 bands replaced by percentile bands recomputed on model or population change: top 10 % green, next 25 % amber, next 45 % grey, bottom 20 % clay. Display-only. STRICT / hard-block HOLD shown separately. Cut-points are tokens. Table, ring and pins share the band. Mockups use top ≈ 76 · P90 ≈ 61 · median ≈ 48.","11.4 · 11.6 · 13 · 15.4 · 16 · 18","{{11.6}}","band() in code still fixed — proposal only"),
("5","Glyph / color conflicts","Weak ▽, failed ⊗, Decline ⊖, Close ✕, hard block ⊘ — one glyph each. Red = failed / hard block only; the low band uses Clay. Changed marker = white Δ + neutral wipe (not cyan). Muted #6B6B66 large text only.","11.6 · 12 (M-08, M-18) · 18","{{11.6}}","—"),
("6","◌ aimed at evidence","Scores are computed live from the published model, so ◌ now marks stale STORED EVIDENCE (FLEX_CLASS under an older DEGREE_FLEX rule; Writer-stamped values pending the Writer redeploy). Anduril 77 → 72 → 59 = FLEX HIGH → NO evidence update, shown as a change-strip event with cause.","05 · HF-01 · HF-19 · 14.1 S6","{{14.1}}","✓ Explorer recomputes live (scoreRow)"),
("7","Opening a job writes","Confirmed: openRow() sets seen-state and calls syncStateUp(). T-06 kept: seen-state local-only or batched-explicit with receipt.","05.1 · T-06","{{17.8}}","✓ pipeline.html openRow → syncStateUp()"),
("8","Plan contradiction","Clarified: UI for <b>Tim</b> to make shared changes is in scope; <b>agents</b> changing the shared model or rules is out of scope in every phase.","17 · 17.1","{{17}}","—"),
("9","Architecture before motion","New Phase 1B — Architecture &amp; Performance: single scoring-record selector, counter registry, write state machine, browser-test migration, performance budget. Motion and layout start only after its gate.","17 · 17.3","{{17.3}}","—"),
("10","Undeployed Writer Apps Script","Listed as a Phase 0 discrepancy and a dependency for HF-01: Writer-stamped values use the old formula until redeployed.","05.1 · 17.1 · HF-01","{{05.1}}","not verifiable from repo; taken as reported"),
("11","Motion limits","Rich motion kept (B-15) with hard limits: never blocks input · never hides true state · job selection settles ≤ 0.7 s total · p95 frame ≤ 16.7 ms · Reduce-motion toggle (off by default) · nothing flashes &gt; 3 / s.","12 · HF-15 · 19","{{12}}","—")]
sec("R","Changes in v1.5")
row=lambda a,b,c,d,e,f: f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td><td class="label" style="font-size:7.3pt">{d}</td><td class="num" style="text-align:right">{e}</td><td class="small" style="color:var(--t2)">{f}</td></tr>'
CHT='<tr><th style="width:20px">#</th><th style="width:84px">Review item</th><th>How v1.5 addresses it</th><th style="width:62px">Where</th><th style="width:26px;text-align:right">Pg</th><th style="width:104px">Code check</th></tr>'
TS='<table class="tight" style="font-size:8.4pt;line-height:1.22">'
page(f"""<div class="sec">Revision</div><h1>Changes in v1.5</h1>
<p class="small muted" style="margin-top:-4px">Reviewer findings relayed by Tim (Oct 15). Each item is mapped to where it is addressed and checked read-only against <code>tpruittguitar/foreman-cockpit</code> main (6a64a37, PR #115) and the published scoring model. Status stays <b style="color:var(--amber)">PROPOSED</b>.</p>
{TS}{CHT}{''.join(row(*x) for x in CH[:4])}</table>""","Changes in v1.5 (1/3)")
page(f"""<div class="sec">Revision · continued</div><h1 style="font-size:18pt">Changes in v1.5 (2/3)</h1>
{TS}{CHT}{''.join(row(*x) for x in CH[4:8])}</table>""","Changes in v1.5 (2/3)")
page(f"""<div class="sec">Revision · continued</div><h1 style="font-size:18pt">Changes in v1.5 (3/3)</h1>
{TS}{CHT}{''.join(row(*x) for x in CH[8:])}</table>
<div class="card bar-a small" style="margin-top:9px"><b>Note A — where the review and the code differ.</b> (1) <code>SCORING_MODEL.md</code> still lists FLEX modifiers +15 / +6 / −10 as defaults; the canonical DEGREE_FLEX policy on the scoring page uses HIGH 90 · SOFT 70 · NO −60 · STRICT −100. Modifiers feed ADJUSTED_FIT / PURSUIT_STATUS only (confirmed: <code>scoreRow</code> uses the fixed class score), so the doc defaults are stale, not the score. (2) Rev 24 weights are experience 35 · title 5 (the v1.4 reading was right); code defaults are 40 / 0. (3) The Writer-redeploy gap cannot be seen in the repo and is taken as reported. (4) Percentile bands are a v1.5 proposal; <code>band()</code> in code is still fixed.</div>
<div class="grid2" style="margin-top:7px">
<div class="card bar-r small" style="margin:0"><b>Withdrawn in v1.5.</b> “100 % = 70 local + 30 shared FLEX”; LOCAL badges on scoring cards D–G; fixed 80 / 65 bands; ✕ for anything but Close; cyan changed marker; recalc-progress ◌; Writer latency / outage windows; “shared-model changes out of scope” (ambiguous).</div>
<div class="card bar-g small" style="margin:0"><b>Unchanged.</b> Palette base, targeting map + brackets, typography, rich-motion standard, 2560 desktop, iPhone perimeter rules, dense 11-column table, Phase 1 integrity first.</div></div>""","Changes in v1.5 (3/3)")


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
bo=[("r","Weights total is not honest","Settings › Flex policy &amp; scoring: the weights card lists 70 (experience 35 · compensation 15 · geo 10 · title 5 · culture 5 · ats 0 · ownership 0) while FLEX 30 sits on another card. All eight weights belong to <b>one shared model</b> (rev 24, total 100); stale copy (“ranks rows on this browser”) made them look local. <i>Corrected in v1.5.</i>"),
("a","Stored evidence is stale, not scores","Scores compute live from the published model. What goes stale is stored evidence: <b>185 of 603</b> FLEX values stamped under an older DEGREE_FLEX rule; Writer-stamped values pending the Writer Apps Script redeploy. Anduril Head of Production <b>77 → 72 → 59</b> = FLEX class HIGH → NO (a legitimate evidence update) — shown with no cause. <i>Reframed in v1.5.</i>"),
("r","Counts disagree across views","Declined by Tim <b>0</b> (Trends donut) / <b>56</b> (Scout results cohort) / <b>57</b> (Buckets table); Employer rejected <b>0 / 2 / 7</b>; Applied 84 vs 26 (cohort). Scope labels (“live rows only”) are not shown next to the numbers."),
("r","Score inconsistency (v1.3)","Same job showed 75 (table) vs 68 “Watch” → 70 → 75 “Strong” (detail); three names for one number. Still open."),
("r","Writer status flapping","Red FAULT banner <b>“Writer unreachable — Failed to fetch”</b> on first load, then “Connected structured runtime”; Writer pill cycles checking / queued / processing / idle; drawer Health DEGRADED while listing no current faults."),
("r","Browsing is not side-effect free","Opening a job row queued a Writer write: drawer showed <b>UNVERIFIED 1 write · oldest 65 s</b>. <b>Confirmed in code (v1.5):</b> <code>openRow()</code> sets seen-state and calls <code>syncStateUp()</code>. Footer: “10 local entries · 10 unverified”."),
("a","Fullscreen map trap","Map (<code>m=1</code>) covers the section tabs with <b>no visible close</b> (one exists in the DOM, hidden); in My rulings the empty overlay “No mapped jobs in this group” blocks the tab bar. Exit only by reload. Header clipped under the rail; Layers click had no visible effect; Selection zoom 600 %."),
("a","Rail pin cannot unpin","Hamburger “Menu” pins the expanded rail; it overlaps the top-bar title and could not be collapsed again until reload.")]
bo2=[("a","Duplicate entry points","Settings tabs <b>Pay &amp; location</b> = anchor on Scoring; <b>Resume &amp; ATS</b> = Documents. Cards PAY / GEO + SCORING, ATS TOOLS + DOCUMENTS, AI OPERATIONS + SCHEDULES open the same views. Writer setup via ⚙ and System › Writer connection. Writer pill, bell and rail Status all open the System drawer. System top tabs Schedules / Health repeat sub-tabs."),
("a","Scope copy is stale","Page copy says weights “rank rows on this browser”, but weights, salary curve, geo points and FLEX weight all publish to the one shared model (save_scoring_model). Truly local: display / columns, layout, map mode, seen-state, drafts. Badge PRESENTATION ONLY contradicts the shared Update buttons."),
("a","No real routes","All path routes (/scoring, /rules, /map, /trends …, even /zz-control-404) return 200 and silently redirect to /pipeline; state lives only in the URL hash."),
("a","Table overflow + codes","Jobs table truncated horizontally; ~150 fields; headers SALARY_BASE_EST, FLEX_CLASS, EXPERIENCE_FIT; states DECLINED_BY_TIM, INTAKE / AWAITING_ANALYSIS; reason codes FIT_TOO_WEAK etc."),
("a","Chart integrity","Discovery sources split by case: LinkedIn 183 + LINKEDIN 69, Indeed 87 + INDEED 17; Declined-by-Tim reason codes “none”."),
("a","Decision friction (v1.3)","Two-step decide (Pursue / Hold / Decline prepare, SAVE JOB DECISION commits); Decline adjacent to Pursue; UNDO only for the last decision."),
("a","Ops surfaces heavy","Daily job decisions share chrome with Dashboard KPIs, PR70 acceptance INDETERMINATE, Schedules UNSUPPORTED, Intake coverage UNKNOWN; Writer connection page shows Script URL + passphrase fields."),
("r","Runtime errors (v1.3)","Console TypeErrors at pipeline lines 1320 / 1326 — to be re-verified in Phase 0."),
("g","Performance","Selection ~0.55 s after the “memoize scoring config” fix (PR #113, 32 s → 0.7 s) — merged on main.")]
bcard=lambda c,t,d: f'<div class="card bar-{c}" style="padding:7px 11px;margin-bottom:6px;display:grid;grid-template-columns:150px 1fr;gap:10px"><div class="label" style="padding-top:2px;color:var(--t1)">{t}</div><div class="small">{d}</div></div>'
page(f"""<div class="sec">Section 05</div><h1>Baseline Observations</h1>
<p class="muted small" style="margin-top:-6px">Live build review (Oct 14) + read-only inventory (Oct 15, pre-#113 build) · corrected against main in 05.1 · bar colour = severity (red integrity, amber friction, green resolved)</p>{''.join(bcard(*x) for x in bo)}""","05 · Baseline Observations (1/2)")
page(f"""<div class="sec">Section 05 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Baseline Observations (2/2)</h1>{''.join(bcard(*x) for x in bo2)}
<p class="small muted" style="margin-top:4px">Every item is mapped to a requirement and an inventory task in Section 17.7. Each one is re-checked in Phase 0 (HF-14) before work starts.</p>""","05 · Baseline Observations (2/2)")

sec("05.1","Re-baseline Against Main (PRs #111–#115)",1)
RBF=[("✓","One-button updates (B-14)","“Update weights &amp; salary”, “Update geo scores”, “Update FLEX weight”, “Update FLEX policy”, each with a progress bar and Writer readback.","pipeline.html · #112"),
("✓","Score tester","Pick one job, move every scoring setting, see its rating live, save as the ruling model.","pipeline.html (Model tester) · #112"),
("✓","OPEN preset default","Applied and closed jobs filtered out by default (preset OPEN, “Open roles”).","pipeline.html · #111"),
("✓","Culture = Target Companies tier","P1 100 · P2 90 · P3 75 · WATCH 60 · unlisted / PAUSED 40 · hidden-client recruiter = UNKNOWN.","pipeline-scoring.js · #111"),
("✓","Protected states","APPLIED / REJECTED_BY_EMPLOYER: decision panel shows application evidence and blocks decline; Writer refuses identity changes. One-click decisions (HF-03) must respect this.","applicationEvidence_ · #115"),
("✓","Selection lag fixed","Memoized scoring config, 32 s → ~0.55–0.7 s.","#113"),
("✓","Writer is synchronous","Apps Script <code>waitLock(30000)</code>; refuses when busy; client <code>gsPostRetryBusy_</code> retries 8 / 15 / 30 / 45 s; writes land in seconds.","Code.gs · #114"),
("✓","Opening a job writes","<code>openRow()</code> → <code>S.seen[id]=…; syncStateUp()</code>.","pipeline.html"),
("✓","Scores computed live","<code>scoreRow()</code> recomputes from the published model; Writer rejects score-output fields (SCORE_OUTPUT_FIELD).","pipeline-scoring.js · SCORING_MODEL.md"),
("⚠","Writer redeploy outstanding","Writer-stamped values use the old formula until the Apps Script is redeployed. Not visible in the repo — Phase 0 discrepancy + HF-01 dependency.","reported by reviewer")]
rbh=''.join(f'<tr><td style="color:{"var(--green)" if a=="✓" else "var(--amber)"};text-align:center">{a}</td><td><b>{b}</b></td><td class="small">{c}</td><td class="small muted">{d}</td></tr>' for a,b,c,d in RBF)
W24=[("Experience / content fit","35","40"),("Degree FLEX","30","30"),("Compensation","15","15"),("Geography","10","10"),("Title / scope","5","0"),("Culture (Target Companies)","5","5"),("ATS match","0","0"),("Ownership","0","0")]
wh=''.join(f'<tr><td>{a}</td><td class="num" style="text-align:right">{b}</td><td class="num muted" style="text-align:right">{c}</td></tr>' for a,b,c in W24)
page(f"""<div class="sec">Section 05.1</div><h1 style="font-size:18pt;margin-bottom:6px">Re-baseline Against Main <span class="muted" style="font-size:11pt;font-weight:400">· PRs #111–#115 · read-only code check</span></h1>
<table class="tight" style="font-size:8.3pt;line-height:1.2"><tr><th style="width:18px"></th><th style="width:150px">Fact</th><th>What the code does</th><th style="width:150px">Source</th></tr>{rbh}</table>
<div class="grid2" style="margin-top:8px;grid-template-columns:1fr 1.1fr">
<div><div class="label" style="color:var(--t1);margin-bottom:4px">Published model rev 24 · v2026-10-14.1 · Oct 14 10:34 PM ET</div>
<table class="tight"><tr><th>Weight</th><th style="width:52px;text-align:right">Rev 24</th><th style="width:62px;text-align:right">Code default</th></tr>{wh}<tr><td><b>Total</b></td><td class="num" style="text-align:right"><b>100</b></td><td class="num muted" style="text-align:right">100</td></tr></table></div>
<div class="card bar-l" style="margin:0;font-size:8.3pt;line-height:1.25"><b>Rest of rev 24.</b> Salary floor 190 000 · target 240 000 · ceiling 300 000 (0 / 50 / 100; code default 160 / 220 / 320). Geo IDW power 6, 20 control points, 5 hard (Cleveland TN 100, Gulf Shores 100, Tampa 90, New York 0, Chicago 0). FLEX class component fixed HIGH 80 · SOFT 62 · NO 30 · STRICT 0 (UNKNOWN 50). FLEX policy modifiers live in the canonical rules (DEGREE_FLEX), not the model, and affect ADJUSTED_FIT / PURSUIT_STATUS only. Source: <code>PIPELINE_SCORING_MODEL.json</code> (Drive, published by Tim). Undo = republish a previous revision from <code>PIPELINE_SCORING_MODEL_HISTORY.jsonl</code> (app already offers “restore … as a new revision”).</div></div>""","05.1 · Re-baseline Against Main")

sec("06","App Coverage")
SITE='''<span class="k">PIPELINE</span>  t=pipeline
├─ Jobs                 p=OPEN                 queue 578 · stat cards · table · job map · drawer
├─ Review queue         p=NEEDS_TIM            50 “Needs decision”
├─ Decline candidates   p=DECLINE_CANDIDATES   8
├─ My rulings           p=RULED                0 · empty map overlay
├─ Map                  m=1                    fullscreen map of current view
├─ Trends               t=reports              “Pipeline reports”
└─ Compare              modal                  Compare roles · 0/3
   <span class="c">Job drawer tabs: Overview · Posting · Fit &amp; Score · Application · Documents · History</span>
<span class="k">INTAKE</span>
├─ Scout results        t=quality              charts · cohort outcomes · scout quality
├─ Scout intake         p=SCOUT_INTAKE         426
├─ Discovery leads      p=LEADS                102
├─ Manual intake        t=intake               + ADD JOB LINK · worker status
└─ Target companies     t=companies            38 · SECTION=TARGET_COMPANIES
<span class="k">SYSTEM</span>    t=automations
├─ Dashboard · Work queue · Intake coverage · Verification &amp; recovery
├─ Schedules · Diagnostics (= Health)          <span class="c">repeated as top tabs</span>
├─ Incidents                                   3 unfinished operations
├─ Writer connection    t=settings             <span class="c">also ⚙ gear</span>
└─ System drawer                               <span class="c">bell · rail Status · Writer pill</span>
<span class="k">SETTINGS</span>
├─ Flex policy &amp; scoring  t=scoring          <span class="c">“Pay &amp; location” = anchor here</span>
├─ Rules (Advanced)     t=rules                19 sections · TIM_PIPELINE_RULES_CANONICAL v4
├─ Display &amp; columns                         ~150 fields · local
└─ Documents            <span class="c">“Resume &amp; ATS” = same view</span>   library · ATS proxy
<span class="k">GLOBAL</span>    top bar · left rail · LAYOUT mode · View &amp; filters · Map point filters
          FAULT banner · footer · hash-only routing'''
LEG=[("Exists","What is on screen today (inventory, Oct 15)."),("Works","Behaviour confirmed in the read-only pass."),("Issues","Observed problems — integrity red, friction amber."),("Propose","Specific v1.4 change, tagged to its requirement (HF) and phase.")]
page(f"""<div class="sec">Section 06</div><h1>App Coverage — Site Map</h1>
<p class="small" style="margin-top:-4px">Single-page app; all state in the URL hash <code>#{{"t":tab,"p":preset,"s":sort,"f":filters,"j":job,"m":1}}</code>. Every view below was opened in the read-only inventory; nothing was saved, applied or published.</p>
<pre style="font-size:8.6pt;line-height:1.5">{SITE}</pre>
<div class="grid2" style="margin-top:8px;gap:6px">{''.join(f'<div class="card" style="margin:0;padding:6px 10px"><span class="label" style="color:var(--cyan)">{a}</span> <span class="small">{b}</span></div>' for a,b in LEG)}</div>
<p class="small muted" style="margin-top:7px">Coverage pages follow this order. Settings › Flex policy &amp; scoring has its own full section (14).</p>""","06 · App Coverage — Site Map")
def cov(name,route,ex,wk,iss,pr):
    rows=''.join(f'<tr><td class="cl" style="color:{c}">{l}</td><td>{t}</td></tr>' for l,t,c in (("Exists",ex,"var(--t2)"),("Works",wk,"var(--green)"),("Issues",iss,"var(--amber)"),("Propose",pr,"var(--cyan)")) if t)
    return f'<div class="card cov" style="padding:5px 10px 4px;margin-bottom:6px"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:1px"><b style="font-size:10.8pt">{name}</b><span class="label" style="font-size:7.5pt;margin-left:auto">{route}</span></div><table>{rows}</table></div>'
def covpage(sub,title,hdr,items):
    sec(sub,title,1)
    page(f'<div class="sec">Section {sub}</div><h1 style="font-size:17pt;margin-bottom:6px">{title}</h1>'+''.join(cov(*x) for x in items),hdr)
P1=[("Jobs","t=pipeline · p=OPEN","“Job decision queue (578)”; stat cards Needs decision 50 · Applied 84 · Research 49 · Interviews 14d 0; Open roles ▾ / funnel → View &amp; filters; sortable table NEW · TITLE · COMPANY · LOCATION · LINK · SCORE · BUCKET · SALARY_BASE_EST · FLEX_CLASS · EXPERIENCE_FIT · AGE; row checkboxes; job location map; job drawer.",
"Stat cards switch views; sort; drawer opens; map legend Primary / Additional / Home; RECENTER / RESET.",
"Table truncated horizontally; raw codes as headers; ~578 dots on the map; opening a row queued an unverified write; ratings change with no cause shown (Anduril 77 → 72 → 59 = FLEX evidence HIGH → NO).",
"Readable 11-column default, all visible at 2560 (HF-07 / 08 / 17) · ◌ only on stale stored evidence (HF-19) · map shows selected job, else filtered set, with animated auto-fit (HF-16) · opening a job never writes; seen-state local or explicit with receipt (HF-04) · Ph 1–3."),
("Review queue","p=NEEDS_TIM","Same queue preset to 50 “Needs decision” rows (Research bucket dominant), e.g. a VP Ops role at 68.",
"Preset loads; decisions from the drawer.",
"Header “0 need you” vs Needs decision 50 (v1.3); no “since last review” summary.",
"Default landing view of the cockpit; KPI tile = exact population (HF-02); change strip (HF-10); keys P / H / R / D for Pursue / Hold / Research / Decline · Ph 1–3."),
("Decline candidates","p=DECLINE_CANDIDATES","8 rows, scores 37–64 (e.g. an ops-tech role at 64).","List loads; drawer works.",
"The rule that made a row a candidate is not shown; declining is two-step and reasons are not persisted (Trends shows none).",
"Show the triggering rule per row; batch “Confirm declines” with reason code required, receipts and Undo (HF-03 / 11) · Ph 1–3."),
("My rulings","p=RULED","0 rows; map overlay “No mapped jobs in this group”; rulings list “none”.","Empty state renders.",
"Empty fullscreen-map overlay blocks the tab bar — user is trapped until reload.",
"Map never covers tabs; empty state explains rulings and links to Trends export / import (HF-06) · Ph 2."),
("Map (fullscreen)","m=1","Fullscreen US map of the current view (578 rows), zoom, Layers, RECENTER / RESET, legend.","Shows the current view; zoom works.",
"Covers section tabs; no visible close (hidden in DOM) — exit by reload; header clipped under the rail; Layers click no visible change; Selection zoom 600 %.",
"<b>Tim's rule:</b> selected job only, else the filtered selection; always-visible <b>✕ Close · Esc</b>; animated auto-fit (600 ms) instead of fixed 600 %; no clusters / radar / rings; Layers popover visibly applies (HF-16) · Ph 2."),
("Trends (“Pipeline reports”)","t=reports","Research bottlenecks; next actions; state donut (662 roles); base-comp mix; discovery sources; integrity table (749 / 749, parse errors 0); buckets table; rulings export / import; decline reasons; notification sources.",
"Integrity COUNTS OK; parse errors 0; charts render.",
"Declined by Tim 0 / Employer rejected 0 here vs 56 / 2 (Scout results) vs 57 / 7 (Buckets); LinkedIn 183 + LINKEDIN 69, Indeed 87 + INDEED 17; reason codes “none”; tab “Trends” ≠ title “Pipeline reports”.",
"Scope label on every chart (live / archive / cohort) from one counter registry (HF-02) · case-insensitive source normalisation · persist reason codes (HF-11) · one name “Reports” · Ph 1 / 3."),
("Compare","modal · COMPARE · 0/3","“Compare roles · 0/3 — use Compare role in a job drawer to set up to three roles. Missing evidence stays visible.” CLOSE.","Modal opens and closes.",
"Only discoverable from the drawer; top-bar counter gives no hint.",
"Compare tray in the workspace; columns render from the single scoring record (HF-01) and carry the percentile band · Ph 3.")]
covpage("06.1","Coverage — Pipeline (1/2)","06 · Coverage — Pipeline",P1[:4])
covpage("06.2","Coverage — Pipeline (2/2)","06 · Coverage — Pipeline",P1[4:])
D=[("Drawer header","job drawer","Title, company, location, “Hybrid / in person…”, posted age; score ring (rating + band); prev / next; close; chips bucket · FLEX class · salary · location.","Opens from table and map; prev / next.",
"Rating changes while open, no cause shown.","Rev + band by the ring; ◌ stale evidence; change cause shown; map lock-on (HF-01 / 16 / 19)."),
("Overview","tab","Key details, evidence signals, summary; TIM DECISION form: State (READY_TO_PURSUE, APPLIED, Rejected by Employer, MANUAL_RESEARCH, DECLINED_BY_TIM, CLOSED_DEAD, INVALID_DISCOVERY, DUPLICATE), Reason code, Duplicate of, note, SAVE JOB DECISION, UNDO LAST; COMPARE ROLE; ☆ PIN; provenance + DUPLICATE WARNING.",
"Form, compare and pin present.","Two-step decide (PURSUE / HOLD / DECLINE / RESEARCH prepare, Save commits); raw state codes; Undo only “last”.",
"One-click decision state machine with receipts and per-decision Undo (HF-03); readable labels (HF-08); Decline separated with inline reason picker · Ph 1–3."),
("Posting","tab","Source links, posting facts, “no posting text stored”, OPEN EXTERNAL.","External link opens.","Missing posting text is common and silent.",
"Show “posting text missing” as an olive evidence gap; AI discover is an explicit, receipted action (HF-09)."),
("Fit &amp; Score","tab","Opportunity rating breakdown — e.g. 59 WEAK: experience 88 · Degree FLEX weighted 30 (NO_FLEX −60) · net compensation 57 · geo 20 (nearest Los Angeles, CA) · ATS 46 · title 90 · culture 90 (P2) · ownership unknown; screen gate FAIL; FLEX impact −6.",
"Explains each factor; names the nearest geo control point.","Weights do not visibly sum; stored FLEX may be stale; “derived viewer model” scope unclear.",
"Weight · raw · points table = 100 incl. FLEX, all SHARED (rev 24); FLEX input = fixed class score (NO 30); −60 is an ADJUSTED_FIT modifier (HF-09 / 19)."),
("Application · Documents · History","tabs","Application: state, interview mode, JD link, ADD TRIAGE NOTE / SAVE TIMESTAMPED NOTE, interview history. Documents: docs for this role, OPEN THE DOCUMENT LIBRARY. History: this-device ruling, added, first loaded, activity timeline.",
"Tabs render.","Notes are writes without receipts; “this-device ruling” vs canonical unclear.",
"Interviews 14d tile reads from Application dates; notes get receipts; History merges Writer receipts with scope labels (HF-02 / 03).")]
covpage("06.3","Coverage — Job Drawer","06 · Coverage — Job Drawer",D)
I=[("Scout results","t=quality","Intake by discovery day (10-01..10-10); cohort outcomes (638: Ready 1, Scout intake 426, Discovery lead 102, Research 8, Applied 26, Employer rejected 2, Declined by Tim 56, Duplicate 9, Closed 8); maturity 108 finalized; quality windows 7d / 30d (admission 99.3 / 98.6 %, actionable yield 0.7 / 1.4 %, invalid 96.4 / 84 %, median to final 25.1 h / 2.9 d); per-run table.",
"Charts render.","Per-run rows mostly “no run record”; cohort counts differ from Trends without a scope label; 0.7 % actionable yield buried.",
"Scope header on every block (HF-02); yield as the headline KPI; per-run empty state explains why · Ph 1 / 3."),
("Scout intake · Discovery leads","p=SCOUT_INTAKE · p=LEADS","Job queue filtered to 426 and 102.","Filters apply.","Same UI as Jobs for very different work; View &amp; filters shows AWAITING AI 528 / STALLED 72H 536.",
"Triage mode (bulk dismiss with reason, confirm + count + receipt); leads styled olive “unverified”; promote-to-job action · Ph 3."),
("Manual intake","t=intake","Status counters; + ADD JOB LINK; Show filter; empty table; “Worker has not checked this queue yet”; refreshes every 30 s.",
"Status refresh.","No last-check time or ETA.","Show last worker check + Writer latency; ADD JOB LINK gets a receipt · Ph 2."),
("Target companies","t=companies","Registry P1 0 · P2 18 · P3 16 · Watch 0 · Paused 4 (38); SAVE REGISTRY / DISCARD-RELOAD; ADD COMPANY; per-row priority + EDIT; rule text: priority sets discovery intensity and culture score (P1 100, P2 90, P3 75, Watch 60, unlisted / Paused 40); stored in canonical Rules SECTION=TARGET_COMPANIES.",
"Registry loads; form present.","A canonical (shared) write is not badged as such; culture-score impact invisible.",
"SHARED badge + confirm / receipt / undo; preview “changes culture score for N jobs” (HF-19 pattern) · Ph 2–3.")]
covpage("06.4","Coverage — Intake","06 · Coverage — Intake",I)
S=[("Dashboard","t=automations","AI Operations: REFRESH EVIDENCE; KPIs backlog 82 · completion 89 % (690 / 772) · writer blocked 14 · intake reviewed 0 · oldest open 5 d; Writer throughput (waiting 1, finished 24 h 41, peak 5 / h, longest wait 5 min, failed 24 h 2); intake funnel; backlog by stage; runtime read health (master LIVE, snapshot OK, 749 rows, age 4 d).",
"Renders evidence.","Very dense; funnel “found 0” vs scout counts; 4-day-old snapshot not flagged.","One-line health summary first; age warnings; KPIs link to filtered Work queue · Ph 3."),
("Work queue · Intake coverage · Verification &amp; recovery","sub-tabs","772 tracked / 690 verified / 82 unresolved (STAGE · STATE · OWNER · SOURCE · OUTCOME · NEXT ACTION); coverage UNKNOWN with window pickers + REQUEST CATCH UP, 2 requests PENDING_MANUAL; unresolved obligations with ACKNOWLEDGE.",
"Tables load.","Jargon states; catch-up and acknowledge are writes with no confirm or receipt.","Readable states (HF-08); catch-up / acknowledge need reason + confirm + receipt (HF-03) · Ph 2–3."),
("Schedules · Diagnostics (Health) · Incidents","sub-tabs + top tabs","“Native control: UNSUPPORTED”, Stage a schedule proposal; PR70 production acceptance INDETERMINATE; incident history with All / Unresolved / Verified recovered / Historical and 3 unfinished operations.",
"Read-only views render.","Schedules and Health duplicated as top tabs; INDETERMINATE / UNSUPPORTED unexplained.","One entry each; plain-language status + next step; Writer banner links to Incidents · Ph 2."),
("Writer connection","t=settings · ⚙","Script URL, passphrase (masked), TEST, SAVE CONNECTION ON THIS DEVICE, CLEAR, SEED STRUCTURED RUNTIME FROM WRITER; receipts → LOAD RECEIPTS FROM DRIVE; status “Connected structured runtime”, no write errors.",
"Connection healthy after load.","Two entry points; credential fields on a general page; “unreachable” banner on first load then Connected.",
"Single entry (System › Writer connection); credentials behind explicit reveal + confirm; banner only after 2 failed checks / 20 s grace (HF-04) · Ph 1–2."),
("System drawer","bell · Status · Writer pill","Health DEGRADED (no current faults; 3 prior failures to verify); master LIVE; live code PR #109; scoring rev 24; 185 of 603 FLEX evidence values stamped under an older rule; frontend check unavailable (PR #113); migration CUTOVER_COMPLETE; AI usage meters; 3 unfinished ops; REFRESH NOW, CHECK LATEST BUILD, REVIEW FULL UNFINISHED-WORK QUEUE.",
"Rich status in one place.","Three entry points; DEGRADED with no current fault reads as an alarm.","Pill + one icon open it; health = worst <i>current</i> fault, history separate; stale-evidence count mirrored from Settings (HF-19) · Ph 1–2.")]
covpage("06.5","Coverage — System (1/2)","06 · Coverage — System",S[:3])
covpage("06.6","Coverage — System (2/2)","06 · Coverage — System",S[3:])
ST=[("Flex policy &amp; scoring","t=scoring","FLEX policy (shared), VNext backtest gate, shared model rev 24, ranking weights, salary curve (all one shared model), geo heat map with 20 control points.","See Section 14.","Copy says local while all scoring inputs are shared; 185 stale evidional; duplicate “Pay &amp; location” tab.","Full redesign in Section 14 (HF-19) · Ph 1–3."),
("Rules (Advanced rules)","t=rules","TIM_PIPELINE_RULES_CANONICAL v4, ACTIVE, owner Tim Pruitt, 19 sections (Ruleset overview … Target companies), search; EDIT SOURCE TEXT / DISCARD-RELOAD / LOAD APPROVED FLEX-URL UPDATE. Change control: AIs may propose; only Tim pressing Save makes it canonical.",
"Read and search.","Rules are the authority for scoring (COMPENSATION_GEOGRAPHY, DEGREE_FLEX, TARGET_COMPANIES) but nothing links them.",
"Section index with “used by” links (Scoring A / E / G, Target companies); diff preview before Save; SHARED badge + receipt (HF-04 / 19) · Ph 2–3."),
("Display &amp; columns","Settings","Columns “local to this browser”: ~150 grouped fields, desktop / phone sets, frozen columns; SAVE DISPLAY ON THIS DEVICE / RESET DEFAULTS / USE COCKPIT COLUMNS / RESTORE COLUMNS.","Lists render.","Scope only in copy; no readable preset.",
"LOCAL badge; ship the 11-column readable preset (HF-07 / 08); phone set = Track M cards · Ph 3."),
("Documents (+ “Resume &amp; ATS”)","Settings","Resumes 3 (1 APPROVED) · cover letters 3 · supporting 3 · Tim's voice 2; working-text drafts (browser-only, not saved to Drive); Open in Drive; ATS profile + local proxy scores; “Automatic text extraction unavailable” for PDF.",
"Library renders; Drive links.","“Resume &amp; ATS” is the same view; browser-only drafts risk loss.","Merge tabs as “Documents &amp; ATS”; LOCAL draft badge + “not saved to Drive” warning; ATS score labelled “proxy” · Ph 2–3.")]
covpage("06.7","Coverage — Settings","06 · Coverage — Settings",ST)
G=[("Routing","URL hash","Hash-only state; /scoring, /rules, /map, /trends, /companies, /help … and /zz-control-404 all return 200 and redirect to /pipeline.","Hash deep links restore views.","Silent redirects hide typos and broken links.","Keep hash state; add readable path aliases and a not-found notice instead of silent redirect · Ph 2."),
("Top bar","global","Menu · title + tagline · breadcrumb · search “Search jobs, companies, or locations…” · Writer pill (idle / checking / queued / processing + countdown) · QUEUE n · LAST SYNC · COMPARE · 0/3 · COMPACT / COMFORTABLE · LAYOUT · REFRESH · bell · ⚙ (= Writer setup).",
"Search, density and layout work.","Refresh twice (top + rail); ⚙ opens Writer setup, not Settings; pill flaps.","One Refresh; ⚙ → Settings; pill debounced with “stable 12m” (HF-04 / 06) · Ph 2."),
("Left rail · Layout mode","global","Pipeline · Intake · System · Settings, Status, Refresh; expands on hover; Menu pins. LAYOUT: MOVE handles, LOCK VIEW / SAVE / RESET VIEW / DONE.",
"Hover expand; DONE exits layout.","Pin cannot unpin; rail overlaps title / map header.","Pin toggles with visible ⇤ Unpin; rail pushes content (HF-06); LOCAL badge on layouts · Ph 2."),
("View &amp; filters · Map point filters","panels","READY 1 / AWAITING AI 528 / STALLED 72H 536; ~20 preset chips; SELECT VISIBLE · AI DISCOVER MISSING DATA · MARK VISIBLE SEEN. Map: Auto zoom on selection, Selection zoom 600 %, Dense-area boost, colour chips.",
"Presets apply; popover opens.","Bulk write / AI actions sit beside filters; dense-area boost is cluster-like; colours not score bands.",
"Separate filters from bulk actions (confirm + count + receipt); keep auto-zoom (current behaviour) as animated fit; drop dense-area boost; pins by score band (HF-16) · Ph 2–3."),
("FAULT banner · footer","global","Red “Writer unreachable — Failed to fetch” with ✕; footer “OPERATIONS · 10 local entries · 10 unverified · browser does not run jobs or check scheduler health”.",
"Dismiss works.","False alarm on load; “unverified” count not actionable.","Debounced banner linked to Incidents; footer count opens receipts (HF-03 / 04) · Ph 1–2.")]
covpage("06.8","Coverage — Global Chrome","06 · Coverage — Global Chrome",G)


sec("07","Information Hierarchy")
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
("HF-16","Map panel: selected job or filtered set (targeting style kept)","P1"),
("HF-17","2560 × 1440 primary desktop layout","P2"),
("HF-18","Mobile redesign + perimeter insets, camera keep-out","P2"),
("HF-19","Scoring page &amp; geo map: honest totals, scope, preview, stale evidence","P1")]
phase_of={"HF-14":"0","HF-01":"1","HF-02":"1","HF-03":"1","HF-04":"1–2","HF-05":"2","HF-06":"2","HF-07":"3","HF-08":"3","HF-09":"3","HF-10":"3","HF-11":"3","HF-13":"3","HF-12":"4","HF-15":"2–3","HF-16":"2–3","HF-17":"3","HF-18":"M","HF-19":"1–3"}
lc=["#38E1D6","#A3A39E","#6B6B66","#3A3A3A"]
lh=''.join(f'<div class="card" style="margin:0;padding:7px 12px;display:grid;grid-template-columns:70px 130px 1fr;gap:10px;margin-left:{i*14}px;border-left:2px solid {lc[i]}"><div class="label" style="padding-top:2px">{a}</div><b>{t}</b><div class="small">{d}</div></div>' for i,(a,t,d) in enumerate(layers))
rh=''.join(f'<tr><td class="id">{i}</td><td>{t}</td><td><span class="tag {p.lower()}">{p}</span></td><td class="label">{phase_of[i]}</td></tr>' for i,t,p in reqs)
page(f"""<div class="sec">Section 07</div><h1>Information Hierarchy</h1>
<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px">{lh}</div>
<p class="small muted">Layout (v1.3, Tim-approved): <b style="color:var(--t1)">review table left · live map centre · selected job + decisions right</b>; KPI tiles + change strip on top, event ticker below.</p>
<div class="hull bar-l small" style="margin-top:4px"><b>Layers mapped to the v1.4 cockpit</b></div><table class="tight"><tr><th style="width:80px">Layer</th><th style="width:190px">Desktop 2560 zone</th><th>Phone (portrait)</th></tr><tr><td class="id">1</td><td>KPI tiles + change strip (top)</td><td class="small">KPI strip + change strip</td></tr><tr><td class="id">2</td><td>11-column table (left) + job map (centre)</td><td class="small">Swipe cards · Map tab</td></tr><tr><td class="id">3</td><td>Selected-job workspace (right)</td><td class="small">Job detail · map bottom sheet</td></tr><tr><td class="id">4</td><td>Breakdown drawers, receipts, ticker</td><td class="small">Desktop mode</td></tr></table>""","07 · Information Hierarchy")
sec("08","Requirements HF-01 – HF-19")
page(f"""<div class="sec">Section 08</div><h1>Requirements</h1>
<table><tr><th style="width:62px">ID</th><th>Requirement</th><th style="width:48px">Pri</th><th style="width:58px">Phase</th></tr>{rh}</table>
<p class="small muted" style="margin-top:6px">Priority: P0 integrity / precedes all else · P1 workflow safety · P2 cognitive efficiency · P3 optional enhancement. Phase column maps to Section 17; “M” = Mobile track. HF-15 – HF-18 new in v1.3; HF-19 new in v1.4.</p>""","08 · Requirements")

det=[("HF-01","One score, one meaning","P0",["Single scoring record: value, score type, rule/model version, computed-at, evidence status.","Queue, detail, map, compare render from that record. One display name everywhere.","Alternative / historical scores explicitly labeled, never silently substituted.","<b>First suspect:</b> the memoized scoring config (lag fix). Verify cache invalidation when the model is republished.","<b>Dependency (v1.5):</b> Writer-stamped values use the old formula until the Writer Apps Script is redeployed (Phase 0 discrepancy)."],"Identical value and band for the same job / type / revision in every view."),
("HF-02","Counts that reconcile","P0",["Each counter documents population, filters, time window, source. “Applied – all time” vs “Applied – this view” labeled.","Every Layer-1 tile is clickable and filters the queue to exactly its population.","Inventory cases: Declined by Tim 0 / 56 / 57 and Employer rejected 0 / 2 / 7 (Trends · Scout results · Buckets) carry explicit scope (live / cohort / archive)."],"Every counter matches its documented query; tile click count == rows shown."),
("HF-03","Decisions that show the truth","P0",["One click begins a write; no separate Save for routine decisions.","States: queued, processing, confirmed, failed, superseded. Receipt + Undo shown directly under the action buttons.","Writer is synchronous: a write lands in seconds; 30 s script lock; busy refusals auto-retry at 8 / 15 / 30 / 45 s. Queued state reads “◷ Waiting for Writer lock · N s”.","Failed (⊗) actions stay visible, keep payload, retry without duplicate canonical writes.","Decline (⊖) visually separated from Pursue; APPLIED / REJECTED_BY_EMPLOYER stay protected (#115)."],"Simulated Writer failures never show success, never drop decisions, never duplicate rows."),
("HF-04","Behavioral surprises","P1",["Fix console errors (lines 1320 / 1326). Make Compact toggle work or remove it.","Settings shows one shared scoring model (all weights, salary, geo, FLEX weight) vs local display preferences; shared publishes warn and confirm.","Remove duplicate entry points: Settings tabs + cards, ⚙ vs Writer connection, three System-drawer triggers, Schedules / Health top tabs.","Writer banner / pill debounced (no “unreachable” flash on load); opening a job never causes a write."],None),
("HF-05","Context preservation and conflict guard","P1",["Refresh keeps selected job, filters, sort, scroll.","New / changed rows marked with a white Δ and neutral wipe (never cyan) instead of silent reorder; evidence updates state their cause.","If a bot changes the selected job after it was opened, warn before the decision commits; never overwrite silently."],None),
("HF-06","Navigation","P1",["Map: permanent panel (HF-16); fullscreen sits below the tab bar with always-visible ✕ Close + Esc; auto-fit; selection synced with queue.","Rail never covers content (push, don't overlay); Menu pin toggles with a visible Unpin."],None),
("HF-07","Density preserved","P2",["Keep 11-column desktop default; adjustable widths; column priority settings.","No horizontal overflow for priority columns (title, company, location, score, posted pay, age); clip nothing mid-word.","Target 15–20 visible rows at standard desktop viewport. Queue rows show posted pay + age next to score."],None),
("HF-08","Readable labels","P2",["<code>SALARY_BASE_EST</code> → “Base pay (est.)”; <code>FLEX_CLASS</code> → “Degree flex”; <code>RESOLVED/APPLIED_CONFIRMED</code> → “Applied – confirmed”. Raw codes live in Layer 4."],None),
("HF-09","Score rationale","P2",["One plain-English line next to every score (e.g., “Startup ramp role, $200–250K posted, degree required – flex”).","Breakdown and uncertainty one click away."],None),
("HF-10","Change summary","P2",["Strip: “Since your last review: N new · N scores changed (with cause, e.g. FLEX evidence HIGH → NO) · N Writer retries needed”, each item clickable."],None),
("HF-11","Data integrity in charts","P2",["Normalize source names case-insensitively; persist decline reason codes."],None),
("HF-12","Personalization (last)","P3",["Learns from overrides (e.g., frequent declines of manager-level non-priority roles); advisory only, explains itself, reversible.","Never alters canonical rules, applies to jobs, or decides for the user."],None),
("HF-13","Phone","P2",["Phone scope: Layer 1 counts, change summary, queue, selected job, decide / undo.","Targets ≥ 44px for decision buttons (WCAG 2.2 minimum 24px). Editing rules / settings is desktop only. <b>Expanded by HF-18 (v1.3).</b>"],None),
("HF-14","Baseline first","P0",["Before any change, time 5 real review tasks on the current build; record time, errors, extra navigation, scrolling, perceived difficulty. Repeat after each phase."],None)]
def detcard(d):
    i,t,p,items,acc=d
    a=f'<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--seam)" class="small"><span class="label" style="color:var(--green)">✓ Accept</span>&nbsp; {acc}</div>' if acc else ''
    li=''.join(f'<li>{x}</li>' for x in items)
    return f'<div class="card" style="padding:7px 12px;margin-bottom:7px"><div style="display:flex;gap:10px;align-items:baseline;margin-bottom:3px"><span class="id">{i}</span><b style="font-size:11pt">{t}</b><span style="margin-left:auto" class="tag {p.lower()}">{p}</span></div><ul class="small" style="margin-bottom:0">{li}</ul>{a}</div>'
sec("09","Requirement Detail")
page('<div class="sec">Section 09</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-01 – HF-04</span></h1>'+''.join(detcard(d) for d in det[:4]),"09 · Requirement Detail (1/4)")
page('<div class="sec">Section 09 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-05 – HF-11</span></h1>'+''.join(detcard(d) for d in det[4:11]),"09 · Requirement Detail (2/4)")
det2=[("HF-15","Motion system","P2",["Rich motion is the standard (operator decision): named duration and easing tokens; catalog M-01 – M-19 (Section 12); no radar sweep.","Hard limits: never blocks input · never hides true state · job selection settles ≤ 0.7 s total · p95 frame ≤ 16.7 ms · nothing flashes &gt; 3 / s.","<b>Reduce motion</b> toggle in Local preferences, off by default."],"0 input blocked; selection ≤ 0.7 s; p95 frame ≤ 16.7 ms; ≤ 3 flashes / s; every animation maps to a token; write-state motion never precedes the state event."),
("HF-16","Map panel — Tim's rule","P1",["Permanent centre panel showing <b>only the selected job</b>, or by default <b>the jobs in the current filtered selection</b> (current behaviour = design authority).","Score-band pins, two-way selection sync, hover cards, smooth animated auto-fit; fullscreen with visible ✕ Close + Esc.","Targeting look kept: reticle / lock-on, grid, coordinates, corner brackets. <b>No radar, range rings or clusters.</b>"],"Pin set == filtered rows 100 %; selection sync 100 %; close found unaided; 0 radar / ring / cluster elements."),
("HF-17","2560 × 1440 desktop layout","P2",["Rail 56 (push) + three zones: table 1112 · map 800 · workspace 508 (job drawer); sub-tabs, KPI tiles, change strip, ticker.","All 11 columns visible without horizontal scroll; ≥ 30 rows; type scale per Section 15."],"11 / 11 columns and ≥ 30 rows at 2560 × 1440; 0 clipped priority cells."),
("HF-18","Mobile redesign","P2",["iPhone 18 Pro (assumed 402 × 874 pt): portrait cards with swipe decisions + haptics, tab bar, full-bleed map + sheet.","Landscape split view; desktop-mode switch with state persisting both ways.","Perimeter: 24 pt side padding beyond safe area, 36 pt in corner zones, controls ≥ 16 pt above the home indicator; camera keep-out top (portrait) and left or right (landscape). Targets ≥ 44 pt."],"Undo 100 %; state kept across switch 100 %; 0 tap targets in keep-out zones, portrait and both landscape rotations."),
("HF-19","Scoring page &amp; geo map","P1",["Settings › Flex policy &amp; scoring retained and enhanced (Section 14): all eight weights are one shared model; honest total = all rows, all SHARED (rev 24: 35 · 30 · 15 · 10 · 5 · 5 · 0 · 0).","FLEX weight (model) separated from FLEX policy modifiers (rules; ADJUSTED_FIT / PURSUIT_STATUS only). Publish confirm + receipt; Undo = republish previous revision; live impact preview; ◌ only on stale stored evidence.","Geo map: targeting look, click-to-add, drag-to-move; canonical COMPENSATION_GEOGRAPHY is the authority."],"Per Section 14.1: total = visible sum, all SHARED; preview = actual change; ◌ on 100 % of stale evidence values; 0 LOCAL badges on scoring inputs.")]
page('<div class="sec">Section 09 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-12 – HF-15</span></h1>'+''.join(detcard(d) for d in det[11:]+det2[:1]),"09 · Requirement Detail (3/4)")
page('<div class="sec">Section 09 · continued</div><h1>Requirement Detail <span class="muted" style="font-size:12pt;font-weight:400">HF-16 – HF-19</span></h1>'+''.join(detcard(d) for d in det2[1:]),"09 · Requirement Detail (4/4)")
sec("10","Visual Standards"); sec("11","Color System")
base=[("#000000","Void","Page background"),("#0B0B0B","Hull","Panels"),("#141414","Plate","Cards / rows"),("#1E1E1E","Raised","Hover / selected"),("#2A2A2A","Seam","Borders"),("#3A3A3A","Gridline","Map grid")]
text=[("#E6E6E2","Primary","Body text, values, titles"),("#A3A39E","Secondary","Supporting text, labels"),("#6B6B66","Muted","Large text (≥ 18.66 px bold / 24 px) only")]
sig=[("#4ADE80","HUD Green","Fits rules · confirmed · <b>Pursue</b>","✓"),("#F2B33D","Amber Caution","Flex question · queued · <b>Hold</b>","◷"),("#FF4D3D","Alert Red","Failed write ⊗ · hard block ⊘ — <b>only</b>","⊗"),("#38E1D6","Target Cyan","Selection · focus · links — the only “live” color","◉"),("#8A8F7A","Olive Drab","Discovery leads · unverified","?"),("#5A5A5A","Terminal Grey","Closed · <b>Decline</b> ⊖ (with word)","⊖")]
def sw(h,n,r,ic="",tc=None,stack=False):
    nm=f'<span class="nm" style="color:{tc}">{ic}&nbsp;{n}</span>' if tc else f'<span class="nm">{n}</span>'
    return f'<div class="sw"><div class="chip" style="background:{h}"></div><div><div style="display:flex;justify-content:space-between;align-items:baseline">{nm}<span class="hx">{h}</span></div><div class="rl">{r}</div><div class="crx">CONTRAST ON VOID {cr(h,"#000000"):.1f}:1</div></div></div>'
vs=["Black and neutral grey; <b>no blue-tinted charcoal</b>. Emphasis by contrast, weight, spacing, restrained status color.","One color = one meaning everywhere: green fits rules / top band; amber flex / waiting; red <b>failed write or hard block only</b>; clay low band; grey terminal.","Clear type hierarchy; minimize tiny text.","<b>Rich motion by operator decision (v1.3):</b> animate anywhere it makes a little sense — sliding, scrolling, sweeping, materializing — under the Motion System guardrails (Section 12).","<b>Map style retained:</b> the current military targeting look is design authority and is only enhanced (Section 13).","Visible focus, WCAG 2.2 AA contrast, logical keyboard order, keyboard shortcuts documented in a help overlay (not tiny inline text).","Emotional target: <b>confidence and control</b> in a living HUD — motion says the system is alive and working, never that it is unsure."]
th=''.join(f'<div class="sw" style="grid-template-columns:1fr"><div style="font-size:15pt;font-weight:600;color:{h};line-height:1.1">Aa 84</div><div><div style="display:flex;justify-content:space-between"><span class="nm">{n}</span><span class="hx">{h}</span></div><div class="rl">{r}</div><div class="crx">VOID {cr(h,"#000000"):.1f}:1 · PLATE {cr(h,"#141414"):.1f}:1</div></div></div>' for h,n,r in text)
page(f"""<div class="sec">Section 10</div><h1>Visual Standards</h1>
<ul>{''.join(f'<li>{x}</li>' for x in vs)}</ul>
<div class="sec" style="margin-top:14px">Section 11</div><h1 style="font-size:17pt">Color System <span class="muted" style="font-size:11pt;font-weight:400">· futuristic military HUD · black / neutral grey · no blue tint</span></h1>
<div class="label" style="color:var(--t1);margin:4px 0 6px">11.1 Base surfaces</div>
<div class="grid2" style="gap:0 9px">{''.join(sw(*x) for x in base)}</div>
<div class="label" style="color:var(--t1);margin:6px 0 6px">11.2 Text</div>
<div class="grid3" style="gap:0 9px">{th}</div>
<p class="small muted" style="margin-top:4px">Contrast note: Muted <code>#6B6B66</code> is {cr("#6B6B66","#000000"):.1f}:1 on Void (below 4.5:1), so in v1.5 it is restricted to <b>large text only</b>; small metadata uses Secondary. Terminal Grey <code>#5A5A5A</code> ({cr("#5A5A5A","#000000"):.1f}:1) is used for dots and bars only and always carries a word label in Secondary text.</p>""","10–11 · Visual Standards, Color System")

sgh=''.join(sw(h,n,r,ic,h) for h,n,r,ic in sig)
page(f"""<div class="sec">Section 11 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Color System — Signal, Bands, Rules</h1>
<div class="label" style="color:var(--t1);margin-bottom:6px">11.3 Signal colors</div>
<div class="grid2 sig" style="gap:0 9px">{sgh}</div>
<div class="label" style="color:var(--t1);margin:8px 0 6px">11.4 Score bands — percentile (v1.5)</div>
<div class="bands" style="grid-template-columns:repeat(4,1fr)">
 <div class="band" style="border-left:2px solid #4ADE80"><div class="label">Top 10 % · ≥ P90 (61)</div><div class="bn" style="color:#4ADE80">▲ Top</div></div>
 <div class="band" style="border-left:2px solid #F2B33D"><div class="label">Next 25 % · ≥ 54</div><div class="bn" style="color:#F2B33D">◆ Upper</div></div>
 <div class="band" style="border-left:2px solid #8E8E89"><div class="label">Next 45 % · ≥ 38</div><div class="bn" style="color:#8E8E89">● Mid</div></div>
 <div class="band" style="border-left:2px solid #D9826B"><div class="label">Bottom 20 %</div><div class="bn" style="color:#D9826B">▽ Low</div></div>
</div>
<p class="small muted" style="margin-top:5px">Display-only, recomputed when the model or the eligible population changes; cut-points are tokens (example: top 76 · P90 61 · median 48). STRICT / hard-block shows ⊘ HOLD separately, never as a band. Rows, ring and pins share one band from the single score record (HF-01).</p>
<div class="label" style="color:var(--t1);margin:8px 0 6px">11.5 Usage rules</div>
<table class="tight">
<tr><th style="width:118px">Rule</th><th>Standard</th><th style="width:140px">Example</th></tr>
<tr><td><b>Typography</b></td><td>Monospace <b>uppercase</b> for labels only; sans-serif for numbers and titles.</td><td><span class="label">POSTED PAY</span> <span class="num">$212K</span></td></tr>
<tr><td><b>Glow</b></td><td>Cyan glow on focus, processing, hover traces, lock-on and auto-fit trace (<code>0 0 6px</code>, 40%); one-shot green confirm flash. At rest nothing else glows.</td><td><span style="display:inline-block;border:1px solid var(--cyan);box-shadow:0 0 6px rgba(56,225,214,.4);padding:1px 8px;font-size:9pt">Focused</span></td></tr>
<tr><td><b>Borders &amp; corners</b></td><td>1px Seam borders; sharp or 2px corners. No pills, no soft shadows.</td><td><span style="display:inline-block;border:1px solid var(--seam);border-radius:2px;padding:1px 8px;background:var(--plate);font-size:9pt">Panel</span></td></tr>
<tr><td><b>Signal use</b></td><td>Signal colors on text, thin left bars and dots — <b>never large fills</b>.</td><td><span style="border-left:2px solid var(--amber);padding-left:6px;font-size:9pt"><span class="dot" style="background:var(--amber)"></span>Waiting for lock 8 s</span></td></tr>
<tr><td><b>Never color alone</b></td><td>Every signal pairs with an icon or a word (WCAG 1.4.1), so meaning survives color-vision differences.</td><td><span style="color:var(--red);font-size:9pt">⊗ Write failed</span></td></tr>
<tr><td><b>Cyan scarcity</b></td><td>Target Cyan means live / interactive / focused — incl. lock-on reticle and hover traces. Never used for status or decoration.</td><td><span style="color:var(--cyan);font-size:9pt">◉ Selected</span></td></tr>
</table>
""","11 · Color System (continued)")

sec("11.6","Bands, Glyphs & Markers",1)
GLY=[("✕","Close","#A3A39E","Close panel / fullscreen only"),("⊖","Decline","#A3A39E","Decision — grey + word, separated from Pursue"),("⊗","Failed write","#FF4D3D","Red; keeps payload; Retry"),("⊘","Hard block / HOLD","#FF4D3D","STRICT FLEX etc.; outside bands"),("▲","Top 10 %","#4ADE80","Band"),("◆","Next 25 %","#F2B33D","Band"),("●","Mid 45 %","#8E8E89","Band"),("▽","Low 20 %","#D9826B","Band (Clay, not red)"),("◷","Waiting for Writer lock","#F2B33D","Seconds; auto-retry 8/15/30/45 s"),("⟳","Writing","#38E1D6","Live state (cyan = live)"),("✓","Confirmed","#4ADE80","Readback matched"),("Δ","Changed","#E6E6E2","White + neutral wipe; never cyan"),("◌","Stale evidence","#8A8F7A","Stored evidence under an older rule / pre-redeploy"),("⚠","Confirm shared publish","#F2B33D","Shared-model change gate")]
gh=''.join(f'<tr><td style="font-size:14pt;color:{c};text-align:center">{g}</td><td><b>{n}</b></td><td class="hx" style="font-family:var(--mono);font-size:8pt">{c}</td><td class="small">{u}</td></tr>' for g,n,c,u in GLY)
page(f"""<div class="sec">Section 11.6 · new in v1.5</div><h1 style="font-size:18pt;margin-bottom:6px">Bands, Glyphs &amp; Markers</h1>
<p class="small muted" style="margin-top:-2px">One glyph = one meaning. Weak, failed, Decline and Close no longer share ✕; red no longer means a low score; the changed marker is not cyan.</p>
<table class="tight"><tr><th style="width:30px">Glyph</th><th style="width:150px">Meaning</th><th style="width:66px">Colour</th><th>Use</th></tr>{gh}</table>
<div class="grid2" style="margin-top:8px">
<div class="card bar-g small" style="margin:0"><b>Change-strip example.</b> <span style="color:#E6E6E2">Δ</span> Anduril · Head of Production <b>77 → 72 → 59</b> — cause: FLEX evidence HIGH → NO (rules evidence update, rev 24 unchanged). Click opens the evidence diff.</div>
<div class="card bar-a small" style="margin:0"><b>◌ scope.</b> Never marks a model revision — scores are live. Marks only stored evidence that predates the current rule (185 / 603) or Writer-stamped values awaiting the Writer redeploy.</div></div>""","11.6 · Bands, Glyphs & Markers")

# ---------- v1.3 new sections (inserted after Color System) ----------
import sys; sys.path.insert(0,'/workspace/pe/build15')
from mapsvg import map_svg, geo_heat_svg
from desk import desktop
from mobile import portrait_queue, portrait_detail, portrait_map, landscape_map, landscape_detail, landscape_desktop, keepout_diagrams
def note(t,c="l"): return f'<div class="card bar-{c} small" style="padding:7px 11px;margin-bottom:7px">{t}</div>'
sec("12","Motion System")
MT=[("--pe-motion-instant","0ms","—","State commit, value write (never animated)"),
("--pe-motion-fast","120ms","ease-out","Hover glow, press, focus ring"),
("--pe-motion-base","240ms","ease-inout","Panel slide, tab slide, toast slide-up"),
("--pe-motion-lock","320ms","snap","Map lock-on brackets / reticle"),
("--pe-motion-materialize","400ms","ease-out","Job detail scanline + dissolve"),
("--pe-motion-sweep","600ms","linear","Changed-row wipe, edge trace, ring draw-on"),
("--pe-motion-roll","800ms","ease-out","KPI counter roll-up"),
("--pe-motion-boot","1200ms","ease-out","Total HUD boot-up sequence"),
("--pe-motion-breathe","1600ms loop","ease-inout","Waiting-for-lock amber breathe"),
("--pe-motion-fit","600ms","ease-inout","Map auto-fit pan / zoom to job or filtered set"),
("--pe-motion-stagger","18ms / row","—","Row stagger step, capped at 30 rows")]
EZ=[("--pe-ease-out","cubic-bezier(0.16, 1, 0.3, 1)","Entrances, materialize, roll-up"),
("--pe-ease-in","cubic-bezier(0.7, 0, 0.84, 0)","Exits, collapse"),
("--pe-ease-inout","cubic-bezier(0.65, 0, 0.35, 1)","Slides, tabs, breathe"),
("--pe-ease-snap","cubic-bezier(0.34, 1.56, 0.64, 1)","Pin drop, lock-on overshoot"),
("--pe-ease-linear","linear","Sweeps, ticker, progress fill")]
mth=''.join(f'<tr><td class="code" style="color:var(--cyan)">{a}</td><td class="num">{b}</td><td class="small">{c}</td><td class="small">{d}</td></tr>' for a,b,c,d in MT)
ezh=''.join(f'<tr><td class="code" style="color:var(--cyan)">{a}</td><td class="code">{b}</td><td class="small">{c}</td></tr>' for a,b,c in EZ)
GR=[("G1","Never blocks input","Actions dispatch at t = 0; animation runs alongside, is interruptible, and never gates a click, key or gesture. No “wait for animation” states."),
("G2","Never hides true state","Final values are in the DOM immediately; motion is a presentation layer. Write-state motion is driven only by state-machine events (Phase 1). If motion and state disagree, state wins and the animation is cancelled."),
("G3","60 fps, GPU only","Animate <code>transform</code>, <code>opacity</code>, <code>filter</code> (and SVG <code>stroke-dashoffset</code> on small elements). No layout properties. p95 frame ≤ 16.7 ms; concurrent animations capped (12 desktop / 6 phone); overflow degrades to fade."),
("G4","Reduce motion toggle","Settings › Local preferences › <b>Reduce motion</b>, <b>off by default</b> (operator decision). On: loops stop, slides become 120 ms fades, shake becomes a static outline. OS-level Reduce Motion triggers a one-time prompt; it never silently overrides Tim's choice."),
("G5","Meaning conserved","Motion colour follows signal meaning: amber breathe = waiting for Writer lock only, red shake = failed only, cyan = live / selected / writing; the changed marker is white, never cyan."),
("G6","Flash safety","Nothing flashes more than 3× per second (WCAG 2.3.1); confirmed flash is a single pulse."),
("G7","Selection budget (v1.5)","Job selection — data, detail materialize, ring, lock-on and auto-fit together — settles in ≤ 0.7 s total; anything longer is cut, not queued.")]
grh=''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td></tr>' for a,b,c in GR)
page(f"""<div class="sec">Section 12</div><h1>Motion System <span class="muted" style="font-size:12pt;font-weight:400">· rich motion by operator decision</span></h1>
<div class="notice" style="margin-top:0"><b>Design authority</b>Tim Pruitt explicitly chose a <b>high-motion HUD</b> (v1.3; kept in v1.4 minus the radar sweep). Standard: <b>animate anywhere it makes a little sense</b>, within hard limits G1–G7.</div>
<div class="label" style="color:var(--t1);margin:8px 0 5px">12.1 Duration tokens</div>
<table class="tight"><tr><th style="width:178px">Token</th><th style="width:92px">Value</th><th style="width:78px">Easing</th><th>Used for</th></tr>{mth}</table>
<div class="label" style="color:var(--t1);margin:9px 0 5px">12.2 Easing curves</div>
<table class="tight"><tr><th style="width:150px">Token</th><th style="width:240px">Curve</th><th>Used for</th></tr>{ezh}</table>
<div class="label" style="color:var(--t1);margin:5px 0 4px">Boot-up timeline (M-01) · input live from t = 0</div>
<pre style="font-size:8.4pt">t=0      <span class="k">controls live</span> · grid fades in            <span class="c">fast</span>
t=120    panels slide in from edges (stagger 40 ms)  <span class="c">base · ease-out</span>
t=360    corner brackets draw · map materializes     <span class="c">materialize</span>
t=400    KPI counters roll up · rows stagger in      <span class="c">roll · stagger</span>
t=1200   map auto-fits to the current view          <span class="c">fit · ease-inout</span></pre>""","12 · Motion System — Tokens")
CAT=[("M-01","HUD boot-up","App load","Grid fades in → panels slide from edges → corner brackets draw → KPIs roll up → map auto-fits. 1200 ms total; any input skips it; controls live at t = 0."),
("M-02","Panel slide-in","Load, open, expand","Panels enter from their nearest edge: translate 24 px + fade · base · ease-out."),
("M-03","Job detail materializes","Selection","Scanline mask sweeps top → bottom with pixel-dissolve fade-in; cyan edge trace runs the panel border · materialize 400 ms. Real values from frame 1."),
("M-04","Map auto-fit","Selection / filter change","Smooth animated pan + zoom to the selected job, or to the padded bounds of the filtered selection · fit 600 ms · ease-inout; any manual pan / zoom cancels it. <i>Replaces the v1.3 radar sweep.</i>"),
("M-05","Map lock-on","Job selected","Brackets collapse 2× → 1×, reticle rotates 90°, crosshairs extend, coordinates type on · lock 320 ms · snap."),
("M-06","Pin drop","Job enters the filtered set","Pin drops 12 px with snap overshoot · base 240 ms. No ping rings."),
("M-07","KPI roll-up","Counter change","Digits roll to the new value · roll 800 ms. Final value written at once; screen readers get the final value only."),
("M-08","Changed-row wipe","Row new / changed","Neutral white-grey wipe left → right, settles into a white Δ marker · sweep 600 ms. Never cyan. Replaces silent reorder (HF-05)."),
("M-09","Row stagger","Load, sort, filter","Rows rise 6 px + fade, 18 ms step, capped at 30 rows."),
("M-10","Score ring draws on","Detail opens / score changes","Ring stroke draws from 0 to value · sweep 600 ms · ease-out; number shown immediately."),
("M-11","Tab slide","Tab change","Content slides horizontally in tab order · base 240 ms · ease-inout."),
("M-12","Writer write states","State-machine event","Seconds scale. <span style='color:var(--amber)'>◷ waiting for Writer lock: amber breathe + “N s”, next retry 8 / 15 / 30 / 45 s</span> · <span style='color:var(--cyan)'>⟳ writing: cyan sweep</span> (typically 1–5 s) · <span style='color:var(--green)'>✓ confirmed: single green pulse</span> after readback · <span style='color:var(--red)'>⊗ failed: one shake</span> (3 × 4 px, 300 ms) then steady red with Retry."),
("M-13","Toast receipts","Decision made","Receipt slides up from the action bar · base · ease-out; stacks; failures never auto-dismiss."),
("M-14","Hover glow trace","Pointer hover / focus","1 px cyan trace runs once around the control border · fast 120 ms + sweep."),
("M-15","Event ticker","Pipeline events","Bottom feed scrolls ← at 40 px/s; pauses on hover / focus."),
("M-16","Map fullscreen","⤢ Fullscreen / ✕ Close","Fills the workspace below the tab bar · base; always-visible ✕ Close or Esc reverses; selection and viewport kept."),
("M-17","Mobile swipe physics","Card drag","Card tracks finger, action colour reveals underneath, springs back below threshold; haptic at threshold."),
("M-18","Publish progress","Update / publish button","Progress bar under the one-button update fills through write → readback (roll 800 ms per step); ◌ on a row clears when its evidence is refreshed. No breathing — amber stays “waiting for lock” only."),
("M-19","Panel loading","Data loading","Corner brackets draw + one scanline pass, label “ACQUIRING…”. Replaces the radar loading state.")]
ct=lambda L:''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small muted">{c}</td><td class="small">{d}</td></tr>' for a,b,c,d in L)
CH_='<tr><th style="width:42px">ID</th><th style="width:118px">Animation</th><th style="width:100px">Trigger</th><th>Specification</th></tr>'
page(f"""<div class="sec">Section 12 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Guardrails &amp; Motion Catalog (1/2)</h1>
<div class="label" style="color:var(--t1);margin:2px 0 5px">12.3 Guardrails — kept because they do not fight the standard</div>
<table class="tight" style="font-size:8.2pt;line-height:1.18"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th><th>Rule</th></tr>{grh}</table>
<div class="label" style="color:var(--t1);margin:10px 0 5px">12.4 Catalog · every animation names its token</div>
<table class="tight" style="font-size:8.2pt;line-height:1.18">{CH_}{ct(CAT[:3])}</table>""","12 · Motion System — Guardrails & Catalog")
page(f"""<div class="sec">Section 12 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Motion Catalog (2/2)</h1>
<table class="tight" style="font-size:8.2pt;line-height:1.18">{CH_}{ct(CAT[3:])}</table>
<p class="small muted" style="margin-top:4px">All items obey G1–G7: true state at every frame.</p>""","12 · Motion System — Catalog")

sec("13","Map System")
MK=[("Purpose (design authority)","The pipeline map shows <b>only the selected job's location</b>, or — with nothing selected — <b>the jobs in the current filtered selection</b> (Jobs, Review queue, Decline candidates, My rulings + View &amp; filters). Today's behaviour, Tim's binding rule.","a"),
("Retained look","Black field, grey outlines, mono state labels, zoom readout, + / − / layers, RECENTER, RESET, legend, Home — current style, only enhanced.","t"),
("Targeting layer","Reticle + crosshairs + corner-bracket <b>lock-on</b> on the selected job (M-05); HUD corner brackets on the panel; centre-of-view crosshair.","l"),
("Grid &amp; readouts","Graticule (1° minor, 5° major) with edge coordinates; selected job lat / long, range + bearing from Home, nearest geo control point and its score; cursor coordinates.","l"),
("Pins","One pin per job in the filtered selection, <b>coloured by percentile band</b> (▲ Top · ◆ Upper · ● Mid · ▽ Low; ⊘ HOLD separate) with glyph + word in the hover card; ◌ stale-evidence pins get an olive ring; remote jobs counted in the header.","g"),
("Sync &amp; auto-fit","Selection synced map ↔ queue ↔ drawer. <b>Smooth animated auto-fit</b> (M-04, 600 ms): pans / zooms to the job, or to the bounds of the filtered set with padding — replaces the fixed 600 % selection zoom. Manual pan cancels; FIT re-fits.","g"),
("Fullscreen","⤢ Fullscreen fills the workspace below the tab bar — never covers tabs or rail — with an always-visible <b>✕ Close · Esc</b> top-right; selection, filter and viewport kept.","a"),
("Removed in v1.4","<b>Radar sweep</b> (map and loading), range rings + ticks, clusters, ping rings, dimmed filtered-out pins, dense-area boost — none serve “show where the job is”.","r")]
mkh=''.join(f'<div class="card bar-{c}" style="padding:6px 11px;margin-bottom:5px;display:grid;grid-template-columns:140px 1fr;gap:10px"><div class="label" style="padding-top:2px;color:var(--t1)">{a}</div><div class="small">{b}</div></div>' for a,b,c in MK)
page(f"""<div class="sec">Section 13</div><h1>Map System <span class="muted" style="font-size:12pt;font-weight:400">· selected job, else filtered selection · targeting style</span></h1>
{mkh}
<table class="tight" style="margin-top:6px"><tr><th style="width:150px">Interaction</th><th>Result</th></tr>
<tr><td><b>Select row / click pin</b></td><td class="small">Map shows only that job; auto-fit pans / zooms to it (M-04); lock-on runs (M-05); drawer materializes (M-03).</td></tr>
<tr><td><b>Clear selection · Esc</b></td><td class="small">Returns to the filtered selection; auto-fit to its bounds; pins enter with a short drop (M-06).</td></tr>
<tr><td><b>Filter / preset change</b></td><td class="small">Pin set = new filter result exactly (no dimmed leftovers); header count rolls (M-07); auto-fit.</td></tr>
<tr><td><b>⤢ Fullscreen / ✕ Close</b></td><td class="small">Expands below the tab bar (M-16); ✕ Close and Esc always visible; never a trap, also in empty views (“No mapped jobs in this group”).</td></tr></table>""","13 · Map System")
sec("13.1","Map Panel — Reference Rendering",1)
mA=map_svg(684,318,-84.3,33.75,64,s=0.62,uid='refA',mode='filtered',fit_ghost=True,show_controls=True)
mB=map_svg(684,318,-86.0,35.5,150,s=0.62,uid='refB',mode='selected',fullscreen=True,sel_lines=('36.1627°N 086.7816°W','RNG 113 MI · BRG 296° FROM HOME','NEAREST GEO PT NASHVILLE, TN · 90'))
TAGM='<div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:var(--amber);color:#000;font-family:var(--mono);font-size:7.5pt;letter-spacing:.12em;padding:3px 8px;font-weight:600">CONCEPT — MOCK DATA</div>'
an=[("A","Default · filtered selection","One pin per job in the current view, band colours; dashed auto-fit bounds; hover card."),
("B","Selected job only","Only the selected job; lock-on reticle, coordinates, range / bearing, nearest geo point."),
("1","Auto-fit (M-04)","Animated pan + zoom to job or set bounds · 600 ms · interruptible."),
("2","✕ Close · Esc","Always visible in fullscreen (shown in B); never covers tabs."),
("3","Retained frame","Grid, corner brackets, view crosshair, + / − / FIT / layers, RECENTER, RESET."),
("4","Removed","Radar, range rings, clusters, pings, dimmed pins.")]
anh=''.join(f'<div class="card" style="padding:5px 9px;margin:0"><div style="display:flex;gap:6px;align-items:baseline"><span class="id">{n}</span><b style="font-size:10pt">{t}</b></div><div style="font-size:10pt;color:var(--t2);line-height:1.3">{d}</div></div>' for n,t,d in an)
page(f"""<div class="sec">Section 13.1</div><h1 style="font-size:18pt;margin-bottom:5px">Map Panel — Reference Rendering</h1>
<div class="label" style="margin-bottom:3px;color:var(--t1)">A · Default — jobs in the current filtered selection</div>
<div style="position:relative;border:1px solid var(--grid)">{mA}{TAGM}</div>
<div class="label" style="margin:7px 0 3px;color:var(--t1)">B · Selected job only (fullscreen shown, ✕ Close visible)</div>
<div style="position:relative;border:1px solid var(--grid)">{mB}<div style="position:absolute;top:8px;left:40%;background:var(--amber);color:#000;font-family:var(--mono);font-size:7.5pt;letter-spacing:.12em;padding:3px 8px;font-weight:600">CONCEPT — MOCK DATA</div></div>
<div class="grid3" style="margin-top:7px;gap:6px">{anh}</div>""","13 · Map — Reference Rendering · Mock Data")

sec("14","Scoring Page — Settings › Flex Policy & Scoring")
EXI=[("Header · control center","—","“SETTINGS › FLEX POLICY AND SCORING”; tabs Scoring &amp; flex | Pay &amp; location | Rules | Display &amp; columns | Documents | Resume &amp; ATS; badge PRESENTATION ONLY; six navigation cards (Live scoring, Rules authority, Writer connection, Display controls, Documents, Governance).","Pay &amp; location / Resume &amp; ATS are duplicates; badge contradicts shared Update buttons."),
("A · FLEX weighting &amp; eligibility","SHARED","FLEX scoring weight <b>30 %</b> (UPDATE FLEX WEIGHT). Eligibility (SECTION=DEGREE_FLEX, consumed by Writer): degree not stated = HIGH_FLEX · equivalent experience = HIGH_FLEX · hard requirement = NO_FLEX · confirmed single path = STRICT (choices HIGH / SOFT / NO / STRICT / UNKNOWN). Modifiers <b>HIGH 90 · SOFT 70 · NO −60 · STRICT −100</b>. Fresh degree evidence overrides stale FLEX = YES. UPDATE FLEX POLICY.","Shared write with no confirm, impact preview, receipt or undo; scope only in copy."),
("B · VNext backtest gate","PREVIEW","DESIGN_AND_BACKTEST_ONLY, cannot publish. Proposed weights: mfg domain alignment 25 · prototype-to-rate 20 · analogous ops experience 15 · scope / authority / title 15 · employer clout 10 · comp economics 10 · geography 5. Gates: 24+ labeled rows, pairwise accuracy &gt; 70 %, good avg ≫ bad avg, evidence mapping, explicit Tim approval. State <b>NOT READY</b>; live model TIM_WEIGHTED_JOB_RATING 2026-10-04.1.","Gate progress not quantified (rows labeled so far, accuracy)."),
("C · Shared model (published)","SHARED","Published <b>rev 24</b> · v2026-10-14.1 · Oct 14, 10:34 PM · SCORING_MODEL.md · TEST ON ONE JOB… · LOAD PUBLISHED. Stored FLEX evidence: <b>185 of 603</b> stamped under an older rule, idle — “choose Review refresh… to start”.","Stale evidence unmarked; evidence-driven changes show no cause (Anduril 77 → 72 → 59)."),
("D · Ranking weights","SHARED","Copy says “Ranks rows in this browser; does not write to master” — stale: the button publishes to the shared model. Total must equal 100: experience 35 · compensation 15 · geo 10 · ats 0 · title 5 · culture 5 · ownership 0; header “Total weight: 100 / 100 — Balanced”. UPDATE WEIGHTS &amp; SALARY · RESET FORM TO DEFAULTS.","Visible sum 70; FLEX 30 on card A; copy claims local."),
("E · Salary curve","SHARED","Floor 190 000 · target 240 000 · ceiling 300 000 (0 / 50 / 100); geo interpolation power 6. Net compensation = midpoint × state net-value factor.","Curve not drawn; relation to canonical pay rules unstated."),
("F · Geo heat map","SHARED","Continuous US choropleth (+ AK, HI insets), red 0 → yellow → green 100; one distance-weighted interpolation over control points; hard points override nearby; hover tooltip names nearest point + score (Texas → “Austin, TX · 50 / 100”). Table of 20 points (name · lat · lon · score · HARD · ×): Cleveland TN 100 H, New York 0 H, Tampa 90 H, Gulf Shores 100 H, Chicago 0 H, Nashville 90, Birmingham 90, Atlanta 80, Charlotte 80, Columbia SC 80, Raleigh 70, Austin 50, Columbus OH 40, Denver 40, LA 20, SF 20, Seattle 20, Memphis 10, Detroit 5, Minneapolis 5. ADD CONTROL POINT · UPDATE GEO SCORES.","Map click-to-add untested; no drag; no preview of affected jobs.")]
scc={"SHARED":"color:var(--amber);border-color:#4a3a17","LOCAL":"color:var(--t2)","PREVIEW":"color:var(--cyan);border-color:#17403d","—":""}
exr=lambda a,b,c,d: f'<tr><td><b>{a}</b></td><td>{"" if b=="—" else f"<span class=tag style={chr(34)}{scc[b]}{chr(34)}>{b}</span>"}</td><td class="small">{c}</td><td class="small" style="color:var(--amber)">{d}</td></tr>'
exh=''.join(exr(*x) for x in EXI[:4]); exh2=''.join(exr(*x) for x in EXI[4:])
EXT='<tr><th style="width:100px">Card</th><th style="width:62px">Scope</th><th>What exists today</th><th style="width:130px">Issue</th></tr>'
page(f"""<div class="sec">Section 14</div><h1>Scoring Page — As It Exists <span class="muted" style="font-size:11.5pt;font-weight:400">· Settings › Flex policy &amp; scoring</span></h1>
<p class="small" style="margin-top:-4px">A general scoring page, not just a map: seven cards, all scoring inputs in one shared model. Inventory, Oct 15 (read-only; no Update, Add or Publish clicked). Job-level effect: Fit &amp; Score names the nearest control point (e.g. “nearest Los Angeles, CA” → geo 20).</p>
<table class="tight">{EXT}{exh}</table>""","14 · Scoring Page — As It Exists (1/2)")
page(f"""<div class="sec">Section 14 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Scoring Page — As It Exists (2/2)</h1>
<table class="tight">{EXT}{exh2}</table>
<div class="card bar-a small" style="margin-top:9px"><b>Save paths (corrected in v1.5).</b> Weights, salary curve, geo points and FLEX weight all publish to <b>one shared, revision-numbered model</b> (<code>save_scoring_model</code>, rev 24 today). FLEX <i>policy</i> modifiers save to the canonical rules (DEGREE_FLEX) and affect ADJUSTED_FIT / PURSUIT_STATUS only. LOCAL = display, columns, layout, map mode, seen-state, drafts.</div>""","14 · Scoring Page — As It Exists (2/2)")
sec("14.1","Scoring Page — Proposals & HF-19",1)
PRS=[("S1","Retained &amp; enhanced","The page stays the design authority for scoring: same cards, same fields, same order; v1.5 only adds clarity and safety."),
("S2","Honest weight totals","One table, one row per weight, all SHARED: experience 35 · FLEX 30 · compensation 15 · geo 10 · title 5 · culture 5 · ats 0 · ownership 0 = <b>100</b> (rev 24). The FLEX row shows the weight; FLEX class scores are fixed (HIGH 80 · SOFT 62 · NO 30 · STRICT 0). Total always equals the visible sum."),
("S3","One shared model, honest scope","Every scoring card A–G carries <span class='tag' style='color:var(--amber);border-color:#4a3a17'>SHARED · model rev 24</span>; stale “this browser” copy removed. <span class='tag'>LOCAL</span> appears only on display / columns / layout / map mode / seen-state / drafts. Page badge PRESENTATION ONLY removed."),
("S4","Shared-change guard","Every one-button update is a shared publish: ⚠ confirm naming the new revision and impact, Writer receipt with readback, and <b>Undo = republish the previous revision</b> (the app's existing “restore … as a new revision”)."),
("S5","Live impact preview","Before any save: “N of 603 scores change · M cross a band (▲ / ▼) · largest Δ” with a link to the affected rows; computed locally, no write."),
("S6","◌ stale evidence + cause","Scores are live, so ◌ marks only stale <b>stored evidence</b> (185 / 603 FLEX values under an older rule; Writer-stamped values pending redeploy) in table, drawer, map pin and compare. Evidence-driven changes appear in the change strip with cause (Anduril 77 → 72 → 59: FLEX HIGH → NO)."),
("S7","Geo map: targeting look","Grid, edge coordinates, corner brackets, cursor readout, lock-on reticle on the selected control point; heat ramp and interpolation unchanged."),
("S8","Click-to-add, drag-to-move","Click map = new point at cursor (score defaults to interpolated value); drag moves a point; arrow keys nudge score; Del removes; table ↔ map selection sync; unsaved points dashed."),
("S9","Canonical authority","Note on cards E / F: canonical pay / geo rules — <b>COMPENSATION_GEOGRAPHY</b> in TIM_PIPELINE_RULES_CANONICAL (and DEGREE_FLEX for card A) — are the authority; model curve / points may not contradict them, and conflicts are flagged."),
("S10","Tabs de-duplicated","Pay &amp; location → in-page jump to E / F; Resume &amp; ATS merged into “Documents &amp; ATS”; jump chips A–G on the page.")]
prh=''.join(f'<tr><td class="id">{a}</td><td><b>{b}</b></td><td class="small">{c}</td></tr>' for a,b,c in PRS)
page(f"""<div class="sec">Section 14.1</div><h1 style="font-size:18pt;margin-bottom:6px">Scoring Page — Proposals &amp; HF-19</h1>
<div class="notice" style="margin-top:0"><b>Design authority</b>The existing scoring page is retained and enhanced — not replaced. Status PROPOSED; no Update / Publish is authorized.</div>
<table class="tight"><tr><th style="width:34px">#</th><th style="width:140px">Proposal</th><th>Specification</th></tr>{prh}</table>
<div class="card bar-l" style="margin-top:8px;padding:7px 11px"><div style="display:flex;gap:10px;align-items:baseline"><span class="id">HF-19</span><b>Scoring page &amp; geo map</b><span class="tag p1" style="margin-left:auto">P1</span></div><div class="small" style="margin-top:3px"><span class="label" style="color:var(--green)">✓ Accept</span>&nbsp; Displayed total = sum of visible rows incl. FLEX (100 %); every card scoped; 100 % of shared saves confirmed + receipted + undoable; preview count = actual changed rows after save; ◌ on 100 % of stale scores; add / move control point in ≤ 2 actions.</div></div>""","14 · Scoring Page — Proposals")
sec("14.2","Geo Heat Map — Reference Rendering",1)
gref=geo_heat_svg(684,452,s=0.66,uid='gref',drag_from=(31.2,-98.6),new_point=(32.5,-85.0,85))
ga=[("1","Heat field","One IDW interpolation (power 6) over all points; ramp red 0 → amber 50 → green 100, as today."),
("2","Control points","○ soft · ◆ hard (overrides nearby); labels with score."),
("3","Lock-on + drag","Selected point gets the reticle; dashed ghost shows the old position while dragging."),
("4","Click to add","Dashed cyan point = unsaved; table row appears and syncs."),
("5","Hover tooltip","Interpolated score, nearest point + distance, jobs at location."),
("6","HUD frame","Grid, edge coordinates, corner brackets, cursor readout, SHARED · model rev 24 scope line.")]
gah=''.join(f'<div class="card" style="padding:5px 9px;margin:0"><div style="display:flex;gap:6px;align-items:baseline"><span class="id">{n}</span><b style="font-size:10pt">{t}</b></div><div style="font-size:10pt;color:var(--t2);line-height:1.3">{d}</div></div>' for n,t,d in ga)
page(f"""<div class="sec">Section 14.2</div><h1 style="font-size:18pt;margin-bottom:5px">Geo Heat Map — Reference Rendering</h1>
<p class="small muted" style="margin-bottom:6px">Control points are the 20 from the live inventory; Austin shown mid-drag and one click-added point (both unsaved, mock). Interpolation rendered on a 0.45° grid.</p>
<div style="position:relative;border:1px solid var(--grid)">{gref}{TAGM}</div>
<div class="grid3" style="margin-top:8px;gap:6px">{gah}</div>
<div class="card bar-a small" style="margin-top:8px"><b>Authority.</b> Geo points and power are part of the SHARED scoring model; canonical <b>COMPENSATION_GEOGRAPHY</b> rules govern pay / geography gates. If a geo point contradicts a canonical rule (e.g. a Never-Consider metro), the point shows ⚠ and the rule wins.</div>""","14 · Geo Heat Map — Reference · Mock Data")
sec("14.3","Scoring Page Concept Mockup (landscape)",1)
from scoring import scoring_page
page(f"""<div class="sec">Section 14.3</div><h1 style="font-size:17pt;margin-bottom:5px">Scoring Page Concept Mockup — 2560 × 1440 <span class="muted" style="font-size:10.5pt;font-weight:400">· rendered at 37.5 % · CONCEPT — MOCK DATA</span></h1>
<div style="width:960px;height:540px;overflow:hidden;border:1px solid var(--grid);position:relative"><div style="transform:scale({960/2560});transform-origin:0 0;width:2560px;height:1440px">{scoring_page()}</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:7px">
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">A–C</span> <b>Shared column</b><div class="muted">FLEX weight vs policy; publish → rev 25; ◌ 185 stale.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">D–E</span> <b>Shared model</b><div class="muted">All 8 weights SHARED, Σ 100; salary curve 190 / 240 / 300 K drawn.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">F</span> <b>Impact preview</b><div class="muted">47 scores change · 6 cross a band, before Update geo scores.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">G</span> <b>Geo map</b><div class="muted">Targeting look, drag + click-to-add, 20-point table.</div></div></div>""","14 · Scoring Page Mockup 2560 × 1440 — Mock Data",land=True)

sec("15","Desktop Layout 2560 × 1440")
LC=[("Score + band (SCORE) · ◌","64"),("Δ / New (NEW)","36"),("Title (TITLE)","184"),("Company (COMPANY)","112"),("Location (LOCATION)","112"),("Bucket (BUCKET)","104"),("Base pay est. (SALARY_BASE_EST)","72"),("Degree flex (FLEX_CLASS)","84"),("Exp. fit (EXPERIENCE_FIT)","56"),("Age (AGE)","36"),("Write state (new)","≈ 150 (fill)")]
lch=''.join(f'<tr><td class="id">{i+1:02d}</td><td>{a}</td><td class="num" style="text-align:right">{b}</td></tr>' for i,(a,b) in enumerate(LC))
TS=[("KPI value","40 / 650"),("Job title (workspace)","26 / 650"),("Section / pay value","20 / 620"),("Body, why line","15–16 / 400"),("Table cell (row 32 px)","14 / 540"),("Score in table","16 / 650"),("Mono label (uppercase)","11.5–13"),("Minimum anywhere","11")]
tsh=''.join(f'<tr><td>{a}</td><td class="num" style="text-align:right">{b}</td></tr>' for a,b in TS)
page(f"""<div class="sec">Section 15</div><h1>Desktop Layout — 2560 × 1440</h1>
<p class="small" style="margin-top:-4px">Primary target: 2560 × 1440 CSS px at 1× (5120 × 2880 at 2×). Real app chrome (left rail, top bar, Pipeline sub-tabs) plus three working zones, map in the centre.</p>
<pre style="font-size:8.4pt;line-height:1.45"><span class="c">┌ 20 ─ RAIL 56 (push) ─ 12 ──────────────────────────────────────────── 2560 ┐</span>
 TOP BAR       56   Menu · title · breadcrumb · search · Writer pill · Queue · Sync · Compare
 SUB-TABS      44   Jobs · Review queue · Decline candidates · My rulings · Map · Trends · Compare
 KPI TILES     96   Needs decision · Applied · Research · Interviews 14d · Writer · ◌ Provisional
 CHANGE STRIP  40   since last review · Δ with cause · map mode
 MAIN        1068   <span class="k">TABLE 1112</span> │16│ <span class="k">MAP 800</span> │16│ <span class="k">JOB DRAWER 508</span>
 TICKER        36   pipeline events feed, scrolls ←
<span class="c">└ H: 20+56+12+44+12+96+12+40+12+1068+12+36+20 = 1440 · W: 20+56+12+1112+16+800+16+508+20 ┘</span></pre>
<div class="grid2" style="margin-top:6px">
<div><div class="label" style="color:var(--t1);margin-bottom:4px">15.1 Review table — 11 columns, px</div>
<table class="tight"><tr><th style="width:30px">#</th><th>Column</th><th style="width:96px;text-align:right">Width</th></tr>{lch}</table>
<p class="small muted" style="margin-top:4px">Column gap 8 · 6 px selection bar · all 11 visible, no horizontal scroll · row 32 px → 30 rows visible. LINK moves to the drawer Posting tab.</p></div>
<div><div class="label" style="color:var(--t1);margin-bottom:4px">15.2 Type scale at 2560 (px / weight)</div>
<table class="tight"><tr><th>Role</th><th style="width:92px;text-align:right">Size</th></tr>{tsh}</table>
<div class="label" style="color:var(--t1);margin:9px 0 4px">15.3 Zone contents</div>
<ul class="small" style="margin:0"><li><b>Map</b> 800 × 1024 · selected job, else filtered set (Section 13).</li><li><b>Job drawer</b>: real tabs Overview · Posting · Fit &amp; Score · Application · Documents · History; ring + rev; weights incl. FLEX; Pursue / Hold / Research │ Decline; receipts.</li><li><b>Below 2560</b>: 1920 keeps 3 zones (map 640, workspace 460); 1440 stacks map above workspace.</li></ul></div></div>""","15 · Desktop Layout 2560 × 1440")
sec("15.4","Desktop Concept Mockup (landscape)",1)
sc=960/2560
page(f"""<div class="sec">Section 15.4</div><h1 style="font-size:17pt;margin-bottom:5px">Desktop Concept Mockup — 2560 × 1440 <span class="muted" style="font-size:10.5pt;font-weight:400">· rendered at 37.5 % · map prominent · fictional data</span></h1>
<div style="width:960px;height:540px;overflow:hidden;border:1px solid var(--grid);position:relative"><div style="transform:scale({sc});transform-origin:0 0;width:2560px;height:1440px">{desktop()}</div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:7px">
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">1</span> <b>Table · 1112</b><div class="muted">11 app columns, percentile bands, 30 rows, ◌ stale evidence, Δ changed; M-08 / M-09.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">2</span> <b>Map · 800</b><div class="muted">Selected job only, lock-on, coordinates, nearest geo point; Selected | Filtered.</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">3</span> <b>Drawer · 508</b><div class="muted">Real tabs; rev 24; weights Σ 100 incl. FLEX; receipts (M-12).</div></div>
<div class="card" style="padding:5px 8px;margin:0;font-size:10pt"><span class="id">4</span> <b>Chrome</b><div class="muted">Rail, sub-tabs, KPIs incl. ◌ 185, change strip, ticker. Full-res PNG supplied.</div></div></div>""","15 · Desktop Mockup 2560 × 1440 — Mock Data",land=True)

sec("16","Mobile Redesign — iPhone 18 Pro")
INS=[("--pe-safe-*","env(safe-area-inset-*)","Always read from the OS — never hard-coded (assumed 62 / 34 portrait, 62 / 62 / 21 landscape)."),
("--pe-pad-side","24pt","Side padding <b>beyond</b> the safe area for all content and tap targets (portrait → x 24–378)."),
("--pe-pad-corner","36pt","Side inset for any control inside a corner zone (top / bottom 96 pt), clear of the ≈ 55 pt display radius (tab bar x 36–366)."),
("--pe-pad-top","12pt","Below the safe-area top — first row at y 74, clear of the Dynamic Island."),
("--pe-lift-bottom","16pt","Bottom controls end ≥ 16 pt above the home-indicator inset → ≥ 50 pt from the bottom edge (portrait), ≥ 37 pt (landscape)."),
("--pe-island-clear","16pt","Clearance around the camera / Dynamic Island in every orientation; nothing interactive or legible inside."),
("--pe-pad-land","20pt","Landscape: 20 pt beyond the 62 pt safe area on <b>both</b> sides → content x 82–792 for either rotation; no reflow when the camera swaps sides.")]
insh=''.join(f'<tr><td class="code" style="color:var(--cyan);white-space:nowrap">{a}</td><td class="num">{b}</td><td class="small">{c}</td></tr>' for a,b,c in INS)
page(f"""<div class="sec">Section 16</div><h1>Mobile Redesign — iPhone 18 Pro</h1>
<div class="notice" style="margin-top:0"><b>Assumed dimensions</b>~402 × 874 pt portrait / 874 × 402 pt landscape; Dynamic Island + front camera at the <b>top</b> in portrait and on the <b>left or right</b> side in landscape (depends on rotation). Safe areas ≈ 62 top / 34 bottom (portrait), 62 each side / 21 bottom (landscape). Not confirmed for this model — verify in the simulator; layout derives from safe-area insets, not constants.</div>
<div class="label" style="color:var(--t1);margin:6px 0 4px">16.0 Perimeter &amp; keep-out rules (v1.4 — Tim)</div>
<table class="tight"><tr><th style="width:120px">Token</th><th style="width:150px">Value</th><th>Rule</th></tr>{insh}</table>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l" style="margin:0"><div class="label" style="color:var(--cyan);margin-bottom:3px">Portrait</div><ul class="small" style="margin:0">
<li>KPI strip (Decide · New · Failed · ◌ Provisional) + change strip, inside the 24 pt padding.</li>
<li>Swipe cards: <b style="color:var(--green)">→ Pursue</b>, <b style="color:var(--amber)">← Hold</b>, <b style="color:var(--red)">long-press Decline</b> → confirm → Undo; 35 % threshold (M-17).</li>
<li>Floating tab bar Queue · Map · Changes · Search, x 36–366, ending 50 pt above the bottom.</li>
</ul></div>
<div class="card bar-l" style="margin:0"><div class="label" style="color:var(--cyan);margin-bottom:3px">Landscape (both rotations) · Desktop mode</div><ul class="small" style="margin:0">
<li>Split view in x 82–792: queue left, Detail | Map right; docked actions end ≥ 37 pt above bottom.</li>
<li>Camera left or right: same content rectangle, so rotating never moves a control under the camera.</li>
<li>⧉ Desktop loads the 2560 layout scaled + pannable inside the same rectangle; state persists both ways.</li></ul></div></div>
<p class="small muted" style="margin-top:6px">All mockups show the perimeter faintly: <span style="color:var(--red)">hatched red</span> camera keep-out and corner zones, <span style="color:var(--cyan)">dashed cyan</span> safe-area lines, <span style="color:var(--amber)">dashed amber</span> content / tap-target boundary and home-indicator band. Targets ≥ 44 pt; decision buttons 52–56 pt; haptics as v1.3.</p>""","16 · Mobile Redesign — Spec & Insets")
sec("16.1","Mobile Mockups — Portrait Queue & Detail",1)
ps=0.74
def ph(h,cap,sc=None):
    sc=sc or ps
    return f'<div><div style="width:{422*sc:.0f}px;height:{894*sc:.0f}px;overflow:hidden"><div style="transform:scale({sc});transform-origin:0 0">{h}</div></div><div class="label" style="margin-top:5px;color:var(--t1);font-size:7.8pt">{cap}</div></div>'
mob=[("A","Queue","KPI strip with ◌ stale evidence, Δ change strip, top card mid-swipe → Pursue (haptic at threshold), queued receipt with Undo; floating tab bar inset 36 pt and lifted above the home indicator."),
("B","Job detail","Drawer tabs Overview · Posting · Fit · Apply · Docs · History; rev 24 current; evidence from real factors; toast; 56 pt action bar inset 36 pt, Decline separated.")]
mbh=''.join(f'<div class="card" style="padding:6px 9px;margin:0"><div style="display:flex;gap:6px;align-items:baseline"><span class="id">{n}</span><b style="font-size:10pt">{t}</b></div><div style="font-size:10pt;color:var(--t2);line-height:1.35">{d}</div></div>' for n,t,d in mob)
page(f"""<div class="sec">Section 16.1</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockups — Portrait Queue &amp; Detail <span class="muted" style="font-size:10.5pt;font-weight:400">· 402 × 874 pt · keep-out overlay · mock data</span></h1>
<div style="display:flex;justify-content:space-around">{ph(portrait_queue(),"A · Portrait queue")}{ph(portrait_detail(),"B · Portrait job detail")}</div>
<div class="grid2" style="margin-top:8px;gap:7px">{mbh}</div>""","16 · Mobile — Portrait Queue & Detail · Mock Data")
sec("16.2","Mobile Mockup — Portrait Map + Sheet",1)
mm=[("Tim's map rule","Shows only the selected job (here) or, via the Selected | Filtered toggle, the jobs in the current filter. No radar, rings or clusters."),
("Lock-on","Reticle, crosshairs, corner brackets on the job; lat / long, range + bearing readout; selection-tick haptic."),
("Auto-fit","Animated pan / zoom to the job or to the filtered bounds, padded to stay inside the 24 pt inset."),
("Keep-out","Map starts below the 62 pt safe top; header and chips at y ≥ 74; controls 24 pt from the right edge."),
("Floating sheet","Inset 12 pt (actions 24+ pt from the edges); 52 pt Pursue / Hold │ Decline; ◂ ▸ next job in filter."),
("Tab bar","Floating, x 36–366, ends 50 pt above the bottom — never in a corner or on the home indicator.")]
mmh=''.join(f'<div class="card bar-l" style="padding:6px 9px;margin-bottom:6px"><b style="font-size:10pt">{a}</b><div style="font-size:10pt;color:var(--t2);line-height:1.35">{b}</div></div>' for a,b in mm)
page(f"""<div class="sec">Section 16.2</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockup — Portrait Map + Sheet <span class="muted" style="font-size:10.5pt;font-weight:400">· targeting style · mock data</span></h1>
<div style="display:grid;grid-template-columns:{422*0.84:.0f}px 1fr;gap:16px">{ph(portrait_map(),"C · Portrait map (selected job) + floating sheet",0.84)}<div>{mmh}</div></div>""","16 · Mobile — Portrait Map · Mock Data")
sec("16.3","Mobile Mockups — Landscape, Both Rotations",1)
ls=0.76
def lph(h,cap):
    return f'<div style="margin-bottom:7px"><div style="width:{894*ls:.0f}px;height:{422*ls:.0f}px;overflow:hidden"><div style="transform:scale({ls});transform-origin:0 0">{h}</div></div><div class="label" style="margin-top:4px;color:var(--t1);font-size:7.8pt">{cap}</div></div>'
page(f"""<div class="sec">Section 16.3</div><h1 style="font-size:18pt;margin-bottom:6px">Mobile Mockups — Landscape, Both Rotations <span class="muted" style="font-size:10.5pt;font-weight:400">· 874 × 402 pt</span></h1>
{lph(landscape_map('left'),"D · Camera LEFT — split view, Map (selected job), docked actions end 37 pt above bottom")}
{lph(landscape_detail('right'),"E · Camera RIGHT — same content rectangle x 82–792, Detail tab, actions ≥ 44 pt")}
<div class="grid2" style="gap:7px">{note("<b>Rotation-safe.</b> Padding is symmetric (62 + 20 pt both sides), so rotating 180° moves the camera but never a control; no layout jump.")}{note("<b>Split view.</b> Selecting in the list locks the map on that job (Tim's rule); tapping Detail shows the drawer content.")}</div>""","16 · Mobile — Landscape Both Rotations · Mock Data")
sec("16.4","Mobile — Desktop Mode & Keep-out Diagram",1)
dA,dB,dC=keepout_diagrams()
page(f"""<div class="sec">Section 16.4</div><h1 style="font-size:18pt;margin-bottom:6px">Desktop Mode &amp; Keep-out Diagram</h1>
{lph(landscape_desktop('left'),"F · Desktop mode — 2560 layout scaled inside x 82–792; ◧ Exit and viewport minimap kept off the camera and home-indicator zones")}
<div class="label" style="color:var(--t1);margin:4px 0 4px">G · Safe / keep-out regions (overlay at full strength)</div>
<div style="display:grid;grid-template-columns:{422*0.39:.0f}px 1fr;gap:12px;align-items:start">
<div style="width:{422*0.39:.0f}px;height:{894*0.39:.0f}px;overflow:hidden"><div style="transform:scale(.39);transform-origin:0 0">{dA}</div></div>
<div><div style="width:{894*0.53:.0f}px;height:{422*0.53:.0f}px;overflow:hidden;margin-bottom:6px"><div style="transform:scale(.53);transform-origin:0 0">{dB}</div></div>
<div style="width:{894*0.53:.0f}px;height:{422*0.53:.0f}px;overflow:hidden"><div style="transform:scale(.53);transform-origin:0 0">{dC}</div></div></div></div>""","16 · Mobile — Desktop Mode & Keep-out · Mock Data")

sec("17","Implementation Plan")
seq=[("00","Baseline","HF-14","Measured baseline of 5 real review tasks.","Baseline report + discrepancy register signed off."),
("01","Integrity","HF-01 · 02 · 03 · 04 · 19 (data)","One score, reconciled counts, truthful writes (seconds-scale), ◌ stale evidence, honest all-SHARED weights, no write on view. <b>Data fixes only.</b>","No unexplained cross-view discrepancy; zero false successes."),
("1B","Architecture &amp; performance","HF-01 · 03 · 15 (limits)","Single scoring-record selector, counter registry module, write state machine, browser-test migration, performance budget (≤ 0.7 s selection, p95 ≤ 16.7 ms).","Perf + test suite green; budget enforced in CI."),
("02","Workflow + motion core","HF-04 · 05 · 06 · 15 (core) · 16 (panel)","Context survives refresh; map per Tim's rule + fullscreen close; scope badges + shared-change guard; de-duplicated entry points; motion core.","Refresh keeps context; motion never blocks input."),
("03","Cognitive + visual + 2560","HF-07 – 11 · 15 – 17 · 19 + tokens","2560 cockpit, full motion catalog, scoring page + geo map, palette.","Measured faster review, no accuracy loss; 60 fps."),
("04","Adaptive","HF-12","Opt-in, explainable personalization.","Explainable, reversible, subordinate to canonical rules and Tim's decisions."),
("M","Mobile track","HF-13 · 18","iPhone portrait / landscape / desktop-mode with perimeter insets + camera keep-out; after Phase 2 gate, parallel to Phase 3.","Swipe decisions reversible; state kept across switch.")]
sh=''.join(f'<tr><td class="id">{a}</td><td><b>{t}</b></td><td class="small">{r}</td><td class="small">{o}</td><td class="small">{g}</td></tr>' for a,t,r,o,g in seq)
pc=["#A3A39E","#4ADE80","#E6E6E2","#F2B33D","#38E1D6","#8A8F7A"]; gt=["SIGN-OFF","0 FALSE OK","PERF BUDGET","CONTEXT 100%","TIMED RE-TEST","OPT-IN"]
flow=''.join(f'<div style="flex:1;border:1px solid var(--seam);border-top:2px solid {c};padding:6px 8px;background:var(--hull)"><div style="color:var(--t1)">{s[0]} {s[1].upper()}</div><div style="color:var(--t3);margin-top:2px">GATE ▸ {g}</div></div>' for s,c,g in zip(seq,pc,gt))
page(f"""<div class="sec">Section 17</div><h1>Implementation Plan — Overview</h1>
<div class="notice"><b>Authorization</b>This plan is <b>proposed only</b>. No code, backlog or deployment changes are authorized by this document; each phase starts only on Tim's explicit approval. <b>In scope:</b> UI that lets <b>Tim</b> make shared model / rule changes safely. <b>Out of scope in every phase:</b> agents changing the shared model or rules.</div>
<h2 style="margin-top:8px">Sequence and gates</h2>
<table class="tight" style="font-size:8.5pt;line-height:1.22"><tr><th style="width:30px">#</th><th style="width:118px">Phase</th><th style="width:150px">Requirements</th><th>Objective</th><th style="width:150px">Exit gate</th></tr>{sh}</table>
<p class="small muted" style="margin-top:6px">HF-14 timing is re-run at the end of every phase. No phase begins until the previous gate is reviewed with Tim. No motion or layout work starts before the Phase 1B gate.</p>
""","17 · Implementation Plan — Overview")
page(f"""<div class="sec">Section 17 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Sequencing &amp; Cross-cutting Constraints</h1><pre style="font-size:8.4pt;line-height:1.55"><span class="c">PHASE            ────────────────────────────── time ──────────────────────────────▶</span>
00 Baseline      ████
01 Integrity         ██████████  <span class="c">◀ data fixes only</span>
1B Arch + perf                ██████  <span class="c">◀ no motion / layout before this gate</span>
02 Workflow                      ████████  <span class="k">+ map rule · scope guard · motion core</span>
03 Cog + 2560                            ████████████  <span class="k">+ motion catalog · scoring page</span>
04 Adaptive                                          ██████
<span class="k">M  Mobile</span>                                <span class="k">░░░░░░░░░░░░░░░░</span>  <span class="c">starts after Phase 2 gate · parallel</span></pre><div class="grid2 cc" style="gap:7px;margin-top:10px">
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer timing (seconds).</b> <span class="small">Writer is synchronous Apps Script: a write lands in seconds; a 30 s script lock refuses concurrent writes; the client auto-retries at 8 / 15 / 30 / 45 s. Queued = “waiting for Writer lock · N s”, never a fault until retries are exhausted (⊗ failed).</span></div>
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer redeploy dependency.</b> <span class="small">The updated Writer Apps Script is not yet deployed; Writer-stamped values use the old formula until it is. Logged in Phase 0; HF-01 consistency gate cannot pass before redeploy.</span></div>
<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Multi-bot edits.</b> <span class="small">Each decision carries the record version seen at open; a mismatch triggers the conflict guard (HF-05) and a <i>superseded</i> state. Bulk bot updates summarize in the change strip and ticker rather than individually animating.</span></div>
<div class="card bar-t" style="padding:8px 12px;margin-bottom:0"><b>Design authority.</b> <span class="small">Layout follows Tim's v1.4 / v1.5 decisions: 2560 three-zone cockpit; map shows the selected job or the filtered set in its targeting style (no radar); high-motion standard; scoring page retained as authority. Further layout changes need Tim's explicit approval. UI for Tim's shared changes is in scope; agents changing the model or rules is not.</span></div></div>""","17 · Implementation Plan — Constraints")

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

PH=[("17.1","Phase 0 — Baseline",("00","Baseline",["HF-14"],"Measure the current build before anything changes, so every later gate is judged against real numbers rather than impressions.",
["Script 5 representative review tasks: (a) find the job that needs action, (b) state the main score drivers for a given job, (c) disposition a straightforward job, (d) reconcile the Applied count, (e) find the previously selected job after a refresh.",
"Run each task on the live build across at least 3 sessions; record completion time, errors, extra navigation, scrolling, and perceived difficulty (1–7 single-ease question).",
"Snapshot score value, band and label for 20 sample jobs in table, detail, map and compare views, with timestamps.",
"Snapshot every counter (header, KPI tiles, Trends) with the query it appears to represent; log mismatches (Applied 84 vs 26, Declined 57 vs 56, intake 0 vs 138, “0 need you” vs 50).",
"Capture console logs (TypeErrors at lines 1320 / 1326), selection latency (~0.55s), and an inventory of raw internal codes visible in Layers 1–3.",
"Record Writer lock refusals and retry counts (8 / 15 / 30 / 45 s) per session.",
"<b>Discrepancy (v1.5):</b> Writer Apps Script redeploy outstanding — Writer-stamped values on the old formula; note as an HF-01 dependency."],
["Baseline report (timings, errors, difficulty)","Discrepancy register: scores and counters","Reusable task scripts for each re-test"],
["All 5 tasks timed in ≥ 3 sessions","Discrepancy register reviewed and signed off by Tim","No product changes made during the phase"],
["Bots change data mid-session → timestamp every snapshot and note Writer lock state.","Small sample → report medians and ranges; treat targets as directional, not statistical proof."])),
("17.2","Phase 1 — Integrity",("01","Integrity",["HF-01","HF-02","HF-03","HF-04","HF-19"],"Make every number, count and decision state truthful and identical everywhere before improving anything else.",
["Define the single scoring record {value, score type, rule/model version, computed-at, evidence status}; route queue, detail, map and compare through one selector.",
"Audit the memoized scoring config: key the cache on a rules/weights version hash and invalidate on change, keeping the ≤ 0.7s selection budget.",
"Adopt one display name for the score; label any historical or alternative score explicitly.",
"Write a counter registry (population, filters, window, source) for every Layer-1 tile and header count; each tile applies that exact query to the queue.",
"Implement a one-click decision state machine: queued → processing → confirmed | failed | superseded, with an idempotency key per decision.",
"Show receipt + Undo under the buttons; queued shows “waiting for Writer lock · N s” with the next retry; failed (⊗) keeps its payload and offers Retry.",
"Fix console TypeErrors at pipeline lines 1320 / 1326.",
"Expose state-machine events as the only source for write-state motion later (G2).",
"<b>Stale evidence</b> (HF-19): record carries model rev + evidence status; ◌ on the 185 stale evidence values; evidence-driven changes logged with cause (Anduril 77 → 72 → 59, FLEX HIGH → NO).",
"<b>Honest weights</b>: one all-SHARED table summing to 100 (rev 24) on Settings and in Fit &amp; Score; fix stale “this browser” copy; reconcile Declined 0 / 56 / 57 and Employer rejected 0 / 2 / 7.",
"Opening a job never writes (<code>openRow → syncStateUp</code> today); debounce the Writer banner / pill (2 failed checks or 20 s grace)."],
["Scoring record spec + single selector","Counter registry document","Decision state machine with receipts","Fault-injection test suite"],
["Cross-view score consistency 100% on all jobs","Counter reconciliation 100%; tile click count == rows shown","Fault injection (timeout, 5xx, duplicate ack, lock busy): 0 false successes, 0 dropped, 0 duplicates","Console clean across the 5 task scripts","◌ on 100 % of stale evidence; weights total = visible sum, all SHARED"],
["Lock contention looks “stuck” → seconds timer + next-retry countdown.","Cache fix reintroduces the 32s lag → selection performance test in the gate.","Multi-bot edits during a write → superseded state, never overwrite."])),
("17.3","Phase 1B — Architecture & Performance",("1B","Architecture &amp; performance",["HF-01","HF-03","HF-15"],"Put the structure in place that motion and layout depend on, with an enforced performance budget. Starts after the Phase 1 gate; motion and layout start only after this gate.",
["Single scoring-record selector module; every view reads through it; memo keyed on model revision.",
"Counter registry as code (population, filters, window, source) with unit tests.",
"Write state machine (waiting for lock → writing → confirmed | failed | superseded) as one module; motion subscribes to its events only.",
"Migrate browser tests to the current build (PRs #111–#115) incl. protected APPLIED / REJECTED_BY_EMPLOYER and score-tester flows.",
"Performance budget in CI: selection ≤ 0.7 s end to end, p95 frame ≤ 16.7 ms, concurrent-animation caps, no layout-property animation.",
"Flash audit harness: nothing &gt; 3 flashes / s."],
["Selector + registry + state-machine modules","Updated browser test suite","Perf budget + CI trace"],
["All browser tests green on main","Selection ≤ 0.7 s p95 over 50 selections","p95 frame ≤ 16.7 ms in a scripted motion trace","Tim reviews the gate"],
["Refactor regresses #113 lag fix → perf test is a gate.","Scope creep into UI → no visual changes in this phase."])),
("17.4","Phase 2 — Workflow",("02","Workflow",["HF-04","HF-05","HF-06","HF-15","HF-16","HF-19"],"Remove behavioral surprises, make context survive every refresh, make the map a permanent panel, and ship the motion core.",
["Make the Compact toggle work or remove it.",
"Preserve selected job, filters, sort and scroll across refresh using stable job IDs.",
"New / changed rows get the neutral wipe (M-08) and a white Δ marker instead of silent reorder; bulk bot updates batch into the change strip.",
"Conflict guard: store record version on open; on mismatch at commit, show what changed and require confirmation.",
"<b>Map per Tim's rule</b> (HF-16): selected job only, else the filtered set; animated auto-fit; fullscreen below tabs with visible ✕ Close + Esc; remove radar, rings, clusters.",
"<b>Scope + shared-change guard</b> (HF-19): SHARED on all scoring cards, LOCAL only on display prefs; confirm + receipt + Undo (= republish previous revision) for every shared publish.",
"<b>App-wide fixes</b> (T-08 – T-13, T-20 – T-22): rail Unpin, de-duplicated tabs / cards / drawer entries, ⚙ → Settings, path aliases, bulk-action confirm.",
"<b>Motion tokens file + core transitions</b> (HF-15): panel slide, tab slide, toast slide-up, write-state pulses bound to Phase 1 events; Reduce motion toggle (off by default).",
"Sidebar rail pushes content rather than overlaying it."],
["Scope + guard spec","Context preservation + conflict guard","Map rule + motion core"],
["Selection retained after refresh 100% over 50 refresh cycles","Simulated bot edit mid-decision always warns; never overwrites","Map collapse found unaided; selection sync 100%","Motion never blocks input (dispatch ≤ 50 ms)","HF-14 re-test shows no regressions"],
["Highlight noise during bulk bot activity → batch and summarize.","Motion masking state → G2: state wins, animation cancels."])),
("17.5","Phase 3 — Cognitive + Visual",("03","Cognitive + visual",["HF-07","HF-08","HF-09","HF-10","HF-11","HF-15","HF-16","HF-17","HF-19"],"Make review measurably faster with the 2560 cockpit, readable labels, rationale, the full motion catalog and the HUD system.",
["<b>2560 × 1440 three-zone layout</b> (HF-17): grid 1160 / 820 / 508, KPI tiles, change strip, ticker, type scale; all 11 columns and ≥ 30 rows; 15–20 rows at 1440–1920.",
"Label dictionary mapping internal codes to readable labels; raw codes moved to Layer 4.",
"Plain-English rationale line beside every score; breakdown + uncertainty one click away.",
"“Since your last review” strip with per-user last-review timestamp; every item clickable.",
"Normalize source names case-insensitively; persist decline reason codes and backfill where recoverable.",
"<b>Full motion catalog</b> M-01 – M-19 (no radar) + map polish (hover cards, lock-on, readouts); phone in Track M.",
"<b>Scoring page redesign</b> (HF-19, Section 14): weights bar, salary curve, impact preview, geo map targeting look, click-to-add / drag.",
"<b>Apply colour, motion and breakpoint tokens</b> (Section 18); lint against raw hex / raw durations; shortcut help overlay; contrast audit."],
["2560 layout + label dictionary","Rationale line + change strip","Motion catalog + map enhancements","Token stylesheet + visual snapshots"],
["HF-14 re-test: medians ≤ 5s / ≤ 10s / ≤ 15s, no accuracy loss","0 overflow at 1280 / 1440 / 1920 / 2560; 11 / 11 cols at 2560","p95 frame ≤ 16.7 ms during map auto-fit; preview count = actual change","WCAG 2.2 AA agreed criteria pass (automated + keyboard)","No raw hex outside the token file"],
["Density vs readability → table text ≥ 14 px at 2560.","Motion cost → G3 caps; perf trace in gate."])),
("17.6","Phase 4 — Adaptive",("04","Adaptive",["HF-12"],"Add opt-in, explainable personalization that recommends and organizes without ever deciding or altering canonical rules.",
["Log overrides (decision vs recommendation) with the reason codes persisted in Phase 3.",
"Derive advisory suggestions, e.g. “You declined 9 of the last 10 manager-level non-priority roles — rank these lower?”",
"Off by default; opt-in toggle in Local preferences; every suggestion explains itself and is reversible in one click.",
"Hard boundary: no writes to canonical rules, no automatic applications, no auto-decisions; audit log of every adaptive effect."],
["Override log + advisory suggestion engine","Explanation + revert UI","Adaptive-effect audit log"],
["Every suggestion has an explanation and Undo","Audit shows zero canonical-rule mutations","Tim opts in explicitly; HF-14 re-test shows no accuracy loss"],
["Overfitting to recent behavior → minimum-evidence threshold and decay.","Trust erosion → visible, labeled, never a silent reorder (P6)."])),
("17.7","Track M — Mobile",("M","Mobile track",["HF-13","HF-18"],"Deliver the iPhone 18 Pro redesign (portrait, landscape, desktop-mode switch). Starts after the Phase 2 gate; runs in parallel with Phase 3.",
["Confirm iPhone 18 Pro dimensions and safe areas in the simulator (402 × 874 pt assumed).",
"Portrait: KPI strip, change strip, swipe cards (→ Pursue, ← Hold, long-press Decline + confirm + Undo), tab bar Queue · Map · Changes · Search.",
"Map tab: selected job or filtered set, targeting style, floating sheet inside the insets.",
"<b>Perimeter insets</b>: --pe-pad-side 24, --pe-pad-corner 36, --pe-lift-bottom 16, --pe-pad-land 20; camera keep-out top / left / right; test both landscape rotations.",
"Landscape split view: list left, Detail | Map right.",
"Desktop-mode switch: 2560 layout scaled + pannable; shared view-state persists selection, filters, sort, scroll, viewport.",
"Haptics map (threshold, commit, warning, success / error); motion tokens with phone cap of 6 concurrent animations."],
["Portrait + landscape builds","Desktop-mode switch + shared view-state","Gesture + haptic spec"],
["All decision targets ≥ 44 pt; 0 targets in keep-out zones","Swipe decisions reversible via Undo 100%","State kept across switch 100% (50 cycles)","HF-14 tasks timed on phone"],
["Accidental swipes → 35 % threshold, Undo, Decline needs long-press + confirm.","Assumed dimensions wrong → layout from safe-area insets, not constants."]))]
for s,t,args in PH:
    sec(s,t,1); ppage(s,"17 · "+t,phase(*args))
sec("17.8","Inventory Task Register (v1.5)",1)
REG=[("T-01","Scoring record carries model rev + evidence status; ◌ only on stale stored evidence in table, drawer, map, compare","Pipeline · Settings","HF-01 · 19","1"),
("T-02","Stale-evidence count (185 / 603) in Settings card C, System drawer and KPI strip; Review refresh shows progress","Settings · System","HF-19","1"),
("T-03","Evidence-change events with cause in change strip (Anduril 77 → 72 → 59: FLEX HIGH → NO); no rating change without an event","Pipeline","HF-01","1"),
("T-04","Honest weights: one table of 8 SHARED rows = 100 (rev 24); fix stale “this browser” copy","Settings","HF-19","1"),
("T-05","Counter registry + scope labels: Declined 0 / 56 / 57, Employer rejected 0 / 2 / 7, Applied 84 / 26","Trends · Intake","HF-02","1"),
("T-06","Opening a job never writes (openRow → syncStateUp confirmed); seen-state local-only or batched-explicit + receipted; footer “unverified” opens receipts","Pipeline · global","HF-03 · 04","1"),
("T-07","Writer banner / pill debounce: banner after 2 failed checks or 20 s grace; health = worst current fault","global · System","HF-04","1"),
("T-08","Fullscreen map: below tab bar, always-visible ✕ Close + Esc, never traps (My rulings empty state)","Pipeline › Map","HF-06 · 16","2"),
("T-09","Map = selected job only, else filtered set; animated auto-fit replaces 600 % zoom; remove clusters, dense-area boost","Pipeline › Map","HF-16","2"),
("T-10","Rail pin toggles with visible ⇤ Unpin; rail pushes content","global","HF-06","2"),
("T-11","De-duplicate entry points: Settings tabs, cards, ⚙ → Settings, one drawer entry, System top tabs","global · Settings · System","HF-04","2"),
("T-12","Scope badges: SHARED on all scoring cards A–G, target companies, rules; LOCAL only on display / columns / layout / map mode / seen / drafts","Settings · Intake","HF-04 · 19","2"),
("T-13","Shared-change guard: ⚠ confirm + Writer receipt + Undo = republish previous revision (every one-button update, policy, registry, rules)","Settings · Intake","HF-03 · 19","2"),
("T-14","Impact preview before publish: N scores change, M cross a percentile band, largest Δ (extends the #112 score tester)","Settings","HF-19","2–3"),
("T-15","Geo map: targeting look, click-to-add, drag-to-move, keyboard nudge, table ↔ map sync","Settings","HF-19","3"),
("T-16","Salary curve chart + COMPENSATION_GEOGRAPHY / DEGREE_FLEX authority notes and conflict ⚠","Settings · Rules","HF-19","3"),
("T-17","One-click decisions with receipts + per-decision Undo; reason code for Decline (⊖); respect APPLIED / REJECTED_BY_EMPLOYER protection","Drawer · Decline candidates","HF-03 · 11","1–2"),
("T-18","Readable labels for columns, states and reason codes; 11-column 2560 preset","Pipeline · Display","HF-07 · 08 · 17","3"),
("T-19","Source normalisation (LinkedIn / LINKEDIN, Indeed / INDEED); persist decline reasons","Trends","HF-11","3"),
("T-20","Path aliases + not-found notice instead of silent redirect to /pipeline","global","HF-04","2"),
("T-21","Bulk actions (SELECT VISIBLE, AI DISCOVER, MARK SEEN, catch-up, acknowledge) separated from filters, confirm + count + receipt","global · System","HF-03","2"),
("T-22","Writer connection: single entry, credentials behind explicit reveal","System","HF-04","2"),
("T-23","Mobile inset tokens, camera keep-out both orientations, lifted bottom controls; simulator check both landscape rotations","Track M","HF-18","M"),
("T-24","Radar purge: remove sweep from map, loading state, boot, catalog and tokens; lint rule against --pe-motion-radar","global","HF-15 · 16","2"),
("T-25","Single scoring-record selector + counter registry as modules","Pipeline","HF-01 · 02","1B"),
("T-26","Write state machine module (waiting for lock / writing / confirmed / failed / superseded)","global","HF-03","1B"),
("T-27","Browser-test migration to main (#111–#115) incl. protected states + score tester","tests","HF-14","1B"),
("T-28","Perf + flash budget in CI: selection ≤ 0.7 s, p95 frame ≤ 16.7 ms, ≤ 3 flashes / s","CI","HF-15","1B")]
rgr=lambda a,b,c,d,e: f'<tr><td class="id">{a}</td><td class="small">{b}</td><td class="small muted">{c}</td><td class="label" style="font-size:7.5pt">{d}</td><td class="num" style="text-align:center">{e}</td></tr>'
RGT='<tr><th style="width:36px">ID</th><th>Task</th><th style="width:100px">Area</th><th style="width:66px">Req</th><th style="width:34px;text-align:center">Ph</th></tr>'
page(f"""<div class="sec">Section 17.8</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register <span class="muted" style="font-size:11pt;font-weight:400">· every baseline issue → a task</span></h1>
<table class="tight">{RGT}{''.join(rgr(*x) for x in REG[:14])}</table>""","17 · Implementation Plan — Task Register (1/2)")
page(f"""<div class="sec">Section 17.8 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register (2/2)</h1>
<table class="tight">{RGT}{''.join(rgr(*x) for x in REG[14:])}</table>
<p class="small muted" style="margin-top:4px">Phase 1 (data) tasks T-01 – T-07 and T-17 land first; Phase 1B (T-25 – T-28) lands before any layout, motion or scoring-page UI work.</p>""","17 · Implementation Plan — Task Register (2/2)")

sec("18","Design Tokens (CSS)")
TOK=[("/* Base surfaces */",None,None),("--pe-void","#000000","page background"),("--pe-hull","#0B0B0B","panels"),("--pe-plate","#141414","cards / rows"),("--pe-raised","#1E1E1E","hover / selected"),("--pe-seam","#2A2A2A","borders"),("--pe-gridline","#3A3A3A","map grid"),
("/* Text */",None,None),("--pe-text-primary","#E6E6E2",""),("--pe-text-secondary","#A3A39E",""),("--pe-text-muted","#6B6B66","large text only"),
("/* Signal */",None,None),("--pe-green","#4ADE80","fits / confirmed / Pursue"),("--pe-amber","#F2B33D","flex / waiting for lock / Hold"),("--pe-red","#FF4D3D","failed write / hard block only"),("--pe-cyan","#38E1D6","selection / focus / links"),("--pe-olive","#8A8F7A","discovery / unverified"),("--pe-terminal","#5A5A5A","closed / Decline"),
("/* Percentile bands (v1.5, display-only) */",None,None),("--pe-band-top","#4ADE80","top 10 %"),("--pe-band-upper","#F2B33D","next 25 %"),("--pe-band-mid","#8E8E89","next 45 %"),("--pe-band-low","#D9826B","bottom 20 % (Clay)"),("--pe-band-cut-top","61","P90, recomputed"),("--pe-band-cut-upper","54","P65"),("--pe-band-cut-low","38","P20"),
("/* Shape, glow, type, targets */",None,None),("--pe-border","1px solid var(--pe-seam)",""),("--pe-radius","2px",""),("--pe-bar","2px","signal left bar"),("--pe-glow","0 0 6px rgba(56,225,214,0.40)","focus + processing only"),("--pe-font-label",'"IBM Plex Mono", ui-monospace, monospace',"uppercase labels"),("--pe-font-ui",'"Inter", system-ui, sans-serif',"numbers / titles"),("--pe-target-min","44pt","phone targets"),("--pe-target-decision","52pt","phone Pursue / Hold"),
("/* Scope &amp; markers (v1.5) */",None,None),("--pe-scope-shared","var(--pe-amber)","SHARED badge"),("--pe-scope-local","var(--pe-text-secondary)","LOCAL (display only)"),("--pe-changed","#E6E6E2","Δ marker, never cyan"),("--pe-stale-evidence","var(--pe-olive)","◌ stale stored evidence")]
lines=['<span class="c">/* Pipeline Explorer — design tokens (proposed) */</span>',':root {']
for k,v,c in TOK:
    if v is None: lines.append(f'  <span class="c">{H.escape(k)}</span>'); continue
    cm=f'  <span class="c">/* {H.escape(c)} */</span>' if c else ''
    sw_=f'<span style="display:inline-block;width:8px;height:8px;background:{v};border:1px solid #3A3A3A;margin-right:5px;vertical-align:0"></span>' if v.startswith('#') else ''
    lines.append(f'  <span class="k">{k}:</span>{" "*(21-len(k))}{sw_}{H.escape(v)};{cm}')
lines.append('}')
page(f"""<div class="sec">Section 18</div><h1>Design Tokens (CSS)</h1>
<p class="small">Phase 2 ships motion tokens; Phase 3 applies colour, motion and breakpoint tokens through a single token file. Motion and breakpoints continue on the next page. Components reference tokens only; a lint rule rejects raw hex values elsewhere. Semantic aliases (e.g. <code>--pe-state-failed: var(--pe-red)</code>) may be added, but each signal keeps exactly one meaning.</p>
<pre style="font-size:7.3pt;line-height:1.22">{chr(10).join(lines)}</pre>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l small" style="margin:0"><b>Glow:</b> <code>box-shadow: var(--pe-glow)</code> on focus, processing, traces and lock-on; nothing glows at rest.</div>
<div class="card bar-a small" style="margin:0"><b>Signals as accents:</b> <code>border-left: var(--pe-bar) solid var(--pe-amber)</code>; never a background fill.</div></div>""","18 · Design Tokens — Colour & Shape")

TOK2=[("/* Motion — durations */",None),("--pe-motion-instant","0ms"),("--pe-motion-fast","120ms"),("--pe-motion-base","240ms"),("--pe-motion-lock","320ms"),("--pe-motion-materialize","400ms"),("--pe-motion-sweep","600ms"),("--pe-motion-roll","800ms"),("--pe-motion-boot","1200ms"),("--pe-motion-breathe","1600ms"),("--pe-motion-fit","600ms"),("--pe-motion-stagger","18ms"),("--pe-select-budget","700ms"),("--pe-frame-p95","16.7ms"),("--pe-flash-max","3"),
("/* Motion — easing */",None),("--pe-ease-out","cubic-bezier(.16,1,.3,1)"),("--pe-ease-in","cubic-bezier(.7,0,.84,0)"),("--pe-ease-inout","cubic-bezier(.65,0,.35,1)"),("--pe-ease-snap","cubic-bezier(.34,1.56,.64,1)"),("--pe-ease-linear","linear"),
("/* Breakpoints */",None),("--pe-bp-desktop-2560","2560px"),("--pe-bp-desktop-1920","1920px"),("--pe-bp-desktop-1440","1440px"),("--pe-bp-phone-portrait","402pt"),("--pe-bp-phone-landscape","874pt"),
("/* Layout @ 2560 */",None),("--pe-margin","20px"),("--pe-gutter","16px"),("--pe-col-rail","56px"),("--pe-col-table","1112px"),("--pe-col-map","800px"),("--pe-col-work","508px"),("--pe-row-h","32px"),
("/* Mobile perimeter (v1.4) */",None),("--pe-pad-side","24pt"),("--pe-pad-corner","36pt"),("--pe-pad-top","12pt"),("--pe-lift-bottom","16pt"),("--pe-island-clear","16pt"),("--pe-pad-land","20pt")]
l2=['<span class="c">/* PE tokens · v1.5 */</span>',':root {']
for k,v in TOK2:
    if v is None: l2.append(f'  <span class="c">{k}</span>'); continue
    l2.append(f'  <span class="k">{k}:</span>{" "*(28-len(k))}{H.escape(v)};')
l2.append('}')
mq='''<span class="c">/* layout selection */</span>
@media (min-width: 2560px) { <span class="k">.cockpit</span> { grid-template-columns: var(--pe-col-rail) var(--pe-col-table) var(--pe-col-map) var(--pe-col-work); } }
@media (max-width: 440px) and (orientation: portrait)  { <span class="k">.app</span> { --layout: mobile-portrait; } }
@media (max-height: 440px) and (orientation: landscape) { <span class="k">.app</span> { --layout: mobile-landscape; } }
<span class="k">.app[data-desktop-mode]</span> { --layout: desktop-2560; <span class="c">/* scaled, pannable */</span> }
<span class="k">[data-reduce-motion]</span> { --pe-motion-breathe: 0ms; --pe-motion-fit: 120ms; <span class="c">/* off by default */</span> }
<span class="k">.app</span> { padding: calc(env(safe-area-inset-top) + var(--pe-pad-top)) calc(env(safe-area-inset-right) + var(--pe-pad-side)) calc(env(safe-area-inset-bottom) + var(--pe-lift-bottom)) calc(env(safe-area-inset-left) + var(--pe-pad-side)); }'''
page(f"""<div class="sec">Section 18 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Design Tokens — Motion, Breakpoints, Layout</h1>
<pre style="font-size:7.6pt;line-height:1.3;margin:0;column-count:2;column-gap:14px">{chr(10).join(l2)}</pre><p class="small muted" style="margin-top:5px">Phone breakpoints are assumed iPhone 18 Pro dimensions (Section 16); 2560 is the primary desktop target.</p>
<pre style="font-size:7.9pt;margin-top:9px;white-space:pre-wrap">{mq}</pre>
<div class="grid2" style="margin-top:8px">
<div class="card bar-l small" style="margin:0"><b>Lint:</b> no raw durations, easing curves or radar tokens in components — only <code>--pe-motion-*</code> and <code>--pe-ease-*</code>, mirroring the raw-hex rule.</div>
<div class="card bar-a small" style="margin:0"><b>Reduce motion</b> (Settings, off by default) swaps loops to 0 and slides to <code>--pe-motion-fast</code> fades.</div></div>""","18 · Design Tokens — Motion & Breakpoints")
sec("19","Acceptance Targets")
acc=[("Cross-view score consistency","100%"),("Counter reconciliation","100%"),("False successful-write indications","0"),("Unrecoverable failed decisions","0"),("Identify a job needing action","≤ 5s median"),("Understand main score drivers","≤ 10s median"),("Disposition a straightforward job","≤ 15s median"),("Selection retained after refresh","100%"),("Priority-column horizontal overflow","0"),("WCAG 2.2 AA agreed criteria","Pass"),("<b>v1.3</b> · Input blocked by animation","0"),("<b>v1.3</b> · Animation frame time (p95)","≤ 16.7 ms"),("<b>v1.3</b> · Map ↔ queue selection sync","100%"),("<b>v1.3</b> · Columns visible at 2560 × 1440","11 / 11, ≥ 30 rows"),("<b>v1.3</b> · State kept across desktop-mode switch","100%"),("<b>v1.4</b> · Weights total = sum of visible rows (all SHARED)","100%"),("<b>v1.5</b> · Stale evidence marked ◌","100%"),("<b>v1.4</b> · Shared publishes with confirm + receipt + undo","100%"),("<b>v1.4</b> · Map pin set == filtered rows / selected job","100%"),("<b>v1.4</b> · Tap targets inside keep-out zones (all orientations)","0"),("<b>v1.4</b> · Writer false-alarm banners on load","0"),("<b>v1.5</b> · Job selection settles (incl. motion)","≤ 0.7 s"),("<b>v1.5</b> · Flashes per second","≤ 3"),("<b>v1.5</b> · Scoring inputs badged LOCAL","0"),("<b>v1.5</b> · Glyphs with &gt; 1 meaning","0")]
refs=["Nielsen, <i>10 Usability Heuristics</i> (NN/G, rev. 2024)","Nielsen, <i>Progressive Disclosure</i> (NN/G, 2006)","Laubheimer, <i>Data Tables: Four Major User Tasks</i> (NN/G, 2022)","Cowan, <i>The Magical Number 4</i> (2001)","Norman, <i>Emotional Design</i> (2004 / 2008)","<i>Intelligent User Interfaces and Their Evaluation</i> (systematic mapping, 211 studies, PMC)","W3C, WCAG 2.2 SC 2.5.8 <i>Target Size (Minimum)</i>; SC 2.3.1 <i>Three Flashes</i>","Harley, <i>The Role of Animation and Motion in UX</i> (NN/G, 2014)","Apple, <i>Human Interface Guidelines</i> — layout, safe areas, haptics"]
ah=''.join(f'<tr><td>{a}</td><td class="num">{t}</td></tr>' for a,t in acc)
page(f"""<div class="sec">Section 19</div><h1>Acceptance Targets <span class="muted" style="font-size:11pt;font-weight:400">(proposed, not research findings)</span></h1>
<table class="tight"><tr><th>Measure</th><th style="width:130px">Target</th></tr>{ah}</table>
""","19 · Acceptance Targets")
sec("20","References"); sec("21","Design Standard")
page(f"""<div class="sec">Section 20</div><h1>References</h1>
<ul class="small">{''.join(f'<li>{r}</li>' for r in refs)}</ul>
<div class="sec" style="margin-top:8px">Section 21</div><h1 style="font-size:17pt">Design Standard <span class="muted" style="font-size:11pt;font-weight:400">(controlling statement)</span></h1>
<div class="hull bar-l" style="font-size:10.5pt;line-height:1.55;padding:12px 14px">Pipeline Explorer shall be an expert decision-support system that minimizes cognitive translation, preserves situational awareness, provides truthful system feedback, and supports rapid, recoverable actions. It shall keep authoritative data consistent across views, preserve user context during updates, and expose decision evidence without unnecessary navigation. Progressive disclosure organizes complexity; it does not remove necessary information. Adaptive functionality stays transparent, explainable, reversible and under user control. By operator decision, motion is a first-class element — rich and continuous, yet never blocking input or concealing true state — the tactical map is a primary panel in its retained military targeting style that shows only the selected job or the current filtered selection, and the scoring page stays the authority for how scores are set, with every local or shared change scoped, previewed and reversible. All changes preserve established design authority unless explicitly approved, and are validated against usability, accessibility and data-integrity criteria.</div>
<div class="notice"><b>Status</b>Proposed · v1.5 · October 15, 2026. No code, backlog or deployment changes authorized.</div>""","20–21 · References, Design Standard")

N=len(pages)
rows=""
for num,t,pg,lvl in toc:
    cls="row sub" if lvl else "row"
    rows+=f'<div class="{cls}"><span class="n">{num}</span><span class="t">{t}</span><span class="p">{pg:02d}</span></div>'
pages[1]=(f'<div class="sec">Contents</div><h1>Table of Contents</h1><div class="toc">{rows}</div><p class="small muted" style="margin-top:4px">{N} pages · US Letter (landscape for the 2560 mockup) · dark edition. Sections 13–16 contain concept screens built from mock data (labelled CONCEPT — MOCK DATA).</p>',"Contents",False)
pg={n:p for n,t,p,l in toc}
pages=[(re.sub(r"\{\{([0-9.]+)\}\}",lambda m:f"{pg[m.group(1)]:02d}",b),h,l) for b,h,l in pages]
out=[]
for i,(body,hdr,land) in enumerate(pages,1):
    if hdr is None: out.append(f'<section class="page cover">{body}</section>')
    else: out.append(f'<section class="page{" land" if land else ""}"><div class="hdr"><span>Pipeline Explorer // Human Factors Proposal</span><span>{hdr}</span></div><div class="content">{body}</div><div class="ftr"><span>v1.5 · Oct 15 2026 · Prepared for Tim Pruitt</span><span class="st">Proposed — not authorized</span><span class="pn">{i:02d} / {N:02d}</span></div></section>')
js="<script>window.addEventListener('load',()=>{const r=[];document.querySelectorAll('.content').forEach((c,i)=>{if(c.scrollHeight>c.clientHeight+1)r.push('p'+(i+2)+':'+(c.scrollHeight-c.clientHeight)+'h');if(c.scrollWidth>c.clientWidth+1)r.push('p'+(i+2)+':w'+(c.scrollWidth-c.clientWidth));});document.body.setAttribute('data-overflow',r.join(',')||'none');});</script>"
doc=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pipeline Explorer — Human Factors Proposal &amp; Implementation Plan v1.5</title><style>{CSS}</style></head><body>{"".join(out)}{js}</body></html>'
open("/workspace/pe/build15/proposal.html","w").write(doc)
print("pages",N); print(toc)
