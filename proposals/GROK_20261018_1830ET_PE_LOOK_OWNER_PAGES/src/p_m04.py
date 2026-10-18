from look_common import *
F=FX['show'];A=F['applied'];B=F['appliedTim']
chips='<span class="chip" style="border-color:var(--g);color:var(--g)">✓ Applied · 16 Oct</span><span class="chip">Soft flex</span><span class="chip">$230K est.</span>'
sub='Cobalt Aerostructures · Huntsville, AL · LinkedIn'
banner='''<div style="margin:10px 16px 0;border:1px solid var(--outline);border-left:3px solid var(--g);background:var(--plate);padding:9px 12px;font-size:13.5px;line-height:1.5">
<div style="display:flex;justify-content:space-between"><span class="mono g" style="font-size:12px">✓ Applied · 16 Oct 2026</span><span class="mono s" style="font-size:11px">Source</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span class="chip p" style="border-color:var(--outline)">@ Email evidence</span><span class="p">Gmail confirmation</span><span class="c u" style="margin-left:auto">Open in Gmail ↗</span></div>
<div class="s" style="margin-top:5px">“Thank you for applying – Director, Production Operations” · careers@cobaltaero.example · 16 Oct 09:42</div>
<div style="border-top:1px solid var(--seam);margin-top:8px;padding-top:7px"><span class="s">Your earlier decision </span><span class="p">⊖ Decline · 15 Oct</span><span class="s"> was superseded: an email confirmation records APPLIED even over a decline (REV-014).</span></div></div>'''
bl=f'<div class="mono s" style="font-size:13px">Not ranked · applied</div><div class="s" style="font-size:13px;margin-top:4px">Score {A["overall"]} · applied jobs are outside the band population</div><div class="s" style="font-size:13px;margin-top:4px">Protected state: Decline and identity changes refused</div>'
evd=ev([('g','✓','Experience / content fit 78 · aerostructures production'),('a','≈','Degree FLEX: SOFT_FLEX (preferred wording)'),('g','✓','Application: APP_DATE 2026-10-16 · APP_STATUS_EVIDENCE = Gmail message')])
dr=drawer(A,'JOB-0451',sub,chips,banner,evd,'',ring_col='var(--s)',band_line=bl,decisions_html=decisions(applied=True),tab='Overview')
# variant: Tim click source (compact banner only)
banner2='''<div class="panel" style="width:508px;border-top:2px solid var(--c);padding:12px 16px">
<div class="mono c" style="font-size:12px">◉ Job drawer · JOB-0402 · variant: your click</div>
<div style="font-size:21px;font-weight:650;margin-top:4px">Sr. Dir., Operations</div><div class="s" style="font-size:14px">Bayline Medical Devices · Tampa, FL</div>
<div style="margin-top:10px;border:1px solid var(--outline);border-left:3px solid var(--g);background:var(--plate);padding:9px 12px;font-size:13.5px;line-height:1.5">
<div style="display:flex;justify-content:space-between"><span class="mono g" style="font-size:12px">✓ Applied · 14 Oct 2026</span><span class="mono s" style="font-size:11px">Source</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span class="chip p">You · Explorer click</span><span class="p">Recorded from Pipeline Explorer</span></div>
<div class="s" style="margin-top:5px">“Tim direct statement via Pipeline Explorer 2026-10-14” · Writer-confirmed (readback)</div>
<div class="s" style="margin-top:5px">No email confirmation found yet. If one arrives, it is added here as a second source.</div></div></div>'''
call=f'''
<div class="callout" style="left:1740px;top:150px;width:780px"><b>1 · Where APPLIED came from, first</b><br>Green ✓ banner (confirmed state) directly under the title. One "Source" line with a neutral chip: "@ Email evidence" (Gmail confirmation) or "You · Explorer click". Date is APP_DATE; quote is APP_STATUS_EVIDENCE.</div>
<div class="callout" style="left:1740px;top:290px;width:780px"><b>2 · Source rule (derivation, no new number)</b><br>APP_STATUS_EVIDENCE starting "Tim direct statement via Pipeline Explorer" → You · Explorer click (Code.gs writes that text). A Gmail message ID → Email evidence, with an "Open in Gmail ↗" link built from the ID. Anything else → "Other evidence" + the quote.</div>
<div class="callout" style="left:1740px;top:430px;width:780px"><b>3 · Superseded decision</b><br>When TIM_RULING was a decline and email proves the application, the banner names the old decision (⊖ Decline · date) and the rule that overrode it. Primary for the decision, Secondary for the explanation. No red: nothing failed.</div>
<div class="callout" style="left:1740px;top:570px;width:780px"><b>4 · Protected state replaces the decision row</b><br>APPLIED / REJECTED_BY_EMPLOYER: the Writer refuses Decline and identity changes, so the drawer shows the protection notice and a disabled "⊖ Decline · unavailable" (Seam outline, words state why). Unchanged from v1.5.1 HF-03.</div>
<div class="callout" style="left:1740px;top:710px;width:780px"><b>5 · Score kept, rank removed</b><br>Score {A['overall']} from scoreRow(); no band (applied rows are outside the eligible-open population). Ring Secondary.</div>
<div class="callout" style="left:1740px;top:830px;width:780px"><b>6 · Variant · your click</b> (left, compact)<br>Same banner, chip "You · Explorer click", Writer-confirmed note. If an email later arrives, both sources are listed, newest first.</div>
'''
body=board_head('M-04','Drawer · APPLIED from email evidence','V-01 V-04 V-10 V-11 V-16')+f'<div style="position:absolute;left:1190px;top:110px">{dr}</div><div style="position:absolute;left:40px;top:110px">{banner2}</div>'+call
open('m04.html','w').write(page(body,2560,1440))
