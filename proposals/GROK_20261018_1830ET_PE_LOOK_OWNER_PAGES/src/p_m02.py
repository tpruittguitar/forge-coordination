from look_common import *
F=FX['show'];A=F['agency'];T=F['top'];M=F['mid'];HD=F['hold']
rows=thead()
rows+=trow(T['overall'],T['band'],'+2','Director, Manufacturing Ops','Halvorsen Robotics','Nashville, TN','Needs decision','$235K','High flex',84,'2h','—',i=0)
rows+=trow(A['overall'],A['band'],'NEW','Director of Manufacturing','<span class="s">via</span> <span class="p">Keystone Recruiting Group</span>','Huntsville, AL','Needs decision','$235K','Soft flex',74,'3h','—',sel=True,i=1)
rows+=trow(M['overall'],M['band'],'·','Plant Manager','Kestrel Mfg','Greenville, SC','Needs decision','$185K','No flex',62,'1d','—',i=2)
rows+=trow(HD['overall'],'HOLD','·','Production Manager','Oakridge Cabinets','Atlanta, GA','Needs decision','$160K','Strict',60,'3d','—',i=3)
table=f'<div class="panel" style="width:1112px">{"<div class=ph><span class=t>Review queue · excerpt</span><span class=x>Sort: score ↓ · bands = percentile rank</span></div>"}{rows}</div>'
chips='<span class="chip">via agency · Keystone Recruiting Group</span><span class="chip">client unknown</span><span class="chip">Soft flex</span><span class="chip">$235K est.</span>'
sub='Keystone Recruiting Group (agency) · Huntsville, AL · posted 3h · LinkedIn'
banner='''<div style="margin:10px 16px 0;border:1px solid var(--seam);border-left:3px solid var(--outline);background:var(--plate);padding:8px 12px;font-size:13.5px;line-height:1.45">
<span class="mono p" style="font-size:12px">Agency posting · client not named</span><br>
<span class="s">The employer is hidden behind the agency. Two client searches done (title + city + pay; title + phrase). This is normal for agency rows and never delays the job.</span></div>'''
bl=f'<div class="mono g" style="font-size:13px">▲ TOP · #{A["rank"]} of {CUT["N"]} eligible open</div><div class="s" style="font-size:13px;margin-top:4px">as of {AS_OF} · score {A["overall"]} · relative rank, not a fit verdict</div><div class="s" style="font-size:13px;margin-top:4px">Coverage {A["confidence"]}% · culture unknown (client hidden)</div>'
evd=ev([('g','✓','Experience / content fit 74 · aerospace mfg leadership'),('a','≈','Degree FLEX: SOFT_FLEX (preferred wording)'),('g','✓','Geo 80 · nearest control pt Huntsville, AL'),('s','?','Company culture unknown · client not named · target list cannot be checked')])
why=f'<div class="lbl" style="margin-top:9px">Why</div><div style="font-size:15px;margin:3px 0 9px;line-height:1.4">Plant-scale mfg leadership in preferred geography; client unknown, so culture drops out and coverage falls to {A["confidence"]}%. <span class="c u">Fit &amp; Score ›</span></div>'
dr=drawer(A,'JOB-0588',sub,chips,banner,evd,why,band_line=bl)
call=f'''
<div class="callout" style="left:1190px;top:118px;width:0"></div>
<div class="callout" style="left:1740px;top:150px;width:780px"><b>1 · Row: "via &lt;Agency&gt;"</b><br>COMPANY cell reads "via" (Secondary) + agency name (Primary). No chip, no colour, no glyph in the row: an agency row is an ordinary job (Tim ruling 8, REV-014). Full text on hover / in the drawer.</div>
<div class="callout" style="left:1740px;top:270px;width:780px"><b>2 · Header chips</b><br>"via agency · &lt;name&gt;" and "client unknown" use the neutral chip: 1 px outline #6B6B66 (3.44:1 on Plate) + Secondary 11 px mono text (7.27:1). Never amber, never red, never ⊘.</div>
<div class="callout" style="left:1740px;top:390px;width:780px"><b>3 · Neutral info banner</b><br>Plate fill, 3 px left bar in Outline grey (#6B6B66), Primary title + Secondary body. Informational only: it states the fact and says it never delays the job.</div>
<div class="callout" style="left:1740px;top:510px;width:780px"><b>4 · Unknown culture = "?" + word, not ◌</b><br>◌ stays reserved for stale stored evidence (olive). An unknown component shows "?" in a 3 px Outline-grey evidence bar, a dashed empty track and the word "unknown" in the points column. It drops out of Σ and lowers coverage, exactly as scoreRow() does.</div>
<div class="callout" style="left:1740px;top:660px;width:780px"><b>5 · Breakdown adds up (V-16)</b><br>Points = weight × score ÷ Σ known weight ({sum(p['w'] for p in A['parts'] if p['known'])}%). Shown points sum to {A['rawShown']:.1f} (largest-remainder rounding to 0.1). Footer: coverage {A['confidence']}% → factor {A['factor']:.3f} → ring {A['overall']}. Header, ring and footer always show the same number.</div>
<div class="callout" style="left:1740px;top:810px;width:780px"><b>6 · Band = glyph + word + rank (V-19, V-20)</b><br>▲ TOP · #{A['rank']} of {CUT['N']} eligible open · {AS_OF}. Agency rows stay in the band population (they are open and eligible).</div>
<div class="callout" style="left:1740px;top:930px;width:780px"><b>7 · L-2 gap for Claude (not a visual call)</b><br>Today scoreRow() returns culture UNKNOWN only when COMPANY matches /recruit|confidential|hidden client|undisclosed|stealth/. An agency named e.g. "Aerotek" scores culture 40 ("not on target list") at coverage 100% instead of "? unknown" at {A['confidence']}% (score {F['agencyAerotek']['overall']} vs {A['overall']} for this mock; it can differ by a point or two). This drawing is valid only once culture() also treats EMPLOYER_PRIMARY_BUSINESS=RECRUITING_AGENCY / SCOUT_NOTES CLIENT=UNKNOWN as unknown.</div>
<div class="callout" style="left:1740px;top:1100px;width:780px"><b>8 · Decision row (V-01, V-02)</b><br>✓ Pursue green · ‖ Hold amber · Research neutral · ⊖ Decline Secondary text on a #6B6B66 outline. Red never appears on a decision control.</div>
'''
body=board_head('M-02','Agency posting · client unknown','V-01 V-02 V-03 V-04 V-10 V-11 V-16 V-19')+f'<div style="position:absolute;left:40px;top:110px">{table}</div><div style="position:absolute;left:1190px;top:110px">{dr}</div>'+call
open('m02.html','w').write(page(body,2560,1440))
