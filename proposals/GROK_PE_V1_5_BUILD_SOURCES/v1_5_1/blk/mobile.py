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
mob=[("A","Queue","KPI strip with ◌ provisional, change strip, top card mid-swipe → Pursue (haptic at threshold), queued receipt with Undo; floating tab bar inset 36 pt and lifted above the home indicator."),
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
