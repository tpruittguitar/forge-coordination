sec("13","Map System")
MK=[("Purpose (design authority)","The pipeline map shows <b>only the selected job's location</b>, or — with nothing selected — <b>the jobs in the current filtered selection</b> (Jobs, Review queue, Decline candidates, My rulings + View &amp; filters). Today's behaviour, Tim's binding rule.","a"),
("Retained look","Black field, grey outlines, mono state labels, zoom readout, + / − / layers, RECENTER, RESET, legend, Home — current style, only enhanced.","t"),
("Targeting layer","Reticle + crosshairs + corner-bracket <b>lock-on</b> on the selected job (M-05); HUD corner brackets on the panel; centre-of-view crosshair.","l"),
("Grid &amp; readouts","Graticule (1° minor, 5° major) with edge coordinates; selected job lat / long, range + bearing from Home, nearest geo control point and its score; cursor coordinates.","l"),
("Pins","One pin per job in the filtered selection, <b>coloured by score band</b> (✓ Strong · ◷ Watch · ✕ Weak) with icon + word in the hover card; ◌ provisional pins get an olive ring; remote jobs counted in the header.","g"),
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
