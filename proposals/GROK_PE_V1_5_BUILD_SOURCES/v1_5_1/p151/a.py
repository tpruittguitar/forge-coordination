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
