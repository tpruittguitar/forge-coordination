import re
B='/workspace/pe/build151/'
s=open(B+'gen15.py').read()
miss=[]
def R(a,b,need=True):
    global s
    if a not in s:
        if need: miss.append(a[:90])
        return
    s=s.replace(a,b)
R('<div>1.5 <span class="muted">(supersedes 1.4)</span></div>','<div>1.5.1 <span class="muted">(supersedes 1.5)</span></div>')
R('<div class="label">New in 1.5</div><div class="muted" style="font-size:10pt">Re-baselined on main (PRs #111–#115) · one shared scoring model, honest all-SHARED weights · Writer timed in seconds · percentile score bands · distinct glyphs · ◌ keyed on stale evidence · architecture phase before motion</div>',
  '<div class="label">New in 1.5.1</div><div class="muted" style="font-size:10pt">HCI review C#01–C#29 resolved under Tim\'s rulings · B-15 reduce-motion prompt · B-16 ticker controls · B-17 reticle as aiming marks · fixed percentile population + atomic band snapshot · ≤ 700 ms selection timeline · reduced-motion table · readback-confirmed decisions · CAS shared Undo · accessibility contract</div>')
R('v1.5 · Oct 15 2026 · Prepared for Tim Pruitt','v1.5.1 · Oct 15 2026 · Prepared for Tim Pruitt')
R('Implementation Plan v1.5</title>','Implementation Plan v1.5.1</title>',False)
R('Proposed · v1.5 · October 15, 2026.','Proposed · v1.5.1 · October 15, 2026. A second HCI gate (ChatGPT) runs before Phase 1B; Tim has final authority.')
R('sec("R","Changes in v1.5")','sec("R0","Changes in v1.5")')
# ---------- Changes in v1.5.1 ----------
C=r'''CH1=[("1","C#01","Percentile population","Bands rank ONE fixed population: eligible OPEN jobs minus STRICT / hard-blocked rows, never the current filter. Denominator, exclusions, ties (equal scores → higher band), minimum N 40, out-of-population display, “rank among N eligible open jobs · as of HH:MM”.","11.7","{{11.7}}","Adopted"),
("2","C#02","Cut-point tokens","Tokens hold percentile ranks P90 / P65 / P20; score cut-points computed at runtime from the snapshot; 61 / 54 / 38 labelled mock examples.","11.7 · 18","{{11.7}}","Adopted"),
("3","C#03 · C#24","Selection budget","Concurrency timeline: data at frame 1; materialize, ring, auto-fit 300 ms, lock-on 240 ms in parallel; ≤ 700 ms p95 end to end with 600+ rows. Stagger ≤ 250 ms on selection, off for bursts / large sets; order + hit-testing final from frame 1.","12.5","{{12.5}}","Adopted"),
("4","C#05","Loops ≤ 5 s (WCAG 2.2.2)","Every loop stops within 5 s; amber “waiting for Writer lock” breathe becomes steady amber + seconds counter + next-retry time after 5 s. Ticker per B-16.","12.5 · M-12","{{12.5}}","Adopted"),
("5","C#06","Decisions &amp; Undo","Receipt bound to record version at open + idempotency key; confirmed only after Writer readback, never on transport ack; Undo = verifiable inverse on the confirmed state; Decline writes only after a reason code; APPLIED / REJECTED_BY_EMPLOYER protection unchanged.","09.1 · HF-03","{{09.1}}","Adopted"),
("6","C#07","Seen-state","“Local-only” removed. Click is read-only; seen marks go to a debounced idempotent batch sync, separate from decisions, with visible sync status + repair; NEW markers consistent phone ↔ desktop.","09.1 · T-06","{{09.1}}","Adopted"),
("7","C#08","Reduced-motion table","One row per M-01..M-19 with its reduced equivalent; reduced mode never delays information. C#08 “OS wins by default” overridden by B-15.","12.6","{{12.6}}","Adopted · default overridden (B-15)"),
("8","C#23","Shared-model Undo","Restore previous revision\'s settings as a NEW revision sent with the current baseRevision; exact diff + current revision shown first; never blind-roll back an intervening publish.","09.1 · HF-19","{{09.1}}","Adopted · code confirms REVISION_CONFLICT"),
("9","C#09","Colour semantics","“One colour = one meaning” replaced by “meaning = colour + unique glyph + word + position”; no state by hue alone.","11.8 · 10","{{11.8}}","Adopted"),
("10","C#10","Colour-vision checks","Colours kept; glyph + word (TOP / UPPER / MID / LOW / HOLD) in table and map hover cards; protan / deutan / tritan, greyscale, low-light screenshots = Phase 3 gate.","11.8","{{11.8}}","Adopted"),
("11","C#11","Non-text contrast","Meaningful indicators ≥ 3:1 vs adjacent surface; Terminal Grey (2.67:1 on Plate) decoration-only beside a word; no Muted text below large size (incl. 11 px headers, 9.5 px ◌).","11.8 · 18","{{11.8}}","Adopted"),
("12","C#12","Combined flash testing","Whole-screen capture during concurrent pulses, scanlines, shakes; staggered by a flash scheduler.","11.8 · 12.5","{{11.8}}","Adopted"),
("13","C#13 · C#29","Focus","Persistent 2 px high-contrast focus ring on every interactive element; glow is not focus; never hidden under overlays; restored on drawer / map close; M-14 trace gets keyboard + touch equivalents.","11.8","{{11.8}}","Adopted"),
("14","C#14","Target sizes","Hit-area audit: ≥ 24 px or valid spacing exception on desktop; 44 pt on phone.","11.8","{{11.8}}","Adopted"),
("15","C#15","Focus order","Tab order rail › queue › map › workspace; focus after selection, fullscreen and close specified.","11.8","{{11.8}}","Adopted"),
("16","C#16","Glyph legibility","No glyph alone on a decision control; visible verb + accessible name; legend in help overlay; misclicks recorded in HF-14 baseline.","11.8 · 17.1","{{11.8}}","Adopted"),
("17","C#17","Relative vs absolute","Bands are relative rank; numeric score, absolute fit and ⊘ HOLD kept separate; top band never called “good fit”.","11.7","{{11.7}}","Adopted"),
("18","C#18 · C#04","Attention budget","Change strip primary; ticker secondary, throttled, routine bot events muted. C#18 “paused by default” overridden by B-16 (runs by default).","12.5 · 03.1","{{12.5}}","Adopted · default overridden (B-16)"),
("19","C#19","2560 grid","One grid equation incl. 12 px rail gap, borders, scrollbar; flexible tracks; test at 100 / 125 / 150 % zoom.","15.5","{{15.5}}","Adopted"),
("20","C#20","Mobile","Live safe-area insets only; both landscape rotations + desktop mode on simulator and real device; keep-out hatch colours are documentation only.","15.5 · 16","{{15.5}}","Adopted"),
("21","C#22","Atomic band snapshot","Publish modelRev + populationRev + cut-points together; every view renders from the same snapshot.","11.7","{{11.7}}","Adopted"),
("22","C#25","Page 33 hover card","“82 ✓ STRONG · $230K est.” confirmed on the rendered v1.5 page and replaced with “◆ UPPER · 57 · rank 9 of 412 eligible open · 14:32”.","13.1","{{13.1}}","Fixed"),
("23","C#26","KPI roll-up","Final value shown stably; roll is decorative overlay; only final changes announced.","12.6 · M-07","{{12.6}}","Adopted"),
("24","C#27","Card signal bar","3 px card bar added as token --pe-bar-card.","18","{{18}}","Adopted"),
("25","C#28","185 / 603","Live count with timestamp everywhere; mock figures labelled “as of”.","11.7 · T-02","{{11.7}}","Adopted"),
("26","—","T-04 progress","PR #116 (merged after the #115 read) removed “this browser” copy, added a read-only FLEX row so visible weights total 100, relabelled chip SHORTCUTS. §05.1 and T-04 updated.","05.1 · 17.8","{{05.1}}","✓ verified in code (16e7f18)"),
("B-15","C#08","Reduce motion","In-app toggle, OFF by default; OS prefers-reduced-motion → one-time prompt, never silent override.","03.1 · 12.6","{{03.1}}","Binding (Tim)"),
("B-16","C#04 · C#18","Event ticker","Runs by default; visible keyboard + touch Pause/Resume and Hide; choice persists locally; bursts deduplicated + throttled.","03.1 · 12.5","{{03.1}}","Binding (Tim)"),
("B-17","C#21","Reticle","r22 circle + r31 dashed circle kept as aiming marks: never expand, sweep, pulse or encode distance. Range rings stay banned.","03.1 · 13","{{03.1}}","Binding (Tim)"),
("—","C#08 (doctrine)","v1.2 exception","Not cited. Authority = B-07 (rich motion) + B-15..B-17. Doctrine rationale v1.1 governs.","03.1","{{03.1}}","Adopted")]
CT='<table class="tight" style="font-size:8pt;line-height:1.2"><tr><th style="width:24px">#</th><th style="width:52px">C#</th><th style="width:78px">Item</th><th>Resolution</th><th style="width:56px">Where</th><th style="width:22px;text-align:right">Pg</th><th style="width:80px">Disposition</th></tr>'
r1=lambda a,c,b,d,e,f,g: f'<tr><td class="id">{a}</td><td class="label" style="font-size:7pt">{c}</td><td><b>{b}</b></td><td class="small">{d}</td><td class="label" style="font-size:7pt">{e}</td><td class="num" style="text-align:right">{f}</td><td class="small" style="color:var(--t2)">{g}</td></tr>'
CMAP=[("C#01","1"),("C#02","2"),("C#03","3"),("C#04","B-16 · 18"),("C#05","4"),("C#06","5"),("C#07","6"),("C#08","7 · B-15 (default overridden)"),("C#09","9"),("C#10","10"),("C#11","11"),("C#12","12"),("C#13","13"),("C#14","14"),("C#15","15"),("C#16","16"),("C#17","17"),("C#18","18 · B-16 (“paused by default” declined)"),("C#19","19"),("C#20","20"),("C#21","B-17 (rings kept as aiming marks; “replace with brackets” declined)"),("C#22","21"),("C#23","8"),("C#24","3"),("C#25","22"),("C#26","23"),("C#27","24"),("C#28","25"),("C#29","13")]
cmr=lambda L:''.join(f'<tr><td class="id">{a}</td><td class="small">{b}</td></tr>' for a,b in L)
CMH='<table class="tight" style="font-size:8.4pt"><tr><th style="width:48px">Finding</th><th>Addressed by item</th></tr>'
sec("R","Changes in v1.5.1")
page(f"""<div class="sec">Revision</div><h1>Changes in v1.5.1</h1>
<p class="small muted" style="margin-top:-4px">Source: ChatGPT HCI / doctrine review of v1.5 (C#01–C#29, 2026-10-15 14:36 ET) and Tim\'s rulings (2026-10-15), which govern where they differ. Code checked read-only on <code>foreman-cockpit</code> main 16e7f18 (PR #116). Status <b style="color:var(--amber)">PROPOSED</b>. A second HCI gate (ChatGPT) runs before Phase 1B; Tim has final authority.</p>
{CT}{''.join(r1(*x) for x in CH1[:8])}</table>""","Changes in v1.5.1 (1/4)")
page(f"""<div class="sec">Revision · continued</div><h1 style="font-size:18pt">Changes in v1.5.1 (2/4)</h1>
{CT}{''.join(r1(*x) for x in CH1[8:19])}</table>""","Changes in v1.5.1 (2/4)")
page(f"""<div class="sec">Revision · continued</div><h1 style="font-size:18pt">Changes in v1.5.1 (3/4)</h1>
{CT}{''.join(r1(*x) for x in CH1[19:])}</table>""","Changes in v1.5.1 (3/4)")
page(f"""<div class="sec">Revision · continued</div><h1 style="font-size:18pt">Changes in v1.5.1 (4/4) — every C# finding</h1>
<div class="grid2" style="grid-template-columns:1fr 1fr;gap:10px">{CMH}{cmr(CMAP[:15])}</table>{CMH}{cmr(CMAP[15:])}</table></div>
<div class="grid3" style="margin-top:8px;gap:8px"><div class="card bar-a small" style="margin:0"><b>Declined or modified (Tim governs).</b> C#08 “OS preference wins by default” → B-15 in-app toggle OFF by default + one-time prompt. C#18 “ticker paused by default” → B-16 runs by default with Pause / Hide. C#21 option “replace circles with brackets / ticks” → B-17 keeps r22 / r31 as aiming marks. Nothing else declined.</div>
<div class="card bar-r small" style="margin:0"><b>Code vs review.</b> No contradictions. Confirmed in code: PR #116 copy / FLEX mirror row / SHORTCUTS chip; Writer <code>scoringPublishConflict_</code> rejects a publish with missing or stale <code>baseRevision</code> (REVISION_CONFLICT). Note: the in-app rating colour still uses fixed 75 / 50 thresholds (proposal only changes it).</div>
<div class="card bar-l small" style="margin:0"><b>Doctrine.</b> The governing rationale is v1.1; no v1.2 motion exception is cited. Motion authority: B-07 + B-15..B-17.</div></div>""","Changes in v1.5.1 (4/4)")


'''
i=s.index('CH=[("1","Re-baseline on main'); s=s[:i]+C+s[i:]
BD=r'''sec("03.1","Binding Decisions B-01 – B-17",1)
BDS=[("B-01","Dense 11-column table stays the desktop default."),("B-02","Map stays prominent: permanent centre panel."),("B-03","Map shows only the selected job; else the current filtered set."),("B-04","Targeting look kept (reticle / lock-on, grid, coordinates, brackets). No radar sweep, range rings, clusters."),("B-05","Fullscreen map below the tab bar; ✕ Close + Esc always visible."),("B-06","Scoring page is a general scoring page; retain and enhance."),("B-07","<b>Rich motion</b> wherever it makes a little sense — the motion authority, within HF-15 limits."),("B-08","Desktop primary target 2560 × 1440."),("B-09","Separate iPhone 18 Pro redesign: portrait, landscape, desktop mode."),("B-10","Mobile: generous perimeter padding."),("B-11","Camera keep-out top (portrait), left or right (landscape)."),("B-12","Duplicate tabs / cards / entry points consolidated."),("B-13","Black / neutral-grey military HUD; no blue tint."),("B-14","One-button updates with progress + Writer readback (on main, #112)."),
("B-15","<b>Reduce motion</b>: in-app toggle in Local preferences, <b>OFF by default</b>. If the OS reports <code>prefers-reduced-motion</code>, show a one-time prompt; never override silently. Every M-01..M-19 has a fully specified reduced equivalent (12.6)."),
("B-16","<b>Event ticker</b>: runs by default; visible, keyboard- and touch-operable <b>Pause / Resume</b> and <b>Hide</b>; choice persists locally; bot bursts deduplicated and throttled."),
("B-17","<b>Lock-on reticle</b> keeps its circle (r22) and dashed outer circle (r31) as <b>aiming marks</b>: they never expand, sweep, pulse or encode distance. Range rings stay banned.")]
bdh=''.join(f'<tr><td class="id">{a}</td><td class="small">{b}</td></tr>' for a,b in BDS)
page(f"""<div class="sec">Section 03.1 · B-15 – B-17 new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Binding Decisions (Tim; do not relitigate)</h1>
<table class="tight" style="font-size:9pt"><tr><th style="width:44px">ID</th><th>Decision</th></tr>{bdh}</table>
<div class="card bar-l small" style="margin-top:8px"><b>Doctrine.</b> The governing UI rationale is v1.1 (AI Change Rationale — UI Design Reference Doctrine). This proposal cites no other doctrine version; motion authority is B-07 plus B-15 – B-17. Where the HCI review and Tim differ, Tim governs.</div>""","03.1 · Binding Decisions")

'''
R('sec("04","Research Basis")',BD+'sec("04","Research Basis")')
D91=r'''sec("09.1","Decisions, Seen-state & Shared Undo",1)
page(f"""<div class="sec">Section 09.1 · new in v1.5.1</div><h1 style="font-size:18pt;margin-bottom:6px">Decisions, Seen-state &amp; Shared-model Undo</h1>
<div class="card bar-g small"><b>Decision receipts (HF-03 · C#06).</b><ul style="margin:3px 0 0"><li>Each decision carries the <b>record version seen at open</b> and an <b>idempotency key</b>; the receipt is bound to both.</li><li>States: waiting for Writer lock → writing → <b>confirmed only after Writer readback</b> matches (never on transport acknowledgement) | failed (⊗) | superseded (record changed since open).</li><li><b>Undo</b> is a verifiable inverse action on the confirmed state, itself receipted and read back; offered only while the record still holds the confirmed value.</li><li><b>Decline</b> (⊖) starts its write only after a reason code is chosen.</li><li>APPLIED / REJECTED_BY_EMPLOYER protection unchanged (#115).</li></ul></div>
<div class="card bar-a small"><b>Seen-state (HF-04 · T-06 · C#07).</b><ul style="margin:3px 0 0"><li>“Local-only” option removed. Opening a job is <b>read-only at the moment of click</b>.</li><li>Seen marks go into a <b>debounced, idempotent batch sync</b> (e.g. 10 s or 20 marks), separate from decisions and never blocking them.</li><li>Visible sync status (“Seen sync ✓ 14:32” / “◷ pending 3” / “⊗ failed · Retry”) with a repair path (retry, re-read server state).</li><li>NEW markers stay consistent across phone and desktop: server seen-state is authoritative; local queue merges by max timestamp.</li></ul></div>
<div class="card bar-l small"><b>Shared-model Undo (HF-19 · C#23).</b><ul style="margin:3px 0 0"><li>Undo = restore the previous revision\'s settings as a <b>NEW revision</b>, sent with the <b>current baseRevision</b>.</li><li>Before restoring: show the current revision, the exact field diff (current → restored) and any intervening publishes.</li><li>Never roll back an intervening publish blindly; if the live revision moved, the dialog re-diffs against it.</li><li><b>Code fact:</b> the Writer already rejects a publish built on an older or missing baseRevision (<code>scoringPublishConflict_</code> → REVISION_CONFLICT). The UI surfaces that as “revision N is now live — review diff”.</li></ul></div>""","09.1 · Decisions, Seen-state & Undo")

'''
R('sec("10","Visual Standards"); sec("11","Color System")',D91+'sec("10","Visual Standards"); sec("11","Color System")')
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
# 05.1 PR #116
R('("✓","Scores computed live",','("✓","PR #116 scoring copy (new)","“this browser” copy removed; heading “shared by every viewer and agent”; read-only “flex (set in FLEX card)” mirror row so visible weights total 100; Settings chip PRESENTATION ONLY → SHORTCUTS.","pipeline.html · pipeline-navigation.js · #116"),\n("✓","Shared publish CAS (new)","<code>scoringPublishConflict_</code> rejects a publish with missing or stale <code>baseRevision</code> → REVISION_CONFLICT.","Code.gs"),\n("✓","Scores computed live",')
R('· PRs #111–#115 · read-only code check','· PRs #111–#116 · read-only code check')
R('sec("05.1","Re-baseline Against Main (PRs #111–#115)",1)','sec("05.1","Re-baseline Against Main (PRs #111–#116)",1)')
R('"05.1 · Re-baseline Against Main")','"05.1 · Re-baseline Against Main")',False)
# colour semantics
R('"One color = one meaning everywhere:','"Meaning = colour + unique glyph + word + position (never hue alone):')
R('One glyph = one meaning. Weak, failed,','One glyph = one meaning; colour is never the only channel (11.8). Weak, failed,')
R('may be added, but each signal keeps exactly one meaning.','may be added; meaning is carried by colour + glyph + word + position, never hue alone.')
# HF text
R('"Decline (⊖) visually separated from Pursue; APPLIED / REJECTED_BY_EMPLOYER stay protected (#115)."]','"Confirmed only after Writer readback; receipt bound to record version + idempotency key; Undo is a verifiable inverse (09.1).","Decline (⊖) writes only after a reason code; APPLIED / REJECTED_BY_EMPLOYER stay protected (#115)."]')
R('"Hard limits: never blocks input · never hides true state · job selection settles ≤ 0.7 s total · p95 frame ≤ 16.7 ms · nothing flashes &gt; 3 / s."','"Hard limits: never blocks input · never hides true state · job selection ≤ 0.7 s p95 end to end (12.5) · p95 frame ≤ 16.7 ms · ≤ 3 flashes / s whole-screen · every loop stops within 5 s.","Reduce motion per B-15 with reduced equivalents (12.6)."')
# motion catalog
R('("G4","Reduce motion toggle","Settings › Local preferences › <b>Reduce motion</b>, <b>off by default</b> (operator decision).','("G4","Reduce motion toggle (B-15)","Settings › Local preferences › <b>Reduce motion</b>, <b>off by default</b> (B-15); full reduced equivalents in 12.6.')
R('Tim Pruitt explicitly chose a <b>high-motion HUD</b> (v1.3; kept in v1.4 minus the radar sweep).','Tim Pruitt explicitly chose a <b>high-motion HUD</b> (B-07; refined by B-15 – B-17).')
R('· fit 600 ms · ease-inout; any manual pan / zoom cancels it.','· fit 300 ms on selection (600 ms for filter-set fits) · ease-inout; any manual pan / zoom cancels it.')
R('reticle rotates 90°, crosshairs extend, coordinates type on · lock 320 ms · snap."','reticle rotates 90°, crosshairs extend, coordinates type on · lock 240 ms · snap. r22 / r31 circles are aiming marks (B-17): never expand, sweep, pulse or encode distance."')
R('"Digits roll to the new value · roll 800 ms. Final value written at once; screen readers get the final value only."','"Final value shown stably at once; the roll is a decorative overlay beside it · 800 ms. Only final changes are announced (aria-live polite)."')
R('"Rows rise 6 px + fade, 18 ms step, capped at 30 rows."','"Rows rise 6 px + fade; total ≤ 250 ms on selection; off for bursts and sets &gt; 30 rows; order and hit-testing final from frame 1."')
R('"1 px cyan trace runs once around the control border · fast 120 ms + sweep."','"1 px cyan trace once around the border · 120 ms; keyboard focus and touch press get the static 2 px focus ring (never glow-only)."')
R('"Bottom feed scrolls ← at 40 px/s; pauses on hover / focus."','"Runs by default (B-16) at 40 px/s; visible ❚❚ Pause / ▶ Resume and Hide (keyboard + touch), choice persisted; bursts deduped + throttled; routine bot events muted."')
R("Seconds scale. <span style='color:var(--amber)'>◷ waiting for Writer lock: amber breathe + “N s”, next retry 8 / 15 / 30 / 45 s</span>","Seconds scale. <span style='color:var(--amber)'>◷ waiting for Writer lock: amber breathe ≤ 5 s, then steady amber + “N s · next retry M s” (8 / 15 / 30 / 45 s)</span>")
R('("--pe-motion-lock","320ms","snap","Map lock-on brackets / reticle"),','("--pe-motion-lock","240ms","snap","Map lock-on brackets / reticle"),')
R('("--pe-motion-fit","600ms","ease-inout","Map auto-fit pan / zoom to job or filtered set"),','("--pe-motion-fit","300ms","ease-inout","Map auto-fit on selection (filter-set fit 600 ms)"),')
R('("--pe-motion-breathe","1600ms loop","ease-inout","Waiting-for-lock amber breathe"),','("--pe-motion-breathe","1600ms · ≤ 5 s","ease-inout","Waiting-for-lock breathe, then steady"),')
R('<b>Smooth animated auto-fit</b> (M-04, 600 ms)','<b>Smooth animated auto-fit</b> (M-04, 300 ms on selection)')
R('animated auto-fit (600 ms) instead of fixed 600 %','animated auto-fit (300 ms) instead of fixed 600 %')
R('("1","Auto-fit (M-04)","Animated pan + zoom to job or set bounds · 600 ms · interruptible."),','("1","Auto-fit (M-04)","Animated pan + zoom · 300 ms on selection · interruptible."),')
R('("Removed in v1.4","<b>Radar sweep</b> (map and loading), range rings + ticks,','("Removed (B-04 / B-17)","<b>Radar sweep</b> (map and loading), range rings + ticks (the lock-on r22 / r31 circles are aiming marks, not range rings),')
R('with glyph + word in the hover card;','with glyph + word + “rank among N eligible open · as of HH:MM” in the hover card;')
# 185 occurrences
R('<b>185 of 603</b> FLEX values stamped under an older DEGREE_FLEX rule;','a live count (<b>185 of 603</b> as of the Oct 15 03:00 ET inventory) of FLEX values stamped under an older DEGREE_FLEX rule;')
R('scoring rev 24; 185 of 603 FLEX evidence values stamped under an older rule;','scoring rev 24; stale FLEX evidence count (185 of 603 at inventory time);')

R('predates the current rule (185 / 603) or','predates the current rule (live count, e.g. 185 of 603 · as of 03:00 ET) or')
R('Stored FLEX evidence: <b>185 of 603</b> stamped under an older rule,','Stored FLEX evidence: <b>185 of 603</b> (snapshot at inventory) stamped under an older rule,')
R('(185 / 603 FLEX values under an older rule;','(live count with “as of”; 185 of 603 at inventory;')
R('◌ 185 stale.','◌ stale count (live).')
R('KPIs incl. ◌ 185,','KPIs incl. ◌ live count + as-of,')

R('("T-02","Stale-evidence count (185 / 603) in Settings card C, System drawer and KPI strip; Review refresh shows progress"','("T-02","Live stale-evidence count with as-of timestamp (never hard-coded) in Settings card C, System drawer and KPI strip; Review refresh shows progress"')
# T-04/T-06
R('("T-04","Honest weights: one table of 8 SHARED rows = 100 (rev 24); fix stale “this browser” copy","Settings","HF-19","1"),','("T-04","Honest weights: one table of 8 SHARED rows = 100 (rev 24). <b>Partly done in PR #116</b> (copy fixed, read-only FLEX mirror row, chip SHORTCUTS); remaining: scope badges, Fit &amp; Score parity","Settings","HF-19","1"),')
R('("T-06","Opening a job never writes (openRow → syncStateUp confirmed); seen-state local-only or batched-explicit + receipted;','("T-06","Job open read-only at click (openRow → syncStateUp today); seen marks in a debounced idempotent batch sync with visible status + repair, consistent phone ↔ desktop (no local-only option);')
R('"Opening a job never writes (<code>openRow → syncStateUp</code> today); debounce','"Opening a job is read-only at click; seen marks batch-synced (09.1); debounce')
R('"<b>Honest weights</b>: one all-SHARED table summing to 100 (rev 24) on Settings and in Fit &amp; Score; fix stale “this browser” copy; reconcile','"<b>Honest weights</b>: one all-SHARED table summing to 100 (rev 24) on Settings and in Fit &amp; Score (copy + FLEX row done in #116); reconcile')
R('"Make the Compact toggle work or remove it.",','"Make the Compact toggle work or remove it.","Second HCI gate (ChatGPT) on v1.5.1 before Phase 1B starts.",',False)
R('"Flash audit harness: nothing &gt; 3 flashes / s."],','"Flash audit harness: whole-screen capture, nothing &gt; 3 flashes / s; loops stop ≤ 5 s.","Gate entry: second HCI review (ChatGPT) of v1.5.1 completed and reviewed by Tim."],')
R('"Selection ≤ 0.7 s p95 over 50 selections"','"Selection ≤ 0.7 s p95 end to end with 600+ rows over 50 selections"')
# tokens
R('("--pe-text-muted","#6B6B66","large text only")','("--pe-text-muted","#6B6B66","large text only; never 11 px headers or ◌")')
R('("--pe-terminal","#5A5A5A","closed / Decline")','("--pe-terminal","#5A5A5A","decoration beside a word only (2.67:1 on Plate)")')
R('("--pe-band-cut-top","61","P90, recomputed"),("--pe-band-cut-upper","54","P65"),("--pe-band-cut-low","38","P20"),','("--pe-band-rank-top","0.90","P90 percentile rank"),("--pe-band-rank-upper","0.65","P65"),("--pe-band-rank-low","0.20","P20"),("--pe-band-min-n","40","hide bands below"),')
R('("--pe-bar","2px","signal left bar")','("--pe-bar","2px","signal left bar"),("--pe-bar-card","3px","card signal bar"),("--pe-focus-ring","2px solid #E6E6E2","+ 2px Void offset")')
R('("--pe-motion-lock","320ms")','("--pe-motion-lock","240ms")')
R('("--pe-motion-fit","600ms")','("--pe-motion-fit","300ms"),("--pe-motion-fit-set","600ms"),("--pe-loop-max","5s"),("--pe-stagger-max","250ms")')
R('{ --pe-motion-breathe: 0ms; --pe-motion-fit: 120ms; <span class="c">/* off by default */</span> }','{ <span class="c">/* B-15: off by default; full table in 12.6 */</span> --pe-motion-breathe: 0ms; --pe-motion-fit: 0ms; --pe-motion-lock: 0ms; --pe-motion-sweep: 0ms; --pe-motion-roll: 0ms; --pe-motion-stagger: 0ms; }')
R('<b>Reduce motion</b> (Settings, off by default) swaps loops to 0 and slides to <code>--pe-motion-fast</code> fades.','<b>Reduce motion</b> (B-15: Local preferences, off by default; OS preference prompts once) applies the 12.6 table.')
R("<span class=\"c\">/* PE tokens · v1.5 */</span>","<span class=\"c\">/* PE tokens · v1.5.1 */</span>")
# acceptance
R('("<b>v1.5</b> · Glyphs with &gt; 1 meaning","0")]','("<b>v1.5</b> · Glyphs with &gt; 1 meaning","0"),("<b>v1.5.1</b> · Loops running &gt; 5 s","0"),("<b>v1.5.1</b> · Views on different band snapshots","0"),("<b>v1.5.1</b> · Confirmed without readback","0"),("<b>v1.5.1</b> · Indicators &lt; 3:1 non-text contrast","0")]')
R('("<b>v1.5</b> · Job selection settles (incl. motion)","≤ 0.7 s")','("<b>v1.5</b> · Job selection settles, end to end, 600+ rows","≤ 0.7 s p95")')
R('("<b>v1.5</b> · Flashes per second","≤ 3")','("<b>v1.5</b> · Flashes per second (whole screen)","≤ 3")')
s=s.replace('.toc .row{break-inside:avoid;display:flex;align-items:baseline;padding:2.5px 0;','.toc .row{break-inside:avoid;display:flex;align-items:baseline;padding:1px 0;')
s=s.replace('.toc .t{font-size:10.5pt!important}.toc .sub .t{font-size:10pt!important}','.toc .t{font-size:9.2pt!important}.toc .sub .t{font-size:8.8pt!important}')
R('("✓","Score tester","Pick one job, move every scoring setting, see its rating live, save as the ruling model.","pipeline.html (Model tester) · #112"),\n("✓","OPEN preset default","Applied and closed jobs filtered out by default (preset OPEN, “Open roles”).","pipeline.html · #111"),',
  '("✓","Score tester · OPEN default","One-job tester saves as ruling model (#112); preset OPEN hides applied / closed (#111).","pipeline.html"),')
R('("✓","Selection lag fixed","Memoized scoring config, 32 s → ~0.55–0.7 s.","#113"),\n','')
R('Apps Script <code>waitLock(30000)</code>; refuses when busy;','Selection lag fixed (#113, 32 s → ~0.6 s). <code>waitLock(30000)</code>; refuses when busy;')
s=s.replace('<table class="tight" style="font-size:8.3pt;line-height:1.2"><tr><th style="width:18px"></th>','<table class="tight" style="font-size:7.8pt;line-height:1.15"><tr><th style="width:18px"></th>')
s=s.replace('<table class="tight"><tr><th>Weight</th><th style="width:52px;text-align:right">Rev 24</th>','<table class="tight" style="font-size:8pt;line-height:1.1"><tr><th>Weight</th><th style="width:52px;text-align:right">Rev 24</th>')
s=s.replace('<table class="tight" style="font-size:8.2pt;line-height:1.18">{CH_}','<table class="tight" style="font-size:7.8pt;line-height:1.15">{CH_}')
s=s.replace('<table class="tight" style="font-size:8.2pt;line-height:1.18"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th>','<table class="tight" style="font-size:7.8pt;line-height:1.15"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th>')
s=s.replace('<pre style="font-size:8.4pt;line-height:1.5"><span class="c">ONE GRID EQUATION','<pre style="font-size:7.2pt;line-height:1.45;white-space:pre-wrap"><span class="c">ONE GRID EQUATION')
s=s.replace('<pre style="font-size:7.6pt;line-height:1.3;margin:0;column-count:2;column-gap:14px">','<pre style="font-size:6.9pt;line-height:1.28;margin:0;column-count:2;column-gap:10px">')
s=s.replace('<table class="tight"><tr><th>Measure</th>','<table class="tight" style="font-size:8.4pt;line-height:1.15"><tr><th>Measure</th>')
R('185 stale evidional;','stale evidence (live count, 185 at inventory);')
R('◌ on the 185 stale evidence values;','◌ on every stale evidence value (live count + as-of);')
s=s.replace('<table class="tight" style="font-size:7.8pt;line-height:1.15">{CH_}{ct(CAT[3:])}</table>','<table class="tight" style="font-size:7.8pt;line-height:1.15">{CH_}{ct(CAT[3:12])}</table>""","12 · Motion System — Catalog")\npage(f"""<div class="sec">Section 12 · continued</div><h1 style="font-size:18pt;margin-bottom:8px">Motion Catalog (3/3)</h1>\n<table class="tight" style="font-size:7.8pt;line-height:1.15">{CH_}{ct(CAT[12:])}</table>')
s=s.replace('Motion Catalog (2/2)</h1>','Motion Catalog (2/3)</h1>')
R('"Confirmed only after Writer readback; receipt bound to record version + idempotency key; Undo is a verifiable inverse (09.1).",','"Confirmed only after readback; receipt bound to version + idempotency key (09.1).",')
open(B+'gen151.py','w').write(s)
print('MISSES',len(miss))
for m in miss: print(' -',m)
