from look_common import *
F=FX['show'];C=F['closed'];T=F['top'];M=F['mid']
# Open view: closed rows never appear. History preset "Closed postings" shows them.
rows=thead()
rows+=trow(C['overall'],None,'·','Plant Manager','Ironbark Battery','Knoxville, TN','<span class="s">∅</span> Closed posting','$210K','High flex',70,'4d','—',sel=True,dim=True,i=0,bucket_cls='p')
rows+=trow(F['closed2']['overall'],None,'·','Head of Operations','Lumen Grid Storage','Columbia, SC','<span class="s">∅</span> Closed posting','$220K','No flex',55,'6d','—',dim=True,i=1,bucket_cls='p')
rows+=trow(F['closed3']['overall'],None,'·','Ops Director, Assembly','Sablewood Machines','Cleveland, TN','<span class="s">∅</span> Closed / dead','$195K','High flex',41,'9d','—',dim=True,i=2,bucket_cls='p')
hist=f'''<div class="panel" style="width:1112px"><div class="ph"><span class="t">History · closed postings · 3</span><span class="x">Preset: Closed postings still active + Closed / dead · never on Start</span></div>
<div style="display:flex;gap:0;border-bottom:1px solid var(--seam);padding:0 8px">{''.join(f'<span class="mono" style="padding:10px 12px;font-size:12px;letter-spacing:.06em;color:{"var(--c)" if t.startswith("History") else "var(--s)"};border-bottom:2px solid {"var(--c)" if t.startswith("History") else "transparent"}">{t}</span>' for t in ["Review queue","Decline candidates","My rulings","History · closed postings"])}</div>{rows}</div>'''
openv=f'''<div class="panel" style="width:1112px;margin-top:24px"><div class="ph"><span class="t">Review queue (open view) · excerpt</span><span class="x">Closed postings are not here: LIVENESS=CLOSED_* leaves every open view</span></div>{thead()}
{trow(T['overall'],T['band'],'+2','Director, Manufacturing Ops','Halvorsen Robotics','Nashville, TN','Needs decision','$235K','High flex',84,'2h','—',i=0)}
{trow(M['overall'],M['band'],'·','Plant Manager','Kestrel Mfg','Greenville, SC','Needs decision','$185K','No flex',62,'1d','—',i=1)}</div>'''
chips='<span class="chip">∅ posting closed</span><span class="chip">Needs decision · still active in master</span><span class="chip">High flex</span>'
sub='Ironbark Battery · Knoxville, TN · added 4d ago · Greenhouse'
banner='''<div style="margin:10px 16px 0;border:1px solid var(--outline);border-left:3px solid var(--s);background:var(--plate);padding:9px 12px;font-size:13.5px;line-height:1.45">
<div style="display:flex;justify-content:space-between"><span class="mono p" style="font-size:12px">∅ Posting closed · employer ATS</span><span class="c u" style="font-size:13px">Evidence ↗</span></div>
<span class="s">Greenhouse reported this posting closed on 18 Oct (LIVENESS=CLOSED_EMPLOYER_ATS, LIVENESS_ASOF 2026-10-18). It is hidden from Start and every open view. The master still files it as Needs decision; a lane will file it CLOSED_DEAD.</span></div>'''
bl=f'<div class="mono s" style="font-size:13px">Not ranked · closed posting</div><div class="s" style="font-size:13px;margin-top:4px">Score {C["overall"]} · outside the band population (open jobs only)</div><div class="s" style="font-size:13px;margin-top:4px">Δ none since your last review</div>'
evd=ev([('g','✓','Experience / content fit 70 · plant P&amp;L'),('g','✓','Degree FLEX: HIGH_FLEX'),('s','∅','Liveness: CLOSED_EMPLOYER_ATS · Greenhouse API · 18 Oct')])
dr=drawer(C,'JOB-0377',sub,chips,banner,evd,'',ring_col='var(--s)',band_line=bl,decisions_html=decisions(closed=True))
call=f'''
<div class="callout" style="left:1740px;top:150px;width:780px"><b>1 · Start and open views never show it</b><br>REV-011 behaviour survives the redesign: a row with LIVENESS=CLOSED_* leaves Start, Review queue and the map (APPLIED rows excepted: they stay in Applied). The open-view excerpt bottom-left has no closed rows.</div>
<div class="callout" style="left:1740px;top:285px;width:780px"><b>2 · History preset look</b><br>Rows appear only under History · closed postings. Whole row in Secondary text, no left bar, no band glyph, no band colour, score in Secondary. BUCKET cell reads "∅ Closed posting" (still active in master) or "∅ Closed / dead" (filed).</div>
<div class="callout" style="left:1740px;top:420px;width:780px"><b>3 · New glyph ∅ = posting closed</b><br>Distinct from ✕ Close (UI), ⊖ Decline, ⊗ failed write, ⊘ hard block. Drawn in Inter (covered glyph). Colour stays neutral: a closed posting is a fact, not a failure, so it is never red.</div>
<div class="callout" style="left:1740px;top:555px;width:780px"><b>4 · Drawer banner</b><br>Plate fill, 1 px #6B6B66 outline, 3 px Secondary left bar, Primary title, Secondary body, Cyan "Evidence ↗" (link = live colour). Names the source (ATS provider) and the check date from LIVENESS_METHOD / LIVENESS_ASOF.</div>
<div class="callout" style="left:1740px;top:690px;width:780px"><b>5 · Score kept, rank removed</b><br>The score is still what scoreRow() computes ({C['overall']}); the band is withheld because closed rows are outside the eligible-open population (v1.5.1 §3.1). Ring stroke Secondary #A3A39E.</div>
<div class="callout" style="left:1740px;top:825px;width:780px"><b>6 · Decisions</b><br>Pursue is disabled with its reason in words ("posting closed"; Seam outline, Secondary text: disabled controls are exempt from 3:1). Hold, Research, Decline stay available.</div>
'''
body=board_head('M-03','Closed posting · row + drawer banner','V-01 V-02 V-10 V-11 V-16')+f'<div style="position:absolute;left:40px;top:110px">{hist}{openv}</div><div style="position:absolute;left:1190px;top:110px">{dr}</div>'+call
open('m03.html','w').write(page(body,2560,1440))
